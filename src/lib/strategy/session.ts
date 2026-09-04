export type NyParts = {
  weekday: string;
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  dateKey: string;
  minutes: number;
};

export function zonedParts(ts: number, timeZone = "America/New_York"): NyParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(ts))) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  const hour = Number(bag.hour);
  const minute = Number(bag.minute);
  return {
    weekday: bag.weekday,
    year: bag.year,
    month: bag.month,
    day: bag.day,
    hour,
    minute,
    dateKey: `${bag.year}-${bag.month}-${bag.day}`,
    minutes: hour * 60 + minute,
  };
}

export function formatClock(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function parseClock(value: string): number {
  const [h, m] = value.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
  return h * 60 + m;
}

export function sessionStatus(
  ts: number,
  args: {
    sessionTimeZone: string;
    sessionStartMinutes: number;
    sessionEndMinutes: number;
  },
) {
  const z = zonedParts(ts, args.sessionTimeZone);
  const weekend = z.weekday === "Sat" || z.weekday === "Sun";
  const inWindow = z.minutes >= args.sessionStartMinutes && z.minutes < args.sessionEndMinutes;
  const inSession = !weekend && inWindow;
  const startLabel = formatClock(args.sessionStartMinutes);
  const endLabel = formatClock(args.sessionEndMinutes);
  let label = `New York session ${startLabel}–${endLabel} ET`;
  if (weekend) label = "Weekend — New York session closed";
  else if (z.minutes < args.sessionStartMinutes) label = `Premarket — entries start ${startLabel} ET`;
  else if (z.minutes >= args.sessionEndMinutes) label = `Session closed at ${endLabel} ET`;
  else label = `New York session open · ${startLabel}–${endLabel} ET`;

  return {
    ...z,
    weekend,
    inSession,
    clock: `${formatClock(z.minutes)} ET`,
    label,
    startLabel,
    endLabel,
  };
}

export function isSessionBar(
  closeTime: number,
  args: {
    sessionTimeZone: string;
    sessionStartMinutes: number;
    sessionEndMinutes: number;
  },
  dateKey: string,
): boolean {
  const status = sessionStatus(closeTime, args);
  return status.inSession && status.dateKey === dateKey;
}
