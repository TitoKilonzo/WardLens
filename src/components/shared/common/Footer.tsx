import { Link } from 'react-router-dom';
import { ArrowUpRight, ShieldCheck } from 'lucide-react';
export function Footer() {
  return <footer className="site-footer"><div className="footer-main"><div className="footer-brand"><img src="/wardlens-logo.svg" alt="WardLens"/><p>Making local development easier to follow, question, and improve.</p></div><div className="footer-links"><div><strong>Explore</strong><Link to="/projects">Projects</Link><Link to="/wards">Wards</Link><Link to="/budgets">Public budgets</Link></div><div><strong>Take part</strong><Link to="/participation">Participation</Link><Link to="/about">How it works</Link><Link to="/contact">Contact</Link></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} WardLens</span><span className="footer-trust"><ShieldCheck size={15}/> Clear information. Accountable progress. <ArrowUpRight size={14}/></span></div></footer>;
}
