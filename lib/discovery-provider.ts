import { publicHttpUrl } from "@/lib/discovery";

export type WebsiteResolutionRequest = {
  companyName: string;
  region: string;
  officialDirectoryUrl: string;
};

export type WebsiteResolution = {
  websiteUrl: string;
  companyName: string;
  confidence: "low" | "medium" | "high";
  discoveryUrls: string[];
};

export interface DiscoveryProvider {
  readonly name: string;
  readonly paid: boolean;
  readonly enabled: boolean;
  resolveOfficialWebsite(request: WebsiteResolutionRequest): Promise<WebsiteResolution | null>;
}

export type ProviderConfig = {
  enablePaidProviders?: string;
  openAiApiKey?: string;
  openAiDiscoveryModel?: string;
};

class DisabledDiscoveryProvider implements DiscoveryProvider {
  readonly name = "disabled";
  readonly paid = false;
  readonly enabled = false;
  async resolveOfficialWebsite() { return null; }
}

class OpenAIWebSearchProvider implements DiscoveryProvider {
  readonly name = "openai_web_search";
  readonly paid = true;
  readonly enabled = true;

  constructor(private readonly apiKey: string, private readonly model: string) {}

  async resolveOfficialWebsite(request: WebsiteResolutionRequest): Promise<WebsiteResolution | null> {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        tools: [{ type: "web_search" }],
        input: [
          { role: "system", content: "Find only the most likely official company website. Search results are discovery hints, never qualification evidence. Return null when identity is ambiguous." },
          { role: "user", content: `Company: ${request.companyName}\nRegion: ${request.region}\nOfficial directory: ${request.officialDirectoryUrl}` },
        ],
        text: { format: {
          type: "json_schema",
          name: "official_website_resolution",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              website_url: { type: ["string", "null"] },
              company_name: { type: "string" },
              confidence: { type: "string", enum: ["low", "medium", "high"] },
              discovery_urls: { type: "array", items: { type: "string" }, maxItems: 5 },
            },
            required: ["website_url", "company_name", "confidence", "discovery_urls"],
          },
        } },
      }),
    });
    if (!response.ok) throw new Error(`openai_provider_http_${response.status}`);
    const result = await response.json() as { output_text?: string };
    if (!result.output_text) return null;
    const parsed = JSON.parse(result.output_text) as {
      website_url: string | null; company_name: string; confidence: "low" | "medium" | "high"; discovery_urls: string[];
    };
    if (!parsed.website_url || parsed.confidence === "low") return null;
    const websiteUrl = publicHttpUrl(parsed.website_url).toString();
    return {
      websiteUrl,
      companyName: parsed.company_name || request.companyName,
      confidence: parsed.confidence,
      discoveryUrls: parsed.discovery_urls.filter((url) => {
        try { publicHttpUrl(url); return true; } catch { return false; }
      }).slice(0, 5),
    };
  }
}

export function createDiscoveryProvider(config: ProviderConfig): DiscoveryProvider {
  const explicitlyEnabled = config.enablePaidProviders === "true";
  if (!explicitlyEnabled || !config.openAiApiKey || !config.openAiDiscoveryModel) return new DisabledDiscoveryProvider();
  return new OpenAIWebSearchProvider(config.openAiApiKey, config.openAiDiscoveryModel);
}
