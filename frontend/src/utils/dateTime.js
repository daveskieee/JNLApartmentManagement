const APP_TIMEZONE = process.env.REACT_APP_TIMEZONE || 'Asia/Manila';
const APP_LOCALE = process.env.REACT_APP_LOCALE || 'en-PH';

const DATETIME_WITHOUT_TZ = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const normalizeDateInput = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  // SQLite often returns timestamps without timezone; treat them as UTC for consistency.
  if (DATETIME_WITHOUT_TZ.test(raw)) {
    const isoUtc = raw.replace(' ', 'T') + 'Z';
    const d = new Date(isoUtc);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  if (DATE_ONLY.test(raw)) {
    const d = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatAppDate = (value, extraOptions = {}) => {
  const date = normalizeDateInput(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: APP_TIMEZONE,
    ...extraOptions,
  }).format(date);
};

export const formatAppTime = (value, extraOptions = {}) => {
  const date = normalizeDateInput(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: APP_TIMEZONE,
    ...extraOptions,
  }).format(date);
};

export const formatAppDateTime = (value, extraOptions = {}) => {
  const date = normalizeDateInput(value);
  if (!date) return 'N/A';

  return new Intl.DateTimeFormat(APP_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: APP_TIMEZONE,
    ...extraOptions,
  }).format(date);
};
