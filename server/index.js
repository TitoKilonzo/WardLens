import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, audit, initializeDatabase, publicProject } from './db.js';

const app = express();
const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-only-change-this-secret-before-deployment';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '12h';
const originSetting = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = originSetting.split(',').map((value) => {
  const configuredOrigin = value.trim();
  let parsedOrigin;
  try {
    parsedOrigin = new URL(configuredOrigin);
  } catch {
    throw new Error(`Invalid origin in CORS_ORIGIN: ${configuredOrigin}`);
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.pathname !== '/' || parsedOrigin.search || parsedOrigin.hash) {
    throw new Error(`CORS_ORIGIN entries must be HTTP(S) origins without a path: ${configuredOrigin}`);
  }
  return parsedOrigin.origin;
});
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

for (const method of ['get', 'post', 'patch', 'delete']) {
  const register = app[method].bind(app);
  app[method] = (route, ...handlers) => register(route, ...handlers.map((handler) => {
    if (typeof handler !== 'function') return handler;
    return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
  }));
}

const projectSelect = `SELECT p.*, w.name AS ward_name, w.slug AS ward_slug, u.name AS proposer_name FROM projects p JOIN wards w ON w.id=p.ward_id LEFT JOIN users u ON u.id=p.proposed_by`;
function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}
function userFromRow(row) {
  return row ? { id: row.id, name: row.name, email: row.email, role: row.role, ward_id: row.ward_id, ward_name: row.ward_name ?? null, created_at: row.created_at } : null;
}
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Sign in to continue.' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
  const row = await db.prepare('SELECT u.*, w.name AS ward_name FROM users u LEFT JOIN wards w ON w.id=u.ward_id WHERE u.id=?').get(payload.sub);
  if (!row) return res.status(401).json({ error: 'This account is no longer available. Sign in again.' });
  req.user = userFromRow(row);
  next();
}
async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    let payload;
    try { payload = jwt.verify(token, JWT_SECRET); } catch { return next(); }
    const row = await db.prepare('SELECT u.*, w.name AS ward_name FROM users u LEFT JOIN wards w ON w.id=u.ward_id WHERE u.id=?').get(payload.sub);
    if (row) req.user = userFromRow(row);
  }
  next();
}
function allow(...allowed) {
  return (req, res, next) => {
    if (!req.user || !allowed.includes(req.user.role)) return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    next();
  };
}
function cleanText(value, max = 3000) { return typeof value === 'string' ? value.trim().slice(0, max) : ''; }
function parseId(value) { const n = Number(value); return Number.isInteger(n) && n > 0 ? n : null; }
function error(res, status, message) { return res.status(status).json({ error: message }); }
async function projectById(id, userId = null) {
  return await publicProject(await db.prepare(`${projectSelect} WHERE p.id=?`).get(id), userId);
}

app.get('/api/health', async (_req, res) => res.json({ status: 'ok', service: 'WardLens API', timestamp: new Date().toISOString() }));

app.post('/api/auth/register', async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 180).toLowerCase();
  const password = String(req.body.password || '');
  const wardId = parseId(req.body.ward_id);
  if (name.length < 2) return error(res, 400, 'Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(res, 400, 'Enter a valid email address.');
  if (password.length < 8) return error(res, 400, 'Your password must contain at least 8 characters.');
  if (!wardId || !await db.prepare('SELECT id FROM wards WHERE id=?').get(wardId)) return error(res, 400, 'Choose a valid ward.');
  if (await db.prepare('SELECT id FROM users WHERE email=?').get(email)) return error(res, 409, 'An account with this email already exists.');
  const hash = bcrypt.hashSync(password, 12);
  const result = await db.prepare('INSERT INTO users(name,email,password_hash,role,ward_id) VALUES(?,?,? ,\'resident\',?)').run(name, email, hash, wardId);
  const row = await db.prepare('SELECT u.*, w.name AS ward_name FROM users u LEFT JOIN wards w ON w.id=u.ward_id WHERE u.id=?').get(result.lastInsertRowid);
  await audit(row.id, 'account.registered', 'user', row.id);
  return res.status(201).json({ token: tokenFor(row), user: userFromRow(row) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = cleanText(req.body.email, 180).toLowerCase();
  const password = String(req.body.password || '');
  const requestedRole = req.body.role;
  if (requestedRole !== undefined && !['resident','officer','admin','oversight'].includes(requestedRole)) {
    return error(res, 400, 'Choose a valid account type.');
  }
  const row = await db.prepare('SELECT u.*, w.name AS ward_name FROM users u LEFT JOIN wards w ON w.id=u.ward_id WHERE u.email=?').get(email);
  if (!row || !bcrypt.compareSync(password, row.password_hash)) return error(res, 401, 'Email or password is incorrect.');
  if (requestedRole && row.role !== requestedRole) return error(res, 403, 'This account does not match the selected sign-in type.');
  await audit(row.id, 'account.login', 'user', row.id);
  return res.json({ token: tokenFor(row), user: userFromRow(row) });
});

app.get('/api/auth/me', requireAuth, async (req, res) => res.json({ user: req.user }));
app.post('/api/auth/logout', requireAuth, async (req, res) => { await audit(req.user.id, 'account.logout', 'user', req.user.id); res.json({ message: 'Signed out successfully.' }); });

app.get('/api/wards', async (_req, res) => {
  const rows = await db.prepare(`SELECT w.*, COUNT(DISTINCT p.id) AS project_count,
    COALESCE(SUM(CASE WHEN p.status NOT IN ('proposed','under_review','rejected') THEN p.approved_budget ELSE 0 END),0) AS approved_budget,
    COALESCE(SUM(CASE WHEN p.status NOT IN ('proposed','under_review','rejected') THEN p.spent_amount ELSE 0 END),0) AS spent_amount
    FROM wards w LEFT JOIN projects p ON p.ward_id=w.id GROUP BY w.id ORDER BY w.name`).all();
  res.json({ wards: rows });
});
app.get('/api/wards/:slug', optionalAuth, async (req, res) => {
  const ward = await db.prepare('SELECT * FROM wards WHERE slug=?').get(req.params.slug);
  if (!ward) return error(res, 404, 'Ward not found.');
  const projects = await Promise.all((await db.prepare(`${projectSelect} WHERE p.ward_id=? ORDER BY p.created_at DESC`).all(ward.id))
    .map((p) => publicProject(p, req.user?.id)));
  res.json({ ward, projects });
});

app.get('/api/projects', optionalAuth, async (req, res) => {
  const filters = [];
  const values = [];
  const search = cleanText(req.query.search, 120);
  const status = cleanText(req.query.status, 40);
  const category = cleanText(req.query.category, 80);
  const ward = cleanText(req.query.ward, 80);
  if (search) { filters.push('(p.title LIKE ? OR p.description LIKE ? OR p.location LIKE ?)'); values.push(`%${search}%`,`%${search}%`,`%${search}%`); }
  if (status && status !== 'all') { filters.push('p.status=?'); values.push(status); }
  if (category && category !== 'all') { filters.push('p.category=?'); values.push(category); }
  if (ward && ward !== 'all') { filters.push('(w.slug=? OR w.name=?)'); values.push(ward, ward); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const rows = await db.prepare(`${projectSelect} ${where} ORDER BY CASE p.status WHEN 'in_progress' THEN 1 WHEN 'approved' THEN 2 WHEN 'funded' THEN 3 WHEN 'under_review' THEN 4 ELSE 5 END, p.created_at DESC`).all(...values);
  res.json({ projects: await Promise.all(rows.map((p) => publicProject(p, req.user?.id))) });
});
app.get('/api/projects/:id', optionalAuth, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return error(res, 400, 'Invalid project ID.');
  const project = await projectById(id, req.user?.id ?? null);
  if (!project) return error(res, 404, 'Project not found.');
  const milestones = await db.prepare('SELECT m.*, u.name AS updated_by_name FROM milestones m LEFT JOIN users u ON u.id=m.updated_by WHERE project_id=? ORDER BY COALESCE(m.due_date, m.created_at), m.id').all(id);
  const budgets = await db.prepare('SELECT b.*, u.name AS recorder_name FROM budget_records b LEFT JOIN users u ON u.id=b.recorded_by WHERE project_id=? ORDER BY b.created_at DESC, b.id DESC').all(id);
  const feedback = await db.prepare(`SELECT f.id,f.project_id,f.user_id,f.message,f.status,f.response,f.created_at,f.updated_at,u.name AS author_name FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.project_id=? ORDER BY f.created_at DESC`).all(id);
  res.json({ project, milestones, budgets, feedback });
});
app.post('/api/projects', requireAuth, allow('resident'), async (req, res) => {
  const title = cleanText(req.body.title, 160);
  const description = cleanText(req.body.description, 3000);
  const category = cleanText(req.body.category, 80);
  const location = cleanText(req.body.location, 220);
  const cost = Number(req.body.estimated_cost);
  const wardId = parseId(req.body.ward_id);
  const imageUrl = cleanText(req.body.image_url, 500);
  if (title.length < 8) return error(res, 400, 'Project title must be at least 8 characters.');
  if (description.length < 30) return error(res, 400, 'Please add at least 30 characters describing the project.');
  if (!category || !location) return error(res, 400, 'Choose a category and add a project location.');
  if (!Number.isFinite(cost) || cost < 0 || cost > 1_000_000_000_000) return error(res, 400, 'Enter a valid estimated cost.');
  if (!wardId || !await db.prepare('SELECT id FROM wards WHERE id=?').get(wardId)) return error(res, 400, 'Choose a valid ward.');
  const slugBase = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,90) || 'project';
  let slug = slugBase, suffix = 2;
  while (await db.prepare('SELECT id FROM projects WHERE slug=?').get(slug)) slug = `${slugBase}-${suffix++}`;
  const result = await db.prepare(`INSERT INTO projects(title,slug,description,category,status,ward_id,proposed_by,estimated_cost,location,image_url) VALUES(?,?,?,?, 'proposed',?,?,?,?,?)`)
    .run(title, slug, description, category, wardId, req.user.id, cost, location, imageUrl);
  const id = Number(result.lastInsertRowid);
  await audit(req.user.id, 'project.proposed', 'project', id, { title, ward_id: wardId });
  res.status(201).json({ project: await projectById(id, req.user.id), message: 'Your proposal has been submitted for review.' });
});
app.post('/api/projects/:id/vote', requireAuth, allow('resident'), async (req, res) => {
  const id = parseId(req.params.id);
  const project = id && await db.prepare('SELECT id,status FROM projects WHERE id=?').get(id);
  if (!project) return error(res, 404, 'Project not found.');
  if (!['proposed','under_review','approved'].includes(project.status)) return error(res, 400, 'This project is not open for community voting.');
  try {
    await db.prepare('INSERT INTO votes(project_id,user_id) VALUES(?,?)').run(id, req.user.id);
    await audit(req.user.id, 'project.voted', 'project', id);
    const { count } = await db.prepare('SELECT COUNT(*) AS count FROM votes WHERE project_id=?').get(id);
    res.status(201).json({ message: 'Your support has been recorded.', vote_count: Number(count) });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return error(res, 409, 'You have already supported this proposal.');
    throw e;
  }
});
app.delete('/api/projects/:id/vote', requireAuth, allow('resident'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return error(res, 400, 'Invalid project ID.');
  await db.prepare('DELETE FROM votes WHERE project_id=? AND user_id=?').run(id, req.user.id);
  await audit(req.user.id, 'project.vote_removed', 'project', id);
  res.json({ message: 'Your support was withdrawn.' });
});
app.post('/api/projects/:id/feedback', requireAuth, allow('resident'), async (req, res) => {
  const id = parseId(req.params.id);
  const message = cleanText(req.body.message, 2000);
  if (!id || !await db.prepare('SELECT id FROM projects WHERE id=?').get(id)) return error(res, 404, 'Project not found.');
  if (message.length < 10) return error(res, 400, 'Please provide at least 10 characters of detail.');
  const result = await db.prepare('INSERT INTO feedback(project_id,user_id,message) VALUES(?,?,?)').run(id, req.user.id, message);
  await audit(req.user.id, 'feedback.created', 'feedback', Number(result.lastInsertRowid), { project_id: id });
  res.status(201).json({ message: 'Your feedback has been received.' });
});

app.get('/api/budgets', async (req, res) => {
  const wardSlug = cleanText(req.query.ward, 80);
  const kind = cleanText(req.query.kind, 30);
  const clauses = [];
  const values = [];
  if (wardSlug && wardSlug !== 'all') { clauses.push('w.slug=?'); values.push(wardSlug); }
  if (kind && ['allocation','expenditure','adjustment'].includes(kind)) { clauses.push('b.kind=?'); values.push(kind); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const records = await db.prepare(`SELECT b.*,p.title AS project_title,p.slug AS project_slug,p.status AS project_status,w.name AS ward_name,w.slug AS ward_slug FROM budget_records b JOIN projects p ON p.id=b.project_id JOIN wards w ON w.id=p.ward_id ${where} ORDER BY b.created_at DESC,b.id DESC`).all(...values);
  const totals = await db.prepare(`SELECT COALESCE(SUM(CASE WHEN b.kind='allocation' THEN b.amount WHEN b.kind='adjustment' THEN b.amount ELSE 0 END),0) AS allocated, COALESCE(SUM(CASE WHEN b.kind='expenditure' THEN b.amount ELSE 0 END),0) AS spent FROM budget_records b JOIN projects p ON p.id=b.project_id JOIN wards w ON w.id=p.ward_id ${wardSlug && wardSlug !== 'all' ? 'WHERE w.slug=?' : ''}`).get(...(wardSlug && wardSlug !== 'all' ? [wardSlug] : []));
  res.json({ records, totals });
});

app.get('/api/dashboard', requireAuth, async (req, res) => {
  const proposals = await Promise.all((await db.prepare(`${projectSelect} WHERE p.proposed_by=? ORDER BY p.created_at DESC`).all(req.user.id))
    .map((p) => publicProject(p, req.user.id)));
  const votes = await Promise.all((await db.prepare(`SELECT ${'p.*'},w.name AS ward_name,w.slug AS ward_slug, u.name AS proposer_name FROM votes v JOIN projects p ON p.id=v.project_id JOIN wards w ON w.id=p.ward_id LEFT JOIN users u ON u.id=p.proposed_by WHERE v.user_id=? ORDER BY v.created_at DESC`).all(req.user.id))
    .map((p) => publicProject(p, req.user.id)));
  const feedback = await db.prepare('SELECT f.*,p.title AS project_title,p.slug AS project_slug FROM feedback f JOIN projects p ON p.id=f.project_id WHERE f.user_id=? ORDER BY f.created_at DESC').all(req.user.id);
  res.json({ proposals, votes, feedback });
});

app.get('/api/admin/stats', requireAuth, allow('officer','admin','oversight'), async (_req, res) => {
  const stats = {
    projects: Number((await db.prepare('SELECT COUNT(*) AS count FROM projects').get()).count),
    pending: Number((await db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status IN ('proposed','under_review')").get()).count),
    inProgress: Number((await db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status='in_progress'").get()).count),
    completed: Number((await db.prepare("SELECT COUNT(*) AS count FROM projects WHERE status='completed'").get()).count),
    openFeedback: Number((await db.prepare("SELECT COUNT(*) AS count FROM feedback WHERE status!='resolved'").get()).count),
    allocated: Number((await db.prepare("SELECT COALESCE(SUM(approved_budget),0) AS amount FROM projects WHERE status NOT IN ('proposed','under_review','rejected')").get()).amount),
    spent: Number((await db.prepare("SELECT COALESCE(SUM(spent_amount),0) AS amount FROM projects WHERE status NOT IN ('proposed','under_review','rejected')").get()).amount),
    residents: Number((await db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='resident'").get()).count)
  };
  res.json({ stats });
});
app.get('/api/admin/projects', requireAuth, allow('officer','admin','oversight'), async (req, res) => {
  const status = cleanText(req.query.status, 40);
  const params = [];
  let where = '';
  if (status && status !== 'all') { where='WHERE p.status=?'; params.push(status); }
  const projects = await Promise.all((await db.prepare(`${projectSelect} ${where} ORDER BY p.updated_at DESC`).all(...params))
    .map((p) => publicProject(p)));
  res.json({ projects });
});
app.get('/api/admin/feedback', requireAuth, allow('officer','admin','oversight'), async (req, res) => {
  const status = cleanText(req.query.status, 20);
  const params = [];
  let where = '';
  if (status && status !== 'all') { where = 'WHERE f.status=?'; params.push(status); }
  const feedback = await db.prepare(`SELECT f.*,p.title AS project_title,p.slug AS project_slug,u.name AS author_name,w.name AS ward_name FROM feedback f JOIN projects p ON p.id=f.project_id JOIN users u ON u.id=f.user_id JOIN wards w ON w.id=p.ward_id ${where} ORDER BY CASE f.status WHEN 'open' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END, f.created_at DESC`).all(...params);
  res.json({ feedback });
});

app.patch('/api/admin/projects/:id/status', requireAuth, allow('officer','admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const status = cleanText(req.body.status, 40);
  const allowed = ['proposed','under_review','approved','rejected','funded','in_progress','under_verification','completed','paused'];
  if (!id || !await db.prepare('SELECT id FROM projects WHERE id=?').get(id)) return error(res, 404, 'Project not found.');
  if (!allowed.includes(status)) return error(res, 400, 'Choose a valid project status.');
  const note = cleanText(req.body.decision_note, 1000);
  if (['rejected','paused','completed','approved','funded'].includes(status) && note.length < 8) return error(res, 400, 'Add a short reason or decision note of at least 8 characters.');
  await db.prepare('UPDATE projects SET status=?,decision_note=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, note, id);
  await audit(req.user.id, 'project.status_changed', 'project', id, { status, decision_note: note });
  res.json({ project: await projectById(id), message: 'Project status updated.' });
});
app.post('/api/admin/projects/:id/milestones', requireAuth, allow('officer','admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const title = cleanText(req.body.title, 180);
  const description = cleanText(req.body.description, 1000);
  const dueDate = cleanText(req.body.due_date, 10) || null;
  if (!id || !await db.prepare('SELECT id FROM projects WHERE id=?').get(id)) return error(res, 404, 'Project not found.');
  if (title.length < 4) return error(res, 400, 'Milestone title is too short.');
  const r = await db.prepare('INSERT INTO milestones(project_id,title,description,status,due_date,evidence_url,updated_by) VALUES(?,?,?,? ,?,?,?)').run(id,title,description,req.body.status || 'planned',dueDate,cleanText(req.body.evidence_url,500),req.user.id);
  await db.prepare('UPDATE projects SET updated_at=CURRENT_TIMESTAMP WHERE id=?').run(id);
  await audit(req.user.id, 'milestone.created', 'milestone', Number(r.lastInsertRowid), { project_id: id });
  res.status(201).json({ message: 'Milestone added.' });
});
app.patch('/api/admin/milestones/:id', requireAuth, allow('officer','admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const status = cleanText(req.body.status, 30);
  if (!id || !await db.prepare('SELECT id FROM milestones WHERE id=?').get(id)) return error(res, 404, 'Milestone not found.');
  if (!['planned','in_progress','completed','delayed'].includes(status)) return error(res, 400, 'Invalid milestone status.');
  await db.prepare('UPDATE milestones SET status=?,evidence_url=COALESCE(?,evidence_url),updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.body.evidence_url ? cleanText(req.body.evidence_url,500) : null, req.user.id, id);
  await audit(req.user.id, 'milestone.updated', 'milestone', id, { status });
  res.json({ message: 'Milestone updated.' });
});
app.post('/api/admin/projects/:id/budget-records', requireAuth, allow('officer','admin','oversight'), async (req, res) => {
  const id = parseId(req.params.id);
  const kind = cleanText(req.body.kind, 20);
  const amount = Number(req.body.amount);
  const description = cleanText(req.body.description, 500);
  const reference = cleanText(req.body.reference, 120);
  const evidence = cleanText(req.body.evidence_url, 500);
  if (!id || !await db.prepare('SELECT id FROM projects WHERE id=?').get(id)) return error(res, 404, 'Project not found.');
  if (!['allocation','expenditure','adjustment'].includes(kind)) return error(res, 400, 'Choose a valid financial record type.');
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000_000) return error(res, 400, 'Enter a positive amount.');
  if (description.length < 6) return error(res, 400, 'Add a clearer description for this financial record.');
  await db.transaction(async (tx) => {
    await tx.prepare('INSERT INTO budget_records(project_id,kind,amount,description,reference,evidence_url,recorded_by) VALUES(?,?,?,?,?,?,?)').run(id,kind,amount,description,reference,evidence,req.user.id);
    if (kind === 'allocation' || kind === 'adjustment') await tx.prepare('UPDATE projects SET approved_budget=approved_budget+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(amount,id);
    if (kind === 'expenditure') await tx.prepare('UPDATE projects SET spent_amount=spent_amount+?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(amount,id);
    return true;
  });
  await audit(req.user.id, 'budget.recorded', 'project', id, { kind, amount, reference });
  res.status(201).json({ project: await projectById(id), message: 'Financial record published.' });
});
app.patch('/api/admin/feedback/:id', requireAuth, allow('officer','admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const status = cleanText(req.body.status, 20);
  const response = cleanText(req.body.response, 1000);
  if (!id || !await db.prepare('SELECT id FROM feedback WHERE id=?').get(id)) return error(res, 404, 'Feedback not found.');
  if (!['open','in_review','resolved'].includes(status)) return error(res, 400, 'Invalid feedback status.');
  if (status === 'resolved' && response.length < 5) return error(res, 400, 'Add a response before resolving feedback.');
  await db.prepare('UPDATE feedback SET status=?,response=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,response,id);
  await audit(req.user.id, 'feedback.updated', 'feedback', id, { status });
  res.json({ message: 'Feedback response saved.' });
});
app.post('/api/contact', async (req, res) => {
  const name = cleanText(req.body.name, 100);
  const email = cleanText(req.body.email, 180).toLowerCase();
  const topic = cleanText(req.body.topic, 80);
  const message = cleanText(req.body.message, 2000);
  if (name.length < 2) return error(res, 400, 'Enter your name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return error(res, 400, 'Enter a valid email address.');
  if (!topic) return error(res, 400, 'Choose a message topic.');
  if (message.length < 10) return error(res, 400, 'Please provide at least 10 characters of detail.');
  const result = await db.prepare('INSERT INTO contact_messages(name,email,topic,message) VALUES(?,?,?,?)').run(name,email,topic,message);
  await audit(null, 'contact_message.created', 'contact_message', Number(result.lastInsertRowid), { topic });
  res.status(201).json({ message: 'Your message has been received.' });
});
app.get('/api/admin/contact-messages', requireAuth, allow('officer','admin','oversight'), async (_req, res) => {
  const messages = await db.prepare("SELECT * FROM contact_messages ORDER BY CASE status WHEN 'open' THEN 1 WHEN 'in_review' THEN 2 ELSE 3 END, created_at DESC").all();
  res.json({ messages });
});
app.patch('/api/admin/contact-messages/:id', requireAuth, allow('officer','admin'), async (req, res) => {
  const id = parseId(req.params.id);
  const status = cleanText(req.body.status, 20);
  const response = cleanText(req.body.response, 1000);
  if (!id || !await db.prepare('SELECT id FROM contact_messages WHERE id=?').get(id)) return error(res, 404, 'Message not found.');
  if (!['open','in_review','resolved'].includes(status)) return error(res, 400, 'Invalid message status.');
  if (status === 'resolved' && response.length < 5) return error(res, 400, 'Add a response before resolving this message.');
  await db.prepare('UPDATE contact_messages SET status=?,response=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status,response,id);
  await audit(req.user.id, 'contact_message.updated', 'contact_message', id, { status });
  res.json({ message: 'Inbox message updated.' });
});

app.get('/api/admin/audit-logs', requireAuth, allow('admin','oversight'), async (_req, res) => {
  const logs = await db.prepare(`SELECT a.*,u.name AS user_name,u.email AS user_email FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`).all();
  res.json({ logs });
});

app.use('/api', (_req, res) => error(res, 404, 'API route not found.'));

const here = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(here, '../dist');
if (process.env.SERVE_FRONTEND === 'true') {
  app.use(express.static(distPath));
  app.get('*', async (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error('API request failed:', err);
  if (res.headersSent) return;
  res.status(500).json({ error: 'The server could not complete this request.' });
});

await initializeDatabase();
app.listen(PORT, () => {
  console.log(`WardLens API listening on port ${PORT}`);
});
