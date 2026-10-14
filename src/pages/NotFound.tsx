import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
export default function NotFound(){return <div className="container page-container not-found"><span className="not-found-icon"><Compass size={34}/></span><div className="eyebrow">404 · OFF THE MAP</div><h1>This page isn’t on the register.</h1><p>The page may have moved, or the link may be incomplete.</p><Link to="/" className="button button-primary"><ArrowLeft size={17}/> Back to WardLens</Link></div>}
