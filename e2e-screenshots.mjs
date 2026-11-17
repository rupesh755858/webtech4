/**
 * Browser walk-through of the running server: submits an invalid form, then a
 * valid one, and saves screenshots for the report.
 * Run with:  node e2e-screenshots.mjs
 */
import puppeteer from 'puppeteer-core';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { createApp } from './src/app.js';

const PORT = 4599;
const BASE = `http://127.0.0.1:${PORT}`;
const SHOTS = path.join(process.cwd(), 'docs');
await mkdir(SHOTS, { recursive: true });

const app = createApp({ logRequests: false });
const server = app.listen(PORT);
await new Promise((resolve) => server.once('listening', resolve));

const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/chromium',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1360, height: 1100 },
});

const page = await browser.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

const setDate = (id, value) =>
  page.evaluate(
    (fieldId, iso) => {
      const el = document.getElementById(fieldId);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      setter.call(el, iso);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    },
    id,
    value,
  );

const iso = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/* 1. empty submit -> server responds 400 with errors ------------------ */
await page.goto(`${BASE}/apply`, { waitUntil: 'networkidle2' });
await page.click('button[type="submit"]');
await page.waitForSelector('.alert');
const status1 = await page.evaluate(() => document.querySelector('.alert').textContent.replace(/\s+/g, ' ').trim());
console.log('400 page alert:', status1.slice(0, 110));
await page.screenshot({ path: path.join(SHOTS, 'screenshot-validation-errors.png'), fullPage: true });

/* 2. a partially wrong submission keeps the input -------------------- */
await page.goto(`${BASE}/apply`, { waitUntil: 'networkidle2' });
await page.type('#fullName', 'Nilesh Patil');
await page.type('#email', 'nilesh@');
await page.type('#phone', '1234567890');
await setDate('dob', '1992-04-18');
await page.click('button[type="submit"]');
await page.waitForSelector('.alert');
const kept = await page.$eval('#fullName', (el) => el.value);
console.log('input preserved after 400:', kept);

/* 3. valid submission -> 303 redirect -> confirmation page ----------- */
await page.goto(`${BASE}/apply`, { waitUntil: 'networkidle2' });
await page.type('#fullName', 'Nilesh Patil');
await page.type('#email', 'nilesh.nanapatil@gmail.com');
await page.type('#phone', '+91 98765 43210');
await setDate('dob', '1992-04-18');
await page.evaluate(() => {
  document.querySelector('input[name="gender"][value="male"]').checked = true;
  document.querySelector('input[name="relocate"][value="yes"]').checked = true;
  for (const id of ['javascript', 'react', 'nodejs']) {
    document.querySelector(`input[name="skills"][value="${id}"]`).checked = true;
  }
  document.querySelector('#consent').checked = true;
});
await page.select('#position', 'frontend');
await page.type('#experienceYears', '4');
await page.type('#expectedCtc', '12.5');
await page.type('#portfolioUrl', 'https://github.com/nilesh-patil');
await page.type(
  '#coverLetter',
  'I have spent four years building React dashboards used by 40,000 shopkeepers across Maharashtra, and I led the rewrite of our design system.',
);
await setDate('availableFrom', iso(21));
await page.click('button[type="submit"]');
await page.waitForSelector('.success', { timeout: 8000 });
const confirmation = await page.evaluate(() => document.querySelector('.success').textContent.replace(/\s+/g, ' ').trim());
console.log('success banner:', confirmation.slice(0, 120));
const reference = await page.$eval('.mono', (el) => el.textContent.trim());
console.log('booking reference:', reference);
await page.screenshot({ path: path.join(SHOTS, 'screenshot-success.png'), fullPage: true });

/* 4. the record appears in the applications table -------------------- */
await page.goto(`${BASE}/applications`, { waitUntil: 'networkidle2' });
const rows = await page.$$eval('tbody tr', (els) => els.length);
console.log('rows in /applications:', rows);
await page.screenshot({ path: path.join(SHOTS, 'screenshot-applications.png'), fullPage: true });

/* 5. a 404 page ------------------------------------------------------ */
await page.goto(`${BASE}/does-not-exist`, { waitUntil: 'networkidle2' });
console.log('404 title:', await page.title());

console.log('page errors:', errors.length);
await browser.close();
server.close();
process.exit(0);
