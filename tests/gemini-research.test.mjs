import assert from "node:assert/strict";
import test from "node:test";

import {
  createGeminiResearchHttpHandlers,
  getGeminiResearchConfigurationStatus,
} from "../lib/gemini-research.ts";

const sha256 = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
};

const key = "test-gemini-key-never-return-this-value";
const readyEnvironment = async (overrides = {}) => ({
  GEMINI_API_KEY: key,
  GEMINI_RESEARCH_FREE_TIER_CONFIRMED: "true",
  GEMINI_RESEARCH_VERIFIED_MODEL: "gemini-2.5-flash",
  GEMINI_RESEARCH_PROJECT_ID: "test-free-project",
  GEMINI_RESEARCH_KEY_SHA256: await sha256(key),
  ...overrides,
});

const request = (body = { query: "研究欧洲眼镜零售趋势" }, headers = {}) => new Request(
  "https://lead.example.test/api/research/gemini",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://lead.example.test",
      "Sec-Fetch-Site": "same-origin",
      ...headers,
    },
    body: JSON.stringify(body),
  },
);

const groundedPayload = ({
  answer = "研究结果可靠。",
  startIndex = 0,
  endIndex = new TextEncoder().encode("研究结果").byteLength,
  segmentText = "研究结果",
  uri = "https://source.example.test/report",
  modelVersion = "gemini-2.5-flash-001",
  grounding = true,
} = {}) => ({
  ...(modelVersion === undefined ? {} : { modelVersion }),
  candidates: [{
    content: { parts: [{ text: answer }] },
    ...(grounding ? {
      groundingMetadata: {
        webSearchQueries: ["欧洲眼镜零售趋势"],
        searchEntryPoint: { renderedContent: "<div>Google Search</div>" },
        groundingChunks: [{ web: { uri, title: "公开行业报告" } }],
        groundingSupports: [{
          segment: { startIndex, endIndex, text: segmentText },
          groundingChunkIndices: [0],
        }],
      },
    } : {}),
  }],
  usageMetadata: {
    promptTokenCount: 12,
    candidatesTokenCount: 8,
    thoughtsTokenCount: 3,
    totalTokenCount: 23,
  },
});

const jsonResponse = (body, status = 200, headers = {}) => new Response(
  typeof body === "string" ? body : JSON.stringify(body),
  {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  },
);

test("free-tier gate binds the confirmed model, project and exact API key hash", async () => {
  const environment = await readyEnvironment();
  assert.deepEqual(await getGeminiResearchConfigurationStatus(environment), {
    ready: true,
    model: "gemini-2.5-flash",
    reason: null,
  });
  assert.equal((await getGeminiResearchConfigurationStatus({
    ...environment,
    GEMINI_RESEARCH_FREE_TIER_CONFIRMED: "false",
  })).reason, "free_tier_not_confirmed");
  assert.equal((await getGeminiResearchConfigurationStatus({
    ...environment,
    GEMINI_RESEARCH_MODEL: "gemini-custom",
  })).reason, "verified_model_mismatch");
  assert.equal((await getGeminiResearchConfigurationStatus({
    ...environment,
    GEMINI_RESEARCH_PROJECT_ID: "",
  })).reason, "project_id_missing");
  assert.equal((await getGeminiResearchConfigurationStatus({
    ...environment,
    GEMINI_RESEARCH_KEY_SHA256: "0".repeat(64),
  })).reason, "key_hash_mismatch");
});

test("GET exposes only readiness and the configurable default model with no-store", async () => {
  const environment = await readyEnvironment({
    GEMINI_RESEARCH_MODEL: "gemini-2.5-flash-custom",
    GEMINI_RESEARCH_VERIFIED_MODEL: "gemini-2.5-flash-custom",
  });
  const handlers = createGeminiResearchHttpHandlers({ environment });
  const response = await handlers.GET();
  const serialized = await response.clone().text();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    ready: true,
    model: "gemini-2.5-flash-custom",
    reason: null,
  });
  assert.doesNotMatch(serialized, new RegExp(key));
});

test("POST performs one generateContent call with google_search and returns verified grounded DTO", async () => {
  const environment = await readyEnvironment();
  const calls = [];
  const logs = [];
  const times = [1_000, 1_275];
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    now: () => times.shift(),
    logger: (entry) => logs.push(entry),
    fetcher: async (url, init) => {
      calls.push({ url: String(url), init });
      return jsonResponse(groundedPayload());
    },
  });
  const response = await handlers.POST(request());
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /gemini-2\.5-flash:generateContent$/u);
  assert.equal(calls[0].init.headers["x-goog-api-key"], key);
  const upstreamBody = JSON.parse(calls[0].init.body);
  assert.deepEqual(upstreamBody.tools, [{ google_search: {} }]);
  assert.equal(result.requestedModel, "gemini-2.5-flash");
  assert.equal(result.returnedModel, "gemini-2.5-flash-001");
  assert.equal(result.groundingStatus, "verified");
  assert.deepEqual(result.supports, [{ startIndex: 0, endIndex: 4, sourceIndices: [0] }]);
  assert.deepEqual(result.usage, {
    promptTokens: 12,
    outputTokens: 8,
    thoughtTokens: 3,
    totalTokens: 23,
  });
  assert.equal(result.durationMs, 275);
  assert.equal(result.searchSuggestionHtml, "<div>Google Search</div>");
  assert.equal(logs[0].status, "success");
  assert.equal(logs[0].durationMs, 275);
  assert.equal(logs[0].upstreamHttpStatus, 200);
  assert.doesNotMatch(JSON.stringify(result), new RegExp(key));
  assert.doesNotMatch(JSON.stringify(logs), /研究欧洲眼镜零售趋势/u);
});

test("missing grounding and unsafe URLs are returned as unverified without unsafe citations", async () => {
  const environment = await readyEnvironment();
  for (const payload of [
    groundedPayload({ grounding: false }),
    groundedPayload({ uri: "javascript:alert(1)" }),
  ]) {
    const handlers = createGeminiResearchHttpHandlers({
      environment,
      fetcher: async () => jsonResponse(payload),
    });
    const result = await (await handlers.POST(request())).json();
    assert.equal(result.groundingStatus, "unverified");
    if (payload.candidates[0].groundingMetadata) {
      assert.deepEqual(result.citations, []);
      assert.deepEqual(result.supports, []);
    }
  }

  const misaligned = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => jsonResponse(groundedPayload({ segmentText: "错位文本" })),
  });
  assert.equal(
    (await (await misaligned.POST(request())).json()).groundingStatus,
    "unverified",
  );

  const missingModelPayload = groundedPayload({ modelVersion: null });
  const missingSuggestionPayload = groundedPayload();
  delete missingSuggestionPayload.candidates[0].groundingMetadata.searchEntryPoint;
  for (const payload of [missingModelPayload, missingSuggestionPayload]) {
    const handlers = createGeminiResearchHttpHandlers({
      environment,
      fetcher: async () => jsonResponse(payload),
    });
    const result = await (await handlers.POST(request())).json();
    assert.equal(result.groundingStatus, "verified");
  }
  assert.equal((await (await createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => jsonResponse(missingSuggestionPayload),
  }).POST(request())).json()).searchSuggestionHtml, null);
});

test("bad JSON, timeout and upstream status errors use safe Chinese responses", async () => {
  const environment = await readyEnvironment();
  const cases = [
    [401, "gemini_authentication_failed", 502],
    [403, "gemini_access_denied", 502],
    [404, "gemini_model_not_found", 502],
    [429, "gemini_rate_limited", 429],
  ];
  for (const [upstreamStatus, code, expectedStatus] of cases) {
    const logs = [];
    const handlers = createGeminiResearchHttpHandlers({
      environment,
      logger: (entry) => logs.push(entry),
      fetcher: async () => jsonResponse("secret upstream failure", upstreamStatus),
    });
    const response = await handlers.POST(request());
    const result = await response.json();
    assert.equal(response.status, expectedStatus);
    assert.equal(result.error, code);
    assert.equal(logs[0].upstreamHttpStatus, upstreamStatus);
    assert.ok(Number.isInteger(logs[0].durationMs) && logs[0].durationMs >= 0);
    assert.doesNotMatch(JSON.stringify(result), /secret upstream failure/u);
  }

  const badJsonHandlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => jsonResponse("not-json"),
  });
  const badJson = await badJsonHandlers.POST(request());
  assert.equal(badJson.status, 502);
  assert.equal((await badJson.json()).error, "gemini_invalid_response");

  const timeoutHandlers = createGeminiResearchHttpHandlers({
    environment,
    timeoutMs: 5,
    fetcher: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true });
    }),
  });
  const timeout = await timeoutHandlers.POST(request());
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error, "gemini_timeout");
});

test("POST requires same-origin JSON and configuration readiness", async () => {
  const environment = await readyEnvironment();
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => assert.fail("request must not reach Gemini"),
  });
  const crossOrigin = await handlers.POST(request(undefined, { Origin: "https://evil.example" }));
  assert.equal(crossOrigin.status, 403);
  assert.equal(crossOrigin.headers.get("cache-control"), "private, no-store");

  const wrongType = new Request("https://lead.example.test/api/research/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      Origin: "https://lead.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    body: "research",
  });
  assert.equal((await handlers.POST(wrongType)).status, 415);

  const notReady = createGeminiResearchHttpHandlers({
    environment: { ...environment, GEMINI_RESEARCH_FREE_TIER_CONFIRMED: "false" },
    fetcher: async () => assert.fail("request must not reach Gemini"),
  });
  const unavailable = await notReady.POST(request());
  assert.equal(unavailable.status, 503);
  assert.equal((await unavailable.json()).error, "free_tier_not_confirmed");
});

test("one warm isolate rejects concurrent research without a second Gemini call", async () => {
  const environment = await readyEnvironment();
  let release;
  const upstream = new Promise((resolve) => { release = resolve; });
  let calls = 0;
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => {
      calls += 1;
      return upstream;
    },
  });
  const first = handlers.POST(request());
  await new Promise((resolve) => setImmediate(resolve));
  const second = await handlers.POST(request({ query: "第二项研究" }));
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error, "gemini_research_in_progress");
  assert.equal(calls, 1);
  release(jsonResponse(groundedPayload()));
  assert.equal((await first).status, 200);
});

test("request and response size limits fail closed before parsing oversized content", async () => {
  const environment = await readyEnvironment();
  let calls = 0;
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => {
      calls += 1;
      return jsonResponse(groundedPayload());
    },
  });
  const oversizedInput = await handlers.POST(request({ query: "研".repeat(2_001) }));
  assert.equal(oversizedInput.status, 400);
  assert.equal(calls, 0);

  const oversizedResponse = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => jsonResponse(groundedPayload(), 200, {
      "Content-Length": "1000001",
    }),
  });
  const response = await oversizedResponse.POST(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "gemini_invalid_response");
});

test("bounded readers cancel oversized streams and map response body timeout safely", async () => {
  const environment = await readyEnvironment();
  let requestCancelled = false;
  const requestStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(5_000));
      controller.enqueue(new Uint8Array(5_000));
    },
    cancel() { requestCancelled = true; },
  });
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => assert.fail("oversized request must not reach Gemini"),
  });
  const streamedRequest = new Request("https://lead.example.test/api/research/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://lead.example.test",
      "Sec-Fetch-Site": "same-origin",
    },
    body: requestStream,
    duplex: "half",
  });
  const requestResponse = await handlers.POST(streamedRequest);
  assert.equal(requestResponse.status, 413);
  assert.equal(requestCancelled, true);

  let responseCancelled = false;
  const oversizedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(600_000));
      controller.enqueue(new Uint8Array(600_000));
    },
    cancel() { responseCancelled = true; },
  });
  const oversizedHandlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => new Response(oversizedStream, {
      headers: { "Content-Type": "application/json" },
    }),
  });
  const oversized = await oversizedHandlers.POST(request());
  assert.equal(oversized.status, 502);
  assert.equal((await oversized.json()).error, "gemini_response_too_large");
  assert.equal(responseCancelled, true);

  let timeoutCancelled = false;
  const timeoutLogs = [];
  const stalledStream = new ReadableStream({
    pull() { return new Promise(() => undefined); },
    cancel() { timeoutCancelled = true; },
  });
  const timeoutHandlers = createGeminiResearchHttpHandlers({
    environment,
    timeoutMs: 5,
    logger: (entry) => timeoutLogs.push(entry),
    fetcher: async () => new Response(stalledStream, {
      headers: { "Content-Type": "application/json" },
    }),
  });
  const timeout = await timeoutHandlers.POST(request());
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).error, "gemini_timeout");
  assert.equal(timeoutCancelled, true);
  assert.equal(timeoutLogs[0].upstreamHttpStatus, 200);
});

test("non-success upstream responses are cancelled without reading their body", async () => {
  const environment = await readyEnvironment();
  let cancelled = false;
  const body = new ReadableStream({
    pull() { return new Promise(() => undefined); },
    cancel() { cancelled = true; },
  });
  const handlers = createGeminiResearchHttpHandlers({
    environment,
    fetcher: async () => new Response(body, {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }),
  });
  const response = await handlers.POST(request());
  assert.equal(response.status, 502);
  assert.equal((await response.json()).error, "gemini_authentication_failed");
  assert.equal(cancelled, true);
});
