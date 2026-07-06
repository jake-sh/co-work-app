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
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

export function parseScheduleFromText(text: string, now: Date = new Date()): ParsedSchedule | null {
  let date: Date | null = null;
  const consumed: string[] = [];

  let m = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    consumed.push(m[0]);
  }

  if (!date) {
    m = text.match(/(\d{1,2})\s?월\s?(\d{1,2})\s?일/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const day = parseInt(m[2], 10);
      // Always use the current year: this parses casual in-context date
      // mentions in a memo/to-do ("7월5일 보고"), which almost always refer to
      // a date near today — including ones that already just passed — not
      // one a full year out. Rolling to next year for any date earlier than
      // today (even yesterday) put auto-created events a year in the future,
      // where they'd never be seen.
      date = new Date(now.getFullYear(), month, day);
      consumed.push(m[0]);
    }
  }

  if (!date) {
    m = text.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const day = parseInt(m[2], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        date = new Date(now.getFullYear(), month, day);
        consumed.push(m[0]);
      }
    }
  }

  if (!date) {
    let mm = text.match(/모레/);
    if (mm) {
      date = addDays(now, 2);
      consumed.push(mm[0]);
    } else if ((mm = text.match(/내일|tomorrow/i))) {
      date = addDays(now, 1);
      consumed.push(mm[0]);
    } else if ((mm = text.match(/오늘|today/i))) {
      date = now;
      consumed.push(mm[0]);
    }
  }

  if (!date) {
    const nextWeekMatch = text.match(/다음\s?주/);
    const thisWeekMatch = text.match(/이번\s?주/);
    const nextWeek = !!nextWeekMatch;
    const lowerText = text.toLowerCase();
    for (const [key, dayIdx] of Object.entries(WEEKDAYS)) {
      const idx = lowerText.indexOf(key.toLowerCase());
      if (idx !== -1) {
        date = resolveWeekday(now, dayIdx, nextWeek);
        consumed.push(text.slice(idx, idx + key.length));
        if (nextWeekMatch) consumed.push(nextWeekMatch[0]);
        if (thisWeekMatch) consumed.push(thisWeekMatch[0]);
        break;
      }
    }
  }

  if (!date) return null;

  const time = parseTime(text);
  if (time) consumed.push(time.raw);

  return {
    date: format(date, "yyyy-MM-dd"),
    time: time?.value ?? null,
    title: stripConsumed(text, consumed),
  };
}
