import { decodeRoutes, type RouteTable } from "./format.js";

export type Airport = {
  iata: string; name: string; city: string; country: string;
  lat: number; lon: number; size: string;
};

export type Dataset = {
  airports: Airport[];
  index: Map<string, number>;
  routes: RouteTable;
  /** adjacency[airportIndex] = route record indices touching that airport */
  adjacency: number[][];
};

type Tuple = [string, string, string, string, number, number, string];

export function parseAirports(json: unknown): Airport[] {
  const rows = (json as { airports?: Tuple[] }).airports ?? [];
  return rows.map(([iata, name, city, country, lat, lon, size]) => ({
    iata, name, city, country, lat, lon, size,
  }));
}

export function buildAdjacency(count: number, routes: RouteTable): number[][] {
  const adj: number[][] = Array.from({ length: count }, () => []);
  for (let i = 0; i < routes.count; i++) {
    adj[routes.a[i]!]!.push(i);
    adj[routes.b[i]!]!.push(i);
  }
  return adj;
}

export async function loadDataset(): Promise<Dataset> {
  const [airportsJson, routesBuf] = await Promise.all([
    fetch("/airports.json").then((r) => r.json()),
    fetch("/routes.bin").then((r) => r.arrayBuffer()),
  ]);
  const airports = parseAirports(airportsJson);
  const routes = decodeRoutes(routesBuf);
  return {
    airports,
    index: new Map(airports.map((a, i) => [a.iata, i])),
    routes,
    adjacency: buildAdjacency(airports.length, routes),
  };
}
