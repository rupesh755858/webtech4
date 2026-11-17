/**
 * Server-side validation for the job application form.
 *
 * Every rule lives on the server: the browser is never trusted. Each validator
 * is a pure function that returns `null` when the value is valid, or a
 * human-readable message when it is not.
 *
 * `validateApplication()` returns three things:
 *   values - cleaned strings, sent straight back to the form so the applicant
 *            never loses what they typed
 *   errors - { fieldName: message } for every field that failed
 *   data   - normalised values (numbers, arrays, booleans, ISO dates) that are
 *            safe to store; only meaningful when `errors` is empty
 */
import { GENDERS, POSITIONS, SKILLS, positionById } from './positions.js';

export const LIMITS = {
  nameMin: 3,
  nameMax: 60,
  emailMax: 120,
  coverMin: 50,
  coverMax: 1200,
  expMin: 0,
  expMax: 40,
  ctcMin: 1,
  ctcMax: 100,
  ageMin: 18,
  ageMax: 65,
  availableWithinDays: 180,
  skillsMin: 1,
  skillsMax: 5,
};

export const NAME_RE = /^[A-Za-z][A-Za-z .'-]*$/;
export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
export const PHONE_RE = /^[6-9][0-9]{9}$/;

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function str(value) {
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return String(value);
}

/** Strip everything that is not a digit (used for the mobile number). */
export function onlyDigits(value, max = 15) {
  return str(value).replace(/\D/g, '').slice(0, max);
}

/** yyyy-mm-dd in local time (never UTC - avoids off-by-one-day bugs). */
export function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse yyyy-mm-dd into a local Date at midnight; null if not a real date. */
export function parseISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(iso))) return null;
  const [y, m, d] = str(iso).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export function addDays(date, days) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function startOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/** Completed years between a date of birth and today. */
export function calculateAge(dobISO, now = new Date()) {
  const dob = parseISODate(dobISO);
  if (!dob) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday =
    now.getMonth() < dob.getMonth() ||
    (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

/** dd/mm/yyyy for display. */
export function formatDate(iso) {
  const date = parseISODate(iso);
  if (!date) return str(iso);
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${d}/${m}/${date.getFullYear()}`;
}

/** +91 98765 43210 style formatting for display. */
export function formatPhone(digits) {
  const d = onlyDigits(digits, 10);
  if (d.length !== 10) return str(digits);
  return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
}

/** Indian salary formatting: 12.5 -> "₹12.5 LPA". */
export function formatCtc(lakhs) {
  if (lakhs === null || lakhs === undefined || lakhs === '') return '—';
  return `₹${Number(lakhs).toLocaleString('en-IN')} LPA`;
}

/* ------------------------------------------------------------------ */
/* individual rules                                                    */
/* ------------------------------------------------------------------ */

export function validateName(value) {
  const name = str(value).replace(/\s+/g, ' ').trim();
  if (!name) return 'Full name is required.';
  if (name.length < LIMITS.nameMin) return `Full name must be at least ${LIMITS.nameMin} characters.`;
  if (name.length > LIMITS.nameMax) return `Full name cannot be longer than ${LIMITS.nameMax} characters.`;
  if (!NAME_RE.test(name)) return 'Full name may contain letters, spaces, apostrophes, dots and hyphens only.';
  return null;
}

export function validateEmail(value) {
  const email = str(value).trim().toLowerCase();
  if (!email) return 'Email address is required.';
  if (email.length > LIMITS.emailMax) return 'Email address is too long.';
  if (/\s/.test(email)) return 'Email address cannot contain spaces.';
  if (email.includes('..')) return 'Email address cannot contain two dots in a row.';
  if (!EMAIL_RE.test(email)) return 'Enter a valid email address, for example name@example.com.';
  return null;
}

/** Keep only digits, then drop an Indian +91 / 91 country code. */
export function normalisePhone(value) {
  let digits = onlyDigits(value, 12);
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  return digits;
}

export function validatePhone(value) {
  const digits = normalisePhone(value);
  if (!digits) return 'Mobile number is required.';
  if (digits.length !== 10) return 'Mobile number must be exactly 10 digits.';
  if (!PHONE_RE.test(digits)) return 'Mobile number must start with 6, 7, 8 or 9.';
  return null;
}

export function validateDob(value, now = new Date()) {
  const iso = str(value).trim();
  if (!iso) return 'Date of birth is required.';
  const date = parseISODate(iso);
  if (!date) return 'Enter a valid date of birth (dd/mm/yyyy).';
  if (date > startOfToday(now)) return 'Date of birth cannot be in the future.';
  const age = calculateAge(iso, now);
  if (age < LIMITS.ageMin) return `Applicants must be at least ${LIMITS.ageMin} years old.`;
  if (age > LIMITS.ageMax) return `Applicants must be ${LIMITS.ageMax} years old or younger.`;
  return null;
}

export function validateGender(value) {
  const gender = str(value).trim();
  if (!gender) return 'Please select a gender.';
  if (!GENDERS.some((option) => option.id === gender)) return 'Please select a valid gender option.';
  return null;
}

export function validatePosition(value) {
  const position = str(value).trim();
  if (!position) return 'Please choose the role you are applying for.';
  if (!positionById(position)) return 'Please choose a role from the list.';
  return null;
}

export function validateExperience(value) {
  const raw = str(value).trim();
  if (!raw) return 'Total years of experience is required.';
  if (!/^\d+$/.test(raw)) return 'Experience must be a whole number of years.';
  const years = Number(raw);
  if (years < LIMITS.expMin || years > LIMITS.expMax) {
    return `Experience must be between ${LIMITS.expMin} and ${LIMITS.expMax} years.`;
  }
  return null;
}

export function validateCtc(value, { required = false } = {}) {
  const raw = str(value).trim();
  if (!raw) return required ? 'Expected CTC is required for experienced applicants.' : null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return 'Expected CTC must be a number in lakhs, e.g. 12.5.';
  const lakhs = Number(raw);
  if (lakhs < LIMITS.ctcMin || lakhs > LIMITS.ctcMax) {
    return `Expected CTC must be between ₹${LIMITS.ctcMin} and ₹${LIMITS.ctcMax} lakhs per annum.`;
  }
  return null;
}

export function validateSkills(value) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const valid = [...new Set(list.map((item) => str(item).trim()).filter(Boolean))];
  if (!valid.length) return 'Please select at least one skill.';
  if (valid.length > LIMITS.skillsMax) return `Please select no more than ${LIMITS.skillsMax} skills.`;
  const unknown = valid.filter((id) => !SKILLS.some((skill) => skill.id === id));
  if (unknown.length) return 'One or more selected skills are not recognised.';
  return null;
}

export function validatePortfolioUrl(value) {
  const raw = str(value).trim();
  if (!raw) return null; // optional field
  if (raw.length > 200) return 'Portfolio link is too long.';
  let url;
  try {
    url = new URL(raw);
  } catch {
    return 'Enter a full URL, for example https://github.com/your-name.';
  }
  if (!['http:', 'https:'].includes(url.protocol)) return 'Only http:// and https:// links are allowed.';
  if (!url.hostname.includes('.')) return 'Enter a full URL, for example https://github.com/your-name.';
  return null;
}

export function validateCoverLetter(value) {
  const text = str(value).trim();
  if (!text) return 'A short cover note is required.';
  if (text.length < LIMITS.coverMin) {
    return `Cover note must be at least ${LIMITS.coverMin} characters (currently ${text.length}).`;
  }
  if (text.length > LIMITS.coverMax) {
    return `Cover note must not be longer than ${LIMITS.coverMax} characters.`;
  }
  return null;
}

export function validateAvailableFrom(value, now = new Date()) {
  const iso = str(value).trim();
  if (!iso) return 'Please tell us when you can join.';
  const date = parseISODate(iso);
  if (!date) return 'Enter a valid joining date.';
  const today = startOfToday(now);
  if (date < today) return 'Joining date cannot be in the past.';
  const lastAllowed = addDays(today, LIMITS.availableWithinDays);
  if (date > lastAllowed) {
    return `Joining date must be within the next ${LIMITS.availableWithinDays} days.`;
  }
  return null;
}

export function validateRelocate(value) {
  const answer = str(value).trim();
  if (!answer) return 'Please tell us whether you are willing to relocate.';
  if (!['yes', 'no'].includes(answer)) return 'Please choose Yes or No.';
  return null;
}

export function validateConsent(value) {
  const accepted = value === true || ['on', 'true', 'yes', '1'].includes(str(value).trim().toLowerCase());
  if (!accepted) return 'You must confirm that the information provided is true.';
  return null;
}

/* ------------------------------------------------------------------ */
/* cross-field rules (a field checked against another field)           */
/* ------------------------------------------------------------------ */

/** The role's advertised experience band must match the applicant. */
export function validateExperienceForRole(experienceRaw, positionRaw) {
  const position = positionById(str(positionRaw).trim());
  const years = Number(str(experienceRaw).trim());
  if (!position || Number.isNaN(years)) return null; // base rules already reported these
  if (years < position.experienceMin || years > position.experienceMax) {
    return `${position.title} requires ${position.experienceMin}-${position.experienceMax} years of experience.`;
  }
  return null;
}

/** Nobody can have more years of experience than their working-age years. */
export function validateExperienceVsAge(experienceRaw, dobISO, now = new Date()) {
  const years = Number(str(experienceRaw).trim());
  const age = calculateAge(str(dobISO).trim(), now);
  if (Number.isNaN(years) || age === null) return null;
  const possibleYears = age - 16;
  if (years > possibleYears) {
    return `With age ${age}, at most ${Math.max(possibleYears, 0)} years of experience is possible.`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* whole-form validation                                               */
/* ------------------------------------------------------------------ */

export function emptyApplication() {
  return {
    fullName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    position: '',
    experienceYears: '',
    expectedCtc: '',
    skills: [],
    portfolioUrl: '',
    coverLetter: '',
    availableFrom: '',
    relocate: '',
    consent: false,
  };
}

/**
 * @param {object} body  req.body from the form or the JSON API
 * @param {object} opts  { now } - injectable clock, used by the tests
 */
export function validateApplication(body = {}, opts = {}) {
  const now = opts.now || new Date();
  const raw = body && typeof body === 'object' ? body : {};

  const values = {
    fullName: str(raw.fullName).replace(/\s+/g, ' ').trim(),
    email: str(raw.email).trim().toLowerCase(),
    phone: normalisePhone(raw.phone),
    dob: str(raw.dob).trim(),
    gender: str(raw.gender).trim(),
    position: str(raw.position).trim(),
    experienceYears: str(raw.experienceYears).trim(),
    expectedCtc: str(raw.expectedCtc).trim(),
    skills: (Array.isArray(raw.skills) ? raw.skills : raw.skills ? [raw.skills] : [])
      .map((skill) => str(skill).trim())
      .filter(Boolean),
    portfolioUrl: str(raw.portfolioUrl).trim(),
    coverLetter: str(raw.coverLetter).trim(),
    availableFrom: str(raw.availableFrom).trim(),
    relocate: str(raw.relocate).trim(),
    consent: raw.consent === true || ['on', 'true', 'yes', '1'].includes(str(raw.consent).trim().toLowerCase()),
  };

  const errors = {};
  const add = (field, message) => {
    if (message) errors[field] = message;
  };

  add('fullName', validateName(values.fullName));
  add('email', validateEmail(values.email));
  add('phone', validatePhone(values.phone));
  add('dob', validateDob(values.dob, now));
  add('gender', validateGender(values.gender));
  add('position', validatePosition(values.position));
  add('experienceYears', validateExperience(values.experienceYears));
  add(
    'experienceYears',
    errors.experienceYears ? null : validateExperienceForRole(values.experienceYears, values.position),
  );
  add(
    'experienceYears',
    errors.experienceYears ? null : validateExperienceVsAge(values.experienceYears, values.dob, now),
  );

  const experience = Number(values.experienceYears);
  add('expectedCtc', validateCtc(values.expectedCtc, { required: experience >= 1 }));
  add('skills', validateSkills(values.skills));
  add('portfolioUrl', validatePortfolioUrl(values.portfolioUrl));
  add('coverLetter', validateCoverLetter(values.coverLetter));
  add('availableFrom', validateAvailableFrom(values.availableFrom, now));
  add('relocate', validateRelocate(values.relocate));
  add('consent', validateConsent(values.consent));

  const data = {
    fullName: values.fullName,
    email: values.email,
    phone: values.phone,
    dob: values.dob,
    age: calculateAge(values.dob, now),
    gender: values.gender,
    position: values.position,
    positionTitle: positionById(values.position)?.title || '',
    experienceYears: Number.isNaN(experience) ? null : experience,
    expectedCtc: values.expectedCtc === '' ? null : Number(values.expectedCtc),
    skills: values.skills,
    portfolioUrl: values.portfolioUrl || null,
    coverLetter: values.coverLetter,
    availableFrom: values.availableFrom,
    relocate: values.relocate,
    consent: values.consent,
  };

  return { values, errors, data };
}

/** True when there is nothing to report. */
export function isValid(errors) {
  return Object.keys(errors || {}).length === 0;
}

/** Friendly labels for the error summary, in form order. */
export const FIELD_LABELS = {
  fullName: 'Full name',
  email: 'Email address',
  phone: 'Mobile number',
  dob: 'Date of birth',
  gender: 'Gender',
  position: 'Role',
  experienceYears: 'Experience',
  expectedCtc: 'Expected CTC',
  skills: 'Skills',
  portfolioUrl: 'Portfolio link',
  coverLetter: 'Cover note',
  availableFrom: 'Joining date',
  relocate: 'Relocation',
  consent: 'Declaration',
};

export const FIELD_ORDER = Object.keys(FIELD_LABELS);

export const OPEN_POSITIONS = POSITIONS;
