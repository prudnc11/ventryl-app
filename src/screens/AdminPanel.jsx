/**
 * Ventryl Admin Panel
 * Only accessible when profile.is_admin === true.
 * Tabs: Overview · KYC Review · KYB Review · Orders · Pricing · Users
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase as sb } from '../lib/supabase';

// ── Design tokens (mirror App.jsx) ────────────────────────────────────────────
const T = {
  black:'#000000',white:'#FFFFFF',green:'#06C167',greenLight:'#E6F9F1',greenDark:'#038C48',
  red:'#FF3B30',redLight:'#FFF1F0',
  amber:'#F5A623',amberLight:'#FFF8E7',
  blue:'#1D4ED8',blueLight:'#EFF6FF',
  gray50:'#FAFAFA',gray100:'#F5F5F5',gray200:'#E5E5E5',gray400:'#9CA3AF',gray600:'#4B5563',
};
const F = "'Manrope', sans-serif";


// ── Tiny shared UI ─────────────────────────────────────────────────────────────
function Badge({ status }) {
  const MAP = {
    pending:   { bg: T.amberLight, color: '#8A5C00', label: 'Pending' },
    submitted: { bg: T.blueLight,  color: T.blue,    label: 'Submitted' },
    verified:  { bg: T.greenLight, color: T.greenDark,label: 'Verified' },
    rejected:  { bg: T.redLight,   color: T.red,     label: 'Rejected' },
    approved:  { bg: T.greenLight, color: T.greenDark,label: 'Approved' },
    confirmed: { bg: T.greenLight, color: T.greenDark,label: 'Confirmed' },
    in_transit:{ bg: T.blueLight,  color: T.blue,    label: 'In Transit' },
    delivered: { bg: T.greenLight, color: T.greenDark,label: 'Delivered' },
    collected: { bg: T.greenLight, color: T.greenDark,label: 'Collected' },
    cancelled: { bg: T.gray100,    color: T.gray600,  label: 'Cancelled' },
    disputed:  { bg: T.redLight,   color: T.red,     label: 'Disputed' },
  };
  const s = MAP[status] || { bg: T.gray100, color: T.gray400, label: status };
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '10px', fontWeight: 800,
      padding: '2px 8px', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ background: T.black, padding: '20px 22px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '28px', fontWeight: 800, color: color || T.green, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', color: T.gray400, marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function SectionHead({ title, sub, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{title}</div>
        {sub && <div style={{ fontSize: '11px', color: T.gray400, marginTop: '2px' }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: T.gray400, fontSize: '12px' }}>Loading…</div>;
}

function ErrBanner({ msg }) {
  if (!msg) return null;
  return <div style={{ background: T.redLight, border: `1px solid ${T.red}`, padding: '10px 14px', fontSize: '12px', color: T.red, fontWeight: 600, marginBottom: '12px' }}>{msg}</div>;
}

// ── VCS Score pill ─────────────────────────────────────────────────────────────
function VcsPill({ score }) {
  const color = score >= 750 ? T.greenDark : score >= 600 ? T.blue : score >= 450 ? '#92400e' : T.red;
  const bg    = score >= 750 ? T.greenLight : score >= 600 ? T.blueLight : score >= 450 ? T.amberLight : T.redLight;
  return (
    <span style={{ background: bg, color, fontSize: '10px', fontWeight: 800, padding: '2px 8px' }}>
      VCS {score}
    </span>
  );
}

// ── KYC Review Tab ─────────────────────────────────────────────────────────────
function KycReview({ isMobile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [acting, setActing] = useState({});
  const [rejectReason, setRejectReason] = useState({});
  const [showReject, setShowReject] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, email, company_name, kyc_status, vcs_score, created_at')
      .in('kyc_status', ['submitted', 'rejected'])
      .order('created_at', { ascending: false });
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (userId, action, reason) => {
    setActing(a => ({ ...a, [userId]: action }));
    const updates = action === 'approve'
      ? { kyc_status: 'verified' }
      : { kyc_status: 'rejected' };
    const { error } = await sb.from('profiles').update(updates).eq('id', userId);
    if (error) { setErr(error.message); setActing(a => ({ ...a, [userId]: null })); return; }
    setRows(r => r.filter(u => u.id !== userId));
    setActing(a => ({ ...a, [userId]: null }));
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: T.gray400 }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>No pending KYC submissions</div>
        </div>
      )}
      {rows.map(u => (
        <div key={u.id} style={{ border: `1px solid ${T.gray100}`, background: T.white, marginBottom: '10px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{u.full_name || '—'}</span>
                <Badge status={u.kyc_status} />
                <VcsPill score={u.vcs_score || 300} />
              </div>
              <div style={{ fontSize: '11px', color: T.gray400 }}>{u.email} · {u.company_name || 'No company'}</div>
              <div style={{ fontSize: '10px', color: T.gray400, marginTop: '2px' }}>Submitted: {new Date(u.created_at).toLocaleDateString('en-NG')}</div>
            </div>
            <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
              <button onClick={() => setShowReject(s => ({ ...s, [u.id]: !s[u.id] }))}
                style={{ background: T.white, color: T.red, border: `1px solid ${T.red}`, padding: '7px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: F, minHeight: '36px' }}>
                Reject
              </button>
              <button onClick={() => act(u.id, 'approve')}
                disabled={!!acting[u.id]}
                style={{ background: T.green, color: T.white, border: 'none', padding: '7px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: F, minHeight: '36px', opacity: acting[u.id] ? 0.6 : 1 }}>
                {acting[u.id] === 'approve' ? 'Approving…' : 'Approve ✓'}
              </button>
            </div>
          </div>
          {showReject[u.id] && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${T.gray100}` }}>
              <input value={rejectReason[u.id] || ''} onChange={e => setRejectReason(r => ({ ...r, [u.id]: e.target.value }))}
                placeholder="Rejection reason (required)"
                style={{ width: '100%', border: `1px solid ${T.red}`, padding: '9px 12px', fontFamily: F, fontSize: '12px', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={() => { if (!rejectReason[u.id]?.trim()) return; act(u.id, 'reject', rejectReason[u.id]); setShowReject(s => ({ ...s, [u.id]: false })); }}
                disabled={!rejectReason[u.id]?.trim() || !!acting[u.id]}
                style={{ background: rejectReason[u.id]?.trim() ? T.red : T.gray200, color: rejectReason[u.id]?.trim() ? T.white : T.gray400, border: 'none', padding: '8px 16px', fontSize: '11px', fontWeight: 800, cursor: rejectReason[u.id]?.trim() ? 'pointer' : 'not-allowed', fontFamily: F }}>
                {acting[u.id] === 'reject' ? 'Rejecting…' : 'Confirm Rejection'}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── KYB Review Tab ─────────────────────────────────────────────────────────────
function KybReview({ isMobile }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [acting, setActing] = useState({});
  const [showReject, setShowReject] = useState({});
  const [rejectReason, setRejectReason] = useState({});

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from('depots')
        .select('id, name, location, kyb_status, license_number, created_at, profiles!owner_id(full_name, email)')
        .in('kyb_status', ['submitted', 'rejected'])
        .order('created_at', { ascending: false });
      if (error) { setErr(error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const act = async (depotId, action) => {
    setActing(a => ({ ...a, [depotId]: action }));
    const { error } = await sb.from('depots')
      .update({ kyb_status: action === 'approve' ? 'verified' : 'rejected' })
      .eq('id', depotId);
    if (error) { setErr(error.message); setActing(a => ({ ...a, [depotId]: null })); return; }
    setRows(r => r.filter(d => d.id !== depotId));
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      {rows.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: T.gray400 }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>No pending KYB submissions</div>
        </div>
      )}
      {rows.map(d => (
        <div key={d.id} style={{ border: `1px solid ${T.gray100}`, background: T.white, marginBottom: '10px', padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{d.name}</span>
                <Badge status={d.kyb_status} />
                <VcsPill score={300} />
              </div>
              <div style={{ fontSize: '11px', color: T.gray400 }}>{d.location}{d.license_number ? ` · ${d.license_number}` : ''}</div>
              <div style={{ fontSize: '11px', color: T.gray400, marginTop: '2px' }}>
                Owner: {d.profiles?.full_name || '—'} · {d.profiles?.email || '—'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '7px', flexShrink: 0 }}>
              <button onClick={() => setShowReject(s => ({ ...s, [d.id]: !s[d.id] }))}
                style={{ background: T.white, color: T.red, border: `1px solid ${T.red}`, padding: '7px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: F }}>
                Reject
              </button>
              <button onClick={() => act(d.id, 'approve')}
                disabled={!!acting[d.id]}
                style={{ background: T.green, color: T.white, border: 'none', padding: '7px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: F, opacity: acting[d.id] ? 0.6 : 1 }}>
                {acting[d.id] === 'approve' ? 'Approving…' : 'Approve ✓'}
              </button>
            </div>
          </div>
          {showReject[d.id] && (
            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${T.gray100}` }}>
              <input value={rejectReason[d.id] || ''} onChange={e => setRejectReason(r => ({ ...r, [d.id]: e.target.value }))}
                placeholder="Rejection reason"
                style={{ width: '100%', border: `1px solid ${T.red}`, padding: '9px 12px', fontFamily: F, fontSize: '12px', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
              <button onClick={() => act(d.id, 'reject')} disabled={!rejectReason[d.id]?.trim()}
                style={{ background: rejectReason[d.id]?.trim() ? T.red : T.gray200, color: rejectReason[d.id]?.trim() ? T.white : T.gray400, border: 'none', padding: '8px 16px', fontSize: '11px', fontWeight: 800, cursor: rejectReason[d.id]?.trim() ? 'pointer' : 'not-allowed', fontFamily: F }}>
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── All Orders Tab ─────────────────────────────────────────────────────────────
function AllOrders({ isMobile }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from('orders')
        .select('id, status, total_volume, total_value, created_at, profiles!buyer_id(full_name), depots(name)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setLoading(false); return; }
      setOrders(data || []);
      setLoading(false);
    })();
  }, []);

  const FILTERS = ['all', 'pending', 'confirmed', 'in_transit', 'delivered', 'disputed', 'cancelled'];
  const visible = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ background: filter === f ? T.black : T.white, color: filter === f ? T.white : T.gray600, border: `1px solid ${filter === f ? T.black : T.gray200}`, padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: F }}>
            {f === 'all' ? 'All' : f.replace('_', ' ')}
            {f === 'all' ? ` (${orders.length})` : ` (${orders.filter(o => o.status === f).length})`}
          </button>
        ))}
      </div>
      {visible.length === 0 && <div style={{ color: T.gray400, textAlign: 'center', padding: '32px' }}>No orders</div>}
      <div style={{ border: `1px solid ${T.gray100}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.black }}>
              {['Order', 'Buyer', 'Depot', 'Volume', 'Value', 'Status', 'Date'].map(h => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: T.white, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((o, i) => (
              <tr key={o.id} style={{ borderBottom: `1px solid ${T.gray100}`, background: i % 2 === 0 ? T.white : T.gray50 }}>
                <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 700, color: T.black }}>{o.id}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: T.gray600 }}>{o.profiles?.full_name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: T.gray600 }}>{o.depots?.name || '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: T.black }}>{((o.total_volume || 0) / 1000).toFixed(0)}k L</td>
                <td style={{ padding: '10px 12px', fontSize: '12px', color: T.black }}>₦{((o.total_value || 0) / 1e6).toFixed(1)}M</td>
                <td style={{ padding: '10px 12px' }}><Badge status={o.status} /></td>
                <td style={{ padding: '10px 12px', fontSize: '11px', color: T.gray400 }}>{new Date(o.created_at).toLocaleDateString('en-NG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Pricing Engine Tab ─────────────────────────────────────────────────────────
const PRODUCTS = ['PMS', 'AGO', 'DPK', 'LPG', 'ATK'];
const PRODUCT_LABELS = { PMS: 'Premium Motor Spirit (Petrol)', AGO: 'Automotive Gas Oil (Diesel)', DPK: 'Dual Purpose Kerosene', LPG: 'Liquefied Petroleum Gas', ATK: 'Aviation Turbine Kerosene' };

function PricingEngine({ isMobile }) {
  const [prices, setPrices] = useState({});
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState({});
  const [history, setHistory] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      // Load latest price per product
      const results = await Promise.all(PRODUCTS.map(async p => {
        const { data } = await sb.from('price_history').select('price, recorded_at')
          .eq('product', p).order('recorded_at', { ascending: false }).limit(1).maybeSingle();
        return { product: p, price: data?.price ?? 0, date: data?.recorded_at };
      }));
      const map = {};
      results.forEach(r => { map[r.product] = r; });
      setPrices(map);
      setEditing(Object.fromEntries(results.map(r => [r.product, String(r.price || '')])));

      // Load recent price changes
      const { data: hist } = await sb.from('price_history').select('*')
        .order('recorded_at', { ascending: false }).limit(30);
      setHistory(hist || []);
    })();
  }, []);

  const savePrice = async (product) => {
    const val = parseInt(editing[product]);
    if (!val || val <= 0) { setErr('Enter a valid price per litre'); return; }
    setSaving(s => ({ ...s, [product]: true }));
    const { error } = await sb.from('price_history').insert({
      product,
      price: val,
      recorded_at: new Date().toISOString().split('T')[0],
      source: 'admin',
    });
    if (error) { setErr(error.message); setSaving(s => ({ ...s, [product]: false })); return; }
    setPrices(p => ({ ...p, [product]: { product, price: val, date: new Date().toISOString() } }));
    setSaving(s => ({ ...s, [product]: false }));
  };

  const pctChange = (product) => {
    const curr = prices[product]?.price;
    const histEntries = history.filter(h => h.product === product);
    if (histEntries.length < 2 || !curr) return null;
    const prev = histEntries[1]?.price;
    if (!prev) return null;
    return ((curr - prev) / prev * 100).toFixed(1);
  };

  return (
    <div>
      <ErrBanner msg={err} />
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
        {PRODUCTS.map(p => {
          const info = prices[p];
          const chg = pctChange(p);
          const chgPos = chg > 0;
          return (
            <div key={p} style={{ border: `1px solid ${T.gray100}`, background: T.white, padding: '16px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{p}</div>
                  <div style={{ fontSize: '10px', color: T.gray400, marginTop: '1px' }}>{PRODUCT_LABELS[p]}</div>
                </div>
                {chg !== null && (
                  <span style={{ fontSize: '11px', fontWeight: 700, color: chgPos ? T.green : T.red }}>
                    {chgPos ? '+' : ''}{chg}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: T.black, marginBottom: '12px' }}>
                ₦{(info?.price || 0).toLocaleString()}<span style={{ fontSize: '12px', fontWeight: 600, color: T.gray400 }}>/L</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" value={editing[p] || ''} onChange={e => setEditing(d => ({ ...d, [p]: e.target.value }))}
                  placeholder="New price/L"
                  style={{ flex: 1, border: `1px solid ${T.gray200}`, padding: '8px 10px', fontFamily: F, fontSize: '13px', fontWeight: 700, color: T.black, outline: 'none' }} />
                <button onClick={() => savePrice(p)} disabled={saving[p]}
                  style={{ background: T.black, color: T.white, border: 'none', padding: '8px 14px', fontSize: '11px', fontWeight: 800, cursor: 'pointer', fontFamily: F, opacity: saving[p] ? 0.6 : 1 }}>
                  {saving[p] ? '…' : 'Set'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <SectionHead title="Recent Price Changes" sub="Last 30 records across all products" />
      <div style={{ border: `1px solid ${T.gray100}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.black }}>
              {['Product', 'Price/L', 'Source', 'Date'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: T.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((h, i) => (
              <tr key={h.id} style={{ borderBottom: `1px solid ${T.gray100}`, background: i % 2 === 0 ? T.white : T.gray50 }}>
                <td style={{ padding: '9px 12px', fontSize: '12px', fontWeight: 700, color: T.black }}>{h.product}</td>
                <td style={{ padding: '9px 12px', fontSize: '12px', fontWeight: 700, color: T.black }}>₦{(h.price || 0).toLocaleString()}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{h.source || 'system'}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray400 }}>{h.recorded_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {history.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: T.gray400, fontSize: '12px' }}>No price history</div>}
      </div>
    </div>
  );
}

// ── Users Tab ──────────────────────────────────────────────────────────────────
function UsersTable({ isMobile }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, email, company_name, kyc_status, vcs_score, is_admin, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) { setErr(error.message); setLoading(false); return; }
      setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = search
    ? users.filter(u => (u.full_name + u.email + u.company_name).toLowerCase().includes(search.toLowerCase()))
    : users;

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, company…"
        style={{ width: '100%', border: `1px solid ${T.gray200}`, padding: '10px 14px', fontFamily: F, fontSize: '13px', color: T.black, outline: 'none', marginBottom: '14px', boxSizing: 'border-box' }} />
      <div style={{ border: `1px solid ${T.gray100}`, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: T.black }}>
              {['Name', 'Email', 'Company', 'KYC', 'VCS', 'Joined'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: T.white, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${T.gray100}`, background: i % 2 === 0 ? T.white : T.gray50 }}>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', background: T.black, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: T.white, flexShrink: 0 }}>
                      {(u.full_name || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: T.black }}>{u.full_name || '—'}</div>
                      {u.is_admin && <div style={{ fontSize: '9px', fontWeight: 800, color: T.green }}>ADMIN</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{u.email}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{u.company_name || '—'}</td>
                <td style={{ padding: '9px 12px' }}><Badge status={u.kyc_status || 'pending'} /></td>
                <td style={{ padding: '9px 12px' }}><VcsPill score={u.vcs_score || 300} /></td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray400 }}>{new Date(u.created_at).toLocaleDateString('en-NG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: T.gray400, fontSize: '12px' }}>No users found</div>}
      </div>
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function Overview({ isMobile }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [usersRes, depotsRes, ordersRes, pendingKycRes, pendingKybRes] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('depots').select('id', { count: 'exact', head: true }),
        sb.from('orders').select('id, total_value, status', { count: 'exact' }),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'submitted'),
        sb.from('depots').select('id', { count: 'exact', head: true }).eq('kyb_status', 'submitted'),
      ]);
      const orders = ordersRes.data || [];
      const completedOrders = orders.filter(o => ['delivered', 'collected'].includes(o.status));
      const totalGmv = completedOrders.reduce((s, o) => s + (o.total_value || 0), 0);
      setMetrics({
        users: usersRes.count || 0,
        depots: depotsRes.count || 0,
        totalOrders: ordersRes.count || 0,
        completedOrders: completedOrders.length,
        gmv: totalGmv,
        pendingKyc: pendingKycRes.count || 0,
        pendingKyb: pendingKybRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner />;

  const fmtVal = v => v >= 1e9 ? `₦${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `₦${(v / 1e6).toFixed(1)}M` : `₦${v.toLocaleString()}`;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
        <KpiCard label="Total Users" value={metrics.users.toLocaleString()} />
        <KpiCard label="Active Depots" value={metrics.depots.toLocaleString()} />
        <KpiCard label="Total Orders" value={metrics.totalOrders.toLocaleString()} sub={`${metrics.completedOrders} completed`} />
        <KpiCard label="Platform GMV" value={fmtVal(metrics.gmv)} color={T.green} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '10px' }}>
        <div style={{ border: `2px solid ${metrics.pendingKyc > 0 ? T.amber : T.gray100}`, background: T.white, padding: '16px 18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>KYC Queue</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: metrics.pendingKyc > 0 ? T.amber : T.green }}>{metrics.pendingKyc}</div>
          <div style={{ fontSize: '11px', color: T.gray400, marginTop: '4px' }}>Pending review</div>
        </div>
        <div style={{ border: `2px solid ${metrics.pendingKyb > 0 ? T.amber : T.gray100}`, background: T.white, padding: '16px 18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>KYB Queue</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: metrics.pendingKyb > 0 ? T.amber : T.green }}>{metrics.pendingKyb}</div>
          <div style={{ fontSize: '11px', color: T.gray400, marginTop: '4px' }}>Depot verifications pending</div>
        </div>
      </div>
    </div>
  );
}

// ── Root AdminPanel ────────────────────────────────────────────────────────────
export function AdminPanel({ isMobile }) {
  const [tab, setTab] = useState('overview');

  const TABS = [
    { id: 'overview', label: 'Overview',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'kyc',      label: 'KYC Review',  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'kyb',      label: 'KYB Review',  icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'orders',   label: 'All Orders',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'pricing',  label: 'Pricing',     icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    { id: 'users',    label: 'Users',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0' },
  ];

  const CONTENT = {
    overview: <Overview isMobile={isMobile} />,
    kyc:      <KycReview isMobile={isMobile} />,
    kyb:      <KybReview isMobile={isMobile} />,
    orders:   <AllOrders isMobile={isMobile} />,
    pricing:  <PricingEngine isMobile={isMobile} />,
    users:    <UsersTable isMobile={isMobile} />,
  };

  return (
    <div style={{ fontFamily: F }}>
      {/* Header */}
      <div style={{ background: T.black, padding: isMobile ? '16px' : '20px 24px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '32px', height: '32px', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 800, color: T.black }}>A</div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: T.white }}>Admin Panel</div>
            <div style={{ fontSize: '11px', color: '#555' }}>Ventryl Operations · Restricted Access</div>
          </div>
          <span style={{ marginLeft: 'auto', background: T.green, color: T.black, fontSize: '10px', fontWeight: 800, padding: '3px 8px' }}>ADMIN</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* Tab sidebar */}
        <div style={{ width: isMobile ? '100%' : '160px', flexShrink: 0, background: T.white, border: `1px solid ${T.gray100}`, overflow: 'hidden' }}>
          {TABS.map((t, i) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '11px 14px', background: tab === t.id ? T.black : T.white, color: tab === t.id ? T.white : T.gray600, border: 'none', borderBottom: i < TABS.length - 1 ? `1px solid ${T.gray100}` : 'none', cursor: 'pointer', fontFamily: F, fontSize: '12px', fontWeight: tab === t.id ? 800 : 600, textAlign: 'left' }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d={t.icon} />
              </svg>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontSize: '15px', fontWeight: 800, color: T.black }}>{TABS.find(t => t.id === tab)?.label}</div>
          </div>
          {CONTENT[tab]}
        </div>
      </div>
    </div>
  );
}
