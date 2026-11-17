/**
 * HTML routes: GET serves pages, POST processes the form.
 * Every response is rendered by the server (EJS) - no client-side JavaScript
 * is required for the validation to work.
 */
import { Router } from 'express';

import { GENDERS, POSITIONS, SKILLS, positionById } from '../lib/positions.js';
import {
  FIELD_LABELS,
  FIELD_ORDER,
  emptyApplication,
  isValid,
  validateApplication,
} from '../lib/validators.js';
import { createApplication, getApplication, listApplications } from '../lib/store.js';

const router = Router();

/** Shared locals for the application form (used by GET and by a failed POST). */
function formLocals({ values, errors }) {
  return {
    title: 'Apply',
    positions: POSITIONS,
    skills: SKILLS,
    genders: GENDERS,
    values,
    errors,
    fieldLabels: FIELD_LABELS,
    fieldOrder: FIELD_ORDER,
    errorCount: Object.keys(errors).length,
  };
}

/* GET / - landing page ------------------------------------------------ */
router.get('/', async (req, res, next) => {
  try {
    const applications = await listApplications();
    res.render('home', {
      title: 'Careers',
      positions: POSITIONS,
      applicationCount: applications.length,
    });
  } catch (error) {
    next(error);
  }
});

/* GET /apply - show an empty form ------------------------------------- */
router.get('/apply', (req, res) => {
  res.render('apply', formLocals({ values: emptyApplication(), errors: {} }));
});

/* POST /apply - validate, then redirect or re-render with errors ------- */
router.post('/apply', async (req, res, next) => {
  const { values, errors, data } = validateApplication(req.body);

  if (!isValid(errors)) {
    // 400 Bad Request + the form again, with the applicant's input intact.
    return res.status(400).render('apply', formLocals({ values, errors }));
  }

  try {
    const application = await createApplication(data);
    // Post/Redirect/Get: the browser is sent to a GET page, so pressing
    // refresh cannot submit the same application twice.
    return res.redirect(303, `/applications/${application.id}?submitted=1`);
  } catch (error) {
    return next(error);
  }
});

/* GET /applications - list of received applications -------------------- */
router.get('/applications', async (req, res, next) => {
  try {
    const applications = await listApplications();
    res.render('applications', {
      title: 'Applications',
      applications,
      positionById,
    });
  } catch (error) {
    next(error);
  }
});

/* GET /applications/:id - confirmation / detail page ------------------- */
router.get('/applications/:id', async (req, res, next) => {
  try {
    const application = await getApplication(req.params.id);
    if (!application) {
      return res.status(404).render('404', { title: 'Application not found' });
    }
    return res.render('application', {
      title: `Application ${application.id}`,
      application,
      justSubmitted: req.query.submitted === '1',
      positionById,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
