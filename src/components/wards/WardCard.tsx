import { ArrowUpRight, Building2, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Ward } from '../../types';
import { wardPath } from '../../utils/paths';
import { formatCompactKES } from '../../utils/format';
export function WardCard({ ward, index=0 }: { ward:Ward; index?:number }) { return <Link to={wardPath(ward)} className="ward-card"><div className={`ward-art ward-art-${index%4}`}><MapPin size={22}/><span className="ward-art-ring"/><span className="ward-art-count">{String(index+1).padStart(2,'0')}</span></div><div className="ward-card-content"><div className="ward-card-kicker">{ward.county}</div><h3>{ward.name}</h3><p>{ward.description}</p><div className="ward-card-metrics"><span><Building2 size={14}/>{ward.project_count ?? 0} projects</span><span><Users size={14}/>{(ward.population||0).toLocaleString()} residents</span></div><div className="ward-card-bottom"><span>{formatCompactKES(ward.approved_budget || 0)} allocated</span><ArrowUpRight size={17}/></div></div></Link>; }
