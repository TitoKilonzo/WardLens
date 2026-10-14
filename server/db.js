import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  const missing = ['JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'CORS_ORIGIN']
    .filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET === 'dev-only-change-this-secret-before-deployment') {
    throw new Error('JWT_SECRET must be replaced with a unique production secret.');
  }
  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => !origin || origin === '*' || origin.includes('localhost'))) {
    throw new Error('CORS_ORIGIN must contain only explicit hosted frontend origins in production.');
  }
}
const configuredPath = process.env.DATABASE_PATH || './data/wardlens.sqlite';
const dbPath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(here, '..', configuredPath);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS wards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  county TEXT NOT NULL DEFAULT 'WardLens County',
  population INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'resident' CHECK(role IN ('resident','officer','admin','oversight')),
  ward_id INTEGER REFERENCES wards(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed' CHECK(status IN ('proposed','under_review','approved','rejected','funded','in_progress','under_verification','completed','paused')),
  ward_id INTEGER NOT NULL REFERENCES wards(id),
  proposed_by INTEGER REFERENCES users(id),
  estimated_cost REAL NOT NULL DEFAULT 0,
  approved_budget REAL NOT NULL DEFAULT 0,
  spent_amount REAL NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  location TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decision_note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, user_id)
);
CREATE TABLE IF NOT EXISTS milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','completed','delayed')),
  due_date TEXT,
  evidence_url TEXT NOT NULL DEFAULT '',
  updated_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved')),
  response TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS budget_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('allocation','expenditure','adjustment')),
  amount REAL NOT NULL,
  description TEXT NOT NULL,
  reference TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  recorded_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_review','resolved')),
  response TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_projects_ward_status ON projects(ward_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_project ON feedback(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_budget_project ON budget_records(project_id, created_at DESC);
`);

const wards = [
  ['Central Ward','central-ward',18300,'The county centre, public market and surrounding neighbourhoods.'],
  ['Riverside Ward','riverside-ward',14600,'River-adjacent settlements and community water infrastructure.'],
  ['Greenfields Ward','greenfields-ward',21100,'Growing residential areas, schools and local access roads.'],
  ['Market Ward','market-ward',17200,'Trading centres, market facilities and public sanitation.'],
  ['Hillview Ward','hillview-ward',12800,'Hilly neighbourhoods with drainage and road-access needs.'],
  ['Lakeview Ward','lakeview-ward',15900,'Lake-side communities, lighting and shared public spaces.']
];
const insertWard = db.prepare('INSERT OR IGNORE INTO wards(name,slug,population,description) VALUES(?,?,?,?)');
wards.forEach((w) => insertWard.run(...w));

const legacyDemoDomain = ['wardlens', 'local'].join('.');
function normalizeDemoEmail(value) {
  const email = String(value).trim().toLowerCase();
  const legacySuffix = `@${legacyDemoDomain}`;
  return email.endsWith(legacySuffix)
    ? `${email.slice(0, -legacySuffix.length)}@wardlens.com`
    : email;
}

export const adminEmail = normalizeDemoEmail(process.env.ADMIN_EMAIL || 'admin@wardlens.com');
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
export const residentEmail = normalizeDemoEmail(process.env.RESIDENT_EMAIL || 'resident@wardlens.com');
const residentPassword = process.env.RESIDENT_PASSWORD || 'Resident123!';

// Upgrade seeded demo account emails for an existing SQLite installation.
// If the target address already exists, leave it untouched rather than merging two accounts.
const demoEmailMigrations = [
  [`admin@${legacyDemoDomain}`, adminEmail],
  [`resident@${legacyDemoDomain}`, residentEmail],
  [`officer@${legacyDemoDomain}`, 'officer@wardlens.com'],
  [`oversight@${legacyDemoDomain}`, 'oversight@wardlens.com']
];
const migrateDemoEmails = db.transaction(() => {
  const findUser = db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE');
  const updateEmail = db.prepare('UPDATE users SET email = ? WHERE id = ?');
  for (const [oldEmail, newEmail] of demoEmailMigrations) {
    if (oldEmail.toLowerCase() === newEmail.toLowerCase()) continue;
    const oldUser = findUser.get(oldEmail);
    if (!oldUser || findUser.get(newEmail)) continue;
    updateEmail.run(newEmail, oldUser.id);
  }
});
migrateDemoEmails();

const insertUser = db.prepare('INSERT OR IGNORE INTO users(name,email,password_hash,role,ward_id) VALUES(?,?,?,?,?)');
insertUser.run('WardLens Administrator', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin', 1);
if (!isProduction) {
  insertUser.run('Amina Njeri', residentEmail, bcrypt.hashSync(residentPassword, 10), 'resident', 1);
  insertUser.run('County Project Officer', 'officer@wardlens.com', bcrypt.hashSync('Officer123!', 10), 'officer', 1);
  insertUser.run('Public Finance Reviewer', 'oversight@wardlens.com', bcrypt.hashSync('Oversight123!', 10), 'oversight', 1);
}

const projectCount = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
if (projectCount === 0) {
  const residentId = db.prepare('SELECT id FROM users WHERE email = ?').get(residentEmail)?.id ?? null;
  const sampleProjects = [
    { title:'Central Market Clean Water Point', slug:'central-market-clean-water-point', description:'Install a reliable community water point with accessible taps, drainage and a maintenance plan for vendors and nearby residents.', category:'Water & sanitation', status:'in_progress', ward:1, cost:2850000, budget:2600000, spent:1480000, progress:58, location:'Central Market, Central Ward', image:'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=85' },
    { title:'Greenfields Primary School Sanitation Block', slug:'greenfields-primary-sanitation-block', description:'Construct a durable, accessible sanitation block for learners, including handwashing points and safe water storage.', category:'Education', status:'funded', ward:3, cost:4100000, budget:3900000, spent:620000, progress:16, location:'Greenfields Primary School', image:'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=85' },
    { title:'Riverside Access Road Drainage', slug:'riverside-access-road-drainage', description:'Repair blocked drainage and improve a flood-prone access road used by residents, students and local businesses.', category:'Roads & drainage', status:'approved', ward:2, cost:5700000, budget:0, spent:0, progress:0, location:'Riverside access road', image:'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85' },
    { title:'Market Ward Solar Streetlights', slug:'market-ward-solar-streetlights', description:'Install solar streetlights around the trading centre and bus stage to improve public-space visibility after dark.', category:'Energy & lighting', status:'under_review', ward:4, cost:1850000, budget:0, spent:0, progress:0, location:'Market Ward trading centre', image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85' },
    { title:'Hillview Community Footbridge', slug:'hillview-community-footbridge', description:'Replace a damaged foot crossing with a safe, accessible bridge and protective railings for the nearby community.', category:'Roads & drainage', status:'proposed', ward:5, cost:3200000, budget:0, spent:0, progress:0, location:'Hillview stream crossing', image:'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=85' },
    { title:'Lakeview Recreation Green', slug:'lakeview-recreation-green', description:'Rehabilitate a neighbourhood green with trees, seating, refuse bins and a clearly defined maintenance schedule.', category:'Parks & public spaces', status:'completed', ward:6, cost:1250000, budget:1200000, spent:1175000, progress:100, location:'Lakeview community grounds', image:'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1200&q=85' }
  ];
  const addProject = db.prepare(`INSERT INTO projects(title,slug,description,category,status,ward_id,proposed_by,estimated_cost,approved_budget,spent_amount,progress,location,image_url) VALUES(@title,@slug,@description,@category,@status,@ward,@residentId,@cost,@budget,@spent,@progress,@location,@image)`);
  const addBudget = db.prepare('INSERT INTO budget_records(project_id,kind,amount,description,reference) VALUES(?,?,?,?,?)');
  const addMilestone = db.prepare('INSERT INTO milestones(project_id,title,description,status,due_date,evidence_url) VALUES(?,?,?,?,?,?)');
  const seedAll = db.transaction(() => {
    for (const p of sampleProjects) {
      const result = addProject.run({ ...p, residentId });
      const id = Number(result.lastInsertRowid);
      if (p.budget > 0) addBudget.run(id, 'allocation', p.budget, 'Approved project allocation', `ALLOC-${String(id).padStart(4,'0')}`);
      if (p.spent > 0) addBudget.run(id, 'expenditure', p.spent, 'Published cumulative expenditure', `EXP-${String(id).padStart(4,'0')}`);
      if (p.status !== 'proposed' && p.status !== 'under_review') {
        addMilestone.run(id, 'Planning and community consultation', 'Initial scope and community needs recorded.', 'completed', null, '');
        addMilestone.run(id, 'Procurement and mobilization', 'Procurement and site preparation activities.', p.progress > 0 ? 'completed' : 'planned', null, '');
        addMilestone.run(id, 'Implementation and inspection', 'Delivery and quality checks for the approved scope.', p.progress === 100 ? 'completed' : p.progress > 0 ? 'in_progress' : 'planned', null, '');
      }
    }
  });
  seedAll();
}

export function audit(userId, action, entityType, entityId = null, details = {}) {
  db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)')
    .run(userId ?? null, action, entityType, entityId, JSON.stringify(details));
}

export function publicProject(row, userId = null) {
  if (!row) return null;
  const votes = db.prepare('SELECT COUNT(*) AS count FROM votes WHERE project_id=?').get(row.id).count;
  const voted = userId ? Boolean(db.prepare('SELECT 1 FROM votes WHERE project_id=? AND user_id=?').get(row.id, userId)) : false;
  return { ...row, vote_count: votes, has_voted: voted, ward_name: row.ward_name ?? '' };
}
