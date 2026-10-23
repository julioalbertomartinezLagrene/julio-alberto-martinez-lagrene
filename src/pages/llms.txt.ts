import type { APIRoute } from "astro";
import profile from "../content/profile.json";
import { llmsTxt } from "../lib/agent";

// A plain Markdown summary of this page for AI assistants (see src/lib/agent.ts).
export const GET: APIRoute = ({ site }) =>
  new Response(llmsTxt(profile, site ?? new URL("https://example.netlify.app")), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
