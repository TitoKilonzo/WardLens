import { AsyncLocalStorage } from 'node:async_hooks';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === 'production';
const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();
const tursoAuthToken = process.env.TURSO_AUTH_TOKEN?.trim();
const useTurso = Boolean(tursoUrl || tursoAuthToken);

if (Boolean(tursoUrl) !== Boolean(tursoAuthToken)) {
  throw new Error('Configure both TURSO_DATABASE_URL and TURSO_AUTH_TOKEN to use Turso.');
}
if (isProduction) {
  const required = ['JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD', 'CORS_ORIGIN', 'TURSO_DATABASE_URL', 'TURSO_AUTH_TOKEN'];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length) throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  if (process.env.JWT_SECRET === 'dev-only-change-this-secret-before-deployment') {
    throw new Error('JWT_SECRET must be replaced with a unique production secret.');
  }
  const origins = process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim());
  if (origins.some((origin) => !origin || origin === '*' || origin.includes('localhost'))) {
    throw new Error('CORS_ORIGIN must contain only explicit hosted frontend origins in production.');
  }
}

const localPathValue = process.env.DATABASE_PATH || './data/wardlens.sqlite';
const localPath = path.isAbsolute(localPathValue) ? localPathValue : path.resolve(here, '..', localPathValue);
const sqlite = useTurso ? null : (() => {
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  return new Database(localPath);
})();
if (sqlite) {
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
}

const remote = useTurso ? createClient({ url: tursoUrl, authToken: tursoAuthToken }) : null;
const transactionStorage = new AsyncLocalStorage();
let localTransactionLock = Promise.resolve();

function normalizeResult(result) {
  return {
    ...(result.lastInsertRowid !== undefined ? { lastInsertRowid: Number(result.lastInsertRowid) } : {}),
    changes: Number(result.rowsAffected ?? result.changes)
  };
}

function prepare(sql, connection = null) {
  return {
    async get(...args) {
      if (connection) {
        const result = await connection.execute({ sql, args });
        return result.rows[0];
      }
      if (remote) {
        const result = await remote.execute({ sql, args });
        return result.rows[0];
      }
      if (!transactionStorage.getStore()) await localTransactionLock;
      return sqlite.prepare(sql).get(...args);
    },
    async all(...args) {
      if (connection) {
        const result = await connection.execute({ sql, args });
        return result.rows;
      }
      if (remote) {
        const result = await remote.execute({ sql, args });
        return result.rows;
      }
      if (!transactionStorage.getStore()) await localTransactionLock;
      return sqlite.prepare(sql).all(...args);
    },
    async run(...args) {
      if (connection) {
        const result = await connection.execute({ sql, args });
        return normalizeResult(result);
      }
      if (remote) {
        const result = await remote.execute({ sql, args });
        return normalizeResult(result);
      }
      if (!transactionStorage.getStore()) await localTransactionLock;
      return sqlite.prepare(sql).run(...args);
    }
  };
}

export const db = {
  prepare,
  async batch(statements) {
    if (!remote) throw new Error('Batch imports require a configured Turso database.');
    return remote.batch(statements, 'write');
  },
  async exec(sql) {
    if (remote) return remote.executeMultiple(sql);
    return sqlite.exec(sql);
  },
  async transaction(callback) {
    if (remote) {
      const transaction = await remote.transaction('write');
      try {
        const result = await callback({
          prepare: (sql) => prepare(sql, transaction),
          batch: (statements) => transaction.batch(statements)
        });
        await transaction.commit();
        return result;
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    }

    let release;
    const previousLock = localTransactionLock;
    localTransactionLock = new Promise((resolve) => { release = resolve; });
    await previousLock;
    sqlite.exec('BEGIN IMMEDIATE');
    try {
      const result = await transactionStorage.run(true, () => callback({
        prepare,
        batch: (statements) => {
          for (const statement of statements) sqlite.prepare(statement.sql).run(...(statement.args || []));
        }
      }));
      sqlite.exec('COMMIT');
      return result;
    } catch (error) {
      sqlite.exec('ROLLBACK');
      throw error;
    } finally {
      release();
    }
  },
  async close() {
    if (remote) return remote.close();
    sqlite.close();
  }
};

export const adminEmail = (process.env.ADMIN_EMAIL || 'admin@wardlens.com').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
export const residentEmail = (process.env.RESIDENT_EMAIL || 'resident@wardlens.com').trim().toLowerCase();
const residentPassword = process.env.RESIDENT_PASSWORD || 'Resident123!';

export const schema = `
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
`;

const wards = [
  ['Central Ward','central-ward',18300,'The county centre, public market and surrounding neighbourhoods.'],
  ['Riverside Ward','riverside-ward',14600,'River-adjacent settlements and community water infrastructure.'],
  ['Greenfields Ward','greenfields-ward',21100,'Growing residential areas, schools and local access roads.'],
  ['Market Ward','market-ward',17200,'Trading centres, market facilities and public sanitation.'],
  ['Hillview Ward','hillview-ward',12800,'Hilly neighbourhoods with drainage and road-access needs.'],
  ['Lakeview Ward','lakeview-ward',15900,'Lake-side communities, lighting and shared public spaces.']
];

const sampleProjects = [
  { title:'Central Market Clean Water Point', slug:'central-market-clean-water-point', description:'Install a reliable community water point with accessible taps, drainage and a maintenance plan for vendors and nearby residents.', category:'Water & sanitation', status:'in_progress', ward:1, cost:2850000, budget:2600000, spent:1480000, progress:58, location:'Central Market, Central Ward', image:'https://images.unsplash.com/photo-1541544741938-0af808871cc0?auto=format&fit=crop&w=1200&q=85' },
  { title:'Greenfields Primary School Sanitation Block', slug:'greenfields-primary-sanitation-block', description:'Construct a durable, accessible sanitation block for learners, including handwashing points and safe water storage.', category:'Education', status:'funded', ward:3, cost:4100000, budget:3900000, spent:620000, progress:16, location:'Greenfields Primary School', image:'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=85' },
  { title:'Riverside Access Road Drainage', slug:'riverside-access-road-drainage', description:'Repair blocked drainage and improve a flood-prone access road used by residents, students and local businesses.', category:'Roads & drainage', status:'approved', ward:2, cost:5700000, budget:0, spent:0, progress:0, location:'Riverside access road', image:'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=85' },
  { title:'Market Ward Solar Streetlights', slug:'market-ward-solar-streetlights', description:'Install solar streetlights around the trading centre and bus stage to improve public-space visibility after dark.', category:'Energy & lighting', status:'under_review', ward:4, cost:1850000, budget:0, spent:0, progress:0, location:'Market Ward trading centre', image:'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=85' },
  { title:'Hillview Community Footbridge', slug:'hillview-community-footbridge', description:'Replace a damaged foot crossing with a safe, accessible bridge and protective railings for the nearby community.', category:'Roads & drainage', status:'proposed', ward:5, cost:3200000, budget:0, spent:0, progress:0, location:'Hillview stream crossing', image:'https://images.unsplash.com/photo-1449158743715-0a90ebb6d2d8?auto=format&fit=crop&w=1200&q=85' },
  { title:'Lakeview Recreation Green', slug:'lakeview-recreation-green', description:'Rehabilitate a neighbourhood green with trees, seating, refuse bins and a clearly defined maintenance schedule.', category:'Parks & public spaces', status:'completed', ward:6, cost:1250000, budget:1200000, spent:1175000, progress:100, location:'Lakeview community grounds', image:'https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=1200&q=85' }
];

export async function initializeDatabase({ seed = true, developmentUsers = !isProduction } = {}) {
  if (remote) await remote.executeMultiple(schema);
  else await db.exec(schema);
  if (!seed) return;

  for (const [name, slug, population, description] of wards) {
    await db.prepare('INSERT OR IGNORE INTO wards(name,slug,population,description) VALUES(?,?,?,?)').run(name, slug, population, description);
  }

  const demoEmailDomain = ['wardlens', 'local'].join('.');
  const emailMigrations = [
    [`admin@${demoEmailDomain}`, adminEmail],
    [`resident@${demoEmailDomain}`, residentEmail],
    [`officer@${demoEmailDomain}`, 'officer@wardlens.com'],
    [`oversight@${demoEmailDomain}`, 'oversight@wardlens.com']
  ];
  await db.transaction(async (tx) => {
    for (const [oldEmail, newEmail] of emailMigrations) {
      if (oldEmail.toLowerCase() === newEmail.toLowerCase()) continue;
      const oldUser = await tx.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').get(oldEmail);
      const newUser = await tx.prepare('SELECT id FROM users WHERE email=? COLLATE NOCASE').get(newEmail);
      if (oldUser && !newUser) await tx.prepare('UPDATE users SET email=? WHERE id=?').run(newEmail, oldUser.id);
    }
  });

  const insertUser = db.prepare('INSERT OR IGNORE INTO users(name,email,password_hash,role,ward_id) VALUES(?,?,?,?,?)');
  await insertUser.run('WardLens Administrator', adminEmail, bcrypt.hashSync(adminPassword, 10), 'admin', 1);
  if (developmentUsers) {
    await insertUser.run('Amina Njeri', residentEmail, bcrypt.hashSync(residentPassword, 10), 'resident', 1);
    await insertUser.run('County Project Officer', 'officer@wardlens.com', bcrypt.hashSync('Officer123!', 10), 'officer', 1);
    await insertUser.run('Public Finance Reviewer', 'oversight@wardlens.com', bcrypt.hashSync('Oversight123!', 10), 'oversight', 1);
  }

  await db.transaction(async (tx) => {
    const projectCount = (await tx.prepare('SELECT COUNT(*) AS count FROM projects').get()).count;
    if (Number(projectCount) !== 0) return;
    const resident = await tx.prepare('SELECT id FROM users WHERE email=?').get(residentEmail);
    for (const project of sampleProjects) {
      const inserted = await tx.prepare(`INSERT INTO projects(title,slug,description,category,status,ward_id,proposed_by,estimated_cost,approved_budget,spent_amount,progress,location,image_url)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        project.title, project.slug, project.description, project.category, project.status, project.ward,
        resident?.id ?? null, project.cost, project.budget, project.spent, project.progress, project.location, project.image
      );
      const id = inserted.lastInsertRowid;
      if (project.budget > 0) {
        await tx.prepare('INSERT INTO budget_records(project_id,kind,amount,description,reference) VALUES(?,?,?,?,?)')
          .run(id, 'allocation', project.budget, 'Approved project allocation', `ALLOC-${String(id).padStart(4,'0')}`);
      }
      if (project.spent > 0) {
        await tx.prepare('INSERT INTO budget_records(project_id,kind,amount,description,reference) VALUES(?,?,?,?,?)')
          .run(id, 'expenditure', project.spent, 'Published cumulative expenditure', `EXP-${String(id).padStart(4,'0')}`);
      }
      if (project.status !== 'proposed' && project.status !== 'under_review') {
        await tx.prepare('INSERT INTO milestones(project_id,title,description,status,due_date,evidence_url) VALUES(?,?,?,?,?,?)')
          .run(id, 'Planning and community consultation', 'Initial scope and community needs recorded.', 'completed', null, '');
        await tx.prepare('INSERT INTO milestones(project_id,title,description,status,due_date,evidence_url) VALUES(?,?,?,?,?,?)')
          .run(id, 'Procurement and mobilization', 'Procurement and site preparation activities.', project.progress > 0 ? 'completed' : 'planned', null, '');
        await tx.prepare('INSERT INTO milestones(project_id,title,description,status,due_date,evidence_url) VALUES(?,?,?,?,?,?)')
          .run(id, 'Implementation and inspection', 'Delivery and quality checks for the approved scope.', project.progress === 100 ? 'completed' : project.progress > 0 ? 'in_progress' : 'planned', null, '');
      }
    }
  });
}

export async function audit(userId, action, entityType, entityId = null, details = {}) {
  await db.prepare('INSERT INTO audit_logs(user_id,action,entity_type,entity_id,details) VALUES(?,?,?,?,?)')
    .run(userId ?? null, action, entityType, entityId, JSON.stringify(details));
}

export async function publicProject(row, userId = null) {
  if (!row) return null;
  const votes = await db.prepare('SELECT COUNT(*) AS count FROM votes WHERE project_id=?').get(row.id);
  const voted = userId ? Boolean(await db.prepare('SELECT 1 FROM votes WHERE project_id=? AND user_id=?').get(row.id, userId)) : false;
  return { ...row, vote_count: Number(votes.count), has_voted: voted, ward_name: row.ward_name ?? '' };
}
