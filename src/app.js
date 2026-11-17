/**
 * Express application factory.
 *
 * Kept separate from server.js so the app can be imported by the test suite
 * without opening a network port (see tests/api.test.js).
 */
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pagesRouter from './routes/pages.js';
import apiRouter from './routes/api.js';
import { GENDERS, POSITIONS, SKILLS, genderLabel, positionById, skillLabels } from './lib/positions.js';
import { formatCtc, formatDate, formatPhone } from './lib/validators.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');

export function createApp({ logRequests = true } = {}) {
  const app = express();

  // ---- view engine & static assets -------------------------------------
  app.set('view engine', 'ejs');
  app.set('views', path.join(here, 'views'));
  app.disable('x-powered-by');
  app.use(express.static(path.join(ROOT, 'public'), { maxAge: '1h' }));

  // ---- request body parsers --------------------------------------------
  // HTML forms arrive as application/x-www-form-urlencoded,
  // JSON clients (and the /api routes) arrive as application/json.
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(express.json({ limit: '100kb' }));

  // ---- tiny request logger (a custom middleware) -----------------------
  if (logRequests) {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on('finish', () => {
        console.log(
          `${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started} ms)`,
        );
      });
      next();
    });
  }

  // ---- values available to every view ----------------------------------
  app.use((req, res, next) => {
    res.locals.appName = 'TalentBridge';
    res.locals.company = 'Nimbus Analytics Pvt. Ltd.';
    res.locals.currentPath = req.path;
    res.locals.openPositions = POSITIONS.length;
    // View helpers, so templates stay free of formatting logic.
    res.locals.positions = POSITIONS;
    res.locals.skills = SKILLS;
    res.locals.genders = GENDERS;
    res.locals.positionById = positionById;
    res.locals.skillLabels = skillLabels;
    res.locals.genderLabel = genderLabel;
    res.locals.formatDate = formatDate;
    res.locals.formatPhone = formatPhone;
    res.locals.formatCtc = formatCtc;
    next();
  });

  // ---- routes ----------------------------------------------------------
  app.use('/', pagesRouter);
  app.use('/api', apiRouter);

  // ---- 404 handler: reached only when no route matched ------------------
  app.use((req, res) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ ok: false, error: 'Endpoint not found' });
    }
    return res.status(404).render('404', { title: 'Page not found' });
  });

  // ---- central error handler (4 arguments = Express error middleware) ---
  app.use((err, req, res, next) => {
    console.error('[error]', err.message);
    const status = err.status || 500;
    const message =
      status === 500 ? 'Something went wrong on our side. Please try again.' : err.message;

    if (req.path.startsWith('/api')) {
      return res.status(status).json({ ok: false, error: message });
    }
    return res.status(status).render('error', { title: 'Error', status, message });
  });

  return app;
}
