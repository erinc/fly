import type { Airport } from "../data/bundle.js";
import type { Reachable } from "./query.js";

export type InsightGroup = {
  id: string;
  codes: string[];
  originCountries: string[];
  destinations: Reachable[];
};

export type GroupReachSummary = {
  id: string;
  codes: string[];
  destinations: number;
  countriesAbroad: number;
};

export type MeetingLeg = {
  id: string;
  codes: string[];
  minutes: number;
  airport: number;
};

export type MeetingPlace = {
  key: string;
  city: string;
  country: string;
  legs: MeetingLeg[];
  longestMinutes: number;
  spreadMinutes: number;
  averageMinutes: number;
};

export type NextUnlock =
  | { kind: "reach"; destinations: number; countries: number }
  | { kind: "meetings"; places: MeetingPlace[] };

export type ReachInsights = {
  groups: GroupReachSummary[];
  commonDestinations: number;
  commonCountries: number;
  meetings: MeetingPlace[];
  nextUnlock: NextUnlock | null;
};

function destinationCountries(group: InsightGroup, airports: Airport[]): Set<string> {
  const countries = new Set<string>();
  for (const destination of group.destinations) {
    const country = airports[destination.airport]?.country;
    if (country) countries.add(country);
  }
  return countries;
}

function countriesAbroad(group: InsightGroup, airports: Airport[]): Set<string> {
  const domestic = new Set(group.originCountries);
  const countries = destinationCountries(group, airports);
  for (const country of domestic) countries.delete(country);
  return countries;
}

function intersection<T>(sets: Set<T>[]): Set<T> {
  const first = sets[0];
  if (!first) return new Set();
  return new Set([...first].filter((item) => sets.slice(1).every((set) => set.has(item))));
}

function placeKey(airport: Airport): string {
  const place = (airport.city || airport.name).trim().toLocaleLowerCase();
  return `${airport.country}\u0000${place}`;
}

/** The quickest route from one selected place to each destination city. */
function placesForGroup(group: InsightGroup, airports: Airport[]): Map<string, MeetingLeg> {
  const places = new Map<string, MeetingLeg>();
  for (const destination of group.destinations) {
    const airport = airports[destination.airport];
    if (!airport) continue;
    const key = placeKey(airport);
    const current = places.get(key);
    if (!current || destination.minutes < current.minutes) {
      places.set(key, {
        id: group.id,
        codes: group.codes,
        minutes: destination.minutes,
        airport: destination.airport,
      });
    }
  }
  return places;
}

/** Cities every selected place reaches nonstop, ranked for balanced travel. */
export function meetingPlaces(groups: InsightGroup[], airports: Airport[]): MeetingPlace[] {
  if (groups.length < 2) return [];
  const byGroup = groups.map((group) => placesForGroup(group, airports));
  const keys = intersection(byGroup.map((places) => new Set(places.keys())));
  const meetings: MeetingPlace[] = [];

  for (const key of keys) {
    const legs = byGroup.flatMap((places) => {
      const leg = places.get(key);
      return leg ? [leg] : [];
    });
    if (legs.length !== groups.length) continue;
    const destination = airports[legs[0]!.airport];
    if (!destination) continue;
    const times = legs.map((leg) => leg.minutes);
    const longestMinutes = Math.max(...times);
    const shortestMinutes = Math.min(...times);
    meetings.push({
      key,
      city: destination.city || destination.name,
      country: destination.country,
      legs,
      longestMinutes,
      spreadMinutes: longestMinutes - shortestMinutes,
      averageMinutes: Math.round(times.reduce((sum, time) => sum + time, 0) / times.length),
    });
  }

  return meetings.sort((a, b) =>
    a.longestMinutes - b.longestMinutes
    || a.spreadMinutes - b.spreadMinutes
    || a.averageMinutes - b.averageMinutes
    || a.city.localeCompare(b.city),
  );
}

export function analyzeReach(
  airports: Airport[],
  groups: InsightGroup[],
  nextGroups: InsightGroup[] | null = null,
): ReachInsights {
  const summaries = groups.map((group) => ({
    id: group.id,
    codes: group.codes,
    destinations: group.destinations.length,
    countriesAbroad: countriesAbroad(group, airports).size,
  }));

  const destinationSets = groups.map((group) =>
    new Set(group.destinations.map((destination) => destination.airport)),
  );
  const countrySets = groups.map((group) => destinationCountries(group, airports));
  const meetings = meetingPlaces(groups, airports);

  let nextUnlock: NextUnlock | null = null;
  if (nextGroups && nextGroups.length === groups.length) {
    if (groups.length === 1) {
      const current = groups[0]!;
      const next = nextGroups[0]!;
      const currentDestinations = new Set(current.destinations.map((d) => d.airport));
      const addedDestinations = next.destinations.filter((d) => !currentDestinations.has(d.airport));
      const currentCountries = countriesAbroad(current, airports);
      const addedCountries = countriesAbroad(next, airports);
      for (const country of currentCountries) addedCountries.delete(country);
      if (addedDestinations.length > 0) {
        nextUnlock = {
          kind: "reach",
          destinations: addedDestinations.length,
          countries: addedCountries.size,
        };
      }
    } else {
      const currentKeys = new Set(meetings.map((meeting) => meeting.key));
      const addedMeetings = meetingPlaces(nextGroups, airports)
        .filter((meeting) => !currentKeys.has(meeting.key));
      if (addedMeetings.length > 0) nextUnlock = { kind: "meetings", places: addedMeetings };
    }
  }

  return {
    groups: summaries,
    commonDestinations: intersection(destinationSets).size,
    commonCountries: intersection(countrySets).size,
    meetings,
    nextUnlock,
  };
}
