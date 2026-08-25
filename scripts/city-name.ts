/**
 * OurAirports' `municipality` field names the airport's physical municipality,
 * which is frequently not the city the airport is understood to serve
 * (e.g. "Zaventem" for Brussels-BRU, "Segrate (MI)" for Milan-LIN). This
 * module cleans that field for display and, for well-known airports where
 * cleaning alone still isn't enough, overrides it with the served city.
 */

/**
 * Generic, conservative cleanup of an OurAirports municipality string:
 *  - drop one trailing parenthetical, e.g. "Paris (Roissy-en-France, Val-d'Oise)" -> "Paris"
 *  - drop one trailing ", Suffix", e.g. "London, Essex" -> "London"
 *  - collapse an exact "X, X" duplicate, e.g. "Luton, Luton" -> "Luton"
 * Only ever strips from the end, and only once per rule, so ordinary names
 * (no trailing paren/comma) pass through untouched.
 */
export function cleanCityName(raw: string): string {
  let name = raw.trim();

  // Strip a single trailing parenthetical, e.g. "Segrate (MI)" -> "Segrate".
  name = name.replace(/\s*\([^()]*\)\s*$/, "").trim();

  // Strip a single trailing ", Suffix", e.g. "London, Essex" -> "London".
  // (Also handles "Luton, Luton" since the suffix equals the prefix.)
  const commaIdx = name.indexOf(",");
  if (commaIdx > 0) {
    name = name.slice(0, commaIdx).trim();
  }

  return name || raw.trim();
}

/**
 * IATA-keyed overrides for airports where cleaning alone still gives a
 * misleading answer: villages/suburbs that host a major city's airport,
 * secondary airports of a metro area under a different name, and
 * transliteration mismatches (e.g. "Köln" -> "Cologne").
 */
export const CITY_OVERRIDES: Record<string, string> = {
  // Brussels: BRU's municipality is the suburb Zaventem; CRL is Brussels
  // South's low-cost airport, physically in Charleroi.
  BRU: "Brussels",
  CRL: "Brussels (Charleroi)",
  // Milan: LIN/MXP sit in the suburbs Segrate/Ferno; BGY (Orio al Serio) is
  // marketed as "Milan Bergamo".
  LIN: "Milan",
  MXP: "Milan",
  BGY: "Bergamo (Milan)",
  // Rome: FCO's own municipality field already reads "Rome"; CIA (Ciampino)
  // needs disambiguating from it.
  CIA: "Rome (Ciampino)",
  // Turin: municipality is the suburb Caselle Torinese.
  TRN: "Turin",
  // Lyon: municipality is the suburb Colombier-Saugnieu.
  LYS: "Lyon",
  // Paris: CDG/ORY need disambiguating from each other once cleaning
  // reduces both to plain "Paris"; BVA (Beauvais) is ~80km away.
  ORY: "Paris (Orly)",
  BVA: "Paris (Beauvais)",
  // Marseille: municipality is the suburb Marignane.
  MRS: "Marseille",
  // Toulon: municipality is Hyères, a distinct coastal town.
  TLN: "Toulon",
  // Edinburgh: raw "Ingliston, Edinburgh" puts the suburb first, so generic
  // comma-stripping keeps the wrong half.
  EDI: "Edinburgh",
  // Glasgow: municipality is the town of Prestwick.
  PIK: "Glasgow (Prestwick)",
  // London: raw "Southend-on-Sea, Essex" cleans to the real town name, but
  // the airport is marketed as a London airport.
  SEN: "London (Southend)",
  // Teesside: municipality is Darlington; airport rebranded from
  // "Durham Tees Valley" to "Teesside International".
  MME: "Teesside",
  // Cologne: the parenthetical held the correct English name, which
  // generic paren-stripping would have discarded.
  CGN: "Cologne",
  // Frankfurt/Düsseldorf/Munich: low-cost secondary airports far from the
  // named city but marketed under its name.
  HHN: "Frankfurt (Hahn)",
  NRN: "Düsseldorf (Weeze)",
  FMM: "Munich (Memmingen)",
  // Stockholm/Oslo: low-cost secondary airports, similarly branded.
  NYO: "Stockholm (Skavsta)",
  TRF: "Oslo (Torp)",
  // Barcelona: low-cost secondary airports branded as Barcelona.
  GRO: "Barcelona (Girona)",
  REU: "Barcelona (Reus)",
  // Corfu: the parenthetical held the correct English name (like Cologne).
  CFU: "Corfu",
  // Southeast/East European capitals whose municipality names a suburb.
  OTP: "Bucharest",
  KRK: "Kraków",
  LJU: "Ljubljana",
  ZAG: "Zagreb",
  ATH: "Athens",
  GRZ: "Graz",
  OSR: "Ostrava",
  // Warsaw: WMI (Modlin) is a distinct low-cost secondary airport.
  WMI: "Warsaw (Modlin)",
  // Leipzig: municipality is the suburb Schkeuditz.
  LEJ: "Leipzig",
  // Canary Islands: municipality names a village on the island; the
  // island/city name is how travelers know these airports.
  FUE: "Fuerteventura",
  ACE: "Lanzarote",
  LPA: "Las Palmas (Gran Canaria)",
  // Bali: municipality is the Kuta tourist district.
  DPS: "Denpasar (Bali)",
  // Taipei: municipality is Taoyuan, a separate city ~40km away.
  TPE: "Taipei",
  // Kuala Lumpur: municipality is Sepang, where the airport sits.
  KUL: "Kuala Lumpur",
  // Istanbul: raw "Pendik, Istanbul" puts the suburb first, so generic
  // comma-stripping keeps the wrong half (same failure mode as Edinburgh).
  SAW: "Istanbul",
  // Washington, DC: municipality is "Dulles", the airport's own name.
  IAD: "Washington, DC",
  // Tokyo: municipality is Narita, a distinct city ~60km away.
  NRT: "Tokyo (Narita)",
  // Found while scanning cleaning's output for collateral damage: these all
  // have the same "suburb, city" (or "suburb (city)") reversal as
  // Edinburgh/Istanbul/Cologne above, where generic left-to-right cleaning
  // keeps the wrong half.
  SPN: "Saipan",
  BWX: "Banyuwangi",
  CHG: "Chaoyang",
  FUG: "Fuyang",
  JNH: "Jiaxing",
  TRE: "Tiree",
  NAH: "Naha (Sangihe)",
  GMZ: "La Gomera",
  USM: "Koh Samui",
};

/** Resolve the display city for an airport: cleaning, then override wins. */
export function resolveCityName(iata: string, rawMunicipality: string): string {
  const cleaned = cleanCityName(rawMunicipality);
  return CITY_OVERRIDES[iata] ?? cleaned;
}
