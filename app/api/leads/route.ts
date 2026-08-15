import { and, asc, count, desc, eq, isNotNull, like, or, sql, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { campaignLeads, prospectCompanies } from "@/db/schema";
import { apiFailure } from "@/lib/api";

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

export async function GET(request: Request) {
  try {
    const parameters = new URL(request.url).searchParams;
    const page = boundedInteger(parameters.get("page"), 1, 1, 100_000);
    const pageSize = boundedInteger(parameters.get("pageSize"), 25, 1, 100);
    const conditions: SQL[] = [];
    const exactFilters = [
      [parameters.get("campaignId"), campaignLeads.campaignId],
      [parameters.get("status"), campaignLeads.workflowStatus],
      [parameters.get("grade"), campaignLeads.grade],
      [parameters.get("confidence"), campaignLeads.scoreConfidence],
      [parameters.get("country"), prospectCompanies.country],
      [parameters.get("customerType"), prospectCompanies.customerType],
      [parameters.get("companyRole"), prospectCompanies.companyRole],
      [parameters.get("contactStatus"), prospectCompanies.contactStatus],
      [parameters.get("sourceType"), prospectCompanies.sourceType],
    ] as const;
    for (const [value, column] of exactFilters) if (value) conditions.push(eq(column, value));
    if (parameters.get("productDirection")) conditions.push(like(
      prospectCompanies.productDirectionsJson, `%${parameters.get("productDirection")}%`,
    ));
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
      );
      if (search) conditions.push(search);
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const sortKey = parameters.get("sort") as keyof typeof SORTS | null;
    const sortColumn = SORTS[sortKey || "score"] || campaignLeads.currentScore;
    const order = parameters.get("order") === "asc" ? asc(sortColumn) : desc(sortColumn);
    const db = getDb();
    const campaignId = parameters.get("campaignId");
    const campaignWhere = campaignId ? eq(campaignLeads.campaignId, campaignId) : undefined;
    const [rows, totals, statusRows, gradeRows, countryRows, typeRows, sourceRows] = await Promise.all([
      db.select({
        leadId: campaignLeads.id,
        campaignId: campaignLeads.campaignId,
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
        companyRole: prospectCompanies.companyRole,
        productsJson: prospectCompanies.productsJson,
        brandsJson: prospectCompanies.brandsJson,
        wholesaleSignal: prospectCompanies.wholesaleSignal,
        productDirectionsJson: prospectCompanies.productDirectionsJson,
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
        .where(campaignWhere).groupBy(campaignLeads.workflowStatus),
      db.select({ key: campaignLeads.grade, value: count() }).from(campaignLeads)
        .where(campaignWhere).groupBy(campaignLeads.grade),
      db.selectDistinct({ value: prospectCompanies.country }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(and(campaignWhere, isNotNull(prospectCompanies.country))).orderBy(asc(prospectCompanies.country)),
      db.selectDistinct({ customerType: prospectCompanies.customerType, companyType: prospectCompanies.companyType }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id)).where(campaignWhere),
      db.selectDistinct({ value: prospectCompanies.sourceType }).from(campaignLeads)
        .innerJoin(prospectCompanies, eq(campaignLeads.companyId, prospectCompanies.id))
        .where(and(campaignWhere, isNotNull(prospectCompanies.sourceType))).orderBy(asc(prospectCompanies.sourceType)),
    ]);
    const total = totals[0]?.value || 0;
    const statusCounts = Object.fromEntries(statusRows.map((row) => [row.key, Number(row.value || 0)]));
    statusCounts.all = Object.values(statusCounts).reduce((sum, value) => sum + value, 0);
    const gradeCounts = Object.fromEntries(gradeRows.map((row) => [row.key, Number(row.value || 0)]));
    const companyTypes = [...new Set(typeRows.map((row) => row.customerType || row.companyType).filter(Boolean) as string[])].sort();
    return Response.json({
      rows,
      pagination: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) },
      facets: {
        statusCounts,
        gradeCounts,
        countries: countryRows.map((row) => row.value).filter(Boolean),
        companyTypes,
        sourceTypes: sourceRows.map((row) => row.value).filter(Boolean),
      },
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
