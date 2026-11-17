/**
 * Tiny JSON-file data store (demonstrates the node:fs/promises module).
 *
 * Applications are kept in an array on disk so they survive a server restart.
 * Writes are serialised through a promise queue: two applicants submitting at
 * the same moment cannot overwrite each other's record.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/** Resolved on every call so tests can point DATA_FILE at a temp file. */
function dataFile() {
  return process.env.DATA_FILE || path.join(process.cwd(), 'data', 'applications.json');
}

let queue = Promise.resolve();

function serialise(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {}); // never let one failure poison the queue
  return run;
}

async function readAll() {
  try {
    const raw = await readFile(dataFile(), 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return []; // first run: no file yet
    throw error;
  }
}

async function writeAll(list) {
  const file = dataFile();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(list, null, 2)}\n`, 'utf8');
}

/** APP-2611-4F2A style reference number. */
export function makeApplicationId(now = new Date()) {
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `APP-${yy}${mm}-${randomUUID().slice(0, 4).toUpperCase()}`;
}

export function createApplication(data) {
  return serialise(async () => {
    const list = await readAll();
    const now = new Date();
    const application = {
      id: makeApplicationId(now),
      createdAt: now.toISOString(),
      status: 'received',
      ...data,
    };
    list.unshift(application);
    await writeAll(list);
    return application;
  });
}

export function listApplications() {
  return serialise(() => readAll());
}

export async function getApplication(id) {
  const list = await listApplications();
  return list.find((application) => application.id === id) || null;
}

export function countApplications() {
  return serialise(async () => (await readAll()).length);
}
