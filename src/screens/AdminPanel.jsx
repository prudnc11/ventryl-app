/**
 * Ventryl Admin Panel
 * Only accessible when profile.is_admin === true.
 * Tabs: Overview · KYC Review · KYB Review · Orders · Pricing · Users
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase as sb } from '../lib/supabase';
import { notifications } from '../lib/api';

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
  const tier  = score >= 750 ? 'Platinum' : score >= 600 ? 'Gold' : score >= 450 ? 'Silver' : score >= 300 ? 'Bronze' : 'Standard';
  const color = score >= 750 ? T.greenDark : score >= 600 ? T.blue : score >= 450 ? '#92400e' : T.red;
  const bg    = score >= 750 ? T.greenLight : score >= 600 ? T.blueLight : score >= 450 ? T.amberLight : T.redLight;
  return (
    <span style={{ background: bg, color, fontSize: '10px', fontWeight: 800, padding: '2px 8px' }}>
      VCS {score} · {tier}
    </span>
  );
}

// ── Document viewer panel ──────────────────────────────────────────────────────
function DocViewer({ bucket, docs, onClose }) {
  const [urls, setUrls] = useState({});
  const [loadingUrls, setLoadingUrls] = useState(true);

  useEffect(() => {
    if (!docs || docs.length === 0) { setLoadingUrls(false); return; }
    (async () => {
      const signed = {};
      await Promise.all(docs.map(async (doc) => {
        try {
          const { data, error } = await sb.storage.from(bucket).createSignedUrl(doc.file_path, 3600);
          if (error) { console.warn(`[DocViewer] signed URL failed for ${doc.file_path}:`, error.message); return; }
          if (data?.signedUrl) signed[doc.id] = data.signedUrl;
        } catch (e) { console.warn(`[DocViewer] signed URL error:`, e.message); }
      }));
      setUrls(signed);
      setLoadingUrls(false);
    })();
  }, [docs, bucket]);

  const DOC_LABELS = {
    nmdpra_license: 'NMDPRA License',
    cac_cert: 'CAC Certificate',
    tax_clearance: 'Tax Clearance',
    env_permit: 'Environmental Permit',
    proof_of_address: 'Proof of Address',
    director_id: 'Director ID',
    tank_calibration: 'Tank Calibration',
    nin: 'NIN',
    passport: 'International Passport',
    drivers_license: "Driver's License",
  };

  return (
    <div style={{ background: T.gray50, border: `1px solid ${T.gray200}`, padding: '16px 18px', marginTop: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: T.black }}>Submitted Documents</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: T.gray400, padding: '0 4px', lineHeight: 1 }}>✕</button>
      </div>
      {loadingUrls && <div style={{ fontSize: '12px', color: T.gray400 }}>Generating signed links…</div>}
      {!loadingUrls && docs.length === 0 && (
        <div style={{ fontSize: '12px', color: T.gray400 }}>No documents uploaded yet.</div>
      )}
      {!loadingUrls && docs.map(doc => (
        <div key={doc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: T.white, border: `1px solid ${T.gray100}`, marginBottom: '6px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: T.black }}>{DOC_LABELS[doc.type] || doc.type}</div>
            <div style={{ fontSize: '10px', color: T.gray400, marginTop: '2px' }}>{doc.file_name} {doc.file_size ? `· ${(doc.file_size / 1024).toFixed(0)} KB` : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Badge status={doc.status} />
            {urls[doc.id] ? (
              <a href={urls[doc.id]} target="_blank" rel="noreferrer"
                style={{ background: T.black, color: T.white, fontSize: '10px', fontWeight: 800, padding: '5px 10px', textDecoration: 'none' }}>
                View
              </a>
            ) : (
              <span style={{ fontSize: '10px', color: T.amber, fontWeight: 700 }}>Access denied</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Shared filter pill bar ─────────────────────────────────────────────────────
function FilterBar({ filters, active, counts, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {filters.map(f => (
        <button key={f.value} onClick={() => onChange(f.value)}
          style={{ background: active === f.value ? T.black : T.white, color: active === f.value ? T.white : T.gray600, border: `1px solid ${active === f.value ? T.black : T.gray200}`, padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: F }}>
          {f.label} ({counts[f.value] ?? 0})
        </button>
      ))}
    </div>
  );
}

// ── KYC Review Tab ─────────────────────────────────────────────────────────────
function KycReview({ isMobile, adminUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('pending');
  const [acting, setActing] = useState({});
  const [rejectReason, setRejectReason] = useState({});
  const [showReject, setShowReject] = useState({});
  const [expanded, setExpanded] = useState({});
  const [docs, setDocs] = useState({});
  const [loadingDocs, setLoadingDocs] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from('profiles')
      .select('id, full_name, email, company_name, kyc_status, vcs_score, created_at')
      .order('created_at', { ascending: false });
    if (error) { setErr(error.message); setLoading(false); return; }
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const KYC_FILTERS = [
    { value: 'pending', label: 'Needs Review' },
    { value: 'verified', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  const counts = {
    pending:  rows.filter(u => u.kyc_status === 'submitted' || u.kyc_status === 'pending').length,
    verified: rows.filter(u => u.kyc_status === 'verified').length,
    rejected: rows.filter(u => u.kyc_status === 'rejected').length,
    all:      rows.length,
  };

  const visible = filter === 'all' ? rows
    : filter === 'pending' ? rows.filter(u => u.kyc_status === 'submitted' || u.kyc_status === 'pending')
    : rows.filter(u => u.kyc_status === filter);

  const toggleExpand = async (userId) => {
    const nowOpen = !expanded[userId];
    setExpanded(e => ({ ...e, [userId]: nowOpen }));
    if (nowOpen && !docs[userId]) {
      setLoadingDocs(l => ({ ...l, [userId]: true }));
      const { data } = await sb.from('kyc_documents').select('*').eq('user_id', userId);
      setDocs(d => ({ ...d, [userId]: data || [] }));
      setLoadingDocs(l => ({ ...l, [userId]: false }));
    }
  };

  const act = async (userId, action) => {
    setActing(a => ({ ...a, [userId]: action }));
    const updates = action === 'approve' ? { kyc_status: 'verified' } : { kyc_status: 'rejected' };
    if (action === 'reject' && rejectReason[userId]?.trim()) {
      updates.kyc_rejection_reason = rejectReason[userId].trim();
    }
    const { error } = await sb.from('profiles').update(updates).eq('id', userId);
    if (error) { setErr(error.message); setActing(a => ({ ...a, [userId]: null })); return; }
    setRows(r => r.map(u => u.id === userId ? { ...u, kyc_status: updates.kyc_status } : u));
    setActing(a => ({ ...a, [userId]: null }));
    // Send KYC notification email
    const user = rows.find(u => u.id === userId);
    if (user?.email) {
      const notifType = action === 'approve' ? 'kyc_approved' : 'kyc_rejected';
      notifications.send({
        userId, type: notifType, channel: 'email', toEmail: user.email,
        data: { name: user.full_name || user.company_name || '', reason: rejectReason[userId] || '' },
      }).catch(() => {});
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <FilterBar filters={KYC_FILTERS} active={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: T.gray400 }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>No {filter === 'all' ? '' : filter} KYC submissions</div>
        </div>
      )}
      {visible.map(u => {
        const canAct = u.kyc_status === 'submitted' || u.kyc_status === 'pending';
        return (
          <div key={u.id} style={{ border: `1px solid ${u.kyc_status === 'verified' ? T.green + '40' : u.kyc_status === 'rejected' ? T.red + '30' : T.gray100}`, background: T.white, marginBottom: '10px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleExpand(u.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{u.full_name || '—'}</span>
                  <Badge status={u.kyc_status} />
                  <VcsPill score={u.vcs_score || 500} />
                </div>
                <div style={{ fontSize: '11px', color: T.gray400 }}>{u.email || '—'} · {u.company_name || 'No company'}</div>
                <div style={{ fontSize: '10px', color: T.blue, marginTop: '4px', fontWeight: 600 }}>
                  {expanded[u.id] ? '▲ Hide documents' : '▼ View documents & details'}
                </div>
              </div>
              {canAct && (
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
              )}
            </div>
            {showReject[u.id] && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${T.gray100}` }}>
                <input value={rejectReason[u.id] || ''} onChange={e => setRejectReason(r => ({ ...r, [u.id]: e.target.value }))}
                  placeholder="Rejection reason (required)"
                  style={{ width: '100%', border: `1px solid ${T.red}`, padding: '9px 12px', fontFamily: F, fontSize: '12px', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={() => { if (!rejectReason[u.id]?.trim()) return; act(u.id, 'reject'); setShowReject(s => ({ ...s, [u.id]: false })); }}
                  disabled={!rejectReason[u.id]?.trim() || !!acting[u.id]}
                  style={{ background: rejectReason[u.id]?.trim() ? T.red : T.gray200, color: rejectReason[u.id]?.trim() ? T.white : T.gray400, border: 'none', padding: '8px 16px', fontSize: '11px', fontWeight: 800, cursor: rejectReason[u.id]?.trim() ? 'pointer' : 'not-allowed', fontFamily: F }}>
                  {acting[u.id] === 'reject' ? 'Rejecting…' : 'Confirm Rejection'}
                </button>
              </div>
            )}
            {expanded[u.id] && (
              loadingDocs[u.id]
                ? <div style={{ padding: '12px', fontSize: '12px', color: T.gray400 }}>Loading documents…</div>
                : <DocViewer bucket="kyc-documents" docs={docs[u.id] || []} onClose={() => setExpanded(e => ({ ...e, [u.id]: false }))} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── KYB Review Tab ─────────────────────────────────────────────────────────────
function KybReview({ isMobile, adminUserId }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('pending');
  const [acting, setActing] = useState({});
  const [showReject, setShowReject] = useState({});
  const [rejectReason, setRejectReason] = useState({});
  const [expanded, setExpanded] = useState({});
  const [docs, setDocs] = useState({});
  const [loadingDocs, setLoadingDocs] = useState({});

  useEffect(() => {
    (async () => {
      const { data, error } = await sb
        .from('depots')
        .select('id, name, owner_id, location, state, lga, address, capacity, license_number, kyb_status, contact_name, contact_phone, contact_email, contact_role, created_at, profiles!owner_id(full_name, email)')
        .order('created_at', { ascending: false });
      if (error) { setErr(error.message); setLoading(false); return; }
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const KYB_FILTERS = [
    { value: 'pending', label: 'Needs Review' },
    { value: 'verified', label: 'Approved' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'all', label: 'All' },
  ];

  const counts = {
    pending:  rows.filter(d => d.kyb_status === 'submitted' || d.kyb_status === 'pending').length,
    verified: rows.filter(d => d.kyb_status === 'verified').length,
    rejected: rows.filter(d => d.kyb_status === 'rejected').length,
    all:      rows.length,
  };

  const visible = filter === 'all' ? rows
    : filter === 'pending' ? rows.filter(d => d.kyb_status === 'submitted' || d.kyb_status === 'pending')
    : rows.filter(d => d.kyb_status === filter);

  const toggleExpand = async (depotId) => {
    const nowOpen = !expanded[depotId];
    setExpanded(e => ({ ...e, [depotId]: nowOpen }));
    if (nowOpen && !docs[depotId]) {
      setLoadingDocs(l => ({ ...l, [depotId]: true }));
      const { data } = await sb.from('kyb_documents').select('*').eq('depot_id', depotId);
      setDocs(d => ({ ...d, [depotId]: data || [] }));
      setLoadingDocs(l => ({ ...l, [depotId]: false }));
    }
  };

  const act = async (depotId, action) => {
    setActing(a => ({ ...a, [depotId]: action }));
    const newStatus = action === 'approve' ? 'verified' : 'rejected';
    const updates = { kyb_status: newStatus };
    if (action === 'reject' && rejectReason[depotId]?.trim()) {
      updates.kyb_rejection_reason = rejectReason[depotId].trim();
    }
    const { error } = await sb.from('depots').update(updates).eq('id', depotId);
    if (error) { setErr(error.message); setActing(a => ({ ...a, [depotId]: null })); return; }
    setRows(r => r.map(d => d.id === depotId ? { ...d, kyb_status: newStatus } : d));
    setActing(a => ({ ...a, [depotId]: null }));
    // Send KYB notification email to depot owner
    const depot = rows.find(d => d.id === depotId);
    const ownerEmail = depot?.profiles?.email;
    const ownerId = depot?.owner_id;
    if (ownerEmail && ownerId) {
      const notifType = action === 'approve' ? 'kyb_approved' : 'kyb_rejected';
      notifications.send({
        userId: ownerId, type: notifType, channel: 'email', toEmail: ownerEmail,
        data: {
          depotName: depot.name || '', contact: depot.profiles?.full_name || depot.contact_name || '',
          reason: rejectReason[depotId] || '',
        },
      }).catch(() => {});
    }
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <FilterBar filters={KYB_FILTERS} active={filter} counts={counts} onChange={setFilter} />
      {visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: T.gray400 }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>No {filter === 'all' ? '' : filter} KYB submissions</div>
        </div>
      )}
      {visible.map(d => {
        const canAct = d.kyb_status === 'submitted' || d.kyb_status === 'pending';
        return (
          <div key={d.id} style={{ border: `1px solid ${d.kyb_status === 'verified' ? T.green + '40' : d.kyb_status === 'rejected' ? T.red + '30' : T.gray100}`, background: T.white, marginBottom: '10px', padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => toggleExpand(d.id)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{d.name}</span>
                  <Badge status={d.kyb_status} />
                </div>
                <div style={{ fontSize: '11px', color: T.gray400 }}>{d.location}{d.license_number ? ` · ${d.license_number}` : ''}</div>
                <div style={{ fontSize: '11px', color: T.gray400, marginTop: '2px' }}>
                  Owner: {d.profiles?.full_name || '—'} · {d.profiles?.email || '—'}
                </div>
                <div style={{ fontSize: '10px', color: T.blue, marginTop: '4px', fontWeight: 600 }}>
                  {expanded[d.id] ? '▲ Hide details' : '▼ View KYB info & documents'}
                </div>
              </div>
              {canAct && (
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
              )}
            </div>
            {showReject[d.id] && (
              <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${T.gray100}` }}>
                <input value={rejectReason[d.id] || ''} onChange={e => setRejectReason(r => ({ ...r, [d.id]: e.target.value }))}
                  placeholder="Rejection reason"
                  style={{ width: '100%', border: `1px solid ${T.red}`, padding: '9px 12px', fontFamily: F, fontSize: '12px', marginBottom: '8px', outline: 'none', boxSizing: 'border-box' }} />
                <button onClick={() => { if (!rejectReason[d.id]?.trim()) return; act(d.id, 'reject'); setShowReject(s => ({ ...s, [d.id]: false })); }}
                  disabled={!rejectReason[d.id]?.trim()}
                  style={{ background: rejectReason[d.id]?.trim() ? T.red : T.gray200, color: rejectReason[d.id]?.trim() ? T.white : T.gray400, border: 'none', padding: '8px 16px', fontSize: '11px', fontWeight: 800, cursor: rejectReason[d.id]?.trim() ? 'pointer' : 'not-allowed', fontFamily: F }}>
                  Confirm Rejection
                </button>
              </div>
            )}
            {expanded[d.id] && (
              <div style={{ marginTop: '12px', borderTop: `1px solid ${T.gray100}`, paddingTop: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                  {[
                    ['State', d.state],
                    ['LGA', d.lga],
                    ['Capacity', d.capacity ? `${Number(d.capacity).toLocaleString()} L` : '—'],
                    ['License #', d.license_number || '—'],
                    ['Address', d.address || '—'],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: T.gray50, padding: '8px 10px', border: `1px solid ${T.gray100}` }}>
                      <div style={{ fontSize: '9px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: T.black, marginTop: '2px' }}>{val || '—'}</div>
                    </div>
                  ))}
                </div>
                {(d.contact_name || d.contact_phone || d.contact_email) && (
                  <div style={{ background: T.blueLight, border: `1px solid ${T.blue}20`, padding: '10px 12px', marginBottom: '12px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Operations Contact</div>
                    <div style={{ fontSize: '12px', color: T.black, fontWeight: 600 }}>{d.contact_name}{d.contact_role ? ` · ${d.contact_role}` : ''}</div>
                    <div style={{ fontSize: '11px', color: T.gray600, marginTop: '2px' }}>{d.contact_phone}{d.contact_email ? ` · ${d.contact_email}` : ''}</div>
                  </div>
                )}
                {loadingDocs[d.id]
                  ? <div style={{ fontSize: '12px', color: T.gray400 }}>Loading documents…</div>
                  : <DocViewer bucket="kyb-documents" docs={docs[d.id] || []} onClose={() => setExpanded(e => ({ ...e, [d.id]: false }))} />
                }
              </div>
            )}
          </div>
        );
      })}
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
        .select('id, status, total_volume, total_value, placed_at, profiles!buyer_id(full_name), depots(name)')
        .order('placed_at', { ascending: false })
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
              {['Order', 'Buyer', 'Depot', 'Volume', 'Value', 'Status', 'Placed'].map(h => (
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
                <td style={{ padding: '10px 12px', fontSize: '11px', color: T.gray400 }}>{o.placed_at ? new Date(o.placed_at).toLocaleDateString('en-NG') : '—'}</td>
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

  // Platform fee state
  const [currentFee, setCurrentFee] = useState(null); // current % from DB
  const [feeInput, setFeeInput] = useState('');
  const [feeStep, setFeeStep] = useState('idle'); // idle | confirm | otp | saving | done
  const [otp, setOtp] = useState('');
  const [otpErr, setOtpErr] = useState('');
  const [feeLog, setFeeLog] = useState([]);
  const otpSentTo = useRef('');

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

      // Load current platform fee
      const { data: feeRow } = await sb.from('platform_settings').select('value, updated_at')
        .eq('key', 'platform_fee_percent').maybeSingle();
      if (feeRow) { setCurrentFee(parseFloat(feeRow.value)); setFeeInput(feeRow.value); }
      else { setCurrentFee(1); setFeeInput('1'); }

      // Load fee change log
      const { data: fLog } = await sb.from('platform_settings_log').select('*')
        .eq('key', 'platform_fee_percent').order('changed_at', { ascending: false }).limit(10);
      setFeeLog(fLog || []);
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

  // Fee change flow: Step 1 → confirm, Step 2 → generate & send OTP (server-side), Step 3 → verify & save
  const handleFeeConfirm = async () => {
    const val = parseFloat(feeInput);
    if (isNaN(val) || val < 0 || val > 50) { setOtpErr('Fee must be between 0% and 50%'); return; }
    if (val === currentFee) { setOtpErr('No change detected'); return; }
    setOtpErr('');
    // Get admin session
    const { data: { session } } = await sb.auth.getSession();
    const email = session?.user?.email || '';
    const adminId = session?.user?.id;
    otpSentTo.current = email;
    // Generate OTP server-side via Edge Function
    try {
      const { data: result, error } = await sb.functions.invoke('admin-otp', {
        body: {
          action: 'generate',
          admin_id: adminId,
          email,
          context: `Platform fee change: ${currentFee}% → ${feeInput}%`,
        },
      });
      if (error) { setOtpErr('Failed to send OTP. Try again.'); return; }
    } catch (e) {
      setOtpErr('OTP service unavailable. Try again.');
      return;
    }
    setFeeStep('otp');
  };

  const handleOtpVerify = async () => {
    setOtpErr('');
    const { data: { session } } = await sb.auth.getSession();
    const userId = session?.user?.id;

    // Verify OTP server-side
    const { data: result, error: verifyErr } = await sb.functions.invoke('admin-otp', {
      body: { action: 'verify', admin_id: userId, code: otp },
    });
    if (verifyErr || !result?.valid) {
      setOtpErr(result?.error || 'Invalid OTP code. Please try again.');
      return;
    }

    // Re-validate fee value to prevent tampering between confirm and OTP steps
    const val = parseFloat(feeInput);
    if (isNaN(val) || val < 0 || val > 50) { setOtpErr('Invalid fee value.'); return; }

    setFeeStep('saving');

    // Log the change
    await sb.from('platform_settings_log').insert({
      key: 'platform_fee_percent',
      old_value: String(currentFee),
      new_value: String(val),
      changed_by: userId,
      method: 'admin',
    });

    // Update the setting
    const { error } = await sb.from('platform_settings').upsert({
      key: 'platform_fee_percent',
      value: String(val),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    });

    if (error) { setOtpErr(error.message); setFeeStep('otp'); return; }
    setCurrentFee(val);
    setFeeStep('done');
    // Refresh log
    const { data: fLog } = await sb.from('platform_settings_log').select('*')
      .eq('key', 'platform_fee_percent').order('changed_at', { ascending: false }).limit(10);
    setFeeLog(fLog || []);
  };

  const resetFeeFlow = () => {
    setFeeStep('idle');
    setOtp('');
    setGeneratedOtp('');
    setOtpErr('');
    setFeeInput(String(currentFee));
  };

  return (
    <div>
      <ErrBanner msg={err} />

      {/* ── PLATFORM FEE SECTION ── */}
      <div style={{ border: `2px solid ${T.black}`, background: T.white, padding: '20px 22px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: T.black }}>Platform Fee</div>
            <div style={{ fontSize: '11px', color: T.gray400, marginTop: '2px' }}>Applied to every order as a percentage of product value</div>
          </div>
          <div style={{ background: T.black, color: T.green, fontSize: '20px', fontWeight: 900, padding: '6px 14px' }}>
            {currentFee !== null ? `${currentFee}%` : '—'}
          </div>
        </div>

        {feeStep === 'idle' && (
          <div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '5px' }}>New Fee Percentage (%)</div>
                <input type="number" step="0.1" min="0" max="50" value={feeInput} onChange={e => setFeeInput(e.target.value)}
                  style={{ width: '100%', border: `1px solid ${T.gray200}`, padding: '10px 12px', fontFamily: F, fontSize: '15px', fontWeight: 700, color: T.black, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <button onClick={() => { setOtpErr(''); setFeeStep('confirm'); }}
                disabled={!feeInput || parseFloat(feeInput) === currentFee}
                style={{ background: parseFloat(feeInput) !== currentFee ? T.black : T.gray200, color: parseFloat(feeInput) !== currentFee ? T.white : T.gray400, border: 'none', padding: '10px 18px', fontSize: '12px', fontWeight: 800, cursor: parseFloat(feeInput) !== currentFee ? 'pointer' : 'not-allowed', fontFamily: F, minHeight: '44px', whiteSpace: 'nowrap' }}>
                Change Fee
              </button>
            </div>
            {otpErr && <div style={{ fontSize: '11px', color: T.red, fontWeight: 600, marginTop: '8px' }}>{otpErr}</div>}
          </div>
        )}

        {/* Confirm step */}
        {feeStep === 'confirm' && (
          <div style={{ background: T.amberLight, border: `1px solid ${T.amber}`, padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#8A5C00', marginBottom: '8px' }}>Confirm Fee Change</div>
            <div style={{ fontSize: '12px', color: '#8A5C00', lineHeight: 1.6, marginBottom: '14px' }}>
              You are changing the platform fee from <strong>{currentFee}%</strong> to <strong>{feeInput}%</strong>.<br/>
              This will affect all new orders placed after this change. Existing orders are not affected.<br/>
              An OTP verification code will be sent to your email to authorize this change.
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleFeeConfirm}
                style={{ background: T.black, color: T.white, border: 'none', padding: '10px 18px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: F, minHeight: '42px' }}>
                Send OTP & Proceed
              </button>
              <button onClick={resetFeeFlow}
                style={{ background: 'none', color: T.black, border: `1px solid ${T.gray200}`, padding: '10px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: F, minHeight: '42px' }}>
                Cancel
              </button>
            </div>
            {otpErr && <div style={{ fontSize: '11px', color: T.red, fontWeight: 600, marginTop: '8px' }}>{otpErr}</div>}
          </div>
        )}

        {/* OTP verification step */}
        {feeStep === 'otp' && (
          <div style={{ background: T.blueLight, border: `1px solid ${T.blue}`, padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: T.blue, marginBottom: '4px' }}>OTP Verification Required</div>
            <div style={{ fontSize: '11px', color: T.blue, marginBottom: '14px' }}>
              Enter the 6-digit code sent to <strong>{otpSentTo.current}</strong>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <input type="text" inputMode="numeric" maxLength={6} value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpErr(''); }}
                placeholder="000000" autoFocus
                style={{ width: '160px', border: `2px solid ${T.blue}`, padding: '10px 14px', fontFamily: F, fontSize: '20px', fontWeight: 800, color: T.black, outline: 'none', textAlign: 'center', letterSpacing: '0.3em' }} />
              <button onClick={handleOtpVerify} disabled={otp.length !== 6}
                style={{ background: otp.length === 6 ? T.green : T.gray200, color: otp.length === 6 ? T.white : T.gray400, border: 'none', padding: '10px 18px', fontSize: '12px', fontWeight: 800, cursor: otp.length === 6 ? 'pointer' : 'not-allowed', fontFamily: F, minHeight: '44px' }}>
                Verify & Apply
              </button>
              <button onClick={resetFeeFlow}
                style={{ background: 'none', color: T.black, border: `1px solid ${T.gray200}`, padding: '10px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: F, minHeight: '44px' }}>
                Cancel
              </button>
            </div>
            {otpErr && <div style={{ fontSize: '11px', color: T.red, fontWeight: 600, marginTop: '8px' }}>{otpErr}</div>}
          </div>
        )}

        {/* Saving step */}
        {feeStep === 'saving' && (
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: T.gray400 }}>Applying fee change...</div>
          </div>
        )}

        {/* Done step */}
        {feeStep === 'done' && (
          <div style={{ background: T.greenLight, border: `1px solid ${T.green}`, padding: '16px 18px' }}>
            <div style={{ fontSize: '13px', fontWeight: 800, color: T.greenDark, marginBottom: '4px' }}>Fee Updated Successfully</div>
            <div style={{ fontSize: '12px', color: T.greenDark, marginBottom: '12px' }}>
              Platform fee changed to <strong>{currentFee}%</strong>. All new orders will use this rate.
            </div>
            <button onClick={resetFeeFlow}
              style={{ background: T.black, color: T.white, border: 'none', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', fontFamily: F }}>
              Done
            </button>
          </div>
        )}

        {/* Fee change audit log */}
        {feeLog.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: `1px solid ${T.gray100}`, paddingTop: '12px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Fee Change History</div>
            {feeLog.map((l, i) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: i < feeLog.length - 1 ? `1px solid ${T.gray100}` : 'none', fontSize: '11px' }}>
                <span style={{ color: T.gray600 }}>
                  <strong style={{ color: T.black }}>{l.old_value}%</strong> → <strong style={{ color: T.green }}>{l.new_value}%</strong>
                </span>
                <span style={{ color: T.gray400 }}>{new Date(l.changed_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PRODUCT PRICES ── */}
      <SectionHead title="Product Prices" sub="Set benchmark price per litre for each product" />
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
  const [depotCounts, setDepotCounts] = useState({});
  const [orderCounts, setOrderCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      // Fetch all profiles (no limit) so admin sees every user
      const { data, error } = await sb
        .from('profiles')
        .select('id, full_name, email, phone, company_name, state, lga, kyc_status, vcs_score, is_admin, created_at')
        .order('created_at', { ascending: false });
      if (error) { setErr(error.message); setLoading(false); return; }
      const allUsers = data || [];
      setUsers(allUsers);

      // Fetch depot counts per owner
      const { data: depots } = await sb.from('depots').select('owner_id');
      if (depots) {
        const dc = {};
        depots.forEach(d => { dc[d.owner_id] = (dc[d.owner_id] || 0) + 1; });
        setDepotCounts(dc);
      }

      // Fetch order counts per buyer
      const { data: orders } = await sb.from('orders').select('buyer_id');
      if (orders) {
        const oc = {};
        orders.forEach(o => { oc[o.buyer_id] = (oc[o.buyer_id] || 0) + 1; });
        setOrderCounts(oc);
      }
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const USER_FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'verified', label: 'KYC Verified' },
    { value: 'pending', label: 'Pending KYC' },
    { value: 'admin', label: 'Admins' },
    { value: 'depot_owners', label: 'Depot Owners' },
  ];

  const counts = {
    all: users.length,
    verified: users.filter(u => u.kyc_status === 'verified' || u.kyc_status === 'approved').length,
    pending: users.filter(u => !u.kyc_status || u.kyc_status === 'pending' || u.kyc_status === 'submitted').length,
    admin: users.filter(u => u.is_admin).length,
    depot_owners: users.filter(u => depotCounts[u.id] > 0).length,
  };

  let visible = users;
  if (filter === 'verified') visible = users.filter(u => u.kyc_status === 'verified' || u.kyc_status === 'approved');
  else if (filter === 'pending') visible = users.filter(u => !u.kyc_status || u.kyc_status === 'pending' || u.kyc_status === 'submitted');
  else if (filter === 'admin') visible = users.filter(u => u.is_admin);
  else if (filter === 'depot_owners') visible = users.filter(u => depotCounts[u.id] > 0);

  if (search) {
    const q = search.toLowerCase();
    visible = visible.filter(u => ((u.full_name || '') + (u.email || '') + (u.company_name || '') + (u.state || '') + (u.phone || '')).toLowerCase().includes(q));
  }

  const totalPages = Math.ceil(visible.length / PAGE_SIZE);
  const paged = visible.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: T.gray600, fontWeight: 600 }}>{users.length} total users · Showing {visible.length}{search ? ' matching' : ''}</div>
        <button onClick={loadUsers} style={{ background: T.black, color: T.white, border: 'none', padding: '6px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', fontFamily: F }}>Refresh</button>
      </div>
      <FilterBar filters={USER_FILTERS} active={filter} counts={counts} onChange={v => { setFilter(v); setPage(0); }} />
      <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} placeholder="Search by name, email, company, state, phone…"
        style={{ width: '100%', border: `1px solid ${T.gray200}`, padding: '10px 14px', fontFamily: F, fontSize: '13px', color: T.black, outline: 'none', marginBottom: '14px', boxSizing: 'border-box' }} />
      <div style={{ border: `1px solid ${T.gray100}`, overflow: isMobile ? 'auto' : 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isMobile ? '700px' : 'auto' }}>
          <thead>
            <tr style={{ background: T.black }}>
              {['Name', 'Email', 'Company', 'State', 'KYC', 'Depots', 'Orders', 'Joined'].map(h => (
                <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '10px', fontWeight: 700, color: T.white, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((u, i) => (
              <tr key={u.id} style={{ borderBottom: `1px solid ${T.gray100}`, background: i % 2 === 0 ? T.white : T.gray50, cursor: 'pointer' }}
                onClick={() => setExpanded(e => ({ ...e, [u.id]: !e[u.id] }))}>
                <td style={{ padding: '9px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <div style={{ width: '26px', height: '26px', background: T.black, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800, color: T.white, flexShrink: 0 }}>
                      {((u.full_name || '?')[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: T.black }}>{u.full_name || '—'}</div>
                      {u.is_admin && <div style={{ fontSize: '9px', fontWeight: 800, color: T.green }}>ADMIN</div>}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{u.email || '—'}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{u.company_name || '—'}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray600 }}>{u.state || '—'}</td>
                <td style={{ padding: '9px 12px' }}><Badge status={u.kyc_status || 'pending'} /></td>
                <td style={{ padding: '9px 12px', fontSize: '11px', fontWeight: 700, color: depotCounts[u.id] ? T.black : T.gray400 }}>{depotCounts[u.id] || 0}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', fontWeight: 700, color: orderCounts[u.id] ? T.black : T.gray400 }}>{orderCounts[u.id] || 0}</td>
                <td style={{ padding: '9px 12px', fontSize: '11px', color: T.gray400, whiteSpace: 'nowrap' }}>{new Date(u.created_at).toLocaleDateString('en-NG')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {paged.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: T.gray400, fontSize: '12px' }}>No users found</div>}
      </div>
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '14px' }}>
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
            style={{ background: page === 0 ? T.gray100 : T.black, color: page === 0 ? T.gray400 : T.white, border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 700, cursor: page === 0 ? 'default' : 'pointer', fontFamily: F }}>← Prev</button>
          <span style={{ fontSize: '11px', color: T.gray600, fontWeight: 600 }}>Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
            style={{ background: page >= totalPages - 1 ? T.gray100 : T.black, color: page >= totalPages - 1 ? T.gray400 : T.white, border: 'none', padding: '6px 12px', fontSize: '11px', fontWeight: 700, cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: F }}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ── Overview Tab ───────────────────────────────────────────────────────────────
function Overview({ isMobile }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [usersRes, depotsRes, ordersRes, pendingKycRes, pendingKybRes, openDisputesRes] = await Promise.all([
        sb.from('profiles').select('id', { count: 'exact', head: true }),
        sb.from('depots').select('id', { count: 'exact', head: true }),
        sb.from('orders').select('id, total_value, status', { count: 'exact' }),
        sb.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'submitted'),
        sb.from('depots').select('id', { count: 'exact', head: true }).eq('kyb_status', 'submitted'),
        sb.from('disputes').select('id', { count: 'exact', head: true }).eq('status', 'open'),
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
        openDisputes: openDisputesRes.count || 0,
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
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: '10px' }}>
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
        <div style={{ border: `2px solid ${metrics.openDisputes > 0 ? T.red : T.gray100}`, background: metrics.openDisputes > 0 ? '#FFF1F0' : T.white, padding: '16px 18px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Open Disputes</div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: metrics.openDisputes > 0 ? T.red : T.green }}>{metrics.openDisputes}</div>
          <div style={{ fontSize: '11px', color: T.gray400, marginTop: '4px' }}>Awaiting resolution</div>
        </div>
      </div>
    </div>
  );
}

// ── Disputes Review Tab ────────────────────────────────────────────────────────
const DISPUTE_REASONS = {
  quantity_short: 'Quantity Shortage',
  quality_issue: 'Quality Issue',
  late_delivery: 'Late Delivery',
  wrong_product: 'Wrong Product',
  damaged_goods: 'Damaged Goods',
  pricing_error: 'Pricing Error',
  other: 'Other',
};

function DisputesReview({ isMobile }) {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('open');
  const [expanded, setExpanded] = useState({});
  const [acting, setActing] = useState({});
  const [adminNotes, setAdminNotes] = useState({});
  const [resolution, setResolution] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await sb
        .from('disputes')
        .select('*, profiles!buyer_id(full_name, email, company_name), orders!order_id(id, total_value, total_volume, status, depots(name))')
        .order('created_at', { ascending: false });
      if (error) { setErr(error.message); setLoading(false); return; }
      setDisputes(data || []);
    } catch (e) { setErr(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const FILTERS = [
    { value: 'open', label: 'Open' },
    { value: 'under_review', label: 'Under Review' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' },
    { value: 'all', label: 'All' },
  ];

  const counts = {
    open: disputes.filter(d => d.status === 'open').length,
    under_review: disputes.filter(d => d.status === 'under_review').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    closed: disputes.filter(d => d.status === 'closed').length,
    all: disputes.length,
  };

  const visible = filter === 'all' ? disputes : disputes.filter(d => d.status === filter);

  const updateDispute = async (disputeId, newStatus, note) => {
    setActing(a => ({ ...a, [disputeId]: newStatus }));
    const updates = { status: newStatus };
    if (note) updates.admin_note = note;
    if (newStatus === 'resolved' || newStatus === 'closed') updates.resolved_at = new Date().toISOString();

    const { error } = await sb.from('disputes').update(updates).eq('id', disputeId);
    if (error) { setErr(error.message); setActing(a => ({ ...a, [disputeId]: null })); return; }

    // If resolving, also update the order status back
    const dispute = disputes.find(d => d.id === disputeId);
    if (dispute && (newStatus === 'resolved' || newStatus === 'closed')) {
      const resolveAs = resolution[disputeId] || 'delivered';
      await sb.from('orders').update({ status: resolveAs }).eq('id', dispute.order_id);
      await sb.from('order_status_logs').insert({
        order_id: dispute.order_id,
        to_status: resolveAs,
        note: `Dispute ${newStatus} by admin. ${note || ''}`.trim(),
      });
    }

    setDisputes(prev => prev.map(d => d.id === disputeId ? { ...d, status: newStatus, admin_note: note || d.admin_note, resolved_at: updates.resolved_at || d.resolved_at } : d));
    setActing(a => ({ ...a, [disputeId]: null }));
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <ErrBanner msg={err} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '12px', color: T.gray600, fontWeight: 600 }}>{disputes.length} total disputes · {counts.open} open</div>
        <button onClick={load} style={{ background: T.black, color: T.white, border: 'none', padding: '6px 12px', fontSize: '10px', fontWeight: 800, cursor: 'pointer', fontFamily: F }}>Refresh</button>
      </div>
      <FilterBar filters={FILTERS} active={filter} counts={counts} onChange={setFilter} />

      {visible.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: T.gray400 }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 700 }}>No {filter === 'all' ? '' : filter.replace('_', ' ')} disputes</div>
        </div>
      )}

      {visible.map(d => {
        const isOpen = d.status === 'open' || d.status === 'under_review';
        const buyer = d.profiles || {};
        const order = d.orders || {};
        const depotName = order.depots?.name || '—';
        const isExp = expanded[d.id];

        return (
          <div key={d.id} style={{
            border: `2px solid ${d.status === 'open' ? T.red : d.status === 'under_review' ? T.amber : T.gray100}`,
            background: T.white, marginBottom: '10px', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 18px', cursor: 'pointer' }} onClick={() => setExpanded(e => ({ ...e, [d.id]: !e[d.id] }))}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: T.black }}>{d.reference}</span>
                    <Badge status={d.status === 'open' ? 'disputed' : d.status === 'under_review' ? 'pending' : d.status === 'resolved' ? 'delivered' : 'cancelled'} />
                    <span style={{ fontSize: '10px', fontWeight: 700, color: T.gray400 }}>{new Date(d.created_at).toLocaleDateString('en-NG')}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: T.gray400 }}>
                    Order: <span style={{ color: T.black, fontWeight: 700 }}>{d.order_id}</span> · Depot: <span style={{ fontWeight: 600 }}>{depotName}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: T.gray400, marginTop: '2px' }}>
                    Buyer: <span style={{ fontWeight: 600 }}>{buyer.full_name || '—'}</span> · {buyer.company_name || buyer.email || '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  {order.total_value && <span style={{ fontSize: '12px', fontWeight: 800, color: T.black }}>₦{((order.total_value || 0) / 1e6).toFixed(1)}M</span>}
                  <span style={{ fontSize: '10px', color: T.blue, fontWeight: 600 }}>{isExp ? '▲ Hide' : '▼ Details'}</span>
                </div>
              </div>
            </div>

            {/* Expanded details */}
            {isExp && (
              <div style={{ borderTop: `1px solid ${T.gray100}`, padding: '16px 18px' }}>
                {/* Reason & Details */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ background: T.gray50, padding: '12px 14px', border: `1px solid ${T.gray100}` }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Reason</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.black }}>{DISPUTE_REASONS[d.reason] || d.reason}</div>
                  </div>
                  <div style={{ background: T.gray50, padding: '12px 14px', border: `1px solid ${T.gray100}` }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Order Value</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: T.black }}>₦{(order.total_value || 0).toLocaleString()} · {((order.total_volume || 0) / 1000).toFixed(0)}k L</div>
                  </div>
                </div>

                <div style={{ background: T.gray50, padding: '12px 14px', border: `1px solid ${T.gray100}`, marginBottom: '14px' }}>
                  <div style={{ fontSize: '9px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Details</div>
                  <div style={{ fontSize: '12px', color: T.black, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{d.details}</div>
                </div>

                {/* Evidence */}
                {d.evidence_urls && d.evidence_urls.length > 0 && (
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Evidence ({d.evidence_urls.length} file{d.evidence_urls.length !== 1 ? 's' : ''})</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {d.evidence_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: T.blueLight, border: `1px solid ${T.blue}20`, padding: '8px 12px', fontSize: '11px', fontWeight: 700, color: T.blue, textDecoration: 'none' }}>
                          📎 File {i + 1} — View
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin note (if already set) */}
                {d.admin_note && (
                  <div style={{ background: T.greenLight, border: `1px solid ${T.green}40`, padding: '12px 14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: T.greenDark, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>Admin Resolution Note</div>
                    <div style={{ fontSize: '12px', color: T.greenDark, fontWeight: 600 }}>{d.admin_note}</div>
                    {d.resolved_at && <div style={{ fontSize: '10px', color: T.gray400, marginTop: '4px' }}>Resolved: {new Date(d.resolved_at).toLocaleString('en-NG')}</div>}
                  </div>
                )}

                {/* Action buttons for open/under_review disputes */}
                {isOpen && (
                  <div style={{ borderTop: `1px solid ${T.gray100}`, paddingTop: '14px' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Admin Note / Resolution</div>
                      <textarea value={adminNotes[d.id] || ''} onChange={e => setAdminNotes(n => ({ ...n, [d.id]: e.target.value }))}
                        placeholder="Describe the resolution or investigation notes…"
                        style={{ width: '100%', border: `1px solid ${T.gray200}`, padding: '10px 12px', fontFamily: F, fontSize: '12px', minHeight: '70px', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Resolve Order As</div>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {[['delivered', 'Delivered'], ['collected', 'Collected']].map(([val, label]) => (
                          <button key={val} onClick={() => setResolution(r => ({ ...r, [d.id]: val }))}
                            style={{ background: (resolution[d.id] || 'delivered') === val ? T.black : T.white, color: (resolution[d.id] || 'delivered') === val ? T.white : T.gray600, border: `1px solid ${(resolution[d.id] || 'delivered') === val ? T.black : T.gray200}`, padding: '6px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: F }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {d.status === 'open' && (
                        <button disabled={!!acting[d.id]} onClick={() => updateDispute(d.id, 'under_review', adminNotes[d.id])}
                          style={{ background: T.amber, color: T.white, border: 'none', padding: '9px 16px', fontSize: '11px', fontWeight: 800, cursor: acting[d.id] ? 'not-allowed' : 'pointer', fontFamily: F, opacity: acting[d.id] ? 0.6 : 1 }}>
                          {acting[d.id] === 'under_review' ? 'Updating…' : 'Mark Under Review'}
                        </button>
                      )}
                      <button disabled={!!acting[d.id] || !adminNotes[d.id]?.trim()} onClick={() => updateDispute(d.id, 'resolved', adminNotes[d.id])}
                        style={{ background: adminNotes[d.id]?.trim() ? T.green : T.gray200, color: adminNotes[d.id]?.trim() ? T.white : T.gray400, border: 'none', padding: '9px 16px', fontSize: '11px', fontWeight: 800, cursor: adminNotes[d.id]?.trim() ? 'pointer' : 'not-allowed', fontFamily: F, opacity: acting[d.id] ? 0.6 : 1 }}>
                        {acting[d.id] === 'resolved' ? 'Resolving…' : 'Resolve Dispute ✓'}
                      </button>
                      <button disabled={!!acting[d.id]} onClick={() => updateDispute(d.id, 'closed', adminNotes[d.id] || 'Closed without resolution')}
                        style={{ background: T.white, color: T.gray600, border: `1px solid ${T.gray200}`, padding: '9px 16px', fontSize: '11px', fontWeight: 800, cursor: acting[d.id] ? 'not-allowed' : 'pointer', fontFamily: F }}>
                        {acting[d.id] === 'closed' ? 'Closing…' : 'Close'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Root AdminPanel ────────────────────────────────────────────────────────────
export function AdminPanel({ isMobile }) {
  const [tab, setTab] = useState('overview');

  // Double-check admin status server-side
  const [confirmed, setConfirmed] = useState(null);
  const [adminUserId, setAdminUserId] = useState(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await sb.auth.getUser();
      const { data } = await sb.from('profiles').select('is_admin').eq('id', user?.id ?? '').maybeSingle();
      setConfirmed(!!data?.is_admin);
      if (data?.is_admin) setAdminUserId(user?.id);
    })();
  }, []);
  if (confirmed === false) return (
    <div style={{ padding: '48px', textAlign: 'center', fontFamily: F }}>
      <div style={{ fontSize: '32px', marginBottom: '12px' }}>🚫</div>
      <div style={{ fontSize: '16px', fontWeight: 800, color: T.black }}>Access Denied</div>
      <div style={{ fontSize: '12px', color: T.gray400, marginTop: '6px' }}>You don't have admin privileges.</div>
    </div>
  );
  if (confirmed === null) return <div style={{ padding: '48px', textAlign: 'center', fontFamily: F, color: T.gray400 }}>Verifying access…</div>;

  const TABS = [
    { id: 'overview', label: 'Overview',    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { id: 'kyc',      label: 'KYC Review',  icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
    { id: 'kyb',      label: 'KYB Review',  icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
    { id: 'orders',   label: 'All Orders',  icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
    { id: 'disputes', label: 'Disputes',   icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z' },
    { id: 'pricing',  label: 'Pricing',     icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' },
    { id: 'users',    label: 'Users',       icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0' },
  ];

  const CONTENT = {
    overview: <Overview isMobile={isMobile} />,
    kyc:      <KycReview isMobile={isMobile} adminUserId={adminUserId} />,
    kyb:      <KybReview isMobile={isMobile} adminUserId={adminUserId} />,
    orders:   <AllOrders isMobile={isMobile} />,
    disputes: <DisputesReview isMobile={isMobile} />,
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
