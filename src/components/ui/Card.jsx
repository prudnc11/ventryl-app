import { cls } from '../../lib/utils';

export function Card({ children, className = '', padding = true }) {
  return (
    <div className={cls('bg-white rounded-xl border border-gray-200 shadow-sm', padding && 'p-5', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action, icon }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="w-9 h-9 rounded-lg bg-[#0A2540]/8 flex items-center justify-center text-[#0A2540]">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function Stat({ label, value, change, changeLabel, icon, color = '#0A2540' }) {
  const isPositive = change >= 0;
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <p className={cls('text-xs font-medium mt-1', isPositive ? 'text-emerald-600' : 'text-red-500')}>
              {isPositive ? '↑' : '↓'} {Math.abs(change)}%{changeLabel ? ` ${changeLabel}` : ''}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0"
            style={{ backgroundColor: color }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}
