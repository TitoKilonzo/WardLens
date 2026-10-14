import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, CircleCheck, Clock3, FileText, LayoutDashboard, MessageSquareText, ThumbsUp, UserRound } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import type { Feedback, Project } from '../types';
import { formatDate, titleCase } from '../utils/format';
import { PageHeader } from '../components/shared/ui/PageHeader';
import { StatusPill } from '../components/shared/ui/StatusPill';
import { LoadingState, ErrorState, EmptyState } from '../components/shared/ui/LoadingState';

type DashData = { proposals: Project[]; votes: Project[]; feedback: Feedback[] };
type DashboardView = 'overview' | 'proposals' | 'votes' | 'feedback';

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useFetch<DashData>('/dashboard');
  const [view, setView] = useState<DashboardView>('overview');
  const activity = data || { proposals: [], votes: [], feedback: [] };
  const tabs: { id: DashboardView; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'proposals', label: 'My proposals', count: activity.proposals.length },
    { id: 'votes', label: 'Supported projects', count: activity.votes.length },
    { id: 'feedback', label: 'My feedback', count: activity.feedback.length },
  ];

  function proposalList() {
    return activity.proposals.length ? <div className="activity-list">{activity.proposals.map((project) =>
      <div className="activity-row" key={project.id}>
        <div className="activity-icon"><FileText size={18}/></div>
        <div className="activity-row-content">
          <Link to={`/projects/${project.id}/${project.slug}`}><strong>{project.title}</strong></Link>
          <span><CalendarDays size={13}/> Submitted {formatDate(project.created_at)} · {project.ward_name}</span>
        </div>
        <StatusPill status={project.status}/>
      </div>
    )}</div> : <EmptyState title="Your first idea starts here" text="Submit a local project proposal and follow its review journey." action={<Link to="/propose" className="button button-primary">Propose a project</Link>}/>;
  }

  function voteList() {
    return activity.votes.length ? <div className="activity-list">{activity.votes.map((project) =>
      <div className="activity-row" key={project.id}>
        <div className="activity-icon activity-icon-blue"><ThumbsUp size={17}/></div>
        <div className="activity-row-content">
          <Link to={`/projects/${project.id}/${project.slug}`}><strong>{project.title}</strong></Link>
          <span>{project.ward_name} · {project.vote_count} community supports</span>
        </div>
        <StatusPill status={project.status}/>
      </div>
    )}</div> : <EmptyState title="No supported proposals yet" text="Explore open proposals and support ideas that matter to your community." action={<Link to="/projects" className="button button-secondary">Explore projects</Link>}/>;
  }

  function feedbackList() {
    return activity.feedback.length ? <div className="feedback-list">{activity.feedback.map((item) =>
      <div className="feedback-item" key={item.id}>
        <div className="feedback-avatar"><MessageSquareText size={16}/></div>
        <div className="feedback-body">
          <div className="feedback-head">
            <strong><Link to={`/projects/${item.project_id}/${item.project_slug}`}>{item.project_title}</Link></strong>
            <span>{formatDate(item.created_at)}</span>
            <span className={`feedback-status feedback-${item.status}`}>{titleCase(item.status)}</span>
          </div>
          <p>{item.message}</p>
          {item.response && <div className="official-response"><strong>Official response</strong><p>{item.response}</p></div>}
        </div>
      </div>
    )}</div> : <div className="empty-inline"><Clock3 size={17}/> Feedback you submit on a project will be listed here.</div>;
  }

  const selectedLabel = tabs.find((tab) => tab.id === view)?.label || 'Overview';

  return <div className="container page-container dashboard-page">
    <PageHeader
      eyebrow="YOUR WARDLENS PORTAL"
      title={`Welcome back, ${user?.name.split(' ')[0] || 'neighbour'}.`}
      description="Keep track of your proposals, community support, and conversations in one place."
      action={<Link to="/propose" className="button button-primary"><FileText size={16}/> New proposal</Link>}
    />
    <div className="profile-banner">
      <div className="profile-avatar"><UserRound size={25}/></div>
      <div><strong>{user?.name}</strong><span>{user?.email}</span></div>
      <div className="profile-ward"><span>Selected ward</span><strong>{user?.ward_name || 'Not set'}</strong></div>
      <div className="profile-role">{user?.role}</div>
    </div>
    <div className="dashboard-metrics" aria-label="Your activity summary">
      <button type="button" className={`dashboard-metric-card ${view === 'proposals' ? 'selected' : ''}`} aria-pressed={view === 'proposals'} onClick={() => setView('proposals')}>
        <span><FileText size={17}/> My proposals</span><strong>{loading ? '—' : activity.proposals.length}</strong><small>Ideas you submitted</small>
      </button>
      <button type="button" className={`dashboard-metric-card ${view === 'votes' ? 'selected' : ''}`} aria-pressed={view === 'votes'} onClick={() => setView('votes')}>
        <span><ThumbsUp size={17}/> Supported projects</span><strong>{loading ? '—' : activity.votes.length}</strong><small>Proposals you supported</small>
      </button>
      <button type="button" className={`dashboard-metric-card ${view === 'feedback' ? 'selected' : ''}`} aria-pressed={view === 'feedback'} onClick={() => setView('feedback')}>
        <span><MessageSquareText size={17}/> Feedback sent</span><strong>{loading ? '—' : activity.feedback.length}</strong><small>Questions and concerns</small>
      </button>
      <div className="dashboard-metric-card dashboard-metric-static">
        <span><CircleCheck size={17}/> Responses resolved</span><strong>{loading ? '—' : activity.feedback.filter((item) => item.status === 'resolved').length}</strong><small>Feedback marked resolved</small>
      </div>
    </div>
    <nav className="dashboard-tabs" aria-label="Dashboard sections">
      {tabs.map((tab) =>
        <button key={tab.id} type="button" className={view === tab.id ? 'active' : ''} aria-current={view === tab.id ? 'page' : undefined} onClick={() => setView(tab.id)}>
          {tab.id === 'overview' && <LayoutDashboard size={15}/>}
          {tab.label}
          {tab.count !== undefined && <span>{loading ? '—' : tab.count}</span>}
        </button>
      )}
    </nav>
    {loading ? <LoadingState label="Loading your activity…"/> : error ? <ErrorState message={error} onRetry={refresh}/> : <section className="content-panel dashboard-activity-panel">
      <div className="panel-title-row">
        <div><div className="eyebrow">YOUR ACTIVITY</div><h2>{selectedLabel}</h2></div>
        {view === 'proposals' && <Link to="/propose" className="mini-link">New proposal <ArrowRight size={14}/></Link>}
        {view === 'votes' && <Link to="/projects" className="mini-link">Explore projects <ArrowRight size={14}/></Link>}
        {view === 'feedback' && <Link to="/projects" className="mini-link">Find a project <ArrowRight size={14}/></Link>}
      </div>
      {view === 'overview' ? <div className="dashboard-two-col">
        <section className="dashboard-activity-group"><div className="panel-title-row"><div><div className="eyebrow">IDEAS YOU SHARED</div><h2>My proposals</h2></div><button type="button" className="mini-link dashboard-text-button" onClick={() => setView('proposals')}>View all <ArrowRight size={14}/></button></div>{proposalList()}</section>
        <section className="dashboard-activity-group"><div className="panel-title-row"><div><div className="eyebrow">YOUR COMMUNITY SUPPORT</div><h2>Projects you support</h2></div><button type="button" className="mini-link dashboard-text-button" onClick={() => setView('votes')}>View all <ArrowRight size={14}/></button></div>{voteList()}</section>
        <section className="dashboard-activity-group dashboard-feedback-panel"><div className="panel-title-row"><div><div className="eyebrow">QUESTIONS & CONCERNS</div><h2>My feedback</h2></div><button type="button" className="mini-link dashboard-text-button" onClick={() => setView('feedback')}>View all <ArrowRight size={14}/></button></div>{feedbackList()}</section>
      </div> : view === 'proposals' ? proposalList() : view === 'votes' ? voteList() : feedbackList()}
    </section>}
  </div>;
}
