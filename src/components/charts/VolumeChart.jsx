import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
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
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-medium text-gray-900">{(p.value / 1000).toFixed(0)}kL</span>
        </div>
      ))}
    </div>
  );
};

export function VolumeChart({ data, stacked = true }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }} barSize={12}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
          width={36}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
        />
        {['PMS', 'AGO', 'DPK'].map((p) => (
          <Bar
            key={p}
            dataKey={p}
            name={FUEL_TYPES[p]?.short}
            fill={FUEL_TYPES[p]?.color}
            stackId={stacked ? 'a' : undefined}
            radius={stacked ? undefined : [2, 2, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
