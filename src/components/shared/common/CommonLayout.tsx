import { Outlet } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import { Header } from './Header';
import { Footer } from './Footer';
import { PortalLayout } from './PortalLayout';
export function CommonLayout() {
  const { user } = useAuth();
  if (user) return <PortalLayout/>;
  return <><Header/><main className="main-content"><Outlet/></main><Footer/></>;
}
