import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import {
  pauseAutomaticEngine,
  resumeAutomaticEngine,
  runAutomaticDiscoveryBatch,
  startAutomaticEngine,
  stopAutomaticEngine,
} from "@/lib/automatic-engine";

const ACTIONS = new Set(["start", "pause", "resume", "stop", "run_batch"]);

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const action = textValue(body.action, { field: "action", required: true, max: 30 });
    if (!ACTIONS.has(action)) throw new ApiError(400, "invalid_engine_action");
    if (action === "start") {
      const timezone = textValue(body.timezone || "Asia/Shanghai", { field: "timezone", required: true, max: 80 });
      const state = await startAutomaticEngine(timezone);
      return Response.json({ state });
    }
    if (action === "pause") return Response.json({ state: await pauseAutomaticEngine() });
    if (action === "resume") return Response.json({ state: await resumeAutomaticEngine() });
    if (action === "stop") return Response.json({ state: await stopAutomaticEngine() });
    return Response.json(await runAutomaticDiscoveryBatch());
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not_found/.test(message)) return apiFailure(new ApiError(404, message));
    if (/not_active|not_started|no_active_campaigns/.test(message)) return apiFailure(new ApiError(409, message));
    if (/invalid_/.test(message)) return apiFailure(new ApiError(400, message));
    return apiFailure(error);
  }
}
