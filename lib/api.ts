export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message = code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function textValue(value: unknown, options: { field: string; max?: number; required?: boolean }) {
  const text = String(value ?? "").trim();
  if (options.required && !text) throw new ApiError(400, "required_field", `${options.field} is required`);
  if (options.max && text.length > options.max) throw new ApiError(400, "field_too_long", `${options.field} is too long`);
  return text;
}

export async function jsonBody(request: Request) {
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new ApiError(415, "json_required");
  const declared = Number(request.headers.get("content-length") || 0);
  if (!Number.isFinite(declared) || declared < 0) throw new ApiError(400, "invalid_content_length");
  if (declared > 2_000_000) throw new ApiError(413, "request_too_large");
  try {
    const source = await request.text();
    if (source.length > 2_000_000) throw new ApiError(413, "request_too_large");
    const parsed = JSON.parse(source) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ApiError(400, "invalid_json");
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, "invalid_json");
  }
}

export function apiFailure(error: unknown) {
  if (error instanceof ApiError) {
    return Response.json({ error: error.code, message: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  const schemaUnavailable = /no such table|prospect_companies|campaign_leads|lead_sources|campaigns/i.test(message);
  return Response.json({
    error: schemaUnavailable ? "database_not_ready" : "internal_error",
    message: schemaUnavailable ? "独立数据库尚未应用迁移。" : "请求未完成。",
  }, { status: 500 });
}
