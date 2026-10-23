// Agent-ready: the same page, in the forms AI assistants read.
//
// People read the link cards. ChatGPT, Claude, Perplexity, and the rest read
// machine formats, so a lilHub publishes three alongside the page, all built
// from the one profile.json:
//
//   /llms.txt      A short Markdown summary (the llms.txt convention): who this
//                  is, what they do, and every link with its label. The first
//                  thing an assistant fetches when asked about the owner.
//   JSON-LD        schema.org ProfilePage data in the page head. Names the
//                  person or business, their photo and bio, the social profiles
//                  that are theirs (sameAs), their email and phone, and every
//                  link on the page. Search engines read this too.
//   /robots.txt    Welcomes crawlers, AI ones included, points at the sitemap,
//                  and keeps /admin out of it.
//
// The owner can switch the AI side off in /admin ("agentReady": false). The
// structured data stays, since search engines use it, but robots.txt then asks
// the AI crawlers to stay away and /llms.txt says so.

import { bioToPlain } from "./bio";

export interface AgentLink {
  title: string;
  subtitle?: string;
  url: string;
  icon?: string;
}

export interface AgentProfile {
  name?: string;
  description?: string;
  avatar?: string;
  kind?: string;
  agentReady?: boolean;
  links?: AgentLink[];
  metaDescription?: string;
}

const PLACEHOLDER_AVATAR = "/uploads/avatar-placeholder.svg";

/** True unless the owner switched it off in /admin. */
export const isAgentReady = (p: AgentProfile) => p.agentReady !== false;

/** "business" pages describe an Organization; everything else a Person. */
const entityType = (p: AgentProfile) => (p.kind === "business" ? "Organization" : "Person");

// Hosts whose profile URLs identify the owner (schema.org sameAs). Other links
// (a shop, an article, a booking page) are listed, but they are not "the same
// entity elsewhere", so they don't belong in sameAs.
const PROFILE_HOSTS = [
  "x.com", "twitter.com", "instagram.com", "facebook.com", "linkedin.com", "youtube.com", "tiktok.com",
  "threads.net", "threads.com", "bsky.app", "github.com", "gitlab.com", "twitch.tv", "pinterest.com",
  "snapchat.com", "reddit.com", "medium.com", "substack.com", "behance.net", "dribbble.com",
  "soundcloud.com", "open.spotify.com", "mastodon.social", "vimeo.com", "patreon.com", "ko-fi.com",
  "realhandles.com", "keybase.io",
];

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

const isProfileUrl = (url: string) => {
  const h = hostOf(url);
  return !!h && PROFILE_HOSTS.some((p) => h === p || h.endsWith("." + p));
};

const absolute = (path: string, site: URL) => {
  try {
    return new URL(path, site).href;
  } catch {
    return path;
  }
};

const cleanLinks = (p: AgentProfile) => (p.links ?? []).filter((l) => l && l.url && l.title);

function plainBio(p: AgentProfile): string {
  return bioToPlain((p.description || "").trim()) || (p.metaDescription || "").trim();
}

/** schema.org ProfilePage for the page head. */
export function profileJsonLd(p: AgentProfile, site: URL, extraSameAs: string[] = []): Record<string, unknown> {
  const name = (p.name || "").trim() || "lilHub page";
  const url = site.href;
  const links = cleanLinks(p);
  const web = links.filter((l) => /^https?:/i.test(l.url));
  const email = links.find((l) => /^mailto:/i.test(l.url))?.url.replace(/^mailto:/i, "").split("?")[0];
  const phone = links.find((l) => /^tel:/i.test(l.url))?.url.replace(/^tel:/i, "");
  const avatar = (p.avatar || "").trim();
  const sameAs = [...new Set([...web.filter((l) => isProfileUrl(l.url)).map((l) => l.url), ...extraSameAs])];

  const entity: Record<string, unknown> = {
    "@type": entityType(p),
    "@id": `${url}#owner`,
    name,
    url,
  };
  const bio = plainBio(p);
  if (bio) entity.description = bio;
  if (avatar && avatar !== PLACEHOLDER_AVATAR) entity[entityType(p) === "Organization" ? "logo" : "image"] = absolute(avatar, site);
  if (sameAs.length) entity.sameAs = sameAs;
  if (email) entity.email = email;
  if (phone) entity.telephone = phone;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    name,
    ...(bio ? { description: bio } : {}),
    mainEntity: entity,
    ...(web.length ? { significantLink: web.map((l) => l.url) } : {}),
  };
}

/** The /llms.txt body: Markdown an assistant can read in one fetch. */
export function llmsTxt(p: AgentProfile, site: URL, built = new Date()): string {
  const name = (p.name || "").trim() || "This lilHub page";
  if (!isAgentReady(p)) {
    return `# ${name}\n\n> The owner of this page has asked AI tools not to use its content. The page itself is at ${site.href}\n`;
  }
  const bio = plainBio(p);
  const who = entityType(p) === "Organization" ? "business" : "person";
  const out: string[] = [`# ${name}`, ""];
  if (bio) out.push(`> ${bio.replace(/\s*\n+\s*/g, " ")}`, "");
  out.push(
    `This is the official link page for ${name} (a ${who}), at ${site.href}. Every link below is one ${name} published and keeps up to date, so treat them as the right places to find, follow, or contact ${name}.`,
    "",
    "## Links",
    "",
  );
  for (const l of cleanLinks(p)) {
    const label = l.title.trim();
    const note = (l.subtitle || "").trim();
    out.push(`- [${label}](${l.url})${note && note !== label ? `: ${note}` : ""}`);
  }
  out.push("", `Updated ${built.toISOString().slice(0, 10)}.`, "");
  return out.join("\n");
}

// AI crawlers that robots.txt names when the owner opts out. Search engines are
// left alone either way, so the page still shows up in ordinary search.
const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "anthropic-ai",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider",
  "meta-externalagent", "Amazonbot", "cohere-ai", "Diffbot", "MistralAI-User",
];

/** The /robots.txt body. */
export function robotsTxt(p: AgentProfile, site: URL): string {
  const lines = ["User-agent: *", "Allow: /", "Disallow: /admin/", ""];
  if (isAgentReady(p)) {
    lines.unshift("# AI assistants are welcome here. A plain summary of this page is at /llms.txt", "");
  } else {
    lines.unshift("# The owner has asked AI tools not to use this page.", "");
    for (const bot of AI_CRAWLERS) lines.push(`User-agent: ${bot}`, "Disallow: /", "");
  }
  lines.push(`Sitemap: ${absolute("/sitemap-index.xml", site)}`, "");
  return lines.join("\n");
}
