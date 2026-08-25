import { writeFileSync } from "node:fs";
import { geoCentroid, geoArea } from "d3-geo";

interface GeoJSONFeature {
  type: "Feature";
  geometry: {
    type: string;
    coordinates: number[][][] | number[][][][];
  };
  properties: { name?: string; [key: string]: unknown };
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

interface CountryLabel {
  name: string;
  lat: number;
  lon: number;
  rank: number;
}

// Shoelace formula to calculate area of a ring in square degrees
function calculateRingArea(ring: number[][]): number {
  let area = 0;
  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    const coord1 = ring[i];
    const coord2 = ring[i + 1];
    if (coord1 && coord2) {
      const lon1 = coord1[0];
      const lat1 = coord1[1];
      const lon2 = coord2[0];
      const lat2 = coord2[1];
      if (lon1 !== undefined && lat1 !== undefined && lon2 !== undefined && lat2 !== undefined) {
        area += (lon2 - lon1) * (lat2 + lat1);
      }
    }
  }
  return Math.abs(area) / 2;
}

// Get the largest ring from a feature's geometry
function getLargestRing(
  geometry: GeoJSONFeature["geometry"]
): { ring: number[][]; area: number } {
  let largestRing: number[][] = [];
  let largestArea = 0;

  if (geometry.type === "Polygon") {
    const rings = geometry.coordinates as number[][][];
    for (const ring of rings) {
      if (ring) {
        const area = calculateRingArea(ring);
        if (area > largestArea) {
          largestArea = area;
          largestRing = ring;
        }
      }
    }
  } else if (geometry.type === "MultiPolygon") {
    const polygons = geometry.coordinates as number[][][][];
    for (const polygon of polygons) {
      if (polygon) {
        for (const ring of polygon) {
          if (ring) {
            const area = calculateRingArea(ring);
            if (area > largestArea) {
              largestArea = area;
              largestRing = ring;
            }
          }
        }
      }
    }
  }

  return { ring: largestRing, area: largestArea };
}

// Calculate centroid of a ring
function calculateCentroid(ring: number[][]): [number, number] {
  let x = 0;
  let y = 0;
  let area = 0;

  const n = ring.length;
  for (let i = 0; i < n - 1; i++) {
    const coord1 = ring[i];
    const coord2 = ring[i + 1];
    if (coord1 && coord2) {
      const lon1 = coord1[0];
      const lat1 = coord1[1];
      const lon2 = coord2[0];
      const lat2 = coord2[1];
      if (lon1 !== undefined && lat1 !== undefined && lon2 !== undefined && lat2 !== undefined) {
        const cross = lon1 * lat2 - lon2 * lat1;
        area += cross;
        x += (lon1 + lon2) * cross;
        y += (lat1 + lat2) * cross;
      }
    }
  }

  area = area / 2;
  const firstCoord = ring[0];
  if (area === 0 && firstCoord) {
    return [firstCoord[0] ?? 0, firstCoord[1] ?? 0];
  }

  return [x / (6 * area), y / (6 * area)];
}

// Round coordinates to 2 decimals
function roundCoordinates(coords: unknown): unknown {
  if (Array.isArray(coords)) {
    if (typeof coords[0] === "number") {
      // This is a coordinate pair [lon, lat]
      return coords.map((n) => Math.round(n * 100) / 100);
    }
    // This is an array of coordinates
    return coords.map((c) => roundCoordinates(c));
  }
  return coords;
}

// Fetch Natural Earth data
async function fetchNaturalEarth(): Promise<GeoJSONFeatureCollection> {
  const urls = [
    "https://naciscdn.org/naturalearth/110m/cultural/ne_110m_admin_0_countries.geojson",
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_0_countries.geojson",
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
  ];

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} from ${url}`);
        continue;
      }
      const data = await response.json() as GeoJSONFeatureCollection;
      console.log(`Fetched from ${url}`);
      return data;
    } catch (error) {
      lastError = error as Error;
      continue;
    }
  }

  throw new Error(
    `Failed to fetch Natural Earth data from any source: ${lastError?.message}`
  );
}

async function main() {
  try {
    console.log("Fetching Natural Earth data...");
    const data = await fetchNaturalEarth();

    console.log(`Found ${data.features.length} features`);

    const worldFeatures: GeoJSONFeature[] = [];
    const labels: CountryLabel[] = [];

    for (const feature of data.features) {
      if (!feature.geometry) continue;

      const name =
        (feature.properties?.name as string | undefined) ||
        (feature.properties?.ADMIN as string | undefined) ||
        "Unknown";

      // Skip Antarctica for labels
      const isAntarctica =
        name === "Antarctica" ||
        name === "AQ" ||
        feature.properties?.iso_a2 === "AQ";

      // Get the largest ring for area and centroid calculations
      const { ring, area } = getLargestRing(feature.geometry);

      if (ring.length > 0) {
        // Add to world features (geometry only, properties stripped)
        const worldFeature: GeoJSONFeature = {
          type: "Feature",
          geometry: {
            type: feature.geometry.type,
            coordinates: roundCoordinates(feature.geometry.coordinates) as number[][][] | number[][][][],
          },
          properties: {},
        };
        worldFeatures.push(worldFeature);

        // Add to labels if not Antarctica
        if (!isAntarctica) {
          const [lon, lat] = calculateCentroid(ring);
          labels.push({
            name,
            lat: Math.round(lat * 100) / 100,
            lon: Math.round(lon * 100) / 100,
            rank: Math.round(area * 100) / 100,
          });
        }
      }
    }

    // Sort labels by rank descending
    labels.sort((a, b) => b.rank - a.rank);

    // Write output files
    const worldGeoJSON: GeoJSONFeatureCollection = {
      type: "FeatureCollection",
      features: worldFeatures,
    };

    writeFileSync(
      "public/world.json",
      JSON.stringify(worldGeoJSON, null, 0),
      "utf-8"
    );

    writeFileSync("public/labels.json", JSON.stringify(labels, null, 0), "utf-8");

    console.log(`Generated world.json with ${worldFeatures.length} features`);
    console.log(
      `Generated labels.json with ${labels.length} labels (Antarctica excluded)`
    );

    // Print top 8 labels for verification
    console.log("\nTop 8 labels by rank:");
    labels.slice(0, 8).forEach((label, i) => {
      console.log(
        `${i + 1}. ${label.name}: rank=${label.rank} (${label.lat}, ${label.lon})`
      );
    });

    // Check file sizes
    const fs = await import("node:fs");
    const worldSize = fs.statSync("public/world.json").size;
    const labelsSize = fs.statSync("public/labels.json").size;
    console.log(`\nFile sizes:`);
    console.log(`  world.json: ${worldSize} bytes`);
    console.log(`  labels.json: ${labelsSize} bytes`);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

main();
