const dayMilliseconds = 86400000;
const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' });
function getCalendar(now = new Date()) {
  const parts = Object.fromEntries(formatter.formatToParts(now).map(part => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  const day = new Date(today + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return {
    today, weekStart: day.toISOString().slice(0, 10), timeZone: 'Asia/Shanghai',
    serverNow: now.toISOString(), nextResetAt: new Date(new Date(today + 'T00:00:00+08:00').getTime() + dayMilliseconds).toISOString(),
  };
}
const periodDate = (recurrence, calendar) => recurrence === 'daily' ? calendar.today : recurrence === 'weekly' ? calendar.weekStart : null;
const periodKey = (recurrence, calendar) => recurrence === 'none' ? null : `${recurrence}:${periodDate(recurrence, calendar)}`;
const isCompleted = (row, calendar) => Boolean(row.completed && (row.recurrence === 'none' || row.completed_period === periodDate(row.recurrence, calendar)));
module.exports = { getCalendar, periodDate, periodKey, isCompleted };
