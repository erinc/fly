import { expect, test } from "vitest";
import { parseAirportsCsv } from "./ourairports.js";

const HEADER =
  '"id","ident","type","name","latitude_deg","longitude_deg","elevation_ft",' +
  '"continent","iso_country","iso_region","municipality","scheduled_service",' +
  '"icao_code","iata_code","gps_code","local_code","home_link","wikipedia_link","keywords"';

const row = (
  type: string,
  name: string,
  lat: string,
  lon: string,
  country: string,
  city: string,
  sched: string,
  iata: string,
) =>
  `1,"X","${type}","${name}",${lat},${lon},100,"EU","${country}","XX","${city}",` +
  `"${sched}","XXXX","${iata}","XXXX","","","",""`;

test("keeps scheduled-service airports that have an IATA code", () => {
  const csv = [
    HEADER,
    row("large_airport", "Heathrow Airport", "51.4706", "-0.4619", "GB", "London", "yes", "LHR"),
  ].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([
    { iata: "LHR", name: "Heathrow Airport", city: "London", country: "GB", lat: 51.4706, lon: -0.4619, size: "large" },
  ]);
});

test("drops airports without scheduled service", () => {
  const csv = [HEADER, row("large_airport", "Quiet", "1", "1", "GB", "Nowhere", "no", "QQQ")].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("drops airports with no IATA code", () => {
  const csv = [HEADER, row("large_airport", "Nameless", "1", "1", "GB", "Nowhere", "yes", "")].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("drops heliports, seaplane bases and closed airports", () => {
  const csv = [
    HEADER,
    row("heliport", "Helipad", "1", "1", "GB", "A", "yes", "AAA"),
    row("seaplane_base", "Lake", "1", "1", "GB", "B", "yes", "BBB"),
    row("closed", "Tegel", "1", "1", "DE", "Berlin", "yes", "TXL"),
  ].join("\n");
  expect(parseAirportsCsv(csv)).toEqual([]);
});

test("handles commas inside quoted fields", () => {
  const csv = [
    HEADER,
    row("medium_airport", "Molde Airport, Aro", "62.7", "7.26", "NO", "Molde", "yes", "MOL"),
  ].join("\n");
  const rows = parseAirportsCsv(csv);
  expect(rows[0]?.name).toBe("Molde Airport, Aro");
  expect(rows[0]?.iata).toBe("MOL");
});
