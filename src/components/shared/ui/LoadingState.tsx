import type { ReactNode } from 'react';
import { LoaderCircle } from 'lucide-react';
export function LoadingState({ label = 'Loading information…' }: { label?: string }) { return <div className="state-panel"><LoaderCircle className="spin" size={24}/><span>{label}</span></div>; }
export function ErrorState({ message, onRetry }: { message:string; onRetry?:()=>void }) { return <div className="state-panel state-error"><strong>We couldn’t load this</strong><span>{message}</span>{onRetry && <button className="button button-secondary" onClick={onRetry}>Try again</button>}</div>; }
export function EmptyState({ title, text, action }: { title:string; text:string; action?:ReactNode }) { return <div className="state-panel empty-state"><span className="empty-mark">WL</span><strong>{title}</strong><span>{text}</span>{action}</div>; }
