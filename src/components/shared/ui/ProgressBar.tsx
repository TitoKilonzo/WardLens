import { progressColor } from '../../../utils/format';
export function ProgressBar({ value, showLabel = true }: { value:number; showLabel?:boolean }) {
  const safe = Math.max(0,Math.min(100,value || 0));
  return <div className="progress-wrap"><div className="progress-track"><div className={`progress-fill ${progressColor(safe)}`} style={{ width:`${safe}%` }} /></div>{showLabel && <span className="progress-label">{safe}%</span>}</div>;
}
