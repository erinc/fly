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

/** Maps every requested title (pre- and post-redirect) to its wikitext. */
export function extractPages(json: unknown): Map<string, string> {
  const q = (json as ApiResponse).query ?? {};
  const byTitle = new Map<string, string>();
  for (const p of q.pages ?? []) {
    const content = p.revisions?.[0]?.slots.main.content;
    if (p.missing || !content) continue;
    byTitle.set(p.title, content);
  }
  for (const hop of [...(q.normalized ?? []), ...(q.redirects ?? [])]) {
    const content = byTitle.get(hop.to);
    if (content !== undefined) byTitle.set(hop.from, content);
  }
  return byTitle;
}

export async function fetchBatch(titles: string[]): Promise<Map<string, string>> {
  const res = await fetch(buildQueryUrl(titles), { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia API ${res.status}`);
  return extractPages(await res.json());
}
