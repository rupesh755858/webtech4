/** Static reference data used by the form and by the validators. */

export const POSITIONS = [
  {
    id: 'frontend',
    title: 'Frontend Engineer (React)',
    type: 'Full-time',
    location: 'Pune · Hybrid',
    experienceMin: 1,
    experienceMax: 8,
  },
  {
    id: 'backend',
    title: 'Backend Engineer (Node.js)',
    type: 'Full-time',
    location: 'Bengaluru · On-site',
    experienceMin: 2,
    experienceMax: 10,
  },
  {
    id: 'qa',
    title: 'QA Automation Engineer',
    type: 'Full-time',
    location: 'Remote (India)',
    experienceMin: 1,
    experienceMax: 6,
  },
  {
    id: 'data',
    title: 'Data Analyst',
    type: 'Full-time',
    location: 'Pune · Hybrid',
    experienceMin: 0,
    experienceMax: 5,
  },
  {
    id: 'intern',
    title: 'Software Engineering Intern',
    type: 'Internship · 6 months',
    location: 'Pune · On-site',
    experienceMin: 0,
    experienceMax: 1,
  },
];

export const SKILLS = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'react', label: 'React' },
  { id: 'nodejs', label: 'Node.js' },
  { id: 'express', label: 'Express' },
  { id: 'sql', label: 'SQL' },
  { id: 'python', label: 'Python' },
  { id: 'testing', label: 'Automated testing' },
  { id: 'docker', label: 'Docker' },
  { id: 'git', label: 'Git' },
  { id: 'communication', label: 'Communication' },
];

export const GENDERS = [
  { id: 'female', label: 'Female' },
  { id: 'male', label: 'Male' },
  { id: 'other', label: 'Other' },
  { id: 'undisclosed', label: 'Prefer not to say' },
];

export function positionById(id) {
  return POSITIONS.find((position) => position.id === id) || null;
}

export function skillLabels(ids = []) {
  return ids
    .map((id) => SKILLS.find((skill) => skill.id === id)?.label)
    .filter(Boolean);
}

export function genderLabel(id) {
  return GENDERS.find((gender) => gender.id === id)?.label || '';
}
