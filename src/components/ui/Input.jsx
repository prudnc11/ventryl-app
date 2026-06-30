import { cls } from '../../lib/utils';

export function Input({ label, error, hint, leading, trailing, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        {leading && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
            {leading}
          </div>
        )}
        <input
          className={cls(
            'block w-full rounded-lg border text-sm transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30 focus:border-[#0A2540]',
            error ? 'border-red-400' : 'border-gray-300',
            leading ? 'pl-9' : 'pl-3',
            trailing ? 'pr-9' : 'pr-3',
            'py-2 text-gray-900 placeholder:text-gray-400'
          )}
          {...props}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
            {trailing}
          </div>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

export function Select({ label, error, hint, className = '', children, ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        className={cls(
          'block w-full rounded-lg border text-sm transition-colors py-2 pl-3 pr-8',
          'focus:outline-none focus:ring-2 focus:ring-[#0A2540]/30 focus:border-[#0A2540]',
          error ? 'border-red-400' : 'border-gray-300',
          'text-gray-900 bg-white appearance-none'
        )}
        {...props}
      >
        {children}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {hint && !error && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}
