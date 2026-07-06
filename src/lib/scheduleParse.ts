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
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseTime(text: string): string | null {
  let m = text.match(/(오전|오후|am|pm)\s?(\d{1,2})\s?시(?:\s?(\d{1,2})\s?분)?/i);
  if (m) {
    let hour = parseInt(m[2], 10) % 12;
    const minute = m[3] ? parseInt(m[3], 10) : 0;
    if (/오후|pm/i.test(m[1])) hour += 12;
    return `${pad(hour)}:${pad(minute)}`;
  }

  m = text.match(/(\d{1,2})\s?시(?:\s?(\d{1,2})\s?분)?/);
  if (m) {
    const hour = parseInt(m[1], 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    if (hour <= 23 && minute <= 59) return `${pad(hour)}:${pad(minute)}`;
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
    if (hour <= 23 && minute <= 59) return `${pad(hour)}:${pad(minute)}`;
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

export function parseScheduleFromText(text: string, now: Date = new Date()): ParsedSchedule | null {
  let date: Date | null = null;

  let m = text.match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (m) {
    date = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
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
    }
  }

  if (!date) {
    m = text.match(/(?<!\d)(\d{1,2})[./](\d{1,2})(?!\d)/);
    if (m) {
      const month = parseInt(m[1], 10) - 1;
      const day = parseInt(m[2], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        date = new Date(now.getFullYear(), month, day);
      }
    }
  }

  if (!date) {
    if (/모레/.test(text)) date = addDays(now, 2);
    else if (/내일|tomorrow/i.test(text)) date = addDays(now, 1);
    else if (/오늘|today/i.test(text)) date = now;
  }

  if (!date) {
    const nextWeek = /다음\s?주/.test(text);
    for (const [key, dayIdx] of Object.entries(WEEKDAYS)) {
      if (text.toLowerCase().includes(key.toLowerCase())) {
        date = resolveWeekday(now, dayIdx, nextWeek);
        break;
      }
    }
  }

  if (!date) return null;

  return {
    date: format(date, "yyyy-MM-dd"),
    time: parseTime(text),
  };
}
