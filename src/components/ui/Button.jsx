import { cls } from '../../lib/utils';

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';

const variants = {
  primary:  'bg-[#0A2540] text-white hover:bg-[#0d2f4f] focus:ring-[#0A2540]',
  accent:   'bg-[#F59E0B] text-white hover:bg-[#d97706] focus:ring-amber-400',
  outline:  'border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:ring-gray-300',
  ghost:    'text-gray-600 hover:bg-gray-100 focus:ring-gray-200',
  danger:   'bg-red-600 text-white hover:bg-red-700 focus:ring-red-400',
  success:  'bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-400',
};

const sizes = {
  xs: 'px-2.5 py-1 text-xs',
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  icon,
  ...props
}) {
  return (
    <button
      className={cls(base, variants[variant], sizes[size], className)}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      ) : icon ? (
        <span className="w-4 h-4 flex-shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
