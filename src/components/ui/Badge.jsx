import { cls } from '../../lib/utils';

const variants = {
  green:  'bg-emerald-100 text-emerald-700',
  blue:   'bg-blue-100 text-blue-700',
  yellow: 'bg-amber-100 text-amber-700',
  red:    'bg-red-100 text-red-700',
  purple: 'bg-violet-100 text-violet-700',
  orange: 'bg-orange-100 text-orange-700',
  gray:   'bg-gray-100 text-gray-600',
};

export function Badge({ children, color = 'gray', className = '' }) {
  return (
    <span
      className={cls(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold',
        variants[color] ?? variants.gray,
        className
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status, map }) {
  const { label, color, bg } = map[status] ?? { label: status, color: '#6B7280', bg: '#F3F4F6' };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ color, backgroundColor: bg }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600">
      <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
      </svg>
      DPR Verified
    </span>
  );
}
