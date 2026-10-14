import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Role } from '../types';
import { Notice } from '../components/shared/ui/Notice';

const accountTypes: { role: Role; label: string }[] = [
  { role: 'resident', label: 'Resident' },
  { role: 'officer', label: 'Officer' },
  { role: 'admin', label: 'Admin' },
  { role: 'oversight', label: 'Oversight' },
];

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('resident');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const selectedAccountType = accountTypes.find((accountType) => accountType.role === role)?.label || 'Resident';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await signIn(email, password, role);
      navigate(from || (role === 'resident' ? '/dashboard' : '/admin'), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-page">
    <div className="auth-visual">
      <div className="auth-visual-text">
        <Link to="/" className="auth-logo"><img src="/wardlens-logo.svg" alt="WardLens"/></Link>
        <div className="auth-quote-mark">“</div>
        <h2>Every local project has a story. Help make it visible.</h2>
        <p>Stay informed about local priorities, follow published records, and take part in your community’s future.</p>
        <div className="auth-visual-bottom"><ShieldCheck size={17}/> Open information. Accountable decisions.</div>
      </div>
      <img className="auth-background-photo" src="https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&w=1200&q=85" alt=""/>
    </div>
    <div className="auth-form-side">
      <div className="auth-form-wrap">
        <Link to="/" className="auth-home-link"><ArrowLeft size={15}/> Back to home</Link>
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Sign in to WardLens.</h1>
        <p className="auth-subtitle">Choose your account type, then enter your sign-in details.</p>
        {error && <Notice>{error}</Notice>}
        <form className="form-stack" onSubmit={submit}>
          <label htmlFor="account-role">Sign in as
            <select id="account-role" name="role" required value={role} onChange={(event) => setRole(accountTypes.find((accountType) => accountType.role === event.target.value)?.role || 'resident')}>
              {accountTypes.map((accountType) => <option key={accountType.role} value={accountType.role}>{accountType.label}</option>)}
            </select>
            <small>Your account type is verified securely when you sign in.</small>
          </label>
          <label htmlFor="login-email">Email address
            <input id="login-email" name="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com"/>
          </label>
          <label htmlFor="login-password">Password
            <span className="password-control">
              <input id="login-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password"/>
              <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
            </span>
          </label>
          <div className="auth-inline-link"><span>Secure sign-in</span><span><ShieldCheck size={14}/> Protected session</span></div>
          <button className="button button-primary button-large auth-submit" disabled={busy}>{busy ? 'Signing in…' : `Sign in as ${selectedAccountType}`} <ArrowRight size={17}/></button>
        </form>
        <p className="auth-switch">New to WardLens? <Link to="/register">Create a resident account</Link></p>
      </div>
    </div>
  </div>;
}
