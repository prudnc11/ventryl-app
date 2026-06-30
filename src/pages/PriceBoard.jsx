import { useState } from 'react';
import { Card, CardHeader } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { SinglePriceChart } from '../components/charts/PriceChart';
import { MARKET_SUMMARY, PRICE_HISTORY } from '../lib/data';
import { FUEL_TYPES, formatNaira } from '../lib/constants';
import { pct } from '../lib/utils';

const ALL_PRODUCTS = ['PMS', 'AGO', 'DPK', 'LPG', 'ATK'];

function ProductPriceCard({ product, data, selected, onClick }) {
  const fuel = FUEL_TYPES[product];
  const market = MARKET_SUMMARY[product];
  const delta = pct(market.current, market.prev);
  const positive = delta >= 0;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
        selected
          ? 'border-[#0A2540] bg-[#0A2540]/5 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ backgroundColor: fuel.color }}
          >
            {product}
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-900">{fuel.short}</p>
          </div>
        </div>
        <span className={`text-xs font-bold ${positive ? 'text-emerald-600' : 'text-red-500'}`}>
          {positive ? '▲' : '▼'} {Math.abs(delta)}%
        </span>
      </div>
      <p className="text-xl font-bold text-gray-900">₦{market.current.toLocaleString()}</p>
      <p className="text-xs text-gray-400 mt-0.5">per litre · 24h: ₦{market.low24h.toLocaleString()} – ₦{market.high24h.toLocaleString()}</p>
    </button>
  );
}

export function PriceBoard() {
  const [selected, setSelected] = useState('PMS');
  const fuel = FUEL_TYPES[selected];
  const market = MARKET_SUMMARY[selected];
  const delta = pct(market.current, market.prev);
  const positive = delta >= 0;

  return (
    <div className="space-y-5">
      {/* Live Price Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ALL_PRODUCTS.map((p) => (
          <ProductPriceCard
            key={p}
            product={p}
            data={PRICE_HISTORY[p]}
            selected={selected === p}
            onClick={() => setSelected(p)}
          />
        ))}
      </div>

      {/* Detailed Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title={`${fuel.label} — 30-Day Price Trend`}
              subtitle="Ex-depot price, national average (₦/L)"
            />
            <SinglePriceChart
              data={PRICE_HISTORY[selected]}
              color={fuel.color}
              product={selected}
            />
          </Card>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Market Snapshot</p>
            <div className="space-y-3">
              {[
                { label: 'Current Price', value: `₦${market.current.toLocaleString()}/L` },
                { label: 'Previous Close', value: `₦${market.prev.toLocaleString()}/L` },
                { label: '24h High', value: `₦${market.high24h.toLocaleString()}/L` },
                { label: '24h Low', value: `₦${market.low24h.toLocaleString()}/L` },
                { label: '24h Change', value: `${positive ? '+' : ''}${delta}%`, highlight: positive ? 'text-emerald-600' : 'text-red-500' },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className={`font-semibold text-gray-900 ${highlight ?? ''}`}>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Price by State</p>
            <div className="space-y-2">
              {[
                { state: 'Lagos',      price: market.current },
                { state: 'Rivers',     price: market.current + 12 },
                { state: 'Kaduna',     price: market.current + 18 },
                { state: 'Delta',      price: market.current + 8 },
                { state: 'Abuja FCT', price: market.current + 22 },
              ].map(({ state, price }) => (
                <div key={state} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{state}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${Math.max(20, 80 - (price - market.current))}px`,
                        backgroundColor: fuel.color,
                        opacity: 0.6,
                      }}
                    />
                    <span className="font-semibold text-gray-900 w-20 text-right">₦{price.toLocaleString()}/L</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Comparison table */}
      <Card>
        <CardHeader title="Full Market Comparison" subtitle="All products, current session" />
        <div className="overflow-x-auto -mx-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Product', 'Current Price', 'Prev Close', '24h Change', '24h High', '24h Low'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_PRODUCTS.map((p) => {
                const m = MARKET_SUMMARY[p];
                const d = pct(m.current, m.prev);
                const pos = d >= 0;
                return (
                  <tr key={p} className="border-b border-gray-50 hover:bg-gray-50/80 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-bold text-white"
                          style={{ backgroundColor: FUEL_TYPES[p].color }}
                        >{p}</span>
                        <span className="text-gray-500">{FUEL_TYPES[p].label.split('(')[1]?.replace(')', '') ?? ''}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900">₦{m.current.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-600">₦{m.prev.toLocaleString()}</td>
                    <td className={`px-5 py-3 font-semibold ${pos ? 'text-emerald-600' : 'text-red-500'}`}>
                      {pos ? '+' : ''}{d}%
                    </td>
                    <td className="px-5 py-3 text-gray-600">₦{m.high24h.toLocaleString()}</td>
                    <td className="px-5 py-3 text-gray-600">₦{m.low24h.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
