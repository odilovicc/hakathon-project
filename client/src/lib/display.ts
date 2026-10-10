export function dateLabel(date: string, short = false) {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: short ? 'short' : 'long',
    ...(short ? {} : { year: 'numeric' as const }),
  }).format(new Date(`${date}T12:00:00`));
}
