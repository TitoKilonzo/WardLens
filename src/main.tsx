import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AppErrorBoundary } from './components/shared/ui/AppErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('WardLens root element was not found. Check index.html.');

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);
