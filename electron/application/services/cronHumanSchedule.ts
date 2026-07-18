const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function cronToHuman(expression: string) {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const everyMinute = /^\*\/(\d+)$/.exec(minute!);
  if (everyMinute && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const count = Number.parseInt(everyMinute[1]!, 10);
    return count === 1 ? 'Every minute' : `Every ${count} minutes`;
  }
  if (/^\d+$/.test(minute!) && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const value = Number.parseInt(minute!, 10);
    return value === 0 ? 'Every hour' : `Every hour at :${String(value).padStart(2, '0')}`;
  }
  const everyHour = /^\*\/(\d+)$/.exec(hour!);
  if (/^\d+$/.test(minute!) && everyHour && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    const count = Number.parseInt(everyHour[1]!, 10);
    const suffix = minute === '0' ? '' : ` at :${minute!.padStart(2, '0')}`;
    return count === 1 ? `Every hour${suffix}` : `Every ${count} hours${suffix}`;
  }
  if (!/^\d+$/.test(minute!) || !/^\d+$/.test(hour!)) return expression;
  const time = formatTime(Number.parseInt(minute!, 10), Number.parseInt(hour!, 10));
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') return `Every day at ${time}`;
  if (dayOfMonth === '*' && month === '*' && /^\d$/.test(dayOfWeek!)) {
    return `Every ${DAY_NAMES[Number.parseInt(dayOfWeek!, 10) % 7]} at ${time}`;
  }
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') return `Weekdays at ${time}`;
  return expression;
}

function formatTime(minute: number, hour: number) {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
