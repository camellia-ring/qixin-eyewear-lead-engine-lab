import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, discoverySources } from "@/db/schema";
import { ApiError, apiFailure, jsonBody, textValue } from "@/lib/api";
import { normalizedDomain, publicHttpUrl } from "@/lib/discovery";
import { scheduleFromCadence } from "@/lib/discovery-runner";
import { canonicalSourceUrl } from "@/lib/lead-engine";

const CADENCES = new Set(["manual", "daily", "weekly"]);
const STATUSES = new Set(["active", "paused"]);
const PARSERS = new Set(["generic_links", "vision_council_members", "exhibitor_cards", "exhibitor_text", "dynamic_directory", "pdf_directory"]);
const TIERS = new Set(["A", "B", "C"]);

function cadenceValue(value: unknown, fallback = "manual") {
  const cadence = textValue(value || fallback, { field: "cadence", max: 20 });
  if (!CADENCES.has(cadence)) throw new ApiError(400, "invalid_cadence");
  return cadence;
}

function candidateLimit(value: unknown, fallback = 20) {
  const limit = Number(value ?? fallback);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new ApiError(400, "invalid_candidate_limit", "每批候选数必须在 1–20 之间");
  return limit;
}

function parserValue(value: unknown, fallback = "generic_links") {
  const parser = textValue(value || fallback, { field: "parserKey", max: 60 });
  if (!PARSERS.has(parser)) throw new ApiError(400, "invalid_parser_key");
  return parser;
}

function parserConfig(value: unknown, fallback = "{}") {
  let parsed: Record<string, unknown>;
  try {
    parsed = value === undefined ? JSON.parse(fallback) as Record<string, unknown>
      : typeof value === "string" ? JSON.parse(value) as Record<string, unknown>
        : value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    throw new ApiError(400, "invalid_parser_config", "解析器配置必须是 JSON 对象");
  }
  for (const field of ["itemsPath", "nameField", "websiteField", "detailField"]) {
    if (parsed[field] !== undefined && !/^[A-Za-z0-9_.-]{1,120}$/.test(String(parsed[field]))) {
      throw new ApiError(400, "invalid_parser_config_field", `${field} 只允许字段路径`);
    }
  }
  if (parsed.endpoint) parsed.endpoint = publicHttpUrl(String(parsed.endpoint)).toString();
  const serialized = JSON.stringify(parsed);
  if (serialized.length > 4000) throw new ApiError(400, "parser_config_too_large");
  return serialized;
}

function integerValue(value: unknown, fallback: number, min: number, max: number, field: string) {
  const result = Number(value ?? fallback);
  if (!Number.isInteger(result) || result < min || result > max) throw new ApiError(400, `invalid_${field}`);
  return result;
}

export async function POST(request: Request) {
  try {
    const body = await jsonBody(request);
    const campaignId = textValue(body.campaignId, { field: "campaignId", required: true, max: 100 });
    const name = textValue(body.name, { field: "name", required: true, max: 160 });
    const url = publicHttpUrl(textValue(body.sourceUrl, { field: "sourceUrl", required: true, max: 2048 })).toString();
    const sourceUrl = canonicalSourceUrl(url);
    const cadence = cadenceValue(body.cadence);
    const maxCandidates = candidateLimit(body.maxCandidates);
    const parserKey = parserValue(body.parserKey);
    const parserConfigJson = parserConfig(body.parserConfig);
    const parsedConfig = JSON.parse(parserConfigJson) as Record<string, unknown>;
    if (parserKey === "dynamic_directory" && !parsedConfig.endpoint) {
      throw new ApiError(400, "dynamic_endpoint_required", "动态目录必须先配置经确认的公开 JSON endpoint");
    }
    const tier = textValue(body.tier || "B", { field: "tier", max: 1 });
    if (!TIERS.has(tier)) throw new ApiError(400, "invalid_source_tier");
    const db = getDb();
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
    if (!campaign) throw new ApiError(404, "campaign_not_found");
    if (campaign.status !== "active") throw new ApiError(409, "campaign_not_active", "请先启用 Campaign，再添加自动发现来源");
    const [existing] = await db.select().from(discoverySources).where(and(
      eq(discoverySources.campaignId, campaignId), eq(discoverySources.sourceUrl, sourceUrl),
    )).limit(1);
    if (existing) throw new ApiError(409, "discovery_source_exists", "该 Campaign 已添加这个来源");
    const [source] = await db.insert(discoverySources).values({
      id: crypto.randomUUID(), campaignId, name, sourceUrl, normalizedDomain: normalizedDomain(sourceUrl),
      sourceType: "official_exhibitor_directory",
      region: textValue(body.region || "global", { field: "region", max: 120 }),
      tier,
      parserKey,
      parserVersion: "1.0.0",
      parserConfigJson,
      priority: integerValue(body.priority, 100, 1, 10_000, "priority"),
      rateLimitMs: integerValue(body.rateLimitMs, 2000, 500, 60_000, "rate_limit_ms"),
      status: "active", cadence, maxCandidates,
      nextRunAt: cadence === "manual" ? null : new Date().toISOString(),
    }).returning();
    return Response.json({ source }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await jsonBody(request);
    const id = textValue(body.id, { field: "id", required: true, max: 100 });
    const db = getDb();
    const [current] = await db.select().from(discoverySources).where(eq(discoverySources.id, id)).limit(1);
    if (!current) throw new ApiError(404, "discovery_source_not_found");
    const status = body.status === undefined ? current.status : textValue(body.status, { field: "status", max: 20 });
    if (!STATUSES.has(status)) throw new ApiError(400, "invalid_source_status");
    const cadence = body.cadence === undefined ? current.cadence : cadenceValue(body.cadence, current.cadence);
    const parserKey = body.parserKey === undefined ? current.parserKey : parserValue(body.parserKey, current.parserKey);
    const parserConfigJson = parserConfig(body.parserConfig, current.parserConfigJson);
    const parsedConfig = JSON.parse(parserConfigJson) as Record<string, unknown>;
    if (status === "active" && parserKey === "dynamic_directory" && !parsedConfig.endpoint) {
      throw new ApiError(400, "dynamic_endpoint_required", "动态目录必须先配置经确认的公开 JSON endpoint");
    }
    const now = new Date();
    const nextRunAt = cadence === "manual" || status === "paused"
      ? null
      : current.nextRunAt || scheduleFromCadence(cadence, now);
    const [source] = await db.update(discoverySources).set({
      name: body.name === undefined ? current.name : textValue(body.name, { field: "name", required: true, max: 160 }),
      status,
      enabled: status === "active",
      cadence,
      parserKey,
      parserConfigJson,
      region: body.region === undefined ? current.region : textValue(body.region, { field: "region", max: 120 }),
      priority: body.priority === undefined ? current.priority : integerValue(body.priority, current.priority, 1, 10_000, "priority"),
      rateLimitMs: body.rateLimitMs === undefined ? current.rateLimitMs : integerValue(body.rateLimitMs, current.rateLimitMs, 500, 60_000, "rate_limit_ms"),
      maxCandidates: body.maxCandidates === undefined ? current.maxCandidates : candidateLimit(body.maxCandidates, current.maxCandidates),
      nextRunAt,
      updatedAt: now.toISOString(),
    }).where(eq(discoverySources.id, id)).returning();
    return Response.json({ source });
  } catch (error) {
    return apiFailure(error);
  }
}
