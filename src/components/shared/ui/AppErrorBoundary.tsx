import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; }

/** Keeps unexpected render errors visible instead of leaving an empty white page. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('WardLens failed while rendering:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-crash-fallback" role="alert">
          <img src="/wardlens-logo.svg" alt="WardLens" />
          <p className="eyebrow">Something went wrong</p>
          <h1>WardLens couldn’t load this page.</h1>
          <p>Reload the page to try again. If the problem continues, open the browser console and share the first error with your developer.</p>
          <button className="button button-primary" onClick={() => window.location.reload()}>Reload page</button>
        </main>
      );
    }
    return this.props.children;
  }
}
