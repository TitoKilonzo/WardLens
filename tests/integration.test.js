import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const port = 4197;
const apiBase = `http://127.0.0.1:${port}/api`;
const dbPath = path.resolve('data/test-wardlens.sqlite');
let server;
let residentToken = '';
let adminToken = '';

before(async () => {
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch { /* nothing to clean */ } }
  server = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, PORT: String(port), DATABASE_PATH: './data/test-wardlens.sqlite', TURSO_DATABASE_URL: '', TURSO_AUTH_TOKEN: '', JWT_SECRET: 'test-secret-for-integration-tests-only', ADMIN_EMAIL:'test-admin@example.com', ADMIN_PASSWORD:'TestingAdmin123!', RESIDENT_EMAIL:'test-resident@example.com', RESIDENT_PASSWORD:'TestingResident123!', DEMO_LOGINS_ENABLED:'true', DEMO_RESIDENT_EMAIL:'hosted-demo-resident@example.com', DEMO_RESIDENT_PASSWORD:'HostedDemoResident123!', DEMO_OFFICER_EMAIL:'hosted-demo-officer@example.com', DEMO_OFFICER_PASSWORD:'HostedDemoOfficer123!', DEMO_OVERSIGHT_EMAIL:'hosted-demo-oversight@example.com', DEMO_OVERSIGHT_PASSWORD:'HostedDemoOversight123!', CORS_ORIGIN: `http://localhost:${port}/` }, stdio: 'ignore' });
  let ready = false;
  for (let i=0; i<100; i++) {
    try { const r = await fetch(`${apiBase}/health`); if (r.ok) { ready = true; break; } } catch { /* server is starting */ }
    await delay(100);
  }
  assert.equal(ready, true, 'API server should start for integration tests');
  const residentResponse = await fetch(`${apiBase}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'test-resident@example.com',password:'TestingResident123!'}) });
  assert.equal(residentResponse.status,200);
  residentToken = (await residentResponse.json()).token;
  const adminResponse = await fetch(`${apiBase}/auth/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'test-admin@example.com',password:'TestingAdmin123!'}) });
  assert.equal(adminResponse.status,200);
  adminToken = (await adminResponse.json()).token;
});

after(async () => {
  if (server && !server.killed) { server.kill('SIGTERM'); await delay(200); }
  for (const suffix of ['', '-wal', '-shm']) { try { fs.unlinkSync(dbPath + suffix); } catch { /* nothing to clean */ } }
});

test('health endpoint returns the service state', async () => {
  const response = await fetch(`${apiBase}/health`, { headers: { Origin: `http://localhost:${port}` } });
  assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'), `http://localhost:${port}`);
  assert.equal((await response.json()).status,'ok');
});

test('sign-in role must match the authenticated account role', async () => {
  const mismatch = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-admin@example.com', password: 'TestingAdmin123!', role: 'resident' })
  });
  assert.equal(mismatch.status, 403);

  const match = await fetch(`${apiBase}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-admin@example.com', password: 'TestingAdmin123!', role: 'admin' })
  });
  assert.equal(match.status, 200);
  assert.equal((await match.json()).user.role, 'admin');
});

test('configured demonstration accounts can sign in with their assigned roles', async () => {
  const accounts = [
    { email: 'hosted-demo-resident@example.com', password: 'HostedDemoResident123!', role: 'resident' },
    { email: 'hosted-demo-officer@example.com', password: 'HostedDemoOfficer123!', role: 'officer' },
    { email: 'hosted-demo-oversight@example.com', password: 'HostedDemoOversight123!', role: 'oversight' }
  ];
  for (const account of accounts) {
    const response = await fetch(`${apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account)
    });
    assert.equal(response.status, 200, `${account.role} demonstration account should sign in`);
    assert.equal((await response.json()).user.role, account.role);
  }
});

test('public project listing contains the seeded demonstration projects', async () => {
  const response = await fetch(`${apiBase}/projects`);
  assert.equal(response.status,200);
  const body = await response.json();
  assert.ok(body.projects.length >= 5);
  assert.ok(body.projects.some((p) => p.title === 'Central Market Clean Water Point'));
});

test('ward, project-detail and dashboard routes return database-backed data', async () => {
  const wardsResponse = await fetch(`${apiBase}/wards`);
  assert.equal(wardsResponse.status, 200);
  assert.ok((await wardsResponse.json()).wards.some((ward) => ward.slug === 'central-ward'));

  const wardResponse = await fetch(`${apiBase}/wards/central-ward`);
  assert.equal(wardResponse.status, 200);
  assert.ok((await wardResponse.json()).projects.length > 0);

  const projectResponse = await fetch(`${apiBase}/projects/1`);
  assert.equal(projectResponse.status, 200);
  assert.equal((await projectResponse.json()).project.id, 1);

  const statsResponse = await fetch(`${apiBase}/admin/stats`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(statsResponse.status, 200);
  assert.ok((await statsResponse.json()).stats.projects >= 6);

  const dashboardResponse = await fetch(`${apiBase}/dashboard`, { headers: { Authorization: `Bearer ${residentToken}` } });
  assert.equal(dashboardResponse.status, 200);
  assert.ok(Array.isArray((await dashboardResponse.json()).proposals));
});

test('resident can submit a proposal and vote only once', async () => {
  const proposalResponse = await fetch(`${apiBase}/projects`, { method:'POST', headers:{Authorization:`Bearer ${residentToken}`,'Content-Type':'application/json'}, body:JSON.stringify({title:'Test community water access point',description:'Residents need a reliable access point for drinking water near the main community walking route.',category:'Water & sanitation',ward_id:1,estimated_cost:750000,location:'North end of Central Ward'}) });
  assert.equal(proposalResponse.status,201);
  const project = (await proposalResponse.json()).project;
  const voteResponse = await fetch(`${apiBase}/projects/${project.id}/vote`, { method:'POST', headers:{Authorization:`Bearer ${residentToken}`} });
  assert.equal(voteResponse.status,201);
  const duplicateVote = await fetch(`${apiBase}/projects/${project.id}/vote`, { method:'POST', headers:{Authorization:`Bearer ${residentToken}`} });
  assert.equal(duplicateVote.status,409);
});

test('management routes enforce role-based permissions', async () => {
  const blocked = await fetch(`${apiBase}/admin/projects`);
  assert.equal(blocked.status,401);
  const residentBlocked = await fetch(`${apiBase}/admin/projects`, { headers:{Authorization:`Bearer ${residentToken}`} });
  assert.equal(residentBlocked.status,403);
  const adminAllowed = await fetch(`${apiBase}/admin/projects`, { headers:{Authorization:`Bearer ${adminToken}`} });
  assert.equal(adminAllowed.status,200);
});

test('contact form stores a valid message for the management inbox', async () => {
  const response = await fetch(`${apiBase}/contact`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:'Test Contact',email:'hello@example.com',topic:'General question',message:'This is an integration test message.'}) });
  assert.equal(response.status,201);
  const inbox = await fetch(`${apiBase}/admin/contact-messages`, { headers:{Authorization:`Bearer ${adminToken}`} });
  assert.equal(inbox.status,200);
  const body = await inbox.json();
  assert.ok(body.messages.some((m) => m.email === 'hello@example.com'));
});


test('authorized management can publish a financial record transactionally', async () => {
  const beforeResponse = await fetch(`${apiBase}/projects/3`);
  assert.equal(beforeResponse.status, 200);
  const before = (await beforeResponse.json()).project.approved_budget;
  const response = await fetch(`${apiBase}/admin/projects/3/budget-records`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'allocation', amount: 12345, description: 'Integration test allocation', reference: 'TEST-ALLOC-001' })
  });
  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.project.approved_budget, before + 12345);
  const recordsResponse = await fetch(`${apiBase}/budgets`);
  assert.equal(recordsResponse.status, 200);
  const records = (await recordsResponse.json()).records;
  assert.ok(records.some((record) => record.reference === 'TEST-ALLOC-001'));
});
