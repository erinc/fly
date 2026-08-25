export const AIRPORTS_CSV_URL =
  "https://davidmegginson.github.io/ourairports-data/airports.csv";

export type AirportSize = "large" | "medium" | "small";

export type AirportRow = {
  iata: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  size: AirportSize;
};

const SIZES: Record<string, AirportSize> = {
  large_airport: "large",
  medium_airport: "medium",
  small_airport: "small",
};

/** Split one CSV line, honouring double-quoted fields with embedded commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { out.push(field); field = ""; }
    else field += c;
  }
  out.push(field);
  return out;
}

export function parseAirportsCsv(csv: string): AirportRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  const header = splitCsvLine(lines[0] ?? "");
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`ourairports CSV is missing the "${name}" column`);
    return i;
  };
  const iType = col("type");
  const iName = col("name");
  const iLat = col("latitude_deg");
  const iLon = col("longitude_deg");
  const iCountry = col("iso_country");
  const iCity = col("municipality");
  const iSched = col("scheduled_service");
  const iIata = col("iata_code");

  const rows: AirportRow[] = [];
  for (const line of lines.slice(1)) {
    const f = splitCsvLine(line);
    const size = SIZES[f[iType] ?? ""];
    const iata = (f[iIata] ?? "").trim();
    if (!size || !iata || f[iSched] !== "yes") continue;
    const lat = Number(f[iLat]);
    const lon = Number(f[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    rows.push({
      iata,
      name: (f[iName] ?? "").trim(),
      city: (f[iCity] ?? "").trim(),
      country: (f[iCountry] ?? "").trim(),
      lat,
      lon,
      size,
    });
  }
  return rows;
}
