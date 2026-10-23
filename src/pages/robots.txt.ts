import type { APIRoute } from "astro";
import profile from "../content/profile.json";
import { robotsTxt } from "../lib/agent";

// Welcomes crawlers (or asks AI ones to stay away, if the owner opted out in /admin) and points at the sitemap.
export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt(profile, site ?? new URL("https://example.netlify.app")), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
