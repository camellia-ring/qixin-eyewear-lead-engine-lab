import { env } from "cloudflare:workers";
import { crmProductInterests } from "@/lib/lead-engine";

export const CRM_HANDOFF_CONTRACT_VERSION = "qixin.approved-customer-handoff.v1";
export const CRM_HANDOFF_PATH = "/api/integrations/lead-engine/handoffs";

type Company = {
  id: string;
  companyName: string;
  country: string | null;
  website: string | null;
  primaryDomain: string | null;
  businessEmail: string | null;
  estimatedPurchaseVolume: string | null;
  doNotContact: boolean;
};

type Lead = { id: string; productTrack: string };
type Contact = { fullName: string; jobTitle: string | null; email: string | null };

export type CrmHandoffPayload = {
  contractVersion: typeof CRM_HANDOFF_CONTRACT_VERSION;
  handoffId: string;
  sourceSystem: "qixin-lead-engine";
  sourceLeadId: string;
  company: {
    sourceCompanyId: string;
    name: string;
    country: string | null;
    website: string | null;
    businessEmail: string | null;
    productInterests: string[];
    estimatedPurchaseVolume: string | null;
  };
  contact: { fullName: string; jobTitle: string | null; email: string } | null;
  approval: { status: "approved"; approver: "private_owner"; approvedAt: string };
  suppression: { doNotContact: false };
  notes: string;
};

type RuntimeEnv = typeof env & {
  CRM_HANDOFF_SECRET?: string;
  CRM_HANDOFF_URL?: string;
  CUSTOMER_HTTP_WEBSITE_CRM?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

export function buildCrmHandoffPayload(input: {
  handoffId: string;
  approvedAt: string;
  company: Company;
  lead: Lead;
  contact?: Contact | null;
  reviewNotes?: string | null;
}): CrmHandoffPayload {
  if (input.company.doNotContact) throw new Error("suppressed_customer_rejected");
  const website = input.company.website || (input.company.primaryDomain ? `https://${input.company.primaryDomain}` : null);
  const contactEmail = input.contact?.email || input.company.businessEmail;
  return {
    contractVersion: CRM_HANDOFF_CONTRACT_VERSION,
    handoffId: input.handoffId,
    sourceSystem: "qixin-lead-engine",
    sourceLeadId: input.lead.id,
    company: {
      sourceCompanyId: input.company.id,
      name: input.company.companyName,
      country: input.company.country,
      website,
      businessEmail: input.company.businessEmail,
      productInterests: crmProductInterests(input.lead.productTrack),
      estimatedPurchaseVolume: input.company.estimatedPurchaseVolume,
    },
    contact: contactEmail ? {
      fullName: input.contact?.fullName || `${input.company.companyName} business contact`,
      jobTitle: input.contact?.jobTitle || null,
      email: contactEmail,
    } : null,
    approval: { status: "approved", approver: "private_owner", approvedAt: input.approvedAt },
    suppression: { doNotContact: false },
    notes: [
      "Human-approved in QIXIN Lead Engine.",
      input.reviewNotes?.trim() || "",
    ].filter(Boolean).join(" "),
  };
}

export async function sendCrmHandoff(payload: CrmHandoffPayload) {
  const runtime = env as RuntimeEnv;
  if (!runtime.CRM_HANDOFF_SECRET) throw new Error("crm_handoff_secret_missing");
  const binding = runtime.CUSTOMER_HTTP_WEBSITE_CRM;
  const baseUrl = runtime.CRM_HANDOFF_URL?.replace(/\/$/, "");
  if (!binding && !baseUrl) throw new Error("crm_handoff_destination_missing");
  const target = binding ? `https://website-crm.internal${CRM_HANDOFF_PATH}` : `${baseUrl}${CRM_HANDOFF_PATH}`;
  const response = await (binding?.fetch.bind(binding) || fetch)(target, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${runtime.CRM_HANDOFF_SECRET}`,
      "Content-Type": "application/json",
      "X-Qixin-Contract-Version": CRM_HANDOFF_CONTRACT_VERSION,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({})) as {
    status?: string;
    customerId?: string;
    error?: string;
    duplicateReason?: string | null;
  };
  if (!response.ok || !new Set(["accepted", "duplicate"]).has(body.status || "")) {
    throw Object.assign(new Error(body.error || `crm_handoff_http_${response.status}`), {
      httpStatus: response.status,
      responseCode: body.error || null,
    });
  }
  return {
    status: body.status as "accepted" | "duplicate",
    customerId: body.customerId || null,
    duplicateReason: body.duplicateReason || null,
    httpStatus: response.status,
  };
}
