import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, BarChart3, FilePlus2, FolderKanban, LayoutDashboard, LogOut, MapPinned, Menu, ShieldCheck, WalletCards, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';

const primaryLinks = [
  { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', to: '/projects', icon: FolderKanban },
  { label: 'Wards', to: '/wards', icon: MapPinned },
  { label: 'Public budgets', to: '/budgets', icon: WalletCards },
  { label: 'Submit a proposal', to: '/propose', icon: FilePlus2 },
] as const;

const managementRoles = ['admin', 'officer', 'oversight'];

export function PortalLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const currentTitle = location.pathname.startsWith('/admin')
    ? 'Management'
    : primaryLinks.find((link) => location.pathname === link.to || location.pathname.startsWith(`${link.to}/`))?.label || 'WardLens Portal';
  const links = managementRoles.includes(user?.role || '')
    ? [...primaryLinks, { label: 'Management', to: '/admin', icon: ShieldCheck }]
    : primaryLinks;

  async function logout() {
    await signOut();
    setMenuOpen(false);
    navigate('/', { replace: true });
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  return <div className="portal-shell">
    {menuOpen && <button className="portal-scrim" aria-label="Close navigation" onClick={closeMenu}/>}
    <aside className={`portal-sidebar ${menuOpen ? 'portal-sidebar-open' : ''}`}>
      <Link to="/" className="portal-brand" onClick={closeMenu} aria-label="WardLens public home">
        <img src="/wardlens-logo.svg" alt="WardLens"/>
        <span>COMMUNITY PORTAL</span>
      </Link>
      <div className="portal-nav-label">WORKSPACE</div>
      <nav className="portal-nav" aria-label="Portal navigation">
        {links.map(({ label, to, icon: Icon }) =>
          <NavLink key={to} to={to} end={to === '/dashboard'} onClick={closeMenu} className={({ isActive }) => `portal-nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={18}/><span>{label}</span>
          </NavLink>
        )}
      </nav>
      <div className="portal-sidebar-bottom">
        <Link to="/about" className="portal-public-link" onClick={closeMenu}>About WardLens <ArrowUpRight size={14}/></Link>
        <div className="portal-user-card">
          <span className="portal-avatar">{user?.name.slice(0, 1).toUpperCase()}</span>
          <span className="portal-user-copy"><strong>{user?.name}</strong><small>{user?.role}</small></span>
          <button type="button" className="portal-logout" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={17}/></button>
        </div>
      </div>
    </aside>
    <div className="portal-main">
      <header className="portal-topbar">
        <button type="button" className="portal-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}>
          {menuOpen ? <X size={20}/> : <Menu size={20}/>}
        </button>
        <div className="portal-page-title"><span>WardLens</span><strong>{currentTitle}</strong></div>
        <div className="portal-topbar-right"><BarChart3 size={17}/><span>Community workspace</span></div>
      </header>
      <main className="portal-content"><Outlet/></main>
    </div>
  </div>;
}
