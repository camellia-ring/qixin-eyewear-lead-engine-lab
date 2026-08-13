import { canonicalSourceUrl, normalizeCompanyName } from "@/lib/lead-engine";

const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal"]);
const BLOCKED_SUFFIXES = [".local", ".internal", ".localhost", ".test", ".invalid", ".example"];
const BLOCKED_DESTINATIONS = [
  "facebook.com", "instagram.com", "linkedin.com", "youtube.com", "youtu.be", "x.com", "twitter.com",
  "tiktok.com", "pinterest.com", "google.com", "bing.com", "yahoo.com", "amazon.com", "alibaba.com",
  "aliexpress.com", "ebay.com", "etsy.com", "whatsapp.com", "wa.me", "doubleclick.net",
];
const GENERIC_EMAIL_PREFIXES = new Set(["info", "sales", "contact", "office", "wholesale", "trade", "orders", "hello", "support", "enquiries", "inquiries"]);
const EYEWEAR_TERMS = [
  "eyewear", "eyeglass", "eyeglasses", "spectacle", "spectacles", "optical frame", "optical frames",
  "sunglass", "sunglasses", "reading glasses", "ophthalmic lens", "optical lens", "safety glasses",
  "brillen", "sonnenbrillen", "lunettes", "montures", "gafas", "monturas", "occhiali", "okulary",
];
const B2B_TERMS = [
  "wholesale", "wholesaler", "distributor", "distribution", "importer", "trade customer", "trade account",
  "stockist", "retailer login", "b2b", "private label", "white label", "oem", "odm", "bulk order",
  "grosshandel", "großhandel", "distributeur", "mayorista", "distribuidor", "hurtownia", "dystrybutor",
];
const INTERNAL_PAGE_TERMS = [
  "about", "company", "products", "collections", "eyewear", "glasses", "frames", "wholesale", "trade",
  "distributor", "stockist", "contact", "brands", "private-label", "oem",
];
const MAX_HTML_BYTES = 1_250_000;
const FETCH_TIMEOUT_MS = 8_000;

export type DiscoveryCandidate = { websiteUrl: string; normalizedDomain: string; label: string };
export type PublicPage = { url: string; title: string; html: string; text: string };
export type SiteEvidence = {
  companyName: string;
  country: string;
  companyType: string;
  businessEmail: string;
  contactChannel: string;
  eyewearTerms: string[];
  b2bTerms: string[];
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

export function extractDirectoryCandidates(html: string, sourceUrl: string, limit = 20) {
  const sourceDomain = normalizedDomain(sourceUrl);
  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data):/i.test(href)) continue;
    try {
      const url = publicHttpUrl(href, sourceUrl);
      const domain = url.hostname.toLocaleLowerCase().replace(/^www\./, "");
      if (domainBlocked(domain, sourceDomain) || seen.has(domain)) continue;
      seen.add(domain);
      candidates.push({ websiteUrl: `${url.protocol}//${url.host}/`, normalizedDomain: domain, label: plainText(match[2]).slice(0, 180) });
      if (candidates.length >= Math.max(1, Math.min(20, limit))) break;
    } catch {
      // Malformed, internal and non-public links are deliberately ignored.
    }
  }
  return candidates;
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

async function fetchWithRedirects(urlValue: string, accept: string, maxBytes: number) {
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
      return { response, body: await readBody(response, maxBytes), finalUrl: current.toString() };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("重定向次数过多");
}

function robotsAllows(robots: string, path: string) {
  let applies = false;
  for (const line of robots.split(/\r?\n/)) {
    const clean = line.replace(/#.*$/, "").trim();
    if (!clean) continue;
    const separator = clean.indexOf(":");
    if (separator < 0) continue;
    const key = clean.slice(0, separator).trim().toLocaleLowerCase();
    const value = clean.slice(separator + 1).trim();
    if (key === "user-agent") {
      applies = value === "*" || value.toLocaleLowerCase() === "qixin-lead-engine";
    } else if (applies && key === "disallow" && value && path.startsWith(value)) {
      return false;
    }
  }
  return true;
}

export async function fetchPublicHtml(urlValue: string, checkRobots = true): Promise<PublicPage> {
  const url = publicHttpUrl(urlValue);
  if (checkRobots) {
    try {
      const robotsUrl = new URL("/robots.txt", url).toString();
      const robots = await fetchWithRedirects(robotsUrl, "text/plain,*/*;q=0.1", 250_000);
      if (robots.response.ok && !robotsAllows(robots.body, `${url.pathname}${url.search}`)) throw new Error("robots.txt 不允许采集此页面");
    } catch (error) {
      if (error instanceof Error && error.message.includes("不允许采集")) throw error;
      // Missing or unreachable robots.txt does not grant access beyond the strict page/rate limits.
    }
  }
  const result = await fetchWithRedirects(url.toString(), "text/html,application/xhtml+xml", MAX_HTML_BYTES);
  if (!result.response.ok) throw new Error(`页面返回 HTTP ${result.response.status}`);
  const contentType = result.response.headers.get("content-type") || "";
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) throw new Error("目标不是 HTML 页面");
  return { url: canonicalSourceUrl(result.finalUrl), title: titleFromHtml(result.body), html: result.body, text: plainText(result.body).slice(0, 200_000) };
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
      const score = INTERNAL_PAGE_TERMS.reduce((sum, term) => sum + (context.includes(term) ? 1 : 0), 0);
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

function inferredCompanyType(b2bTerms: string[]) {
  const joined = b2bTerms.join(" ").toLocaleLowerCase();
  if (/private label|white label|oem|odm/.test(joined)) return "Private Label / OEM Eyewear Company";
  if (/wholesale|wholesaler|grosshandel|großhandel|mayorista|hurtownia/.test(joined)) return "Eyewear Wholesaler";
  if (/distributor|distribution|distributeur|distribuidor|dystrybutor/.test(joined)) return "Eyewear Distributor";
  if (/importer/.test(joined)) return "Eyewear Importer";
  return "Eyewear Company — type needs review";
}

function companyNameFrom(page: PublicPage, fallback: string) {
  const jsonName = page.html.match(/["'](?:legalName|name)["']\s*:\s*["']([^"']{2,160})["']/i)?.[1];
  const title = jsonName || page.title.split(/\s+[|—–-]\s+/)[0] || fallback;
  const cleaned = decodeHtml(title).replace(/\s+/g, " ").trim().slice(0, 180);
  return normalizeCompanyName(cleaned) ? cleaned : fallback;
}

export async function collectSiteEvidence(candidate: DiscoveryCandidate): Promise<SiteEvidence> {
  const homepage = await fetchPublicHtml(candidate.websiteUrl);
  const pages = [homepage];
  for (const url of internalPageLinks(homepage, 3)) {
    try { pages.push(await fetchPublicHtml(url)); } catch { /* A failed supporting page does not discard the homepage evidence. */ }
  }
  const combined = pages.map((page) => page.text).join("\n");
  const eyewearTerms = uniqueMatches(combined, EYEWEAR_TERMS);
  const b2bTerms = uniqueMatches(combined, B2B_TERMS);
  const emails = genericEmails(combined, normalizedDomain(homepage.url));
  return {
    companyName: companyNameFrom(homepage, candidate.label || candidate.normalizedDomain),
    country: pages.map((page) => structuredCountry(page.html)).find(Boolean) || "",
    companyType: inferredCompanyType(b2bTerms),
    businessEmail: emails[0] || "",
    contactChannel: pages.some((page) => /contact|kontakt|contacto|contatti/i.test(new URL(page.url).pathname)) ? "Public website contact page" : "",
    eyewearTerms,
    b2bTerms,
    pages,
  };
}

export function deterministicScore(evidence: SiteEvidence) {
  const productMatchScore = Math.min(22, evidence.eyewearTerms.length >= 4 ? 22 : evidence.eyewearTerms.length >= 2 ? 18 : 14);
  const customerTypeScore = evidence.b2bTerms.length >= 3 ? 16 : evidence.b2bTerms.length ? 12 : 6;
  const purchasingSignalsScore = evidence.b2bTerms.length >= 3 ? 9 : evidence.b2bTerms.length ? 5 : 0;
  const marketMoqFitScore = evidence.country ? 3 : 0;
  const contactabilityScore = evidence.businessEmail ? 6 : evidence.contactChannel ? 3 : 0;
  const accountPotentialScore = evidence.b2bTerms.length ? 5 : 2;
  const dataQualityScore = evidence.pages.length >= 3 ? 5 : evidence.pages.length === 2 ? 4 : 3;
  const evidenceCoverage = Math.min(70, 25 + evidence.pages.length * 8 + (evidence.b2bTerms.length ? 8 : 0) + (evidence.businessEmail || evidence.contactChannel ? 5 : 0));
  return {
    productMatchScore, customerTypeScore, purchasingSignalsScore, marketMoqFitScore, contactabilityScore, accountPotentialScore, dataQualityScore,
    evidenceCoverage,
    scoreConfidence: evidence.pages.length >= 2 ? "medium" : "low",
    hardGateStatus: "needs_review",
    reasons: {
      productMatchScore: [`官网观察到眼镜相关词：${evidence.eyewearTerms.slice(0, 6).join("、")}`, "尚未人工确认具体采购品类"],
      customerTypeScore: [evidence.b2bTerms.length ? `官网观察到 B2B 词：${evidence.b2bTerms.slice(0, 5).join("、")}` : "官网可确认从事眼镜业务", "客户类型仍需人工确认"],
      purchasingSignalsScore: [evidence.b2bTerms.length ? "官网存在批发、分销或贸易信号" : "", "未观察到明确近期采购项目"],
      marketMoqFitScore: [evidence.country ? `结构化地址国家：${evidence.country}` : "", "MOQ、采购权和供应商关系未知"],
      contactabilityScore: [evidence.businessEmail ? "官网公开通用业务邮箱" : evidence.contactChannel ? "官网公开联系页面" : "", "未采集个人联系人"],
      accountPotentialScore: [evidence.b2bTerms.length ? "官网存在渠道业务信号" : "眼镜业务主体", "采购规模未知"],
      dataQualityScore: [`已采集 ${evidence.pages.length} 个官网页面`, "仅限公开网页，仍需人工复核"],
    } as Record<string, [string, string]>,
  };
}
