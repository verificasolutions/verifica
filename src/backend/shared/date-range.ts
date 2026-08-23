const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const SAO_PAULO_OFFSET = "-03:00";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function getSaoPauloParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SAO_PAULO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });

  const parts = formatter.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: read("weekday"),
  };
}

export function getSaoPauloCalendarDate(date = new Date()) {
  const current = getSaoPauloParts(date);
  return {
    year: current.year,
    month: current.month,
    day: current.day,
  };
}

function formatDate(value: CalendarDate) {
  return `${value.year}-${String(value.month).padStart(2, "0")}-${String(value.day).padStart(2, "0")}`;
}

function shiftDays(value: CalendarDate, amount: number): CalendarDate {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day + amount));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toUtcIso(date: CalendarDate, time: string) {
  return new Date(`${formatDate(date)}T${time}${SAO_PAULO_OFFSET}`).toISOString();
}

export function getSaoPauloDayRange(date = new Date()) {
  const current = getSaoPauloParts(date);
  const calendar = { year: current.year, month: current.month, day: current.day };

  return {
    start: toUtcIso(calendar, "00:00:00.000"),
    end: toUtcIso(calendar, "23:59:59.999"),
  };
}

export function getSaoPauloWeekRange(date = new Date()) {
  const current = getSaoPauloParts(date);
  const calendar = { year: current.year, month: current.month, day: current.day };
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayMap[current.weekday] ?? 0;
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const weekStart = shiftDays(calendar, mondayOffset);
  const weekEnd = shiftDays(weekStart, 6);

  return {
    start: toUtcIso(weekStart, "00:00:00.000"),
    end: toUtcIso(weekEnd, "23:59:59.999"),
  };
}

export function getSaoPauloMonthStart(date = new Date()) {
  const current = getSaoPauloParts(date);
  return toUtcIso({ year: current.year, month: current.month, day: 1 }, "00:00:00.000");
}
