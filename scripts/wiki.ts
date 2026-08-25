import { USER_AGENT } from "./sources/wikidata.js";

export const BATCH_SIZE = 50;
const API = "https://en.wikipedia.org/w/api.php";

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function buildQueryUrl(titles: string[]): string {
  const params: Record<string, string> = {
    action: "query",
    format: "json",
    formatversion: "2",
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    redirects: "1",
    titles: titles.join("|"),
  };
  const query = Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join("&");
  return `${API}?${query}`;
}

type ApiResponse = {
  query?: {
    redirects?: { from: string; to: string }[];
    normalized?: { from: string; to: string }[];
    pages?: { title: string; missing?: boolean; revisions?: { slots: { main: { content: string } } }[] }[];
  };
};

/**
 * Maps every requested title (raw, normalized, and post-redirect) to its
 * wikitext. MediaWiki resolves titles as `raw -> normalized -> redirect
 * target -> final page`, and the API returns `normalized` and `redirects`
 * hops in arbitrary order (not necessarily resolution order), so a single
 * ordered pass over `[...normalized, ...redirects]` can miss chains where a
 * title needs both hops (the `normalized -> to` step processed before the
 * `raw -> normalized` step leaves `raw` unpopulated). Instead, repeatedly
 * walk all hops, propagating content backwards, until a full pass adds
 * nothing new — an order-independent fixed point. Capped at hops.length + 1
 * iterations as a cycle guard (a well-formed response can't need more).
 */
export function extractPages(json: unknown): Map<string, string> {
  const q = (json as ApiResponse).query ?? {};
  const byTitle = new Map<string, string>();
  for (const p of q.pages ?? []) {
    const content = p.revisions?.[0]?.slots.main.content;
    if (p.missing || !content) continue;
    byTitle.set(p.title, content);
  }
  const hops = [...(q.normalized ?? []), ...(q.redirects ?? [])];
  for (let pass = 0; pass <= hops.length; pass++) {
    let added = false;
    for (const hop of hops) {
      if (byTitle.has(hop.from)) continue;
      const content = byTitle.get(hop.to);
      if (content !== undefined) {
        byTitle.set(hop.from, content);
        added = true;
      }
    }
    if (!added) break;
  }
  return byTitle;
}

export async function fetchBatch(titles: string[]): Promise<Map<string, string>> {
  const res = await fetch(buildQueryUrl(titles), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return extractPages(await res.json());
}
