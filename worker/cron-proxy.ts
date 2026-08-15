interface Env {
  LEAD_ENGINE_URL: string;
  SITES_BYPASS_TOKEN: string;
}

type BatchResponse = {
  status?: string;
  ran?: boolean;
  reason?: string;
  source?: { name?: string };
  error?: string;
};

async function triggerLeadEngine(env: Env): Promise<void> {
  const endpoint = new URL("/api/engine/control", env.LEAD_ENGINE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OAI-Sites-Authorization": `Bearer ${env.SITES_BYPASS_TOKEN}`,
    },
    body: JSON.stringify({ action: "run_batch" }),
  });

  let result: BatchResponse = {};
  try {
    result = await response.json<BatchResponse>();
  } catch {
    // Keep logs free of untrusted HTML or other response bodies.
  }

  if (!response.ok) {
    throw new Error(`lead_engine_cron_http_${response.status}:${result.error || "unknown"}`);
  }

  console.log(JSON.stringify({
    event: "lead_engine_cron",
    httpStatus: response.status,
    status: result.status || "unknown",
    ran: result.ran === true,
    reason: result.reason || null,
    source: result.source?.name || null,
  }));
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(triggerLeadEngine(env));
  },
};
