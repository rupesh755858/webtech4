/**
 * Integration tests: real HTTP requests against the Express app (supertest).
 * Covers GET/POST routing, status codes, redirects, rendered messages and the
 * JSON API. No port is opened - supertest talks to the app object directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import request from 'supertest';

// Point the store at a throwaway file BEFORE the app is imported.
const DATA_FILE = path.join(os.tmpdir(), `talentbridge-test-${process.pid}-${Date.now()}.json`);
process.env.DATA_FILE = DATA_FILE;

const { createApp } = await import('../src/app.js');
const app = createApp({ logRequests: false });

/** yyyy-mm-dd, n days from today (local time). */
function iso(daysFromToday = 0) {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

const validForm = () => ({
  fullName: 'Nilesh Patil',
  email: 'nilesh.patil@example.com',
  phone: '9876543210',
  dob: '1992-04-18',
  gender: 'male',
  position: 'frontend',
  experienceYears: '4',
  expectedCtc: '12.5',
  skills: ['javascript', 'react'],
  portfolioUrl: 'https://github.com/nilesh',
  coverLetter: 'I have shipped three React products and led a two-person frontend team.',
  availableFrom: iso(10),
  relocate: 'yes',
  consent: 'on',
});

const validJson = () => ({
  fullName: 'Meera Krishnan',
  email: 'meera.krishnan@example.com',
  phone: '+91 90000 00001',
  dob: '1995-06-02',
  gender: 'female',
  position: 'backend',
  experienceYears: '5',
  expectedCtc: '18',
  skills: ['nodejs', 'express', 'sql'],
  coverLetter: 'I have run Node.js services in production for five years across two fintech teams.',
  availableFrom: iso(20),
  relocate: 'no',
  consent: true,
});

/* --------------------------- GET pages ---------------------------- */
test('GET / renders the landing page with the open roles', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/html/);
  assert.match(res.text, /TalentBridge/);
  assert.match(res.text, /Open positions/);
  assert.match(res.text, /Frontend Engineer \(React\)/);
});

test('GET /apply serves the form with every field and novalidate', async () => {
  const res = await request(app).get('/apply');
  assert.equal(res.status, 200);
  assert.match(res.text, /method="POST" action="\/apply" novalidate/);
  for (const field of ['fullName', 'email', 'phone', 'dob', 'position', 'coverLetter', 'consent']) {
    assert.match(res.text, new RegExp(`name="${field}"`), `missing ${field}`);
  }
  assert.match(res.text, /name="skills"\s+value="javascript"/);
});

test('GET /applications works and shows the empty state first', async () => {
  const res = await request(app).get('/applications');
  assert.equal(res.status, 200);
  assert.match(res.text, /Applications received/);
});

test('an unknown URL returns 404 from the catch-all handler', async () => {
  const res = await request(app).get('/no-such-page');
  assert.equal(res.status, 404);
  assert.match(res.text, /404 — page not found/);
});

/* ----------------------- POST /apply (HTML) ----------------------- */
test('POST /apply with an empty body returns 400 and a summary of errors', async () => {
  const res = await request(app).post('/apply').type('form').send({});
  assert.equal(res.status, 400);
  assert.match(res.text, /Your application was not submitted/);
  assert.match(res.text, /Full name is required\./);
  assert.match(res.text, /Email address is required\./);
  assert.match(res.text, /Mobile number is required\./);
  assert.match(res.text, /12 fields need your attention/);
});

test('POST /apply keeps the applicant input when validation fails', async () => {
  const res = await request(app)
    .post('/apply')
    .type('form')
    .send({ ...validForm(), email: 'nilesh@', phone: '1234567890' });
  assert.equal(res.status, 400);
  assert.match(res.text, /value="Nilesh Patil"/); // input preserved
  assert.match(res.text, /Enter a valid email address/);
  assert.match(res.text, /Mobile number must start with 6, 7, 8 or 9/);
});

test('POST /apply rejects a role/experience mismatch with a specific message', async () => {
  const res = await request(app)
    .post('/apply')
    .type('form')
    .send({ ...validForm(), position: 'backend', experienceYears: '1' });
  assert.equal(res.status, 400);
  assert.match(res.text, /Backend Engineer \(Node\.js\) requires 2-10 years of experience\./);
});

test('POST /apply with valid data saves the record and redirects (303)', async () => {
  const res = await request(app).post('/apply').type('form').send(validForm());
  assert.equal(res.status, 303);
  assert.match(res.headers.location, /^\/applications\/APP-\d{4}-[A-F0-9]{4}\?submitted=1$/);

  const detail = await request(app).get(res.headers.location);
  assert.equal(detail.status, 200);
  assert.match(detail.text, /Application submitted successfully/);
  assert.match(detail.text, /Nilesh Patil/);
  assert.match(detail.text, /₹12\.5 LPA/);
  assert.match(detail.text, /JavaScript/);

  const list = await request(app).get('/applications');
  assert.match(list.text, /Nilesh Patil/);
  assert.match(list.text, /APP-\d{4}-[A-F0-9]{4}/);

  // the record really was written to the JSON file
  const stored = JSON.parse(await readFile(DATA_FILE, 'utf8'));
  assert.ok(Array.isArray(stored) && stored.length >= 1);
  const record = stored.find((entry) => entry.email === 'nilesh.patil@example.com');
  assert.equal(record.experienceYears, 4);
  assert.equal(record.status, 'received');
  assert.deepEqual(record.skills, ['javascript', 'react']);
});

test('GET /applications/:id returns 404 for an unknown reference', async () => {
  const res = await request(app).get('/applications/APP-0000-XXXX');
  assert.equal(res.status, 404);
  assert.match(res.text, /404 — page not found/);
});

/* ----------------------------- JSON API --------------------------- */
test('GET /api/positions returns reference data as JSON', async () => {
  const res = await request(app).get('/api/positions');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.count, 5);
  assert.ok(res.body.skills.some((skill) => skill.id === 'nodejs'));
});

test('POST /api/validate accepts valid JSON with 200', async () => {
  const res = await request(app).post('/api/validate').send(validJson());
  assert.equal(res.status, 200);
  assert.equal(res.body.valid, true);
  assert.deepEqual(res.body.errors, {});
  assert.equal(res.body.data.age, 31);
});

test('POST /api/validate rejects invalid JSON with 400 and field errors', async () => {
  const res = await request(app)
    .post('/api/validate')
    .send({ ...validJson(), email: 'not-an-email', skills: [], consent: '' });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.match(res.body.errors.email, /valid email/i);
  assert.match(res.body.errors.skills, /at least one skill/i);
  assert.match(res.body.errors.consent, /must confirm/i);
  assert.equal(res.body.errorCount, 3);
});

test('POST /api/applications creates a record (201 + Location) and can be read back', async () => {
  const created = await request(app).post('/api/applications').send(validJson());
  assert.equal(created.status, 201);
  assert.equal(created.body.ok, true);
  assert.match(created.headers.location, /^\/applications\/APP-/);

  const one = await request(app).get(`/api/applications/${created.body.id}`);
  assert.equal(one.status, 200);
  assert.equal(one.body.data.email, 'meera.krishnan@example.com');
  assert.equal(one.body.data.positionTitle, 'Backend Engineer (Node.js)');

  const all = await request(app).get('/api/applications');
  assert.equal(all.status, 200);
  assert.ok(all.body.count >= 2);
});

test('POST /api/applications refuses invalid data with 400', async () => {
  const res = await request(app).post('/api/applications').send({ fullName: 'X' });
  assert.equal(res.status, 400);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'Validation failed');
  assert.ok(Object.keys(res.body.errors).length >= 10);
});

test('unknown API endpoints return a JSON 404, not HTML', async () => {
  const res = await request(app).get('/api/nothing-here');
  assert.equal(res.status, 404);
  assert.match(res.headers['content-type'], /application\/json/);
  assert.equal(res.body.ok, false);
});

/* ---------------------------- middleware -------------------------- */
test('static assets are served by express.static', async () => {
  const res = await request(app).get('/styles.css');
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /text\/css/);
});
