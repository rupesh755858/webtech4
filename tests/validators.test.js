/**
 * Unit tests for the server-side validation rules.
 * Run with:  npm test
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LIMITS,
  calculateAge,
  emptyApplication,
  formatCtc,
  formatDate,
  formatPhone,
  isValid,
  onlyDigits,
  parseISODate,
  validateApplication,
  validateAvailableFrom,
  validateConsent,
  validateCoverLetter,
  validateCtc,
  validateDob,
  validateEmail,
  validateExperience,
  validateExperienceForRole,
  validateExperienceVsAge,
  validateGender,
  validateName,
  validatePhone,
  validatePortfolioUrl,
  validatePosition,
  validateRelocate,
  validateSkills,
} from '../src/lib/validators.js';

// Fixed clock: Tuesday 17 November 2026
const NOW = new Date(2026, 10, 17, 10, 0, 0);

const validBody = {
  fullName: '  Nilesh   Patil ',
  email: 'Nilesh.Patil@Example.com',
  phone: '+91 98765 43210',
  dob: '1992-04-18',
  gender: 'male',
  position: 'frontend',
  experienceYears: '4',
  expectedCtc: '12.5',
  skills: ['javascript', 'react'],
  portfolioUrl: 'https://github.com/nilesh',
  coverLetter: 'I have built three production React applications and led a two-person team.',
  availableFrom: '2026-12-01',
  relocate: 'yes',
  consent: 'on',
};

/* ----------------------------- helpers ---------------------------- */
test('onlyDigits strips everything that is not a number', () => {
  assert.equal(onlyDigits('+91 98765-43210'), '919876543210');
  assert.equal(onlyDigits('abc'), '');
});

test('parseISODate rejects impossible dates and accepts real ones', () => {
  assert.equal(parseISODate('2026-02-31'), null);
  assert.equal(parseISODate('18/11/2026'), null);
  assert.equal(parseISODate('2026-11-18').getDate(), 18);
});

test('calculateAge handles the birthday boundary', () => {
  assert.equal(calculateAge('1992-11-17', NOW), 34); // birthday today
  assert.equal(calculateAge('1992-11-18', NOW), 33); // birthday tomorrow
  assert.equal(calculateAge('not-a-date', NOW), null);
});

test('display helpers format Indian conventions', () => {
  assert.equal(formatDate('2026-12-01'), '01/12/2026');
  assert.equal(formatPhone('9876543210'), '+91 98765 43210');
  assert.equal(formatCtc(12.5), '₹12.5 LPA');
  assert.equal(formatCtc(null), '—');
});

/* --------------------------- name --------------------------------- */
test('name: valid names pass, invalid ones are explained', () => {
  assert.equal(validateName('Nilesh Patil'), null);
  assert.equal(validateName("A. R. D'Souza"), null);
  assert.equal(validateName('Nilesh   Patil'), null); // spaces are collapsed
  assert.match(validateName(''), /required/i);
  assert.match(validateName('Ni'), /at least 3/i);
  assert.match(validateName('A'.repeat(61)), /longer than 60/i);
  assert.match(validateName('Nilesh123'), /letters/i);
  assert.match(validateName('<script>alert(1)</script>'), /letters/i);
});

/* --------------------------- email -------------------------------- */
test('email: pattern, spaces and consecutive dots are rejected', () => {
  assert.equal(validateEmail('name@example.com'), null);
  assert.equal(validateEmail('  NAME@Example.COM  '), null);
  assert.equal(validateEmail('name+tag@sub.domain.co.in'), null);
  assert.match(validateEmail(''), /required/i);
  assert.match(validateEmail('nilesh'), /valid email/i);
  assert.match(validateEmail('nilesh@'), /valid email/i);
  assert.match(validateEmail('@example.com'), /valid email/i);
  assert.match(validateEmail('nilesh @example.com'), /spaces/i);
  assert.match(validateEmail('nilesh@example..com'), /two dots/i);
});

/* --------------------------- phone -------------------------------- */
test('phone: 10 digits, +91 prefix allowed, starting digit 6-9', () => {
  assert.equal(validatePhone('9876543210'), null);
  assert.equal(validatePhone('+91 98765 43210'), null);
  assert.equal(validatePhone('919876543210'), null);
  assert.match(validatePhone(''), /required/i);
  assert.match(validatePhone('98765'), /exactly 10 digits/i);
  assert.match(validatePhone('1234567890'), /start with 6, 7, 8 or 9/i);
  assert.match(validatePhone('98765abcde'), /exactly 10 digits/i);
});

/* ----------------------- dob / gender / role ----------------------- */
test('date of birth: future, too young and too old are rejected', () => {
  assert.equal(validateDob('1992-04-18', NOW), null);
  assert.equal(validateDob('2008-11-17', NOW), null); // exactly 18 today
  assert.match(validateDob('', NOW), /required/i);
  assert.match(validateDob('2027-01-01', NOW), /future/i);
  assert.match(validateDob('2010-01-01', NOW), /at least 18/i);
  assert.match(validateDob('1940-01-01', NOW), /65 years old or younger/i);
  assert.match(validateDob('18/04/1992', NOW), /valid date/i);
});

test('gender and role must be from the published lists', () => {
  assert.equal(validateGender('female'), null);
  assert.equal(validateGender('undisclosed'), null);
  assert.match(validateGender(''), /select a gender/i);
  assert.match(validateGender('robot'), /valid gender/i);

  assert.equal(validatePosition('backend'), null);
  assert.match(validatePosition(''), /choose the role/i);
  assert.match(validatePosition('astronaut'), /from the list/i);
});

/* ------------------- experience / ctc / skills --------------------- */
test('experience: whole numbers within 0-40', () => {
  assert.equal(validateExperience('0'), null);
  assert.equal(validateExperience('40'), null);
  assert.match(validateExperience(''), /required/i);
  assert.match(validateExperience('41'), /between 0 and 40/i);
  assert.match(validateExperience('3.5'), /whole number/i);
  assert.match(validateExperience('-2'), /whole number/i);
});

test('expected CTC: optional for freshers, required for experienced', () => {
  assert.equal(validateCtc('', { required: false }), null);
  assert.match(validateCtc('', { required: true }), /required/i);
  assert.equal(validateCtc('1', { required: true }), null);
  assert.equal(validateCtc('12.5', { required: true }), null);
  assert.equal(validateCtc('100', { required: true }), null);
  assert.match(validateCtc('0.5', {}), /between ₹1 and ₹100/i);
  assert.match(validateCtc('101', {}), /between ₹1 and ₹100/i);
  assert.match(validateCtc('abc', {}), /must be a number/i);
});

test('skills: at least one, at most five, only known ids', () => {
  assert.equal(validateSkills(['javascript']), null);
  assert.equal(validateSkills('nodejs'), null); // single value from a form
  assert.equal(validateSkills(['javascript', 'javascript']), null); // duplicates collapse
  assert.match(validateSkills([]), /at least one skill/i);
  assert.match(validateSkills(''), /at least one skill/i);
  assert.match(validateSkills(['javascript', 'react', 'nodejs', 'sql', 'python', 'docker']), /no more than 5/i);
  assert.match(validateSkills(['javascript', 'cobol']), /not recognised/i);
});

test('portfolio link is optional but must be a real http(s) URL', () => {
  assert.equal(validatePortfolioUrl(''), null);
  assert.equal(validatePortfolioUrl('https://github.com/nilesh'), null);
  assert.equal(validatePortfolioUrl('http://example.in/profile'), null);
  assert.match(validatePortfolioUrl('github.com/nilesh'), /full URL/i);
  assert.match(validatePortfolioUrl('ftp://example.com/cv'), /http/i);
  assert.match(validatePortfolioUrl('javascript:alert(1)'), /http/i);
});

test('cover note: 50-1200 characters', () => {
  assert.match(validateCoverLetter(''), /required/i);
  assert.match(validateCoverLetter('x'.repeat(49)), /at least 50/i);
  assert.equal(validateCoverLetter('x'.repeat(50)), null);
  assert.equal(validateCoverLetter(`  ${'x'.repeat(50)}  `), null); // trimmed first
  assert.match(validateCoverLetter('x'.repeat(1201)), /not be longer than 1200/i);
});

test('joining date: today to +180 days', () => {
  assert.equal(validateAvailableFrom('2026-11-17', NOW), null); // today
  assert.equal(validateAvailableFrom('2027-05-16', NOW), null); // +180
  assert.match(validateAvailableFrom('2026-11-16', NOW), /cannot be in the past/i);
  assert.match(validateAvailableFrom('2027-05-17', NOW), /within the next 180 days/i);
  assert.match(validateAvailableFrom('', NOW), /when you can join/i);
});

test('relocation answer and consent declaration', () => {
  assert.equal(validateRelocate('yes'), null);
  assert.equal(validateRelocate('no'), null);
  assert.match(validateRelocate(''), /whether you are willing/i);
  assert.match(validateRelocate('maybe'), /choose Yes or No/i);

  assert.equal(validateConsent('on'), null);
  assert.equal(validateConsent(true), null);
  assert.match(validateConsent(''), /must confirm/i);
  assert.match(validateConsent('off'), /must confirm/i);
});

/* ----------------------- cross-field rules ------------------------ */
test('experience must fit the role band', () => {
  assert.equal(validateExperienceForRole('4', 'frontend'), null);
  assert.match(validateExperienceForRole('9', 'frontend'), /requires 1-8 years/i);
  assert.match(validateExperienceForRole('0', 'backend'), /requires 2-10 years/i);
  assert.equal(validateExperienceForRole('1', 'intern'), null);
  assert.equal(validateExperienceForRole('4', ''), null); // base rule reports this
});

test('experience cannot exceed working-age years', () => {
  assert.equal(validateExperienceVsAge('10', '1992-04-18', NOW), null);
  assert.match(validateExperienceVsAge('20', '1992-04-18', NOW), /at most 18 years/i);
  assert.equal(validateExperienceVsAge('2', '2008-11-17', NOW), null); // age 18 -> 2 possible
  assert.equal(validateExperienceVsAge('abc', '1992-04-18', NOW), null);
});

/* ------------------------ whole form ------------------------------ */
test('a complete valid application has no errors', () => {
  const { errors, values, data } = validateApplication(validBody, { now: NOW });
  assert.deepEqual(errors, {});
  assert.equal(isValid(errors), true);

  // values are cleaned for redisplay
  assert.equal(values.fullName, 'Nilesh Patil');
  assert.equal(values.email, 'nilesh.patil@example.com');
  assert.equal(values.phone, '9876543210');

  // data is normalised for storage
  assert.equal(data.age, 34);
  assert.equal(data.experienceYears, 4);
  assert.equal(data.expectedCtc, 12.5);
  assert.deepEqual(data.skills, ['javascript', 'react']);
  assert.equal(data.consent, true);
  assert.equal(data.positionTitle, 'Frontend Engineer (React)');
});

test('an empty submission reports every required field at once', () => {
  const { errors } = validateApplication({}, { now: NOW });
  assert.deepEqual(Object.keys(errors).sort(), [
    'availableFrom',
    'consent',
    'coverLetter',
    'dob',
    'email',
    'experienceYears',
    'fullName',
    'gender',
    'phone',
    'position',
    'relocate',
    'skills',
  ]);
  assert.equal(isValid(errors), false);
});

test('expected CTC becomes required once experience is at least a year', () => {
  const { errors } = validateApplication({ ...validBody, expectedCtc: '' }, { now: NOW });
  assert.match(errors.expectedCtc, /required/i);

  const fresher = { ...validBody, position: 'intern', experienceYears: '0', expectedCtc: '' };
  assert.equal(validateApplication(fresher, { now: NOW }).errors.expectedCtc, undefined);
});

test('only the first problem per field is reported', () => {
  const { errors } = validateApplication(
    { ...validBody, position: 'frontend', experienceYears: '30' },
    { now: NOW },
  );
  // 30 is inside 0-40 so the base rule passes; the role band reports instead.
  assert.match(errors.experienceYears, /requires 1-8 years/i);
});

test('emptyApplication() returns a blank form model', () => {
  const blank = emptyApplication();
  assert.equal(Object.keys(blank).length, 14);
  assert.deepEqual(blank.skills, []);
  assert.equal(blank.consent, false);
  assert.equal(LIMITS.nameMin, 3);
});
