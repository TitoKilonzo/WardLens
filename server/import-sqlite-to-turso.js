import 'dotenv/config';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { adminEmail, db, initializeDatabase } from './db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceValue = process.env.DATABASE_PATH || './data/wardlens.sqlite';
const sourcePath = path.isAbsolute(sourceValue) ? sourceValue : path.resolve(here, '..', sourceValue);
const tables = ['wards', 'users', 'projects', 'votes', 'milestones', 'feedback', 'budget_records', 'contact_messages', 'audit_logs'];

if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN before importing.');
}
if (!process.env.ADMIN_EMAIL?.trim() || !process.env.ADMIN_PASSWORD?.trim()) {
  throw new Error('Set a unique ADMIN_EMAIL and ADMIN_PASSWORD before importing.');
}
if (!fs.existsSync(sourcePath)) {
  throw new Error(`SQLite source database does not exist: ${sourcePath}`);
}

const source = new Database(sourcePath, { readonly: true, fileMustExist: true });

try {
  await initializeDatabase({ seed: false });

  for (const table of tables) {
    const existing = await db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
    if (Number(existing.count) !== 0) {
      throw new Error(`Target Turso table "${table}" is not empty. Import only into a fresh Turso database.`);
    }
  }

  const imported = {};
  const demoEmails = new Set(['resident@wardlens.com', 'officer@wardlens.com', 'oversight@wardlens.com']);
  await db.transaction(async (tx) => {
    for (const table of tables) {
      const records = source.prepare(`SELECT * FROM ${table}`).all();
      imported[table] = records.length;
      if (!records.length) continue;
      const columns = Object.keys(records[0]);
      const placeholders = columns.map(() => '?').join(',');
      const sql = `INSERT INTO ${table}(${columns.join(',')}) VALUES(${placeholders})`;
      for (let offset = 0; offset < records.length; offset += 100) {
        const statements = records.slice(offset, offset + 100).map((record) => {
          if (table === 'users') {
            const email = String(record.email).toLowerCase();
            if (email === 'admin@wardlens.com') {
              record.email = adminEmail;
              record.password_hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
            } else if (demoEmails.has(email)) {
              record.password_hash = bcrypt.hashSync(randomBytes(32).toString('hex'), 10);
            }
          }
          return { sql, args: columns.map((column) => record[column] ?? null) };
        });
        await tx.batch(statements);
      }
    }
  });

  await initializeDatabase({ developmentUsers: false });
  console.log('SQLite records imported into Turso:', imported);
} finally {
  source.close();
  await db.close();
}
