import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, discoverySources, parserVersions } from "@/db/schema";
import { normalizedDomain } from "@/lib/discovery";
import { campaignCountries, normalizeCountry } from "@/lib/campaign-routing";

export type SourceDefinition = {
  key: string;
  name: string;
  url: string;
  sourceType: "association_directory" | "official_exhibitor_directory";
  region: string;
  markets: readonly string[];
  tier: "A" | "B" | "C";
  enabled: boolean;
  parserKey: "vision_council_members" | "exhibitor_cards" | "exhibitor_text" | "dynamic_directory" | "pdf_directory";
  parserVersion: string;
  priority: number;
  rateLimitMs: number;
  accessNotes: string;
  requiresLogin: boolean;
  isPaid: boolean;
};

export const OFFICIAL_SOURCE_REGISTRY: readonly SourceDefinition[] = [
  {
    key: "vision-council-members",
    name: "The Vision Council Member Companies",
    url: "https://thevisioncouncil.org/member-companies",
    sourceType: "association_directory",
    region: "North America / Global",
    markets: ["United States", "Canada", "Mexico"],
    tier: "A",
    enabled: false,
    parserKey: "vision_council_members",
    parserVersion: "1.0.0",
    priority: 10,
    rateLimitMs: 1800,
    accessNotes: "2026-08-15 复核：公开首屏不再输出会员行，并提示登录后查看联系人及附加信息；不绕登录，暂时禁用。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "vision-expo",
    name: "Vision Expo Exhibitor List",
    url: "https://www.visionexpo.com/en-us/attend/exhibitor-list.html",
    sourceType: "official_exhibitor_directory",
    region: "North America / Global",
    markets: ["United States", "Canada", "Mexico"],
    tier: "A",
    enabled: false,
    parserKey: "dynamic_directory",
    parserVersion: "1.0.0",
    priority: 20,
    rateLimitMs: 2200,
    accessNotes: "官方动态展商目录；默认关闭，需先确认公开接口或可访问服务端渲染结果。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "mido",
    name: "MIDO Exhibitor List",
    url: "https://www.mido.com/en/exhibitor-list",
    sourceType: "official_exhibitor_directory",
    region: "Europe / Global",
    markets: ["Italy", "Germany", "France", "Spain", "Poland", "United Kingdom", "Netherlands", "Austria", "Switzerland"],
    tier: "A",
    enabled: false,
    parserKey: "exhibitor_cards",
    parserVersion: "1.0.0",
    priority: 30,
    rateLimitMs: 2200,
    accessNotes: "2026-08-15 复核：公开 HTML 未输出展商卡片，只出现站点服务链接；等待确认公开接口后再启用。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "opti",
    name: "opti All Exhibitors",
    url: "https://connect.opti.de/en/discover/all-exhibitors",
    sourceType: "official_exhibitor_directory",
    region: "Europe / Global",
    markets: ["Germany", "Austria", "Switzerland", "Netherlands", "Poland"],
    tier: "A",
    enabled: false,
    parserKey: "dynamic_directory",
    parserVersion: "1.0.0",
    priority: 40,
    rateLimitMs: 2500,
    accessNotes: "官方动态目录；若公开页面要求会话、登录或反机器人验证则停止并告警。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "hktdc-optical",
    name: "HKTDC Hong Kong Optical Fair Exhibitors",
    url: "https://www.hktdc.com/event/hkopticalfair/en/exhibitor-list",
    sourceType: "official_exhibitor_directory",
    region: "Asia / Global",
    markets: ["Hong Kong", "China", "South Korea"],
    tier: "A",
    enabled: false,
    parserKey: "dynamic_directory",
    parserVersion: "1.0.0",
    priority: 50,
    rateLimitMs: 2500,
    accessNotes: "官方动态目录；默认关闭，避免在未确认公开接口前产生无效请求。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "100-percent-optical",
    name: "100% Optical Exhibitor List",
    url: "https://www.100percentoptical.com/exhibitor-list",
    sourceType: "official_exhibitor_directory",
    region: "United Kingdom / Global",
    markets: ["United Kingdom"],
    tier: "A",
    enabled: true,
    parserKey: "exhibitor_cards",
    parserVersion: "1.1.0",
    priority: 60,
    rateLimitMs: 2200,
    accessNotes: "官方展商目录；只跟随公开展商详情和企业官网链接。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "diops",
    name: "DIOPS Exhibitors",
    url: "https://www.diops.co.kr/front/sub/sub02_06.php",
    sourceType: "official_exhibitor_directory",
    region: "South Korea / Global",
    markets: ["South Korea"],
    tier: "B",
    enabled: true,
    parserKey: "exhibitor_cards",
    parserVersion: "1.0.0",
    priority: 70,
    rateLimitMs: 2500,
    accessNotes: "官方展商列表；支持公开卡片/详情页，无法取得官网时不计入合格数。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "optyka-2025",
    name: "OPTYKA 2025 Exhibitors and Brands",
    url: "https://targioptyka.pl/pl/dla-zwiedzajacych/wazne-informacje/lista-wystawcow-i-marek-2025",
    sourceType: "official_exhibitor_directory",
    region: "Poland / Europe",
    markets: ["Poland"],
    tier: "B",
    enabled: true,
    parserKey: "exhibitor_text",
    parserVersion: "1.0.0",
    priority: 80,
    rateLimitMs: 2400,
    accessNotes: "官方纯文本展商与品牌名单；无官网的名称需经可替换官网发现 provider 核验。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "pso-2025",
    name: "PSO 2025 Exhibitors",
    url: "https://pso.mtp.pl/pl/dla-zwiedzajacych/wazne-informacje/sprawdz-liste-wystawcow-pso-2025/",
    sourceType: "official_exhibitor_directory",
    region: "Poland / Europe",
    markets: ["Poland"],
    tier: "B",
    enabled: true,
    parserKey: "exhibitor_text",
    parserVersion: "1.0.0",
    priority: 90,
    rateLimitMs: 2400,
    accessNotes: "官方纯文本展商名单；名称只是线索，必须另行核验企业官网和商务联系方式。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "oxo-2026",
    name: "OXO 2026 Exhibitors",
    url: "https://targioxo.pl/plan-targow/",
    sourceType: "official_exhibitor_directory",
    region: "Poland / Europe",
    markets: ["Poland"],
    tier: "B",
    enabled: true,
    parserKey: "exhibitor_cards",
    parserVersion: "1.0.0",
    priority: 100,
    rateLimitMs: 2400,
    accessNotes: "官方展商地图与卡片目录；无企业官网时不直接计入合格数。",
    requiresLogin: false,
    isPaid: false,
  },
] as const;

function sourceFitsCampaign(source: SourceDefinition, campaign: { targetCountriesJson: string; targetMarkets: string }) {
  const targets = campaignCountries(campaign);
  if (!targets.length) return true;
  const markets = new Set(source.markets.map(normalizeCountry));
  return targets.some((target) => markets.has(target));
}

export async function seedOfficialSourceRegistry(campaignId: string) {
  const db = getDb();
  const now = new Date().toISOString();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, campaignId)).limit(1);
  if (!campaign) throw new Error("campaign_not_found");
  for (const source of OFFICIAL_SOURCE_REGISTRY) {
    const enabled = source.enabled && sourceFitsCampaign(source, campaign);
    const values = {
      id: `official:${source.key}:${campaignId}`,
      campaignId,
      name: source.name,
      sourceUrl: source.url,
      normalizedDomain: normalizedDomain(source.url),
      sourceType: source.sourceType,
      region: source.region,
      tier: source.tier,
      enabled,
      parserKey: source.parserKey,
      parserVersion: source.parserVersion,
      parserConfigJson: "{}",
      priority: source.priority,
      rateLimitMs: source.rateLimitMs,
      status: enabled ? "active" : "paused",
      cadence: enabled ? "daily" : "manual",
      maxCandidates: 20,
      nextRunAt: enabled ? now : null,
      accessNotes: source.accessNotes,
      requiresLogin: source.requiresLogin,
      isPaid: source.isPaid,
      updatedAt: now,
    };
    await db.insert(discoverySources).values(values).onConflictDoNothing();
    const [current] = await db.select({ id: discoverySources.id, nextRunAt: discoverySources.nextRunAt }).from(discoverySources).where(and(
      eq(discoverySources.campaignId, campaignId),
      eq(discoverySources.sourceUrl, source.url),
    )).limit(1);
    if (current) {
      await db.update(discoverySources).set({
        name: source.name,
        sourceType: source.sourceType,
        region: source.region,
        tier: source.tier,
        enabled,
        parserKey: source.parserKey,
        parserVersion: source.parserVersion,
        priority: source.priority,
        rateLimitMs: source.rateLimitMs,
        status: enabled ? "active" : "paused",
        cadence: enabled ? "daily" : "manual",
        nextRunAt: enabled ? (current.nextRunAt || now) : null,
        accessNotes: source.accessNotes,
        requiresLogin: source.requiresLogin,
        isPaid: source.isPaid,
        updatedAt: now,
      }).where(eq(discoverySources.id, current.id));
    }
  }

  for (const parser of [
    ["vision_council_members", "官方协会表格：企业名称、官网、电话和分区"],
    ["exhibitor_cards", "官方展商卡片、详情页和直接企业官网链接"],
    ["exhibitor_text", "纯文本展商名称；必须经官网发现 provider 二次核验"],
    ["dynamic_directory", "动态目录适配位；仅在确认公开接口后启用"],
    ["pdf_directory", "官方 PDF 展商名单；受文件大小与页数上限约束，名称仍需官网二次核验"],
  ] as const) {
    await db.insert(parserVersions).values({
      id: `${parser[0]}:1.0.0`, parserKey: parser[0], version: "1.0.0",
      sourceType: "official_directory", description: parser[1], codeHash: "source-controlled",
    }).onConflictDoNothing();
  }

  return db.select().from(discoverySources).where(eq(discoverySources.campaignId, campaignId));
}
