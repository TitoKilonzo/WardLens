import type { ReactNode } from 'react';
import { CheckCircle2, CircleAlert } from 'lucide-react';
export function Notice({ kind='error', children }: { kind?:'error'|'success'|'info'; children:ReactNode }) { const Icon = kind === 'success' ? CheckCircle2 : CircleAlert; return <div className={`notice notice-${kind}`}><Icon size={17}/><span>{children}</span></div>; }
