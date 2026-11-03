import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, CheckCircle2, Compass, Eye, HandHeart, Landmark, MapPinned, ShieldCheck, Vote } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import type { Project, Ward } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { WardCard } from '../components/wards/WardCard';
import { ErrorState, LoadingState } from '../components/shared/ui/LoadingState';
import { formatCompactKES } from '../utils/format';

export default function Home() {
  const { data: projectData, loading: projectsLoading, error: projectsError, refresh: refreshProjects } = useFetch<{ projects: Project[] }>('/projects');
  const { data: wardData, loading: wardsLoading, error: wardsError, refresh: refreshWards } = useFetch<{ wards: Ward[] }>('/wards');
  const projects = projectData?.projects || [];
  const wards = wardData?.wards || [];
  const running = projects.filter((project) => project.status === 'in_progress');
  const approvedBudget = projects.reduce((sum, project) => sum + project.approved_budget, 0);
  const stats = [
    { label: 'Projects tracked', value: projects.length.toString().padStart(2, '0'), detail: 'Across our sample wards', icon: MapPinned },
    { label: 'Budget published', value: formatCompactKES(approvedBudget), detail: 'Approved project allocations', icon: Landmark },
    { label: 'Active projects', value: running.length.toString().padStart(2, '0'), detail: 'Currently being delivered', icon: ChartNoAxesCombined },
  ];

  return <>
    <section className="hero-section">
      <div className="hero-grid-bg"/>
      <div className="container hero-layout">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="kicker-orb"/>PUBLIC PROJECTS IN YOUR WARD</div>
          <h1>See what’s happening<br/><span>in your ward.</span></h1>
          <p className="hero-description">Find local projects, check their budgets and progress, and share what matters to your community.</p>
          <div className="hero-actions">
            <Link to="/projects" className="button button-primary button-large">Explore projects <ArrowRight size={18}/></Link>
            <Link to="/wards" className="button button-ghost button-large">Find your ward <ArrowUpRight size={17}/></Link>
          </div>
          <div className="hero-trust-row">
            <ShieldCheck size={19}/>
            <div><strong>Public records, easy to follow</strong><small>Projects, budgets, and progress in one place.</small></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-photo-wrap">
            <img src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=75" alt="Buildings in a growing community" fetchPriority="high" decoding="async"/>
            <div className="photo-overlay"/>
            <div className="photo-caption"><span className="live-dot"/> LOCAL DEVELOPMENT <strong>Starts here.</strong></div>
          </div>
          <div className="hero-floating-card floating-card-top"><span className="float-icon"><Eye size={17}/></span><span><strong>Clear project updates</strong><small>One public record</small></span><BadgeCheck className="float-check" size={17}/></div>
          <div className="hero-floating-card floating-card-bottom"><div className="mini-progress-ring"><CheckCircle2 size={22}/></div><div><strong>Progress you can follow</strong><small>Milestones · budgets · evidence</small></div><ArrowUpRight className="float-up" size={17}/></div>
          <div className="hero-shape hero-shape-one"/>
          <div className="hero-shape hero-shape-two"/>
        </div>
      </div>
      <div className="hero-bottom container"><span>COMMUNITY IDEAS</span><div/><span>PUBLIC DECISIONS</span><div/><span>VISIBLE PROGRESS</span></div>
    </section>

    <section className="stats-strip">
      <div className="container stats-grid">
        {stats.map(({ label, value, detail, icon: Icon }) => <div className="stat-item" key={label}>
          <div className="stat-icon"><Icon size={19}/></div>
          <div><div className="stat-value">{projectsLoading ? '—' : value}</div><div className="stat-label">{label}</div><div className="stat-detail">{detail}</div></div>
        </div>)}
      </div>
    </section>

    <section className="section container">
      <div className="section-heading">
        <div><div className="eyebrow">PROJECTS IN THE OPEN</div><h2>See what’s being built.</h2><p>Follow local projects from approval through delivery.</p></div>
        <Link to="/projects" className="text-link">View all projects <ArrowRight size={17}/></Link>
      </div>
      {projectsLoading ? <LoadingState label="Loading community projects…"/> : projectsError ? <ErrorState message={projectsError} onRetry={refreshProjects}/> : <div className="project-grid">
        {projects.filter((project) => ['in_progress', 'approved', 'funded', 'completed'].includes(project.status)).slice(0, 3).map((project) => <ProjectCard key={project.id} project={project}/>)}
      </div>}
      {!projectsLoading && !projectsError && !projects.length && <div className="empty-inline">No projects have been published yet.</div>}
    </section>

    <section className="section section-soft">
      <div className="container how-layout">
        <div className="how-intro">
          <div className="eyebrow">HOW IT WORKS</div>
          <h2>Good decisions<br/>need good information.</h2>
          <p>WardLens brings community priorities and public records together so residents can see what is planned, funded, and under way.</p>
          <Link to="/about" className="button button-dark">See how it works <ArrowRight size={17}/></Link>
          <div className="how-illustration"><span className="illustration-circle circle-a"/><span className="illustration-circle circle-b"/><Compass size={60} strokeWidth={1.2}/><span className="illustration-line"/></div>
        </div>
        <div className="process-list">
          <div className="process-item"><span className="process-num">01</span><span className="process-icon"><HandHeart size={21}/></span><div><h3>Put forward an idea</h3><p>Propose a road, water point, school improvement, or public space your community needs.</p></div><ArrowUpRight size={18} className="process-arrow"/></div>
          <div className="process-item"><span className="process-num">02</span><span className="process-icon"><Vote size={21}/></span><div><h3>Make priorities visible</h3><p>Residents can support proposals and add local context for decision-makers.</p></div><ArrowUpRight size={18} className="process-arrow"/></div>
          <div className="process-item"><span className="process-num">03</span><span className="process-icon"><Landmark size={21}/></span><div><h3>Follow the public record</h3><p>Check published decisions, budgets, milestones, expenditure, and feedback.</p></div><ArrowUpRight size={18} className="process-arrow"/></div>
        </div>
      </div>
    </section>

    <section className="section container">
      <div className="section-heading">
        <div><div className="eyebrow">START CLOSE TO HOME</div><h2>Get to know your ward.</h2><p>Explore local development and the priorities being discussed in your area.</p></div>
        <Link to="/wards" className="text-link">Explore all wards <ArrowRight size={17}/></Link>
      </div>
      {wardsLoading ? <LoadingState label="Loading wards…"/> : wardsError ? <ErrorState message={wardsError} onRetry={refreshWards}/> : <div className="ward-grid">
        {wards.slice(0, 3).map((ward, index) => <WardCard key={ward.id} ward={ward} index={index}/>)}
      </div>}
    </section>

    <section className="cta-section">
      <div className="cta-pattern"/>
      <div className="container cta-content">
        <div><span className="cta-kicker">LOCAL PROJECTS, OPEN TO EVERYONE</span><h2>Have a say in what happens locally.</h2><p>Join your neighbours in making local priorities easier to see and follow.</p></div>
        <Link to="/register" className="button button-white button-large">Join the community <ArrowRight size={18}/></Link>
      </div>
    </section>
  </>;
}
