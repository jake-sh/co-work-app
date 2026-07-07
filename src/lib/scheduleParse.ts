import { addDays, format } from "date-fns";

const WEEKDAYS: Record<string, number> = {
  일요일: 0,
  월요일: 1,
  화요일: 2,
  수요일: 3,
  목요일: 4,
  금요일: 5,
  토요일: 6,
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export interface ParsedSchedule {
  date: string;
  time: string | null;
  // The input text with the recognized date/time phrase(s) removed, so the
  // auto-created event isn't titled with a redundant restatement of its own
  // date (e.g. "이번주 금요일 소장보고" -> "소장보고").
  title: string;
  // Set when this entry is one day of a parsed range ("7/5~7/7 교육"): every
  // entry generated from the same range shares rangeId/rangeStart/rangeEnd,
  // so callers can tag the created events as one group.
  rangeId?: string;
  rangeStart?: string;
  rangeEnd?: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// A "M월 D일" / "M/D" mention has no year, so the year has to be inferred
// from how far the date sits from today. A future date (or one within the
// last ~2 months) almost certainly means this year — a recent reference like
// "yesterday" or an upcoming plan. Only once it's further in the past than
// that does it more plausibly mean "next year's" occurrence of that date
// (e.g. mentioning "1월5일" in December).
const PAST_ROLLOVER_THRESHOLD_DAYS = 60;

function resolveYearlessDate(now: Date, month: number, day: number): Date {
  const today = startOfDay(now);
  const candidate = new Date(now.getFullYear(), month, day);
  const daysBehind = Math.round((today.getTime() - candidate.getTime()) / 86_400_000);
  return daysBehind > PAST_ROLLOVER_THRESHOLD_DAYS ? new Date(now.getFullYear() + 1, month, day) : candidate;
}

function parseTime(text: string): { value: string; raw: string } | null {
  let m = text.match(/(오전|오후|am|pm)\s?(\d{1,2})\s?시(?:\s?(\d{1,2})\s?분)?/i);
  if (m) {
    let hour = parseInt(m[2], 10) % 12;
    const minute = m[3] ? parseInt(m[3], 10) : 0;
    if (/오후|pm/i.test(m[1])) hour += 12;
    return { value: `${pad(hour)}:${pad(minute)}`, raw: m[0] };
  }

  m = text.match(/(\d{1,2})\s?시(?:\s?(\d{1,2})\s?분)?/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour <= 23 && minute <= 59) return { value: `${pad(hour)}:${pad(minute)}`, raw: m[0] };
  }

  m = text.match(/(\d{1,2}):(\d{2})\s?(am|pm)?/i);
  if (m) {
    let hour = parseInt(m[1], 10) % 12;
    const minute = parseInt(m[2], 10);
    if (m[3]) {
      if (/pm/i.test(m[3])) hour += 12;
    } else {
      hour = parseInt(m[1], 10);
    }
    if (hour <= 23 && minute <= 59) return { value: `${pad(hour)}:${pad(minute)}`, raw: m[0] };
  }

  return null;
}

function resolveWeekday(now: Date, dayIdx: number, nextWeek: boolean): Date {
  const today = startOfDay(now);
  const weekStart = addDays(today, -today.getDay());
  let target = addDays(weekStart, dayIdx);
  if (nextWeek) {
    target = addDays(target, 7);
  } else if (target < today) {
    target = addDays(target, 7);
  }
  return target;
}

function stripConsumed(text: string, consumed: string[]): string {
  let title = text;
  for (const phrase of consumed) {
    if (phrase) title = title.replace(phrase, " ");
  }
  title = title.replace(/\s+/g, " ").trim();
  return title || text.trim();
}

// A period like "7/5~7/7 교육" spans multiple days; the end side may omit its
// month ("7/5~7") to mean "the 7th of the same month". Capped at a month so a
// mistyped date can't silently create dozens of events.
const MAX_RANGE_DAYS = 31;

function parseRange(line: string, now: Date): { start: Date; end: Date; matched: string } | null {
  let m = line.match(/(\d{1,2})[./](\d{1,2})\s*[~-]\s*(?:(\d{1,2})[./])?(\d{1,2})(?!\d)/);
  if (m) {
    const startMonth = parseInt(m[1], 10) - 1;
    const startDay = parseInt(m[2], 10);
    const endMonth = m[3] ? parseInt(m[3], 10) - 1 : startMonth;
    const endDay = parseInt(m[4], 10);
    if (startMonth >= 0 && startMonth <= 11 && endMonth >= 0 && endMonth <= 11 && startDay >= 1 && endDay >= 1) {
      const start = resolveYearlessDate(now, startMonth, startDay);
      let end = new Date(start.getFullYear(), endMonth, endDay);
      if (end < start) end = new Date(start.getFullYear() + 1, endMonth, endDay);
      return { start, end, matched: m[0] };
    }
  }

  m = line.match(/(\d{1,2})\s?월\s?(\d{1,2})\s?일\s*[~-]\s*(?:(\d{1,2})\s?월\s?)?(\d{1,2})\s?일/);
  if (m) {
    const startMonth = parseInt(m[1], 10) - 1;
    const startDay = parseInt(m[2], 10);
    const endMonth = m[3] ? parseInt(m[3], 10) - 1 : startMonth;
    const endDay = parseInt(m[4], 10);
    const start = resolveYearlessDate(now, startMonth, startDay);
    let end = new Date(start.getFullYear(), endMonth, endDay);
    if (end < start) end = new Date(start.getFullYear() + 1, endMonth, endDay);
    return { start, end, matched: m[0] };
  }

  return null;
}

// Parses a single line in isolation. A line with no recognizable date
// mention returns an empty array and is treated as plain detail/body text.
// A period ("7/5~7/7 교육") produces one entry per day in the range.
function parseLine(line: string, now: Date): ParsedSchedule[] {
  const range = parseRange(line, now);
  if (range) {
    const days = Math.round((range.end.getTime() - range.start.getTime()) / 86_400_000) + 1;
    if (days >= 1 && days <= MAX_RANGE_DAYS) {
      const consumed = [range.matched];
      const time = parseTime(line);
      if (time) consumed.push(time.raw);
      const title = stripConsumed(line, consumed);
      const rangeId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const rangeStart = format(range.start, "yyyy-MM-dd");
      const rangeEnd = format(range.end, "yyyy-MM-dd");
      const entries: ParsedSchedule[] = [];
      for (let i = 0; i < days; i++) {
        entries.push({
          date: format(addDays(range.start, i), "yyyy-MM-dd"),
          time: time?.value ?? null,
          title,
          rangeId,
          rangeStart,
          rangeEnd,
        });
      }
      return entries;
    }
  }

  const single = parseSingleDate(line, now);
  return single ? [single] : [];
}

function parseSingleDate(line: string, now: Date): ParsedSchedule | null {
  let date: Date | null = null;
  const consumed: string[] = [];

  let m = line.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    consumed.push(m[0]);
  }

  if (!date) {
    m = line.match(/(\d{1,2})\s?월\s?(\d{1,2})\s?일/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const day = parseInt(m[2], 10);
      date = resolveYearlessDate(now, month, day);
      consumed.push(m[0]);
    }
  }

  if (!date) {
    m = line.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const day = parseInt(m[2], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        date = resolveYearlessDate(now, month, day);
        consumed.push(m[0]);
      }
    }
  }

  if (!date) {
    let mm = line.match(/모레/);
    if (mm) {
      date = addDays(now, 2);
      consumed.push(mm[0]);
    } else if ((mm = line.match(/내일|tomorrow/i))) {
      date = addDays(now, 1);
      consumed.push(mm[0]);
    } else if ((mm = line.match(/오늘|today/i))) {
      date = now;
      consumed.push(mm[0]);
    }
  }

  if (!date) {
    const nextWeekMatch = line.match(/다음\s?주/);
    const thisWeekMatch = line.match(/이번\s?주/);
    const nextWeek = !!nextWeekMatch;
    const lowerLine = line.toLowerCase();
    for (const [key, dayIdx] of Object.entries(WEEKDAYS)) {
      const idx = lowerLine.indexOf(key.toLowerCase());
      if (idx !== -1) {
        date = resolveWeekday(now, dayIdx, nextWeek);
        consumed.push(line.slice(idx, idx + key.length));
        if (nextWeekMatch) consumed.push(nextWeekMatch[0]);
        if (thisWeekMatch) consumed.push(thisWeekMatch[0]);
        break;
      }
    }
  }

  if (!date) return null;

  const time = parseTime(line);
  if (time) consumed.push(time.raw);

  return {
    date: format(date, "yyyy-MM-dd"),
    time: time?.value ?? null,
    title: stripConsumed(line, consumed),
  };
}

// Each line is parsed independently: a line that opens with a date mention
// becomes its own schedule entry (title = that line with the date/time
// stripped out); a line with no date is plain detail text and is dropped
// entirely rather than being appended to the nearest preceding entry.
export function parseSchedulesFromText(text: string, now: Date = new Date()): ParsedSchedule[] {
  const results: ParsedSchedule[] = [];
  for (const line of text.split("\n")) {
    results.push(...parseLine(line, now));
  }
  return results;
}
