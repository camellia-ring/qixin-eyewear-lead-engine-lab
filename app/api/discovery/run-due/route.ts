import { apiFailure, jsonBody } from "@/lib/api";
import { runDueDiscoverySources } from "@/lib/discovery-runner";

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const requested = Number(body.limit ?? 3);
    const limit = Number.isInteger(requested) ? Math.max(1, Math.min(3, requested)) : 3;
    return Response.json(await runDueDiscoverySources(limit));
  } catch (error) {
    return apiFailure(error);
  }
}
