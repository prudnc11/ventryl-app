import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { FUEL_TYPES } from '../../lib/constants';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-600">{FUEL_TYPES[p.dataKey]?.short ?? p.dataKey}:</span>
          <span className="font-medium text-gray-900">₦{p.value.toLocaleString()}/L</span>
        </div>
      ))}
    </div>
  );
};

export function PriceChart({ data, products = ['PMS', 'AGO', 'DPK'] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₦${(v / 1000).toFixed(1)}k`}
          width={48}
        />
        <Tooltip content={<CustomTooltip />} />
        {products.map((p) => (
          <Line
            key={p}
            type="monotone"
            dataKey="price"
            data={data[p]}
            name={p}
            stroke={FUEL_TYPES[p]?.color ?? '#6B7280'}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function SinglePriceChart({ data, color = '#0A2540', product = 'PMS' }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          interval={4}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `₦${v.toLocaleString()}`}
          width={56}
          domain={['auto', 'auto']}
        />
        <Tooltip
          formatter={(v) => [`₦${v.toLocaleString()}/L`, FUEL_TYPES[product]?.short ?? product]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Line
          type="monotone"
          dataKey="price"
          stroke={color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: color }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
