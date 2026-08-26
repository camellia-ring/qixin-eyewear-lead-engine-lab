import { ApiError, apiFailure, jsonBody } from "@/lib/api";
import { applyAssignmentCorrections, getAssignmentCorrectionPreview } from "@/lib/assignment-correction";

export async function GET() {
  try {
    return Response.json(await getAssignmentCorrectionPreview(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    if (body.apply !== true) return Response.json(await getAssignmentCorrectionPreview());
    return Response.json(await applyAssignmentCorrections());
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/assignment_correction_(?:preflight_failed|mismatch|target_missing)/.test(message)) {
      return apiFailure(new ApiError(409, "assignment_correction_preflight_failed", message));
    }
    return apiFailure(error);
  }
}
