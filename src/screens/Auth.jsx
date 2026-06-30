import { useState } from 'react';
import { auth } from '../lib/api';
import { isConfigured } from '../lib/supabase';

/* ── Design tokens (mirrors App.jsx) ─────────────────────────────── */
const T = {
  black: '#0A0A0A', white: '#FFFFFF',
  gray50: '#F6F6F6', gray100: '#EFEFEF', gray200: '#D3D3D3',
  gray400: '#9E9E9E', gray600: '#616161',
  green: '#00D67E', greenLight: '#E6FFF4', greenDark: '#006837',
  amber: '#FFAB00', amberLight: '#FFF8E1',
  red: '#F23333', redLight: '#FFEBEB',
  blue: '#0057FF',
};
const F = "'Manrope',sans-serif";

/* ── Shared primitives ────────────────────────────────────────────── */
function Field({ label, type = 'text', value, onChange, placeholder, required, hint, error }) {
  const [show, setShow] = useState(false);
  const isPassword = type === 'password';
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '10px', fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
        {label}{required && <span style={{ color: T.red }}> *</span>}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type={isPassword && show ? 'text' : type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          style={{
            width: '100%', padding: '11px 14px', paddingRight: isPassword ? '44px' : '14px',
            border: `1px solid ${error ? T.red : T.gray200}`, background: T.white,
            fontFamily: F, fontSize: '13px', color: T.black, outline: 'none',
            boxSizing: 'border-box', borderRadius: 0,
          }}
        />
        {isPassword && (
          <button type="button" onClick={() => setShow(s => !s)}
            style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: T.gray400, fontSize: '11px', fontWeight: 700, fontFamily: F }}>
            {show ? 'HIDE' : 'SHOW'}
          </button>
        )}
      </div>
      {(hint || error) && (
        <div style={{ fontSize: '10px', color: error ? T.red : T.gray400, marginTop: '4px', fontWeight: 600 }}>
          {error || hint}
        </div>
      )}
    </div>
  );
}

function Btn({ children, onClick, loading, disabled, variant = 'primary', type = 'button' }) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        width: '100%', padding: '14px', border: 'none', cursor: disabled || loading ? 'not-allowed' : 'pointer',
        background: isPrimary ? (disabled || loading ? T.gray200 : T.green) : 'transparent',
        color: isPrimary ? (disabled || loading ? T.gray400 : T.black) : T.gray600,
        fontFamily: F, fontSize: '13px', fontWeight: 800,
        letterSpacing: '0.01em', transition: 'all 0.15s',
        marginBottom: '8px',
      }}>
      {loading ? 'Please wait…' : children}
    </button>
  );
}

function ErrorBanner({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ background: T.redLight, border: `1px solid ${T.red}`, padding: '10px 14px', marginBottom: '16px', fontSize: '12px', color: T.red, fontWeight: 700, lineHeight: 1.4 }}>
      {msg}
    </div>
  );
}

/* ── "Not configured" notice ──────────────────────────────────────── */
function SetupNotice() {
  return (
    <div style={{ background: T.amberLight, border: `1px solid ${T.amber}`, padding: '14px 16px', marginBottom: '20px' }}>
      <div style={{ fontSize: '12px', fontWeight: 800, color: '#8A5C00', marginBottom: '4px' }}>⚙ Supabase not configured</div>
      <div style={{ fontSize: '11px', color: '#8A5C00', lineHeight: 1.5 }}>
        Create a <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.07)', padding: '1px 4px' }}>.env.local</code> file with your{' '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.07)', padding: '1px 4px' }}>VITE_SUPABASE_URL</code> and{' '}
        <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.07)', padding: '1px 4px' }}>VITE_SUPABASE_ANON_KEY</code>.
        See <code style={{ fontFamily: 'monospace', background: 'rgba(0,0,0,0.07)', padding: '1px 4px' }}>.env.example</code> for reference.
      </div>
    </div>
  );
}

/* ── Auth layout shell ────────────────────────────────────────────── */
function AuthShell({ title, sub, children }) {
  return (
    <div style={{ minHeight: '100vh', background: T.gray50, display: 'flex', fontFamily: F }}>
      {/* Left brand panel — hidden on small screens */}
      <div style={{ width: '420px', background: T.black, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 44px', flexShrink: 0 }}
        className="auth-brand-panel">
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '17px', fontWeight: 800, color: T.black }}>V</span>
          </div>
          <div>
            <div style={{ fontSize: '17px', fontWeight: 800, color: T.white }}>Ventryl</div>
            <div style={{ fontSize: '9px', fontWeight: 700, color: T.green, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Petroleum Marketplace</div>
          </div>
        </div>

        {/* Value props */}
        <div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: T.white, lineHeight: 1.3, marginBottom: '28px', letterSpacing: '-0.02em' }}>
            Nigeria's B2B<br />petroleum market,<br />built for trust.
          </div>
          {[
            { icon: '⚡', text: 'Live depot prices across 36 states' },
            { icon: '🔒', text: 'Funds held in escrow until delivery' },
            { icon: '🚛', text: 'Real-time truck & delivery tracking' },
            { icon: '📋', text: 'NMDPRA-verified depots only' },
          ].map(({ icon, text }) => (
            <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: '13px', color: '#888', fontWeight: 600 }}>{text}</span>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <div style={{ borderTop: '1px solid #1A1A1A', paddingTop: '20px' }}>
          <div style={{ display: 'flex', gap: '28px' }}>
            {[['500+', 'Verified Depots'], ['₦2.3B', 'Secured in Escrow'], ['12k+', 'Orders Fulfilled']].map(([val, lbl]) => (
              <div key={lbl}>
                <div style={{ fontSize: '16px', fontWeight: 800, color: T.green }}>{val}</div>
                <div style={{ fontSize: '10px', color: '#555', fontWeight: 600 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          {/* Mobile logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}
            className="auth-mobile-logo">
            <div style={{ width: '30px', height: '30px', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: T.black }}>V</span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 800, color: T.black }}>Ventryl</div>
          </div>

          <div style={{ fontSize: '22px', fontWeight: 800, color: T.black, marginBottom: '6px', letterSpacing: '-0.02em' }}>{title}</div>
          {sub && <div style={{ fontSize: '13px', color: T.gray400, marginBottom: '28px', fontWeight: 600 }}>{sub}</div>}

          {children}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .auth-brand-panel { display: none !important; }
          .auth-mobile-logo { display: flex !important; }
        }
        @media (min-width: 769px) {
          .auth-mobile-logo { display: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Login Screen ─────────────────────────────────────────────────── */
function LoginScreen({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setErr('');
    try {
      await auth.signIn({ email, password });
      // Auth store's onAuthStateChange listener updates global state automatically
    } catch (e) {
      setErr(e.message || 'Sign in failed. Check your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" sub="Access your Ventryl account">
      {!isConfigured && <SetupNotice />}
      <form onSubmit={handleSubmit}>
        <ErrorBanner msg={err} />
        <Field label="Email" type="email" value={email} onChange={setEmail} placeholder="you@company.ng" required />
        <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" required />
        <div style={{ textAlign: 'right', marginTop: '-8px', marginBottom: '20px' }}>
          <button type="button" onClick={() => onSwitch('forgot')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: '11px', fontWeight: 700, color: T.blue }}>
            Forgot password?
          </button>
        </div>
        <Btn type="submit" loading={loading} disabled={!email || !password || !isConfigured}>
          Sign In →
        </Btn>
      </form>
      <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: T.gray400 }}>
        No account?{' '}
        <button onClick={() => onSwitch('signup')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: '12px', fontWeight: 800, color: T.black }}>
          Create one
        </button>
      </div>
    </AuthShell>
  );
}

/* ── Signup Screen ────────────────────────────────────────────────── */
function SignupScreen({ onSwitch }) {
  const [form, setForm] = useState({
    fullName: '', companyName: '', email: '', phone: '', password: '', confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setErr('Passwords do not match.'); return; }
    if (form.password.length < 8) { setErr('Password must be at least 8 characters.'); return; }
    setLoading(true);
    setErr('');
    try {
      await auth.signUp({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        companyName: form.companyName,
        phone: form.phone,
      });
      setSuccess(true);
    } catch (e) {
      setErr(e.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AuthShell title="Check your email" sub="Confirm your account to get started">
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <div style={{ width: '56px', height: '56px', background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '26px' }}>✓</div>
          <div style={{ fontSize: '15px', color: T.gray600, fontWeight: 600, lineHeight: 1.5, marginBottom: '28px' }}>
            We sent a confirmation link to <strong style={{ color: T.black }}>{form.email}</strong>.<br />
            Click the link to activate your account.
          </div>
          <Btn variant="ghost" onClick={() => onSwitch('login')}>Back to Sign In</Btn>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create account" sub="Join Nigeria's B2B petroleum marketplace">
      {!isConfigured && <SetupNotice />}
      <form onSubmit={handleSubmit}>
        <ErrorBanner msg={err} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Full Name" value={form.fullName} onChange={set('fullName')} placeholder="Emeka Chukwuma" required />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Company Name" value={form.companyName} onChange={set('companyName')} placeholder="Chukwuma Fuels Ltd" required />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Email Address" type="email" value={form.email} onChange={set('email')} placeholder="emeka@chukwumafuels.ng" required />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <Field label="Phone Number" type="tel" value={form.phone} onChange={set('phone')} placeholder="+234 801 234 5678" hint="Used for order notifications" />
          </div>
          <Field label="Password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required hint="Minimum 8 characters" />
          <Field label="Confirm Password" type="password" value={form.confirmPassword} onChange={set('confirmPassword')} placeholder="••••••••" required />
        </div>
        <div style={{ fontSize: '10px', color: T.gray400, fontWeight: 600, marginBottom: '20px', lineHeight: 1.5 }}>
          By creating an account you agree to Ventryl's{' '}
          <span style={{ color: T.black, fontWeight: 800 }}>Terms of Service</span> and{' '}
          <span style={{ color: T.black, fontWeight: 800 }}>Privacy Policy</span>.
        </div>
        <Btn type="submit" loading={loading}
          disabled={!form.fullName || !form.companyName || !form.email || !form.password || !form.confirmPassword || !isConfigured}>
          Create Account →
        </Btn>
      </form>
      <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: T.gray400 }}>
        Already have an account?{' '}
        <button onClick={() => onSwitch('login')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: '12px', fontWeight: 800, color: T.black }}>
          Sign in
        </button>
      </div>
    </AuthShell>
  );
}

/* ── Forgot Password Screen ───────────────────────────────────────── */
function ForgotScreen({ onSwitch }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErr('');
    try {
      await auth.resetPassword(email);
      setSent(true);
    } catch (e) {
      setErr(e.message || 'Failed to send reset link. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset password" sub="We'll send a reset link to your email">
      {!isConfigured && <SetupNotice />}
      {sent ? (
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: '56px', height: '56px', background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: '26px' }}>✓</div>
          <div style={{ fontSize: '14px', fontWeight: 800, color: T.black, marginBottom: '8px' }}>Link sent</div>
          <div style={{ fontSize: '13px', color: T.gray400, fontWeight: 600, lineHeight: 1.5, marginBottom: '28px' }}>
            Check <strong style={{ color: T.black }}>{email}</strong> for a link to reset your password.
          </div>
          <Btn variant="ghost" onClick={() => onSwitch('login')}>Back to Sign In</Btn>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <ErrorBanner msg={err} />
          <Field label="Email Address" type="email" value={email} onChange={setEmail} placeholder="you@company.ng" required />
          <Btn type="submit" loading={loading} disabled={!email || !isConfigured}>
            Send Reset Link →
          </Btn>
          <div style={{ textAlign: 'center', marginTop: '8px' }}>
            <button onClick={() => onSwitch('login')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: F, fontSize: '12px', fontWeight: 700, color: T.gray400 }}>
              ← Back to Sign In
            </button>
          </div>
        </form>
      )}
    </AuthShell>
  );
}

/* ── Root Auth entry point ────────────────────────────────────────── */
export function AuthScreens() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'forgot'

  if (mode === 'signup') return <SignupScreen onSwitch={setMode} />;
  if (mode === 'forgot') return <ForgotScreen onSwitch={setMode} />;
  return <LoginScreen onSwitch={setMode} />;
}
