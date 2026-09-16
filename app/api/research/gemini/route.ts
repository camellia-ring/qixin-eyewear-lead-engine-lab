import { env } from "cloudflare:workers";

import {
  createGeminiResearchHttpHandlers,
  type GeminiResearchEnvironment,
} from "@/lib/gemini-research";

const handlers = createGeminiResearchHttpHandlers({
  environment: env as typeof env & GeminiResearchEnvironment,
  logger: (entry) => {
    console.info(JSON.stringify({ event: "gemini_grounded_research", ...entry }));
  },
});

export const GET = handlers.GET;
export const POST = handlers.POST;
