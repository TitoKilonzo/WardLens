import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/AuthProvider';
import { CommonLayout } from './components/shared/common/CommonLayout';
import { ProtectedRoute } from './components/shared/ui/ProtectedRoute';
import Home from './pages/Home';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import ProposeProject from './pages/ProposeProject';
import Wards from './pages/Wards';
import WardDetails from './pages/WardDetails';
import Budgets from './pages/Budgets';
import Participation from './pages/Participation';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Admin from './pages/Admin';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import type { Role } from './types';

function PwaRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => console.warn('Service worker registration failed', error));
    }
  }, []);
  return null;
}

const managementRoles: Role[] = ['officer', 'admin', 'oversight'];

export default function App() {
  return <BrowserRouter>
    <AuthProvider>
      <PwaRegistration/>
      <Routes>
        <Route element={<CommonLayout/>}>
          <Route index element={<Home/>}/>
          <Route path="projects" element={<Projects/>}/>
          <Route path="projects/:id/:slug" element={<ProjectDetails/>}/>
          <Route path="wards" element={<Wards/>}/>
          <Route path="wards/:slug" element={<WardDetails/>}/>
          <Route path="budgets" element={<Budgets/>}/>
          <Route path="participation" element={<Participation/>}/>
          <Route path="about" element={<About/>}/>
          <Route path="contact" element={<Contact/>}/>
          <Route element={<ProtectedRoute/>}>
            <Route path="dashboard" element={<Dashboard/>}/>
            <Route path="propose" element={<ProposeProject/>}/>
          </Route>
          <Route element={<ProtectedRoute roles={managementRoles}/>}>
            <Route path="admin" element={<Admin/>}/>
          </Route>
          <Route path="*" element={<NotFound/>}/>
        </Route>
        <Route path="login" element={<Login/>}/>
        <Route path="register" element={<Register/>}/>
      </Routes>
    </AuthProvider>
  </BrowserRouter>;
}
