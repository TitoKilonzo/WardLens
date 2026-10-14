import { Link } from 'react-router-dom';
import { ArrowUpRight, MapPin, ThumbsUp, Wallet } from 'lucide-react';
import type { Project } from '../../types';
import { projectPath } from '../../utils/paths';
import { formatCompactKES } from '../../utils/format';
import { StatusPill } from '../shared/ui/StatusPill';
import { ProgressBar } from '../shared/ui/ProgressBar';
export function ProjectCard({ project, compact=false }: { project:Project; compact?:boolean }) {
 return <article className={`project-card ${compact?'project-card-compact':''}`}><Link to={projectPath(project)} className="project-image-link"><img className="project-image" src={project.image_url || 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80'} alt="" loading="lazy"/><span className="image-category">{project.category}</span><span className="image-arrow"><ArrowUpRight size={17}/></span></Link><div className="project-card-body"><div className="project-card-top"><StatusPill status={project.status}/><span className="project-ward"><MapPin size={13}/>{project.ward_name}</span></div><h3><Link to={projectPath(project)}>{project.title}</Link></h3><p className="project-excerpt">{project.description}</p><div className="project-meta"><span><Wallet size={15}/>{formatCompactKES(project.approved_budget || project.estimated_cost)}</span><span><ThumbsUp size={15}/>{project.vote_count} support</span></div>{['in_progress','funded','under_verification','completed'].includes(project.status) && <div className="card-progress"><ProgressBar value={project.progress}/></div>}</div></article>;
}
