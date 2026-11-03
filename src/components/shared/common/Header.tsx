import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, LayoutDashboard, LogOut, Shield, UserRound } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { PwaInstallButton } from './PwaInstallButton';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const close = () => setMobileOpen(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  async function logout() {
    await signOut();
    close();
    navigate('/');
  }

  const publicLinks = [['Projects','/projects'],['Wards','/wards'],['Budgets','/budgets'],['How it works','/about']] as const;
  const portalLinks = [['Dashboard','/dashboard'],['Projects','/projects'],['Wards','/wards'],['Budgets','/budgets'],['Propose','/propose']] as const;
  const links = user ? portalLinks : publicLinks;

  return <header className="site-header">
    <div className="header-inner">
      <Link to="/" className="brand" aria-label="WardLens home"><img src="/wardlens-logo.svg" alt="WardLens"/></Link>
      {mobileOpen && <button className="mobile-menu-backdrop" aria-label="Close navigation" onClick={close}/>}
      <nav id="main-navigation" className={`main-nav ${mobileOpen ? 'nav-open' : ''}`} aria-label={user ? 'Portal navigation' : 'Main navigation'}>
        {links.map(([label, to]) => <NavLink key={to} to={to} onClick={close} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>{label}</NavLink>)}
        {!user && <NavLink to="/participation" onClick={close} className={({ isActive }) => `nav-link nav-participate ${isActive ? 'active' : ''}`}>Participate</NavLink>}
        {!user && <NavLink to="/login" onClick={close} className="nav-link mobile-login-link">Sign in</NavLink>}
      </nav>
      <div className="header-actions">
        <PwaInstallButton/>
        {user ? <div className="account-menu-wrap">
          <button className="account-trigger" onClick={() => setAccountOpen(!accountOpen)} aria-expanded={accountOpen}>
            <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="account-name">{user.name.split(' ')[0]}</span><ChevronDown size={15}/>
          </button>
          {accountOpen && <div className="account-dropdown">
            <div className="dropdown-user"><strong>{user.name}</strong><small>{user.email}</small><span className="role-chip">{user.role}</span></div>
            <Link to="/dashboard" onClick={() => { setAccountOpen(false); close(); }}><LayoutDashboard size={16}/> My dashboard</Link>
            {['admin', 'officer', 'oversight'].includes(user.role) && <Link to="/admin" onClick={() => { setAccountOpen(false); close(); }}><Shield size={16}/> Management</Link>}
            <button onClick={logout}><LogOut size={16}/> Sign out</button>
          </div>}
        </div> : <>
          <Link className="login-link" to="/login">Sign in</Link>
          <Link className="button button-primary header-cta" to="/register"><UserRound size={16}/> Join WardLens</Link>
        </>}
        <button type="button" className="mobile-menu-button" aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={23}/> : <Menu size={23}/>}
        </button>
      </div>
    </div>
  </header>;
}
