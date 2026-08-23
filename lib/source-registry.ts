import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { campaigns, discoverySources, parserVersions } from "@/db/schema";
import { normalizedDomain } from "@/lib/discovery";
import { campaignCountries, normalizeCountry, UNASSIGNED_CAMPAIGN_ID } from "@/lib/campaign-routing";

export type SourceDefinition = {
  key: string;
  name: string;
  url: string;
  sourceType: "association_directory" | "official_exhibitor_directory";
  region: string;
  markets: readonly string[];
  tier: "A" | "B" | "C";
  enabled: boolean;
  parserKey: "vision_council_members" | "mido_exhibitor_map" | "exhibitor_cards" | "exhibitor_text" | "dynamic_directory" | "pdf_directory";
  parserVersion: string;
  parserConfig?: Readonly<Record<string, string | number | boolean>>;
  repeatDuringDay?: boolean;
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
    name: "MIDO Exhibitors Map 2026",
    url: "https://www.mido.com/en/exhibitors-map-2026",
    sourceType: "official_exhibitor_directory",
    region: "Europe / Global",
    markets: ["Global"],
    tier: "A",
    enabled: true,
    parserKey: "mido_exhibitor_map",
    parserVersion: "1.0.0",
    repeatDuringDay: true,
    priority: 20,
    rateLimitMs: 2200,
    accessNotes: "2026-08-23 复核：官方 2026 地图以服务端 HTML 输出展商名称、国家、企业官网和公开邮箱；排除中国大陆展商，只接收可验证企业官网。",
    requiresLogin: false,
    isPaid: false,
  },
  {
    key: "neo-tokyo-2026",
    name: "Neo Tokyo Eyewear Show 2026 Exhibitors",
    url: "https://neotokyoeyewearshow.com/en/exhibitor/",
    sourceType: "official_exhibitor_directory",
    region: "Japan / Global",
    markets: ["Global"],
    tier: "A",
    enabled: true,
    parserKey: "dynamic_directory",
    parserVersion: "1.0.0",
    parserConfig: {
      endpoint: "https://neotokyoeyewearshow.com/neotokyo-wp/wp-admin/admin-ajax.php",
      method: "POST",
      body: "action=custom_search&query=&lang=en&post_type=exhibitor",
      contentType: "application/x-www-form-urlencoded",
      itemsPath: "",
      flattenObjectArrays: true,
      nameField: "exhibitor_name_en",
      websiteField: "brand_link_source",
      detailField: "link",
    },
    repeatDuringDay: true,
    priority: 30,
    rateLimitMs: 2200,
    accessNotes: "2026-08-23 复核：官方公开 AJAX 目录返回 72 家展商；robots.txt 明确允许 admin-ajax.php，详情页用于取得企业官网。",
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
    markets: ["Global"],
    tier: "A",
    enabled: true,
    parserKey: "exhibitor_cards",
    parserVersion: "1.1.0",
    repeatDuringDay: true,
    priority: 40,
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
    enabled: false,
    parserKey: "exhibitor_cards",
    parserVersion: "1.0.0",
    priority: 70,
    rateLimitMs: 2500,
    accessNotes: "2026-08-23 现场复核：当前页面解析到的是 Kakao、EXCO 和城市服务链接，不是展商企业官网；等待专用解析器前停用。",
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
    enabled: false,
    parserKey: "exhibitor_text",
    parserVersion: "1.0.0",
    priority: 80,
    rateLimitMs: 2400,
    accessNotes: "2026-08-23 现场复核：当前页面只暴露站点导航、目录和酒店链接；没有 API 时无法可靠把名称解析为企业官网，暂时停用。",
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
    enabled: false,
    parserKey: "exhibitor_text",
    parserVersion: "1.0.0",
    priority: 90,
    rateLimitMs: 2400,
    accessNotes: "2026-08-23 现场复核：当前页面只暴露站点导航和会场服务链接；没有 API 时无法可靠取得企业官网，暂时停用。",
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
    enabled: false,
    parserKey: "exhibitor_cards",
    parserVersion: "1.0.0",
    priority: 100,
    rateLimitMs: 2400,
    accessNotes: "2026-08-23 现场复核：当前页面只解析到购票和建站服务链接，没有展商企业官网；等待专用解析器前停用。",
    requiresLogin: false,
    isPaid: false,
  },
] as const;

function sourceFitsCampaign(source: SourceDefinition, campaign: { targetCountriesJson: string; targetMarkets: string }) {
  if (source.markets.includes("Global")) return true;
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
  const activeCampaigns = (await db.select().from(campaigns).where(eq(campaigns.status, "active")))
    .filter((candidate) => candidate.id !== UNASSIGNED_CAMPAIGN_ID)
    .sort((left, right) => right.strategyPriority - left.strategyPriority || left.id.localeCompare(right.id));
  const globalAnchorId = activeCampaigns[0]?.id || campaignId;
  for (const source of OFFICIAL_SOURCE_REGISTRY) {
    const globalSource = source.markets.includes("Global");
    const enabled = source.enabled && sourceFitsCampaign(source, campaign) && (!globalSource || campaignId === globalAnchorId);
    const baseParserConfig = { ...(source.parserConfig || {}), repeatDuringDay: Boolean(source.repeatDuringDay) };
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
      parserConfigJson: JSON.stringify({ ...baseParserConfig, offset: 0 }),
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
    const [current] = await db.select({
      id: discoverySources.id,
      nextRunAt: discoverySources.nextRunAt,
      parserKey: discoverySources.parserKey,
      parserVersion: discoverySources.parserVersion,
      parserConfigJson: discoverySources.parserConfigJson,
    }).from(discoverySources).where(eq(discoverySources.id, values.id)).limit(1);
    if (current) {
      let parserState: Record<string, unknown> = {};
      try { parserState = JSON.parse(current.parserConfigJson || "{}"); } catch { parserState = {}; }
      const parserChanged = current.parserKey !== source.parserKey || current.parserVersion !== source.parserVersion;
      const parserConfigJson = JSON.stringify({
        ...baseParserConfig,
        offset: parserChanged ? 0 : Math.max(0, Number(parserState.offset) || 0),
        ...(parserChanged || !parserState.lastFullScanAt ? {} : { lastFullScanAt: parserState.lastFullScanAt }),
      });
      await db.update(discoverySources).set({
        name: source.name,
        sourceUrl: source.url,
        normalizedDomain: normalizedDomain(source.url),
        sourceType: source.sourceType,
        region: source.region,
        tier: source.tier,
        enabled,
        parserKey: source.parserKey,
        parserVersion: source.parserVersion,
        parserConfigJson,
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
    ["mido_exhibitor_map", "MIDO 服务端展商地图：企业官网、国家、类别和公开商务邮箱"],
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
