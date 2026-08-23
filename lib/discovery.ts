import { canonicalSourceUrl, normalizeCompanyName } from "@/lib/lead-engine";
import {
  B2B_LEXICAL_TERMS,
  classifyBusinessRoles,
  EYEWEAR_LEXICAL_TERMS,
  INTERNAL_EVIDENCE_PAGE_TERMS,
  PRODUCT_LEXICAL_TERMS,
} from "@/lib/customer-scope";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".test", ".invalid", ".example"];
const BLOCKED_DESTINATIONS = [
  "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "youtu.be", "x.com", "twitter.com",
  "tiktok.com", "pinterest.com", "google.com", "bing.com", "yahoo.com", "amazon.com", "alibaba.com",
  "aliexpress.com", "ebay.com", "etsy.com", "whatsapp.com", "wa.me", "doubleclick.net",
  "e-ve.event-form.jp", "closerstillmedia.com", "asp.events", "mya2zevents.com", "a2zevents.zendesk.com",
];
const GENERIC_EMAIL_PREFIXES = new Set([
  "info", "sales", "contact", "office", "wholesale", "trade", "orders", "hello", "support",
  "enquiries", "inquiries", "export", "commercial", "business", "marketing", "international",
]);
const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 8_000;

export type PublicBusinessContact = {
  type: "email" | "phone" | "form" | "contact_page";
  value: string;
  sourceUrl: string;
  sourceTitle: string;
  sameCompanyDomain: boolean;
  trustedOfficialSource: boolean;
  businessUse: boolean;
  status: "valid" | "invalid" | "unverified";
};
export type DiscoveryCandidate = {
  websiteUrl: string;
  normalizedDomain: string;
  label: string;
  directoryUrl?: string;
  directoryDetailUrl?: string;
  directoryTitle?: string;
  directoryCategory?: string;
  directoryCountry?: string;
  officialContacts?: PublicBusinessContact[];
};
export type PublicPage = { url: string; title: string; html: string; text: string; classificationText?: string };
export type SiteEvidence = {
  companyName: string;
  country: string;
  companyType: string;
  businessEmail: string;
  contactChannel: string;
  eyewearTerms: string[];
  b2bTerms: string[];
  productTerms: string[];
  contacts: PublicBusinessContact[];
  pages: PublicPage[];
};

function ipv4Number(hostname: string) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return null;
  return parts.map(Number);
}

function isBlockedIpv4(parts: number[]) {
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19));
}

function isBlockedIpv6(hostname: string) {
  const value = hostname.replace(/^\[|\]$/g, "").toLocaleLowerCase();
  if (!value.includes(":")) return false;
  return value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd")
    || /^fe[89ab]/.test(value) || value.startsWith("2001:db8:") || value.startsWith("::ffff:127.")
    || value.startsWith("::ffff:10.") || value.startsWith("::ffff:192.168.");
}

export function publicHttpUrl(value: unknown, base?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) throw new Error("URL 不能为空");
  const url = base ? new URL(raw, base) : new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("只允许 HTTP/HTTPS 公共网址");
  if (url.username || url.password) throw new Error("网址不能包含登录凭据");
  if (url.port && !new Set(["80", "443"]).has(url.port)) throw new Error("网址不能使用非标准端口");
  const hostname = url.hostname.toLocaleLowerCase().replace(/\.$/, "");
  if (!hostname || BLOCKED_HOSTS.has(hostname) || BLOCKED_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) throw new Error("不允许访问内部地址");
  const ipv4 = ipv4Number(hostname);
  if (!hostname.includes(".") && !ipv4 && !hostname.includes(":")) throw new Error("网址必须包含有效的公共域名");
  if ((ipv4 && isBlockedIpv4(ipv4)) || isBlockedIpv6(hostname)) throw new Error("不允许访问私有或保留地址");
  url.hash = "";
  return url;
}

export function normalizedDomain(value: string) {
  return publicHttpUrl(value).hostname.toLocaleLowerCase().replace(/^www\./, "");
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function plainText(html: string) {
  return decodeHtml(html
    .replace(/<(script|style|template|svg|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>|<\/p>|<\/li>|<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t\f\v]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function attribute(source: string, name: string) {
  const match = source.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return decodeHtml(match?.[1] || match?.[2] || match?.[3] || "").trim();
}

function titleFromHtml(html: string) {
  const og = [...html.matchAll(/<meta\b[^>]*>/gi)].find((match) => /(?:property|name)\s*=\s*["']og:site_name["']/i.test(match[0]));
  if (og) return attribute(og[0], "content").slice(0, 220);
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  return decodeHtml(title).replace(/\s+/g, " ").trim().slice(0, 220);
}

function domainBlocked(hostname: string, sourceDomain = "") {
  const normalized = hostname.toLocaleLowerCase().replace(/^www\./, "");
  return normalized === sourceDomain || normalized.endsWith(`.${sourceDomain}`)
    || BLOCKED_DESTINATIONS.some((domain) => normalized === domain || normalized.endsWith(`.${domain}`));
}

export function extractDirectoryCandidates(html: string, sourceUrl: string, limit = 20, offset = 0) {
  const sourceDomain = normalizedDomain(sourceUrl);
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  const safeLimit = Math.max(1, Math.min(500, limit));
  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const url = publicHttpUrl(href, sourceUrl);
      const domain = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
      if (domainBlocked(domain, sourceDomain) || seen.has(domain)) continue;
      seen.add(domain);
      candidates.push({ websiteUrl: `${url.protocol}//${url.host}/`, normalizedDomain: domain, label: plainText(match[2]).slice(0, 180) });
      if (candidates.length >= safeOffset + safeLimit) break;
    } catch {
      // Malformed, internal and non-public links are deliberately ignored.
    }
  }
  return candidates.slice(safeOffset, safeOffset + safeLimit);
}

function classificationText(html: string) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
  return plainText(main
    .replace(/<(nav|footer|header|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(article|section|div)\b[^>]*(?:class|id)\s*=\s*["'][^"']*(?:blog|news|press|related-post)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi, " "));
}

export function extractExhibitorCardCandidates(html: string, sourceUrl: string, limit = 20, offset = 0) {
  const direct = extractDirectoryCandidates(html, sourceUrl, 500);
  const sourceDomain = normalizedDomain(sourceUrl);
  const seen = new Set(direct.map((candidate) => candidate.normalizedDomain));
  const detailCandidates: DiscoveryCandidate[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    const label = plainText(match[2]).replace(/^[•\-–—\s]+/, "").trim().slice(0, 180);
    if (!href || label.length < 3 || !/[\p{L}]/u.test(label)) continue;
    try {
      const url = publicHttpUrl(href, sourceUrl);
      const domain = normalizedDomain(url.toString());
      if (domain !== sourceDomain) continue;
      const className = attribute(match[1], "class");
      const isDetailPath = /\/(?:exhibitors?|aussteller|wystawcy?|companies|company|profiles?|profile|brands?|brand|firma|suppliers?|supplier)\/[^/?#]+/i.test(url.pathname);
      const isDetailCard = /(?:exhibitor|company|supplier)[-_ ]?(?:card|item|profile|entry|title)/i.test(className);
      if (!isDetailPath && !isDetailCard) continue;
      const canonical = canonicalSourceUrl(url.toString());
      if (canonical === canonicalSourceUrl(sourceUrl)) continue;
      const key = `detail:${canonical}`;
      if (seen.has(key)) continue;
      seen.add(key);
      detailCandidates.push({
        websiteUrl: "",
        normalizedDomain: key,
        label,
        directoryUrl: canonicalSourceUrl(sourceUrl),
        directoryDetailUrl: canonical,
      });
      if (direct.length + detailCandidates.length >= 500) break;
    } catch {
      // Ignore malformed or non-public detail links.
    }
  }
  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  const safeLimit = Math.max(1, Math.min(500, limit));
  // Official exhibitor detail cards are stronger candidates than unrelated footer/service links.
  // Process them first so a bounded batch does not get consumed by event-platform navigation.
  return [...detailCandidates, ...direct].slice(safeOffset, safeOffset + safeLimit);
}

function tableCells(rowHtml: string) {
  return [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => match[1]);
}

export function extractVisionCouncilCandidates(html: string, sourceUrl: string, limit = 20, offset = 0) {
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  const safeLimit = Math.max(1, Math.min(500, limit));
  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  for (const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = tableCells(row[1]);
    if (cells.length < 2) continue;
    const label = plainText(cells[0].match(/<strong\b[^>]*>([\s\S]*?)<\/strong>/i)?.[1] || "").slice(0, 180);
    const anchor = cells[1].match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    const href = anchor ? attribute(anchor[1], "href") : "";
    if (!label || !href) continue;
    try {
      const url = publicHttpUrl(href, sourceUrl);
      const domain = normalizedDomain(url.toString());
      if (domainBlocked(domain, normalizedDomain(sourceUrl)) || seen.has(domain)) continue;
      seen.add(domain);
      const contactText = plainText(cells[1]);
      const phone = contactText.match(/(?:\+?\d|\(\d)[\d\s().-]{7,}\d/)?.[0]?.replace(/\s+/g, " ").trim() || "";
      candidates.push({
        websiteUrl: `${url.protocol}//${url.host}/`,
        normalizedDomain: domain,
        label,
        directoryUrl: canonicalSourceUrl(sourceUrl),
        directoryTitle: "The Vision Council Member Companies",
        directoryCategory: plainText(cells[2] || "").slice(0, 240),
        officialContacts: phone ? [{
          type: "phone", value: phone, sourceUrl: canonicalSourceUrl(sourceUrl),
          sourceTitle: "The Vision Council Member Companies", sameCompanyDomain: false,
          trustedOfficialSource: true, businessUse: true, status: "valid",
        }] : [],
      });
      if (candidates.length >= safeOffset + safeLimit) break;
    } catch {
      // Ignore malformed or non-public company website links.
    }
  }
  return candidates.slice(safeOffset, safeOffset + safeLimit);
}

function directoryCountryName(value: string) {
  const code = value.trim().toLocaleUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return value.trim();
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function trustedDirectoryEmail(value: string, sourceUrl: string, sourceTitle: string): PublicBusinessContact[] {
  const email = value.trim().toLocaleLowerCase().replace(/[),.;:]+$/, "");
  const [local] = email.split("@");
  if (!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email) || !GENERIC_EMAIL_PREFIXES.has(local)) return [];
  return [{
    type: "email", value: email, sourceUrl: canonicalSourceUrl(sourceUrl), sourceTitle,
    sameCompanyDomain: false, trustedOfficialSource: true, businessUse: true, status: "valid",
  }];
}

export function extractMidoMapCandidates(html: string, sourceUrl: string, limit = 20, offset = 0) {
  const sourceTitle = "MIDO Exhibitors Map 2026";
  const candidates: Array<DiscoveryCandidate & { priority: number }> = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<div\b([^>]*\bclass\s*=\s*["'][^"']*\bmap-exhibitor\b[^"']*["'][^>]*)>/gi)) {
    const tag = match[1];
    const label = attribute(tag, "data-name").slice(0, 180);
    const rawWebsite = attribute(tag, "data-href") || attribute(tag, "data-website");
    const countryCode = attribute(tag, "data-country");
    if (!label || !rawWebsite || countryCode.toLocaleUpperCase() === "CN") continue;
    try {
      const website = publicHttpUrl(rawWebsite, sourceUrl);
      const domain = normalizedDomain(website.toString());
      if (domainBlocked(domain, normalizedDomain(sourceUrl)) || seen.has(domain)) continue;
      seen.add(domain);
      const country = directoryCountryName(countryCode);
      const categories = attribute(tag, "data-categories");
      const priority = /(distribut|import|wholesale|trade|trading)/i.test(label) ? 0
        : /(optical|optic|eyewear|lens|vision)/i.test(label) ? 1 : 2;
      candidates.push({
        websiteUrl: `${website.protocol}//${website.host}/`,
        normalizedDomain: domain,
        label,
        directoryUrl: canonicalSourceUrl(sourceUrl),
        directoryTitle: sourceTitle,
        directoryCategory: [country ? `Country: ${country}` : "", categories ? `Categories: ${categories}` : ""].filter(Boolean).join("; "),
        directoryCountry: country,
        officialContacts: trustedDirectoryEmail(attribute(tag, "data-email"), sourceUrl, sourceTitle),
        priority,
      });
    } catch {
      // Entries without a valid public company website cannot enter the candidate pool.
    }
  }
  candidates.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label));
  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  const safeLimit = Math.max(1, Math.min(500, limit));
  return candidates.slice(safeOffset, safeOffset + safeLimit).map(({ priority, ...candidate }) => {
    void priority;
    return candidate;
  });
}

function unresolvedCandidate(label: string, sourceUrl: string): DiscoveryCandidate {
  const key = normalizeCompanyName(label).replace(/\s+/g, "-").slice(0, 120) || crypto.randomUUID();
  return { websiteUrl: "", normalizedDomain: `unresolved:${key}`, label, directoryUrl: canonicalSourceUrl(sourceUrl) };
}

export function extractTextExhibitorHints(html: string, sourceUrl: string, limit = 20, offset = 0) {
  const safeLimit = Math.max(1, Math.min(20, limit));
  const direct = extractDirectoryCandidates(html, sourceUrl, 500);
  const names: string[] = [];
  const seen = new Set(direct.map((candidate) => normalizeCompanyName(candidate.label)));
  const tagged = [...html.matchAll(/<(?:h[2-5]|strong|li)\b[^>]*>([\s\S]*?)<\/(?:h[2-5]|strong|li)>/gi)]
    .map((match) => plainText(match[1]));
  const lineCandidates = plainText(html).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const rawLabel of [...tagged, ...lineCandidates]) {
    const label = rawLabel.replace(/^[•\-–—\s]+/, "").trim();
    const normalized = normalizeCompanyName(label);
    if (!normalized || label.length < 3 || label.length > 160 || seen.has(normalized)) continue;
    if (/^(menu|contact|newsletter|exhibitors?|wystawcy|read more|learn more|home|page \d+|strona \d+)$/i.test(label)) continue;
    if (!/[\p{L}]/u.test(label)) continue;
    seen.add(normalized);
    names.push(label);
    if (direct.length + names.length >= Math.min(1000, offset + safeLimit)) break;
  }
  return [...direct, ...names.map((name) => unresolvedCandidate(name, sourceUrl))].slice(offset, offset + safeLimit);
}

export function parseDirectoryCandidates(parserKey: string, html: string, sourceUrl: string, limit = 20, offset = 0) {
  if (parserKey === "vision_council_members") return extractVisionCouncilCandidates(html, sourceUrl, limit, offset);
  if (parserKey === "mido_exhibitor_map") return extractMidoMapCandidates(html, sourceUrl, limit, offset);
  if (parserKey === "exhibitor_cards") return extractExhibitorCardCandidates(html, sourceUrl, limit, offset);
  if (parserKey === "exhibitor_text") return extractTextExhibitorHints(html, sourceUrl, limit, offset);
  if (parserKey === "dynamic_directory") throw new Error("dynamic_directory_requires_confirmed_public_endpoint");
  if (parserKey === "pdf_directory") throw new Error("pdf_directory_requires_binary_adapter");
  return extractDirectoryCandidates(html, sourceUrl, limit, offset);
}

type DynamicDirectoryConfig = {
  itemsPath?: string;
  nameField?: string;
  websiteField?: string;
  detailField?: string;
  flattenObjectArrays?: boolean;
};

function pathValue(value: unknown, path = "") {
  if (!path) return value;
  return path.split(".").filter(Boolean).reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

export function parseDynamicDirectoryPayload(
  payload: unknown,
  sourceUrl: string,
  config: DynamicDirectoryConfig = {},
  limit = 20,
  offset = 0,
) {
  const itemsPath = config.itemsPath === "" ? "" : config.itemsPath || "items";
  const itemsValue = pathValue(payload, itemsPath);
  const flattened = config.flattenObjectArrays && itemsValue && typeof itemsValue === "object" && !Array.isArray(itemsValue)
    ? Object.values(itemsValue as Record<string, unknown>).flatMap((value) => Array.isArray(value) ? value : [])
    : [];
  const items = Array.isArray(itemsValue) ? itemsValue : Array.isArray(payload) ? payload : flattened;
  const nameField = config.nameField || "name";
  const websiteField = config.websiteField || "website";
  const detailField = config.detailField || "url";
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const item of items.slice(0, 10_000)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const label = String(pathValue(record, nameField) || "").trim().slice(0, 180);
    if (label.length < 2) continue;
    let websiteUrl = "";
    let directoryDetailUrl = "";
    try {
      const rawWebsite = pathValue(record, websiteField);
      if (rawWebsite) websiteUrl = publicHttpUrl(String(rawWebsite), sourceUrl).toString();
    } catch {
      // Invalid website URLs stay unresolved and may still be resolved from an official detail page.
    }
    try {
      const rawDetail = pathValue(record, detailField);
      if (rawDetail) directoryDetailUrl = canonicalSourceUrl(publicHttpUrl(String(rawDetail), sourceUrl).toString());
    } catch {
      // Invalid detail URLs are ignored.
    }
    let key = normalizeCompanyName(label);
    if (websiteUrl) key = normalizedDomain(websiteUrl);
    else if (directoryDetailUrl) key = `detail:${directoryDetailUrl}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    candidates.push({
      websiteUrl: websiteUrl ? canonicalSourceUrl(websiteUrl) : "",
      normalizedDomain: websiteUrl ? normalizedDomain(websiteUrl) : key,
      label,
      directoryUrl: canonicalSourceUrl(sourceUrl),
      directoryDetailUrl: directoryDetailUrl || undefined,
    });
  }
  const safeOffset = Math.max(0, Math.min(100_000, Math.trunc(offset)));
  const safeLimit = Math.max(1, Math.min(500, limit));
  return candidates.slice(safeOffset, safeOffset + safeLimit);
}

async function readBody(response: Response, maxBytes = MAX_HTML_BYTES) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let output = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("页面超过采集大小上限");
    }
    output += decoder.decode(value, { stream: true });
  }
  return output + decoder.decode();
}

type TextRequestOptions = {
  method?: "GET" | "POST";
  body?: string;
  contentType?: "application/x-www-form-urlencoded";
};

async function fetchWithRedirects(urlValue: string, accept: string, maxBytes: number, request: TextRequestOptions = {}) {
  let current = publicHttpUrl(urlValue);
  let method = request.method || "GET";
  let body = method === "POST" ? request.body || "" : undefined;
  if (body && new TextEncoder().encode(body).byteLength > 10_000) throw new Error("请求正文超过大小上限");
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        method,
        body,
        redirect: "manual",
        signal: controller.signal,
        headers: {
          Accept: accept,
          "User-Agent": "QIXIN-Lead-Engine/1.0 (+private evidence collector)",
          ...(method === "POST" && request.contentType ? { "Content-Type": request.contentType } : {}),
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("重定向次数过多");
        current = publicHttpUrl(location, current.toString());
        if (response.status === 303 || ((response.status === 301 || response.status === 302) && method === "POST")) {
          method = "GET";
          body = undefined;
        }
        continue;
      }
      return { response, body: await readBody(response, maxBytes), finalUrl: current.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("重定向次数过多");
}

async function readBinary(response: Response, maxBytes: number) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      throw new Error("文件超过采集大小上限");
    }
    chunks.push(value);
  }
  const output = new Uint8Array(received);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.byteLength;
  }
  return output;
}

async function fetchBinaryWithRedirects(urlValue: string, accept: string, maxBytes: number) {
  let current = publicHttpUrl(urlValue);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: accept, "User-Agent": "QIXIN-Lead-Engine/1.0 (+private evidence collector)" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirect === 3) throw new Error("重定向次数过多");
        current = publicHttpUrl(location, current.toString());
        continue;
      }
      return { response, body: await readBinary(response, maxBytes), finalUrl: current.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("重定向次数过多");
}

export function robotsAllows(robots: string, path: string) {
  let applies = false;
  let sawRule = false;
  let bestLength = -1;
  let bestAllow = true;
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.replace(/#.*$/, "").trim();
    if (!clean) continue;
    const separator = clean.indexOf(":");
    if (separator < 0) continue;
    const key = clean.slice(0, separator).trim().toLocaleLowerCase();
    const value = clean.slice(separator + 1).trim();
    if (key === "user-agent") {
      if (sawRule) {
        applies = false;
        sawRule = false;
      }
      applies ||= value === "*" || value.toLocaleLowerCase() === "qixin-lead-engine";
    } else if (key === "allow" || key === "disallow") {
      sawRule = true;
      if (!applies || !value || !path.startsWith(value)) continue;
      const allow = key === "allow";
      if (value.length > bestLength || (value.length === bestLength && allow)) {
        bestLength = value.length;
        bestAllow = allow;
      }
    }
  }
  return bestAllow;
}

async function ensureRobotsAllowed(url: URL) {
  try {
    const robotsUrl = new URL("/robots.txt", url).toString();
    const robots = await fetchWithRedirects(robotsUrl, "text/plain,*/*;q=0.1", 250_000);
    if (robots.response.ok && !robotsAllows(robots.body, `${url.pathname}${url.search}`)) throw new Error("robots.txt 不允许采集此页面");
  } catch (error) {
    if (error instanceof Error && error.message.includes("不允许采集")) throw error;
    // Missing or unreachable robots.txt does not expand the strict URL, size and rate limits.
  }
}

export async function fetchPublicHtml(urlValue: string, checkRobots = true): Promise<PublicPage> {
  const url = publicHttpUrl(urlValue);
  if (checkRobots) await ensureRobotsAllowed(url);
  const result = await fetchWithRedirects(url.toString(), "text/html,application/xhtml+xml", MAX_HTML_BYTES);
  if (!result.response.ok) throw new Error(`页面返回 HTTP ${result.response.status}`);
  const contentType = result.response.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("目标不是 HTML 页面");
  return {
    url: canonicalSourceUrl(result.finalUrl),
    title: titleFromHtml(result.body),
    html: result.body,
    text: plainText(result.body).slice(0, 200_000),
    classificationText: classificationText(result.body).slice(0, 160_000),
  };
}

export async function fetchPublicJson(urlValue: string, request: TextRequestOptions = {}) {
  const url = publicHttpUrl(urlValue);
  await ensureRobotsAllowed(url);
  const result = await fetchWithRedirects(url.toString(), "application/json,text/json;q=0.9", MAX_HTML_BYTES, request);
  if (!result.response.ok) throw new Error(`动态目录返回 HTTP ${result.response.status}`);
  const contentType = result.response.headers.get("content-type") || "";
  if (!/json/i.test(contentType)) throw new Error("动态目录接口未返回 JSON");
  try {
    return { url: canonicalSourceUrl(result.finalUrl), payload: JSON.parse(result.body) as unknown };
  } catch {
    throw new Error("动态目录接口返回无效 JSON");
  }
}

export async function fetchPublicPdfText(urlValue: string) {
  const url = publicHttpUrl(urlValue);
  await ensureRobotsAllowed(url);
  const result = await fetchBinaryWithRedirects(url.toString(), "application/pdf", 6_000_000);
  if (!result.response.ok) throw new Error(`PDF 返回 HTTP ${result.response.status}`);
  const contentType = result.response.headers.get("content-type") || "";
  if (!/application\/pdf/i.test(contentType) && !/\.pdf$/i.test(new URL(result.finalUrl).pathname)) throw new Error("目标不是 PDF 文件");
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(result.body);
  if (pdf.numPages > 100) throw new Error("PDF 页数超过 100 页上限");
  const extracted = await extractText(pdf, { mergePages: true });
  return {
    url: canonicalSourceUrl(result.finalUrl),
    text: String(extracted.text || "").slice(0, 500_000),
    pageCount: pdf.numPages,
  };
}

function uniqueMatches(text: string, terms: string[]) {
  const normalized = text.toLocaleLowerCase();
  return terms.filter((term) => normalized.includes(term.toLocaleLowerCase()));
}

function genericEmails(text: string, domain: string) {
  const matches = text.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  return [...new Set(matches.map((email) => email.toLocaleLowerCase().replace(/[),.;:]+$/, "")))]
    .filter((email) => {
      const [local, emailDomain] = email.split("@");
      return GENERIC_EMAIL_PREFIXES.has(local) && (emailDomain === domain || emailDomain.endsWith(`.${domain}`));
    });
}

function publicBusinessPhones(text: string) {
  const matches = text.match(/(?:\+?\d|\(\d)[\d\s().-]{7,}\d/g) || [];
  return [...new Set(matches.map((phone) => phone.replace(/\s+/g, " ").trim()))]
    .filter((phone) => {
      const digitCount = phone.replace(/\D/g, "").length;
      return digitCount >= 8 && digitCount <= 16;
    }).slice(0, 3);
}

function pageContacts(page: PublicPage, companyDomain: string): PublicBusinessContact[] {
  const contacts: PublicBusinessContact[] = [];
  const isContactPage = /(?:^|\/)(contact|contact-us|kontakt|contacto|contatti|inquiries?|enquiries?)(?:\/|$)/i.test(new URL(page.url).pathname)
    || /^(contact(?: us)?|get in touch|business enquiries|sales enquiries)(?:\s*[|—–-]|$)/i.test(page.title.trim());
  for (const email of genericEmails(page.text, companyDomain)) {
    contacts.push({
      type: "email", value: email, sourceUrl: page.url, sourceTitle: page.title,
      sameCompanyDomain: true, trustedOfficialSource: false, businessUse: true, status: "valid",
    });
  }
  if (isContactPage) {
    for (const phone of publicBusinessPhones(page.text)) {
      contacts.push({
        type: "phone", value: phone, sourceUrl: page.url, sourceTitle: page.title,
        sameCompanyDomain: true, trustedOfficialSource: false, businessUse: true, status: "valid",
      });
    }
    const hasForm = /<form\b/i.test(page.html) && /<(?:input|textarea|button)\b/i.test(page.html);
    contacts.push({
      type: hasForm ? "form" : "contact_page", value: page.url, sourceUrl: page.url, sourceTitle: page.title,
      sameCompanyDomain: true, trustedOfficialSource: false, businessUse: true, status: "valid",
    });
  }
  return contacts;
}

function internalPageLinks(page: PublicPage, max = 3) {
  const rootDomain = normalizedDomain(page.url);
  const links: Array<{ score: number; url: string }> = [];
  const seen = new Set<string>();
  for (const match of page.html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    if (!href || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const url = publicHttpUrl(href, page.url);
      if (normalizedDomain(url.toString()) !== rootDomain) continue;
      const canonical = canonicalSourceUrl(url.toString());
      if (canonical === page.url || seen.has(canonical)) continue;
      const context = `${url.pathname} ${plainText(match[2])}`.toLocaleLowerCase();
      const score = INTERNAL_EVIDENCE_PAGE_TERMS.reduce((sum, term) => sum + (context.includes(term) ? 1 : 0), 0);
      if (!score) continue;
      seen.add(canonical);
      links.push({ score, url: canonical });
    } catch {
      // Ignore malformed and non-public internal links.
    }
  }
  return links.sort((left, right) => right.score - left.score).slice(0, max).map((item) => item.url);
}

function structuredCountry(html: string) {
  const match = html.match(/["']addressCountry["']\s*:\s*(?:\{[^}]*["']name["']\s*:\s*)?["']([^"']{2,80})["']/i);
  return decodeHtml(match?.[1] || "").trim();
}

function companyNameFrom(page: PublicPage, fallback: string) {
  const jsonName = page.html.match(/["']legalName["']\s*:\s*["']([^"']{2,160})["']/i)?.[1];
  const title = jsonName || page.title.split(/\s+[|—–-]\s+/)[0] || fallback;
  const cleaned = decodeHtml(title).replace(/\s+/g, " ").trim().slice(0, 180);
  return normalizeCompanyName(cleaned) ? cleaned : fallback;
}

export async function collectSiteEvidence(candidate: DiscoveryCandidate): Promise<SiteEvidence> {
  if (!candidate.websiteUrl) throw new Error("company_website_unresolved");
  const homepage = await fetchPublicHtml(candidate.websiteUrl);
  const pages = [homepage];
  const supportingPages = await Promise.all(internalPageLinks(homepage, 3).map(async (url) => {
    try { return await fetchPublicHtml(url); } catch { return null; }
  }));
  pages.push(...supportingPages.filter((page): page is PublicPage => Boolean(page)));
  const combined = pages.map((page) => page.classificationText || page.text).join("\n");
  const eyewearTerms = uniqueMatches(combined, EYEWEAR_LEXICAL_TERMS);
  const b2bTerms = uniqueMatches(combined, B2B_LEXICAL_TERMS);
  const productTerms = uniqueMatches(combined, PRODUCT_LEXICAL_TERMS);
  const contacts = [...pages.flatMap((page) => pageContacts(page, normalizedDomain(homepage.url))), ...(candidate.officialContacts || [])];
  const email = contacts.find((contact) => contact.type === "email" && contact.status === "valid");
  const channel = contacts.find((contact) => ["form", "contact_page", "phone"].includes(contact.type) && contact.status === "valid");
  const companyName = companyNameFrom(homepage, candidate.label || candidate.normalizedDomain);
  const country = pages.map((page) => structuredCountry(page.html)).find(Boolean) || candidate.directoryCountry || "";
  const roles = classifyBusinessRoles({ companyName, country, companyType: "", eyewearTerms, b2bTerms, productTerms, pages });
  return {
    companyName,
    country,
    companyType: roles.map((role) => role.value).join(" / ") || "Eyewear Company — type needs review",
    businessEmail: email?.value || "",
    contactChannel: channel ? `${channel.type}: ${channel.value}` : "",
    eyewearTerms,
    b2bTerms,
    productTerms,
    contacts,
    pages,
  };
}
