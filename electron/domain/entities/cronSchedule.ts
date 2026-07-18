export type CronFields = {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
};

type FieldRange = { minimum: number; maximum: number; sundayAlias?: boolean };
const FIELD_RANGES: FieldRange[] = [
  { minimum: 0, maximum: 59 },
  { minimum: 0, maximum: 23 },
  { minimum: 1, maximum: 31 },
  { minimum: 1, maximum: 12 },
  { minimum: 0, maximum: 6, sundayAlias: true },
];
const ONE_YEAR_MINUTES = 366 * 24 * 60;

export function parseCronExpression(expression: string): CronFields | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const values = parts.map((part, index) => expandField(part, FIELD_RANGES[index]!));
  if (values.some((value) => value === null)) return null;
  return {
    minute: values[0]!, hour: values[1]!, dayOfMonth: values[2]!,
    month: values[3]!, dayOfWeek: values[4]!,
  };
}

export function nextCronFireAt(expression: string, fromMs: number): number | null {
  const fields = parseCronExpression(expression);
  if (!fields || !Number.isFinite(fromMs)) return null;
  const minute = new Set(fields.minute);
  const hour = new Set(fields.hour);
  const dayOfMonth = new Set(fields.dayOfMonth);
  const month = new Set(fields.month);
  const dayOfWeek = new Set(fields.dayOfWeek);
  const domWildcard = fields.dayOfMonth.length === 31;
  const dowWildcard = fields.dayOfWeek.length === 7;
  const candidate = new Date(fromMs);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let index = 0; index < ONE_YEAR_MINUTES; index += 1) {
    if (!month.has(candidate.getMonth() + 1)) {
      candidate.setMonth(candidate.getMonth() + 1, 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    const domMatches = dayOfMonth.has(candidate.getDate());
    const dowMatches = dayOfWeek.has(candidate.getDay());
    const dayMatches = domWildcard && dowWildcard
      || (domWildcard ? dowMatches : dowWildcard ? domMatches : domMatches || dowMatches);
    if (!dayMatches) {
      candidate.setDate(candidate.getDate() + 1);
      candidate.setHours(0, 0, 0, 0);
      continue;
    }
    if (!hour.has(candidate.getHours())) {
      candidate.setHours(candidate.getHours() + 1, 0, 0, 0);
      continue;
    }
    if (!minute.has(candidate.getMinutes())) {
      candidate.setMinutes(candidate.getMinutes() + 1);
      continue;
    }
    return candidate.getTime();
  }
  return null;
}

function expandField(field: string, range: FieldRange): number[] | null {
  const output = new Set<number>();
  for (const part of field.split(',')) {
    const wildcard = /^\*(?:\/(\d+))?$/.exec(part);
    if (wildcard) {
      const step = wildcard[1] ? Number.parseInt(wildcard[1], 10) : 1;
      if (step < 1) return null;
      for (let value = range.minimum; value <= range.maximum; value += step) output.add(value);
      continue;
    }
    const interval = /^(\d+)-(\d+)(?:\/(\d+))?$/.exec(part);
    if (interval) {
      const low = Number.parseInt(interval[1]!, 10);
      const high = Number.parseInt(interval[2]!, 10);
      const step = interval[3] ? Number.parseInt(interval[3], 10) : 1;
      const effectiveMaximum = range.sundayAlias ? 7 : range.maximum;
      if (low > high || step < 1 || low < range.minimum || high > effectiveMaximum) return null;
      for (let value = low; value <= high; value += step) output.add(range.sundayAlias && value === 7 ? 0 : value);
      continue;
    }
    if (!/^\d+$/.test(part)) return null;
    let value = Number.parseInt(part, 10);
    if (range.sundayAlias && value === 7) value = 0;
    if (value < range.minimum || value > range.maximum) return null;
    output.add(value);
  }
  return output.size ? [...output].sort((left, right) => left - right) : null;
}
