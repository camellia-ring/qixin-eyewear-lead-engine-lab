import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { recoverStaleDiscoveryRuns, runDiscoverySource } from "@/lib/discovery-runner";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const sourceId = textValue(body.sourceId, { field: "sourceId", required: true, max: 100 });
    await recoverStaleDiscoveryRuns();
    const result = await runDiscoverySource(sourceId, "manual");
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not_found/.test(message)) return apiFailure(new ApiError(404, message));
    if (/paused|not_active|already_running/.test(message)) return apiFailure(new ApiError(409, message));
    return apiFailure(error);
  }
}
