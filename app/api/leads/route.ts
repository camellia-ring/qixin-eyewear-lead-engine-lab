import { and, asc, count, desc, eq, isNotNull, like, ne, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import { apiFailure } from "@/lib/api";
import { normalizeCountry } from "@/lib/campaign-routing";
import { isRegionKey, REGION_PRESETS } from "@/lib/campaign-strategy";
import { safeJsonList } from "@/lib/lead-engine";

const SORTS = {
  score: campaignLeads.currentScore,
  company: prospectCompanies.companyName,
  country: prospectCompanies.country,
  firstDiscovered: prospectCompanies.firstDiscoveredAt,
  lastVerified: prospectCompanies.lastVerifiedAt,
} as const;

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const number = Number(value ?? fallback);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function values(parameters: URLSearchParams, key: string) {
  return [...new Set(parameters.getAll(key).map((value) => value.trim()).filter(Boolean))];
}

function oneOf(column: Parameters<typeof eq>[0], selected: string[]) {
  if (!selected.length) return undefined;
  return or(...selected.map((value) => eq(column, value)));
}

function jsonContains(column: Parameters<typeof like>[0], selected: string[]) {
  if (!selected.length) return undefined;
  return or(...selected.map((value) => like(column, `%${value}%`)));
}

export async function GET(request: Request) {
  try {
    const parameters = new URL(request.url).searchParams;
    const page = boundedInteger(parameters.get("page"), 1, 1, 100_000);
    const pageSize = boundedInteger(parameters.get("pageSize"), 25, 1, 100);
    const campaignId = parameters.get("campaignId")?.trim();
    const includeHistory = parameters.get("includeHistory") === "true";
    const scope = campaignId
      ? and(eq(campaignLeads.campaignId, campaignId), includeHistory ? undefined : ne(campaignLeads.matchStatus, "stale"))
      : and(eq(campaignLeads.campaignId, prospectCompanies.primaryCampaignId), ne(campaignLeads.matchStatus, "stale"));
    const conditions: SQL[] = scope ? [scope] : [];

    const scalarFilters = [
      ["status", campaignLeads.workflowStatus],
      ["grade", campaignLeads.grade],
      ["confidence", campaignLeads.scoreConfidence],
      ["companyRole", prospectCompanies.companyRole],
      ["contactStatus", prospectCompanies.contactStatus],
      ["sourceType", prospectCompanies.sourceType],
    ] as const;
    for (const [key, column] of scalarFilters) {
      const condition = oneOf(column, values(parameters, key));
      if (condition) conditions.push(condition);
    }
    const countryCondition = oneOf(prospectCompanies.country, values(parameters, "country"));
    if (countryCondition) conditions.push(countryCondition);
    const selectedRegions = values(parameters, "region").filter(isRegionKey);
    if (selectedRegions.length && !selectedRegions.includes("global")) {
      const regionCountries = [...new Set(selectedRegions.flatMap((region) => REGION_PRESETS[region].countries))];
      const regionCondition = oneOf(prospectCompanies.country, regionCountries);
      if (regionCondition) conditions.push(regionCondition);
    }
    const customerTypes = values(parameters, "customerType");
    if (customerTypes.length) {
      const condition = or(oneOf(prospectCompanies.customerType, customerTypes), jsonContains(prospectCompanies.customerTypesJson, customerTypes));
      if (condition) conditions.push(condition);
    }
    const productCondition = jsonContains(prospectCompanies.productDirectionsJson, values(parameters, "productDirection"));
    if (productCondition) conditions.push(productCondition);
    if (parameters.get("duplicate") === "true") conditions.push(eq(prospectCompanies.isDuplicate, true));
    if (parameters.get("duplicate") === "false") conditions.push(eq(prospectCompanies.isDuplicate, false));
    if (parameters.get("doNotContact") === "true") conditions.push(eq(prospectCompanies.doNotContact, true));
    if (parameters.get("doNotContact") === "false") conditions.push(eq(prospectCompanies.doNotContact, false));
    const query = parameters.get("q")?.trim().toLocaleLowerCase();
    if (query) {
      const search = or(
        sql`lower(${prospectCompanies.companyName}) LIKE ${`%${query}%`}`,
        sql`lower(coalesce(${prospectCompanies.primaryDomain}, '')) LIKE ${`%${query}%`}`,
        sql`lower(coalesce(${prospectCompanies.country}, '')) LIKE ${`%${query}%`}`,
        sql`lower(coalesce(${prospectCompanies.customerType}, '')) LIKE ${`%${query}%`}`,
        sql`lower(${prospectCompanies.customerTypesJson}) LIKE ${`%${query}%`}`,
        sql`lower(${prospectCompanies.productDirectionsJson}) LIKE ${`%${query}%`}`,
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const sortKey = parameters.get("sort") as keyof typeof SORTS | null;
    const sortColumn = SORTS[sortKey || "score"] || campaignLeads.currentScore;
    const order = parameters.get("order") === "asc" ? asc(sortColumn) : desc(sortColumn);
    const db = getDb();
    const [rows, totals, statusRows, gradeRows, countryRows, typeRows, productRows, sourceRows] = await Promise.all([
      db.select({
        leadId: campaignLeads.id,
        campaignId: campaignLeads.campaignId,
        assignmentType: campaignLeads.assignmentType,
        matchStatus: campaignLeads.matchStatus,
        matchReason: campaignLeads.matchReason,
        workflowStatus: campaignLeads.workflowStatus,
        qualificationResult: campaignLeads.qualificationResult,
        hardGateStatus: campaignLeads.hardGateStatus,
        hardGateReason: campaignLeads.hardGateReason,
        riskSummary: campaignLeads.riskSummary,
        score: campaignLeads.currentScore,
        grade: campaignLeads.grade,
        evidenceCoverage: campaignLeads.evidenceCoverage,
        confidence: campaignLeads.scoreConfidence,
        autoQualifiedAt: campaignLeads.autoQualifiedAt,
        companyId: prospectCompanies.id,
        companyName: prospectCompanies.companyName,
        country: prospectCompanies.country,
        region: prospectCompanies.region,
        companyType: prospectCompanies.companyType,
        customerType: prospectCompanies.customerType,
        customerTypesJson: prospectCompanies.customerTypesJson,
        companyRole: prospectCompanies.companyRole,
        companySize: prospectCompanies.companySize,
        pricePosition: prospectCompanies.pricePosition,
        productsJson: prospectCompanies.productsJson,
        brandsJson: prospectCompanies.brandsJson,
        wholesaleSignal: prospectCompanies.wholesaleSignal,
        productDirectionsJson: prospectCompanies.productDirectionsJson,
        primaryCampaignId: prospectCompanies.primaryCampaignId,
        website: prospectCompanies.website,
        primaryDomain: prospectCompanies.primaryDomain,
        businessEmail: prospectCompanies.businessEmail,
        contactChannel: prospectCompanies.contactChannel,
        contactStatus: prospectCompanies.contactStatus,
        sourceType: prospectCompanies.sourceType,
        sourceName: prospectCompanies.sourceName,
        firstDiscoveredAt: prospectCompanies.firstDiscoveredAt,
        lastVerifiedAt: prospectCompanies.lastVerifiedAt,
        isDuplicate: prospectCompanies.isDuplicate,
        doNotContact: prospectCompanies.doNotContact,
      }).from(campaignLeads).innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(where).orderBy(order).limit(pageSize).offset((page - 1) * pageSize),
      db.select({ value: count() }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(where),
      db.select({ key: campaignLeads.workflowStatus, value: count() }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(scope).groupBy(campaignLeads.workflowStatus),
      db.select({ key: campaignLeads.grade, value: count() }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(scope).groupBy(campaignLeads.grade),
      db.selectDistinct({ value: prospectCompanies.country }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(and(scope, isNotNull(prospectCompanies.country))).orderBy(asc(prospectCompanies.country)),
      db.selectDistinct({ customerTypesJson: prospectCompanies.customerTypesJson, customerType: prospectCompanies.customerType, companyType: prospectCompanies.companyType })
        .from(campaignLeads).innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(scope),
      db.selectDistinct({ value: prospectCompanies.productDirectionsJson }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(scope),
      db.selectDistinct({ value: prospectCompanies.sourceType }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(and(scope, isNotNull(prospectCompanies.sourceType))).orderBy(asc(prospectCompanies.sourceType)),
    ]);
    const total = totals[0]?.value || 0;
    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.key, Number(row.value || 0)]));
    statusCounts.all = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
    const gradeCounts = Object.fromEntries(gradeRows.map((row) => [row.key, Number(row.value || 0)]));
    const companyTypes = [...new Set(typeRows.flatMap((row) => [
      ...safeJsonList(row.customerTypesJson), row.customerType, row.companyType,
    ]).filter(Boolean) as string[])].sort();
    const productDirections = [...new Set(productRows.flatMap((row) => safeJsonList(row.value)))].sort();
    const presentCountries = new Set(countryRows.map((row) => normalizeCountry(row.value)));
    const regions = Object.entries(REGION_PRESETS)
      .filter(([value, preset]) => value !== "global" && value !== "custom"
        && preset.countries.some((country) => presentCountries.has(normalizeCountry(country))))
      .map(([value, preset]) => ({ value, label: preset.label }));
    return Response.json({
      rows,
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      facets: {
        statusCounts,
        gradeCounts,
        regions,
        countries: countryRows.map((row) => row.value).filter(Boolean),
        companyTypes,
        productDirections,
        sourceTypes: sourceRows.map((row) => row.value).filter(Boolean),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
