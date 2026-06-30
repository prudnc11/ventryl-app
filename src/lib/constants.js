export const FUEL_TYPES = {
  PMS: { label: 'PMS (Petrol)', short: 'PMS', color: '#F59E0B', unit: 'litres' },
  AGO: { label: 'AGO (Diesel)', short: 'AGO', color: '#3B82F6', unit: 'litres' },
  DPK: { label: 'DPK (Kerosene)', short: 'DPK', color: '#8B5CF6', unit: 'litres' },
  LPG: { label: 'LPG (Cooking Gas)', short: 'LPG', color: '#10B981', unit: 'kg' },
  ATK: { label: 'ATK (Aviation)', short: 'ATK', color: '#EF4444', unit: 'litres' },
};

export const ORDER_STATUS = {
  pending:    { label: 'Pending',     color: '#F59E0B', bg: '#FEF3C7' },
  confirmed:  { label: 'Confirmed',   color: '#3B82F6', bg: '#DBEAFE' },
  loading:    { label: 'Loading',     color: '#8B5CF6', bg: '#EDE9FE' },
  in_transit: { label: 'In Transit',  color: '#F97316', bg: '#FFEDD5' },
  delivered:  { label: 'Delivered',   color: '#10B981', bg: '#D1FAE5' },
  cancelled:  { label: 'Cancelled',   color: '#EF4444', bg: '#FEE2E2' },
  disputed:   { label: 'Disputed',    color: '#6B7280', bg: '#F3F4F6' },
};

export const NIGERIAN_STATES = [
  'Lagos', 'Abuja (FCT)', 'Rivers', 'Delta', 'Kaduna',
  'Kano', 'Oyo', 'Ondo', 'Bayelsa', 'Edo', 'Anambra',
  'Enugu', 'Imo', 'Cross River', 'Akwa Ibom',
];

export const DEPOT_TIERS = {
  certified: { label: 'DPR Certified', color: '#10B981' },
  verified:  { label: 'Verified',      color: '#3B82F6' },
  standard:  { label: 'Standard',      color: '#6B7280' },
};

export const NAIRA = '₦';
export const NAIRA_FORMAT = new Intl.NumberFormat('en-NG', {
  style: 'currency', currency: 'NGN', maximumFractionDigits: 0,
});

export const formatNaira = (n) => NAIRA_FORMAT.format(n);
export const formatVolume = (n, unit = 'L') =>
  `${new Intl.NumberFormat('en-NG').format(n)} ${unit}`;
