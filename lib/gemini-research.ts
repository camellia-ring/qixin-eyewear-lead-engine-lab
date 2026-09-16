const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_QUERY_BYTES = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const MAX_ANSWER_CHARS = 60_000;
const MAX_SEARCH_HTML_CHARS = 100_000;
const MAX_GROUNDING_CHUNKS = 100;
const MAX_GROUNDING_SUPPORTS = 200;
const MAX_SEARCH_QUERIES = 50;
const DEFAULT_TIMEOUT_MS = 45_000;

export type GeminiResearchCitation = { title: string; url: string };
export type GeminiResearchSupport = {
  startIndex: number;
  endIndex: number;
  sourceIndices: number[];
};
export type GeminiResearchUsage = {
  promptTokens: number | null;
  outputTokens: number | null;
  thoughtTokens: number | null;
  totalTokens: number | null;
};
export type GeminiResearchResult = {
  requestedModel: string;
  returnedModel: string | null;
  answer: string;
  citations: GeminiResearchCitation[];
  supports: GeminiResearchSupport[];
  searchQueries: string[];
  searchSuggestionHtml: string | null;
  groundingStatus: "verified" | "unverified";
  durationMs: number;
  usage: GeminiResearchUsage;
  generatedAt: string;
};
export type GeminiResearchConfigurationStatus = {
  ready: boolean;
  model: string;
  reason: string | null;
};
export type GeminiResearchEnvironment = {
  GEMINI_API_KEY?: string;
  GEMINI_RESEARCH_MODEL?: string;
  GEMINI_RESEARCH_FREE_TIER_CONFIRMED?: string;
  GEMINI_RESEARCH_VERIFIED_MODEL?: string;
  GEMINI_RESEARCH_PROJECT_ID?: string;
  GEMINI_RESEARCH_KEY_SHA256?: string;
};
export type GeminiResearchLog = {
  status: "success" | "error";
  model: string;
  usage: GeminiResearchUsage | null;
  errorCode: string | null;
  durationMs: number;
  upstreamHttpStatus: number | null;
};

type RecordValue = Record<string, unknown>;
type ReadyConfiguration = {
  apiKey: string;
  model: string;
  projectId: string;
};
type ConfigurationResolution = {
  status: GeminiResearchConfigurationStatus;
  configuration: ReadyConfiguration | null;
};

export class GeminiResearchError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number,
    message: string,
    readonly upstreamHttpStatus: number | null = null,
  ) {
    super(message);
    this.name = "GeminiResearchError";
  }
}

const isRecord = (value: unknown): value is RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const safeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
};

const configuredModel = (environment: GeminiResearchEnvironment): string =>
  environment.GEMINI_RESEARCH_MODEL?.trim() || DEFAULT_MODEL;

const resolveConfiguration = async (
  environment: GeminiResearchEnvironment,
): Promise<ConfigurationResolution> => {
  const model = configuredModel(environment);
  const unavailable = (reason: string): ConfigurationResolution => ({
    status: { ready: false, model, reason },
    configuration: null,
  });

  if (!/^[a-z0-9][a-z0-9._-]{0,99}$/u.test(model)) {
    return unavailable("invalid_model");
  }
  if (environment.GEMINI_RESEARCH_FREE_TIER_CONFIRMED !== "true") {
    return unavailable("free_tier_not_confirmed");
  }
  if (environment.GEMINI_RESEARCH_VERIFIED_MODEL?.trim() !== model) {
    return unavailable("verified_model_mismatch");
  }
  const projectId = environment.GEMINI_RESEARCH_PROJECT_ID?.trim() ?? "";
  if (projectId === "") return unavailable("project_id_missing");

  const apiKey = environment.GEMINI_API_KEY?.trim() ?? "";
  if (apiKey === "") return unavailable("api_key_missing");
  const expectedHash = environment.GEMINI_RESEARCH_KEY_SHA256
    ?.trim()
    .toLocaleLowerCase("en-US") ?? "";
  if (!/^[0-9a-f]{64}$/u.test(expectedHash)) {
    return unavailable("key_hash_invalid");
  }
  const actualHash = await sha256Hex(apiKey);
  if (!safeEqual(actualHash, expectedHash)) {
    return unavailable("key_hash_mismatch");
  }

  return {
    status: { ready: true, model, reason: null },
    configuration: { apiKey, model, projectId },
  };
};

export const getGeminiResearchConfigurationStatus = async (
  environment: GeminiResearchEnvironment,
): Promise<GeminiResearchConfigurationStatus> =>
  (await resolveConfiguration(environment)).status;

const tokenCount = (value: unknown): number | null =>
  Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;

const safeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== "string" || value.trim() === "") return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    return url.toString();
  } catch {
    return null;
  }
};

const byteOffsetToStringIndex = (
  value: string,
  byteOffset: unknown,
): number | null => {
  if (!Number.isSafeInteger(byteOffset) || Number(byteOffset) < 0) return null;
  const target = Number(byteOffset);
  let bytes = 0;
  let stringIndex = 0;
  for (const character of value) {
    if (bytes === target) return stringIndex;
    bytes += new TextEncoder().encode(character).byteLength;
    stringIndex += character.length;
    if (bytes > target) return null;
  }
  return bytes === target ? stringIndex : null;
};

const readBoundedUtf8Body = async ({
  stream,
  maxBytes,
  signal,
  tooLargeError,
  readError,
  timeoutError,
}: {
  stream: ReadableStream<Uint8Array> | null;
  maxBytes: number;
  signal?: AbortSignal;
  tooLargeError: GeminiResearchError;
  readError: GeminiResearchError;
  timeoutError: GeminiResearchError;
}): Promise<string> => {
  if (stream === null) return "";
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytesRead = 0;
  let serialized = "";
  const abort = () => {
    void reader.cancel(signal?.reason).catch(() => undefined);
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (signal?.aborted) throw timeoutError;
      if (done) break;
      if (value === undefined) continue;
      bytesRead += value.byteLength;
      if (bytesRead > maxBytes) {
        await reader.cancel(tooLargeError).catch(() => undefined);
        throw tooLargeError;
      }
      serialized += decoder.decode(value, { stream: true });
    }
    serialized += decoder.decode();
    if (signal?.aborted) throw timeoutError;
    return serialized;
  } catch (error) {
    if (error instanceof GeminiResearchError) throw error;
    if (signal?.aborted) throw timeoutError;
    await reader.cancel(readError).catch(() => undefined);
    throw readError;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
};

const upstreamError = (status: number): GeminiResearchError => {
  if (status === 401) {
    return new GeminiResearchError(
      "gemini_authentication_failed",
      502,
      "Gemini 凭据未通过验证。",
      status,
    );
  }
  if (status === 403) {
    return new GeminiResearchError(
      "gemini_access_denied",
      502,
      "Gemini 项目无权使用当前模型或联网研究。",
      status,
    );
  }
  if (status === 404) {
    return new GeminiResearchError(
      "gemini_model_not_found",
      502,
      "Gemini 模型不存在或当前项目不可用。",
      status,
    );
  }
  if (status === 429) {
    return new GeminiResearchError(
      "gemini_rate_limited",
      429,
      "Gemini 当前受到限流或已达到可用额度。",
      status,
    );
  }
  return new GeminiResearchError(
    "gemini_upstream_failed",
    502,
    "Gemini 研究请求未完成。",
    status,
  );
};

const parseGeminiResponse = (
  payload: unknown,
  requestedModel: string,
  startedAt: number,
  completedAt: number,
  upstreamHttpStatus: number,
): GeminiResearchResult => {
  if (!isRecord(payload)) {
    throw new GeminiResearchError(
      "gemini_invalid_response",
      502,
      "Gemini 返回了无法解析的响应。",
      upstreamHttpStatus,
    );
  }
  const candidates = payload.candidates;
  const candidate = Array.isArray(candidates) && isRecord(candidates[0])
    ? candidates[0]
    : null;
  const content = candidate && isRecord(candidate.content) ? candidate.content : null;
  const rawParts = content && Array.isArray(content.parts) ? content.parts : [];
  const textParts = new Map<number, { text: string; base: number }>();
  let answer = "";
  rawParts.forEach((part, partIndex) => {
    if (!isRecord(part) || part.thought === true || typeof part.text !== "string") return;
    textParts.set(partIndex, { text: part.text, base: answer.length });
    answer += part.text;
  });
  if (answer.trim() === "" || answer.length > MAX_ANSWER_CHARS) {
    throw new GeminiResearchError(
      "gemini_invalid_response",
      502,
      "Gemini 返回了无法解析的响应。",
      upstreamHttpStatus,
    );
  }

  const grounding = candidate && isRecord(candidate.groundingMetadata)
    ? candidate.groundingMetadata
    : null;
  const rawChunks = grounding && Array.isArray(grounding.groundingChunks)
    ? grounding.groundingChunks
    : [];
  const rawSupports = grounding && Array.isArray(grounding.groundingSupports)
    ? grounding.groundingSupports
    : [];
  const rawQueries = grounding && Array.isArray(grounding.webSearchQueries)
    ? grounding.webSearchQueries
    : [];
  if (
    rawChunks.length > MAX_GROUNDING_CHUNKS ||
    rawSupports.length > MAX_GROUNDING_SUPPORTS ||
    rawQueries.length > MAX_SEARCH_QUERIES
  ) {
    throw new GeminiResearchError(
      "gemini_response_too_large",
      502,
      "Gemini 返回内容超过研究面板限制。",
      upstreamHttpStatus,
    );
  }

  let chunksValid = rawChunks.length > 0;
  const citations: GeminiResearchCitation[] = [];
  const chunkToCitation = new Map<number, number>();
  rawChunks.forEach((chunk, chunkIndex) => {
    const web = isRecord(chunk) && isRecord(chunk.web) ? chunk.web : null;
    const url = safeHttpUrl(web?.uri);
    const title = typeof web?.title === "string" ? web.title.trim() : "";
    if (url === null || title === "") {
      chunksValid = false;
      return;
    }
    chunkToCitation.set(chunkIndex, citations.length);
    citations.push({ title, url });
  });

  let queriesValid = rawQueries.length > 0;
  const searchQueries: string[] = [];
  for (const query of rawQueries) {
    if (typeof query !== "string" || query.trim() === "" || query.length > 1_000) {
      queriesValid = false;
      continue;
    }
    searchQueries.push(query);
  }

  const searchEntryPoint = grounding && isRecord(grounding.searchEntryPoint)
    ? grounding.searchEntryPoint
    : null;
  const searchSuggestionHtml = typeof searchEntryPoint?.renderedContent === "string" &&
      searchEntryPoint.renderedContent !== ""
    ? searchEntryPoint.renderedContent
    : null;
  if (
    searchSuggestionHtml !== null &&
    searchSuggestionHtml.length > MAX_SEARCH_HTML_CHARS
  ) {
    throw new GeminiResearchError(
      "gemini_response_too_large",
      502,
      "Gemini 返回内容超过研究面板限制。",
      upstreamHttpStatus,
    );
  }

  let supportsValid = rawSupports.length > 0;
  const supports: GeminiResearchSupport[] = [];
  for (const support of rawSupports) {
    if (!isRecord(support) || !isRecord(support.segment)) {
      supportsValid = false;
      continue;
    }
    const segment = support.segment;
    const explicitPartIndex = segment.partIndex;
    const partIndex = Number.isSafeInteger(explicitPartIndex)
      ? Number(explicitPartIndex)
      : textParts.size === 1
        ? [...textParts.keys()][0]!
        : -1;
    const part = textParts.get(partIndex);
    const startIndex = part
      ? byteOffsetToStringIndex(part.text, segment.startIndex)
      : null;
    const endIndex = part
      ? byteOffsetToStringIndex(part.text, segment.endIndex)
      : null;
    const segmentText = typeof segment.text === "string" ? segment.text : null;
    const rawSourceIndices = support.groundingChunkIndices;
    if (
      !part ||
      startIndex === null ||
      endIndex === null ||
      startIndex < 0 ||
      endIndex <= startIndex ||
      segmentText === null ||
      part.text.slice(startIndex, endIndex) !== segmentText ||
      !Array.isArray(rawSourceIndices) ||
      rawSourceIndices.length === 0
    ) {
      supportsValid = false;
      continue;
    }
    const sourceIndices: number[] = [];
    let sourceIndicesValid = true;
    for (const sourceIndex of rawSourceIndices) {
      if (!Number.isSafeInteger(sourceIndex)) {
        sourceIndicesValid = false;
        break;
      }
      const mapped = chunkToCitation.get(Number(sourceIndex));
      if (mapped === undefined || sourceIndices.includes(mapped)) {
        sourceIndicesValid = false;
        break;
      }
      sourceIndices.push(mapped);
    }
    if (!sourceIndicesValid) {
      supportsValid = false;
      continue;
    }
    supports.push({
      startIndex: part.base + startIndex,
      endIndex: part.base + endIndex,
      sourceIndices,
    });
  }

  const returnedModel = typeof payload.modelVersion === "string" &&
      payload.modelVersion.trim() !== ""
    ? payload.modelVersion
    : null;
  const usageMetadata = isRecord(payload.usageMetadata) ? payload.usageMetadata : {};
  const usage: GeminiResearchUsage = {
    promptTokens: tokenCount(usageMetadata.promptTokenCount),
    outputTokens: tokenCount(usageMetadata.candidatesTokenCount),
    thoughtTokens: tokenCount(usageMetadata.thoughtsTokenCount),
    totalTokens: tokenCount(usageMetadata.totalTokenCount),
  };
  const groundingStatus = grounding !== null &&
      chunksValid &&
      queriesValid &&
      supportsValid
    ? "verified"
    : "unverified";

  return {
    requestedModel,
    returnedModel,
    answer,
    citations,
    supports,
    searchQueries,
    searchSuggestionHtml,
    groundingStatus,
    durationMs: Math.max(0, Math.round(completedAt - startedAt)),
    usage,
    generatedAt: new Date(completedAt).toISOString(),
  };
};

type GenerateDependencies = {
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
};

const generateGroundedResearch = async (
  query: string,
  configuration: ReadyConfiguration,
  dependencies: GenerateDependencies = {},
): Promise<{ result: GeminiResearchResult; upstreamHttpStatus: number }> => {
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? Date.now;
  const timeoutMs = dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const startedAt = now();
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  let response: Response;
  try {
    response = await fetcher(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(configuration.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": configuration.apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
          generationConfig: {
            candidateCount: 1,
            maxOutputTokens: 4_096,
            temperature: 0.2,
          },
        }),
        redirect: "error",
        signal: timeoutSignal,
      },
    );
  } catch (error) {
    if (
      error instanceof DOMException &&
      (error.name === "TimeoutError" || error.name === "AbortError")
    ) {
      throw new GeminiResearchError(
        "gemini_timeout",
        504,
        "Gemini 研究请求超时。",
      );
    }
    throw new GeminiResearchError(
      "gemini_network_failed",
      502,
      "无法连接 Gemini 研究服务。",
    );
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw upstreamError(response.status);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (
    (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) ||
    !contentType.toLocaleLowerCase("en-US").includes("application/json")
  ) {
    await response.body?.cancel().catch(() => undefined);
    throw new GeminiResearchError(
      "gemini_invalid_response",
      502,
      "Gemini 返回了无法解析的响应。",
      response.status,
    );
  }
  const serialized = await readBoundedUtf8Body({
    stream: response.body,
    maxBytes: MAX_RESPONSE_BYTES,
    signal: timeoutSignal,
    tooLargeError: new GeminiResearchError(
      "gemini_response_too_large",
      502,
      "Gemini 返回内容超过研究面板限制。",
      response.status,
    ),
    readError: new GeminiResearchError(
      "gemini_invalid_response",
      502,
      "Gemini 返回了无法解析的响应。",
      response.status,
    ),
    timeoutError: new GeminiResearchError(
      "gemini_timeout",
      504,
      "Gemini 研究请求超时。",
      response.status,
    ),
  });
  let payload: unknown;
  try {
    payload = JSON.parse(serialized);
  } catch {
    throw new GeminiResearchError(
      "gemini_invalid_response",
      502,
      "Gemini 返回了无法解析的响应。",
      response.status,
    );
  }
  const completedAt = now();
  return {
    result: parseGeminiResponse(
      payload,
      configuration.model,
      startedAt,
      completedAt,
      response.status,
    ),
    upstreamHttpStatus: response.status,
  };
};

const configurationMessages: Record<string, string> = {
  invalid_model: "Gemini 研究模型配置无效。",
  free_tier_not_confirmed: "尚未确认当前 Gemini 项目符合免费研究门禁。",
  verified_model_mismatch: "已核验模型与当前研究模型不一致。",
  project_id_missing: "尚未记录已核验的 Gemini 项目。",
  api_key_missing: "Gemini API 密钥尚未配置。",
  key_hash_invalid: "Gemini API 密钥指纹配置无效。",
  key_hash_mismatch: "Gemini API 密钥与已核验指纹不一致。",
};

const jsonResponse = (
  body: unknown,
  status = 200,
): Response => Response.json(body, {
  status,
  headers: {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  },
});

const safeError = (error: unknown): GeminiResearchError =>
  error instanceof GeminiResearchError
    ? error
    : new GeminiResearchError(
      "gemini_internal_error",
      500,
      "Gemini 研究请求未完成。",
    );

const parseResearchQuery = async (request: Request): Promise<string> => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLocaleLowerCase("en-US").includes("application/json")) {
    throw new GeminiResearchError(
      "json_required",
      415,
      "请求必须使用 JSON。",
    );
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_QUERY_BYTES) {
    await request.body?.cancel().catch(() => undefined);
    throw new GeminiResearchError(
      "request_too_large",
      413,
      "研究问题超过允许长度。",
    );
  }
  const serialized = await readBoundedUtf8Body({
    stream: request.body,
    maxBytes: MAX_QUERY_BYTES,
    signal: AbortSignal.timeout(5_000),
    tooLargeError: new GeminiResearchError(
      "request_too_large",
      413,
      "研究问题超过允许长度。",
    ),
    readError: new GeminiResearchError(
      "invalid_json",
      400,
      "请求 JSON 无效。",
    ),
    timeoutError: new GeminiResearchError(
      "request_timeout",
      408,
      "读取研究问题超时。",
    ),
  });
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new GeminiResearchError("invalid_json", 400, "请求 JSON 无效。");
  }
  if (!isRecord(parsed) || Object.keys(parsed).some((key) => key !== "query")) {
    throw new GeminiResearchError("invalid_request", 400, "研究请求字段无效。");
  }
  const query = typeof parsed.query === "string" ? parsed.query.trim() : "";
  if (query === "" || query.length > 2_000) {
    throw new GeminiResearchError(
      "invalid_query",
      400,
      "请输入不超过 2000 字的研究问题。",
    );
  }
  return query;
};

const assertSameOrigin = (request: Request): void => {
  const expectedOrigin = new URL(request.url).origin;
  if (
    request.headers.get("origin") !== expectedOrigin ||
    request.headers.get("sec-fetch-site") !== "same-origin"
  ) {
    throw new GeminiResearchError(
      "same_origin_required",
      403,
      "只允许从当前私有工作台发起研究。",
    );
  }
};

export const createGeminiResearchHttpHandlers = ({
  environment,
  fetcher,
  now,
  timeoutMs,
  logger,
}: {
  environment: GeminiResearchEnvironment;
  fetcher?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  logger?: (entry: GeminiResearchLog) => void;
}) => {
  // This only suppresses duplicate work inside one warm isolate. It is not a
  // distributed quota or a substitute for the verified free-tier gate.
  let requestInFlight = false;

  return {
    GET: async (): Promise<Response> =>
      jsonResponse(await getGeminiResearchConfigurationStatus(environment)),

    POST: async (request: Request): Promise<Response> => {
    const requestedModel = configuredModel(environment);
    const requestStartedAt = Date.now();
    try {
      assertSameOrigin(request);
      const query = await parseResearchQuery(request);
      const resolved = await resolveConfiguration(environment);
      if (!resolved.configuration) {
        const reason = resolved.status.reason ?? "configuration_unavailable";
        throw new GeminiResearchError(
          reason,
          503,
          configurationMessages[reason] ?? "Gemini 研究尚未配置完成。",
        );
      }
      if (requestInFlight) {
        throw new GeminiResearchError(
          "gemini_research_in_progress",
          409,
          "已有一项 Gemini 研究正在进行，请等待完成。",
        );
      }
      requestInFlight = true;
      let generated: {
        result: GeminiResearchResult;
        upstreamHttpStatus: number;
      };
      try {
        generated = await generateGroundedResearch(query, resolved.configuration, {
          ...(fetcher === undefined ? {} : { fetcher }),
          ...(now === undefined ? {} : { now }),
          ...(timeoutMs === undefined ? {} : { timeoutMs }),
        });
      } finally {
        requestInFlight = false;
      }
      const { result, upstreamHttpStatus } = generated;
      logger?.({
        status: "success",
        model: result.returnedModel ?? result.requestedModel,
        usage: result.usage,
        errorCode: null,
        durationMs: result.durationMs,
        upstreamHttpStatus,
      });
      return jsonResponse(result);
    } catch (error) {
      const safe = safeError(error);
      logger?.({
        status: "error",
        model: requestedModel,
        usage: null,
        errorCode: safe.code,
        durationMs: Math.max(0, Date.now() - requestStartedAt),
        upstreamHttpStatus: safe.upstreamHttpStatus,
      });
      return jsonResponse(
        { error: safe.code, message: safe.message },
        safe.httpStatus,
      );
    }
    },
  };
};
