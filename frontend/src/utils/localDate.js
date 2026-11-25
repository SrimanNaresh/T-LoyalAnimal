// Calendar dates in the browser's own time zone, as YYYY-MM-DD.
// Don't use toISOString().slice(0, 10) for this: that is the UTC date, which in
// India is still "yesterday" until 5:30 AM.
export const localDateKey = (date = new Date()) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
