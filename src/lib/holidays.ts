import Holidays from "date-holidays";

const hd = new Holidays("KR");
const cache = new Map<number, Map<string, string>>();

function holidaysForYear(year: number): Map<string, string> {
  let map = cache.get(year);
  if (!map) {
    map = new Map();
    for (const h of hd.getHolidays(year)) {
      // Only statutory (public) holidays — date-holidays also lists
      // observances (e.g. Parent's Day) that aren't actual days off.
      if (h.type === "public") map.set(h.date.slice(0, 10), h.name);
    }
    cache.set(year, map);
  }
  return map;
}

// dateKey is "yyyy-MM-dd", matching the format used throughout the schedule page.
export function getHolidayName(dateKey: string): string | null {
  const year = parseInt(dateKey.slice(0, 4), 10);
  return holidaysForYear(year).get(dateKey) ?? null;
}
