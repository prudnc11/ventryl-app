import { formatDistanceToNow, format } from 'date-fns';

export const cls = (...classes) => classes.filter(Boolean).join(' ');

export const timeAgo = (date) => formatDistanceToNow(new Date(date), { addSuffix: true });

export const formatDate = (date, fmt = 'dd MMM yyyy') =>
  format(new Date(date), fmt);

export const formatDateTime = (date) =>
  format(new Date(date), 'dd MMM yyyy, HH:mm');

export const debounce = (fn, ms = 300) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const pct = (a, b) =>
  b === 0 ? 0 : Number((((a - b) / b) * 100).toFixed(1));

export const clamp = (val, min, max) => Math.min(Math.max(val, min), max);

// Colour helpers
export const hexToRgba = (hex, alpha = 1) => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

export const statusColor = (status, map) => map[status] ?? { color: '#6B7280', bg: '#F3F4F6' };

export const truncate = (str, n = 40) =>
  str.length > n ? `${str.slice(0, n)}…` : str;
