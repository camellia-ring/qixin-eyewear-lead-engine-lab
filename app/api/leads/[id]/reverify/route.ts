import { ApiError, apiFailure } from "@/lib/api";
import { reverifyLead } from "@/lib/reverification";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || id.length > 100) throw new ApiError(400, "invalid_lead_id");
    return Response.json(await reverifyLead(id));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/not_found/.test(message)) return apiFailure(new ApiError(404, message));
    if (/website_missing/.test(message)) return apiFailure(new ApiError(409, message));
    return apiFailure(error);
  }
}
