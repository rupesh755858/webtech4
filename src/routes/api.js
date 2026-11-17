/**
 * JSON API routes - the same validation rules, a different representation.
 * Request bodies arrive as JSON (express.json) and responses use status codes:
 *   200 OK, 201 Created, 400 Bad Request, 404 Not Found.
 */
import { Router } from 'express';

import { GENDERS, POSITIONS, SKILLS } from '../lib/positions.js';
import { isValid, validateApplication } from '../lib/validators.js';
import { createApplication, getApplication, listApplications } from '../lib/store.js';

const router = Router();

/** GET /api/positions - reference data the form is built from. */
router.get('/positions', (req, res) => {
  res.json({ ok: true, count: POSITIONS.length, data: POSITIONS, skills: SKILLS, genders: GENDERS });
});

/** POST /api/validate - check an application without saving it. */
router.post('/validate', (req, res) => {
  const { values, errors, data } = validateApplication(req.body || {});
  if (!isValid(errors)) {
    return res.status(400).json({ ok: false, valid: false, errorCount: Object.keys(errors).length, errors, values });
  }
  return res.json({ ok: true, valid: true, errors: {}, data });
});

/** GET /api/applications - all received applications as JSON. */
router.get('/applications', async (req, res, next) => {
  try {
    const applications = await listApplications();
    res.json({ ok: true, count: applications.length, data: applications });
  } catch (error) {
    next(error);
  }
});

/** GET /api/applications/:id - one application as JSON. */
router.get('/applications/:id', async (req, res, next) => {
  try {
    const application = await getApplication(req.params.id);
    if (!application) return res.status(404).json({ ok: false, error: 'Application not found' });
    return res.json({ ok: true, data: application });
  } catch (error) {
    return next(error);
  }
});

/** POST /api/applications - create an application from a JSON body. */
router.post('/applications', async (req, res, next) => {
  const { errors, data } = validateApplication(req.body || {});
  if (!isValid(errors)) {
    return res.status(400).json({ ok: false, error: 'Validation failed', errors });
  }
  try {
    const application = await createApplication(data);
    return res
      .status(201)
      .location(`/applications/${application.id}`)
      .json({ ok: true, id: application.id, data: application });
  } catch (error) {
    return next(error);
  }
});

export default router;
