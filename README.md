# TalentBridge — Careers Portal (Node.js server-side validation)

An individual Node.js web application that demonstrates **server-side validation**, **GET/POST
handling**, **routing** and **request/response handling**, built for the assignment:

> *Design, develop and deploy a web application to demonstrate server-side validation using NodeJS.*

**Chosen real-world application:** the job-application form of a company careers portal. Every field
has a real rule that only the server can be trusted to enforce (age limits, role-specific experience
bands, salary ranges, joining windows), and the applicant must be told exactly what is wrong.

---

## 1. How the validation works (the core idea)

```
Browser                                  Node.js server
-------                                  --------------
GET /apply        ─────────────────────►  router (pages.js) → render apply.ejs (empty form)
                  ◄─────────────────────  200 OK + HTML

POST /apply       ─────────────────────►  express.urlencoded() → req.body
(form, novalidate)                        validateApplication(req.body)   ← src/lib/validators.js
                                              │
                            errors found ─────┤ 400 Bad Request + the same form,
                                              │ with the applicant's values and one
                  ◄───────────────────────────┘ message per invalid field
                                              │
                            all valid ────────┤ createApplication() → data/applications.json
                                              │
                  ◄───────────────────────────┘ 303 See Other → Location: /applications/APP-2611-7C37

GET /applications/APP-…  ────────────────►  read the record → render confirmation page
```

Three things are deliberate:

1. **The form is sent with `novalidate`.** HTML5 constraint validation is switched off so it cannot
   be used as a shortcut — if the server rules do not run, nothing is validated.
2. **Invalid input is answered with 400 and the form again.** The applicant never loses what they
   typed, and each message is attached to the field that caused it.
3. **Valid input is answered with a 303 redirect (Post/Redirect/Get).** Refreshing the confirmation
   page re-issues a GET, so the same application can never be submitted twice.

---

## 2. Assignment requirements → where they are implemented

| Requirement | Implementation |
| --- | --- |
| 1. Individual web application using Node.js | Node.js 20 + Express, 4 source modules + 2 routers + 7 views |
| 2. Server-side validation | `src/lib/validators.js` — 14 fields, 12 rules + 2 cross-field rules, all on the server |
| 3. GET/POST handled appropriately | `GET /`, `/apply`, `/applications`, `/applications/:id`, `/api/*`; `POST /apply`, `/api/validate`, `/api/applications`; correct 200 / 201 / 303 / 400 / 404 status codes |
| 4. Success and error messages | Error summary + per-field messages on a 400; green confirmation banner and reference number on success; dedicated 404 and 500 pages |
| 5. Modules, routing, request/response | ES modules (`import`/`export`), `express.Router()` in `routes/`, `req.body` / `req.params` / `req.query`, `res.render` / `res.json` / `res.redirect` / `res.status`, custom middleware, central error handler, `node:fs/promises` store, `node:crypto` IDs |
| 6. Tested with valid and invalid input | 39 automated tests (`npm test`) + a scripted browser walk-through (`node e2e-screenshots.mjs`) |

---

## 3. Technologies used

- **Node.js 20** — runtime; ES modules (`"type": "module"`), `node:fs/promises`, `node:crypto`, `node:path`, `node:url`, `process.env`.
- **Express 4** — routing (`express.Router`), middleware pipeline, `express.urlencoded()` and `express.json()` body parsers, `express.static()`, central error-handling middleware.
- **EJS** — server-side HTML templating: `res.render(view, locals)`, layout via partials (`head`, `header`, `footer`, reusable `field`).
- **HTML5 + CSS3** — semantic form markup (`fieldset`/`legend`, `type="date"`, `type="tel"`), custom-property design system, responsive layout, print styles. No CSS framework and **no client-side JavaScript** — validation works with JavaScript disabled.
- **Node's built-in test runner** (`node:test` + `node:assert/strict`) — 23 unit tests for the rules.
- **Supertest** — 16 HTTP integration tests against the Express app without opening a port.
- **Puppeteer-core + headless Chrome** — scripted browser walk-through and screenshots.
- **JSON file storage** (`data/applications.json`) — a stand-in for a database.
- **Deployment targets** — Render / Railway / any Node host, plus a `Dockerfile` for containers.

---

## 4. Theory of the project

**Why validation belongs on the server.** A browser is under the user's control: JavaScript can be
disabled, request bodies can be edited, and any check written in the page can be skipped by posting
directly to the endpoint with `curl`. The server, by contrast, receives whatever actually arrived and
is the only place where a decision is authoritative. Client-side validation is a convenience that
improves the experience; server-side validation is the control that protects the data. This project
implements the second one deliberately and disables the first (`novalidate`).

**The request/response cycle.** HTTP is a stateless request/response protocol: the client sends a
method, a path, headers and an optional body; the server answers with a status code, headers and a
body. Express turns that into a pipeline of middleware functions, each receiving
`(req, res, next)` and either ending the response or passing control on. `express.urlencoded()`
parses `application/x-www-form-urlencoded` form bodies into `req.body`; `express.json()` does the
same for JSON. A route handler then reads `req.body`, `req.params` or `req.query` and calls
`res.render`, `res.json` or `res.redirect`.

**Status codes as part of the contract.** The application uses them meaningfully: `200 OK` for a
page, `201 Created` with a `Location` header for a JSON create, `303 See Other` after a successful
form POST, `400 Bad Request` when validation fails, `404 Not Found` when no route or record matches,
and `500` from the central error handler. A client (or a test) can tell success from failure without
parsing the HTML.

**Post/Redirect/Get.** If a POST responded directly with the confirmation page, reloading it would
re-send the form and create a duplicate record. Answering with a redirect forces the browser to make
a fresh GET, which is safe to repeat. This is why the confirmation page lives at
`GET /applications/:id` and the POST only redirects.

**Validation as pure functions.** Each rule is a function of the value (and sometimes of a reference
date) that returns `null` or a message — no I/O, no request object, no HTML. `validateApplication()`
composes them, returning three things: `values` (cleaned strings to re-display), `errors` (one
message per field) and `data` (normalised values: numbers, arrays, booleans, computed age). That
separation is what makes the rules unit-testable, keeps the message next to the rule that owns it,
and prevents the template from ever receiving unvalidated data.

**Normalise, then validate, then store.** Input is cleaned before it is judged — whitespace
collapsed in names, emails lower-cased, `+91` and spaces stripped from phone numbers, form checkbox
values (`"on"`) turned into booleans. Only the normalised form is written to disk, so the stored
record is consistent no matter how the applicant typed it.

**Cross-field validation.** Some rules cannot be decided by one field alone. Here the advertised
experience band for the chosen role, and the physical limit of "years of experience ≤ age − 16", are
checked after the individual rules pass. This is also why each field reports only its first problem:
later rules are skipped once a field has already failed, so the message is never misleading.

**Dates and time zones.** `input type="date"` sends `yyyy-mm-dd`. Parsing it with
`new Date('2026-12-01')` treats the value as UTC midnight and can shift the day for users outside
GMT, so the value is split and rebuilt as a **local** midnight date. Age is then computed by
comparing year/month/day (not by dividing milliseconds), and the joining date is checked against
today and a 180-day horizon.

**Trust boundaries and defence in depth.** Even though the rules are server-side, the templates
escape every value (`<%= %>` in EJS) so a name like `<script>` can never become markup, and the
portfolio link is validated as an `http(s)` URL before it is ever rendered as a link. Validation and
output encoding are different layers of the same defence.

**Persistence and concurrency.** Records are stored in a JSON file through `node:fs/promises`. Two
applicants submitting at the same moment could read-modify-write over each other, so all writes go
through a promise queue that serialises them. A real deployment would swap this module for a
database without touching the routes — the store exposes only `createApplication`,
`listApplications`, `getApplication`.

**Statelessness.** No session or cookie is used: the server holds no per-user state between
requests. The confirmation page is identified by the record's own reference number, which is exactly
how a stateless HTTP application is supposed to work.

---

## 5. Run it

```bash
npm install
npm start            # http://localhost:3000
npm run dev          # same, with auto-restart on file changes (node --watch)
npm test             # 39 automated tests (23 unit + 16 HTTP integration)
node e2e-screenshots.mjs   # scripted browser run + screenshots in docs/ (needs local Chrome)
```

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | HTTP port |
| `DATA_FILE` | `data/applications.json` | Where applications are stored (tests use a temp file) |

---

## 6. Routes

| Method | Path | Purpose | Responses |
| --- | --- | --- | --- |
| GET | `/` | Landing page: open roles, count of applications received | 200 |
| GET | `/apply` | The application form, empty | 200 |
| POST | `/apply` | Validate the submitted form | 400 + form with errors, or 303 → `/applications/:id` |
| GET | `/applications` | Table of all received applications | 200 |
| GET | `/applications/:id` | Confirmation / record detail (`?submitted=1` shows the success banner) | 200, 404 |
| GET | `/api/positions` | Roles, skills and gender options as JSON | 200 |
| POST | `/api/validate` | Validate a JSON application without saving it | 200 (valid) / 400 (errors) |
| GET | `/api/applications` | All applications as JSON | 200 |
| GET | `/api/applications/:id` | One application as JSON | 200, 404 |
| POST | `/api/applications` | Create an application from JSON | 201 + `Location`, 400 |
| any | anything else | Catch-all 404 (HTML, or JSON under `/api`) | 404 |
| any | route that throws | Central error handler | 500 |

---

## 7. Validation rules

| Field | Rule enforced on the server | Example message |
| --- | --- | --- |
| Full name | required, 3–60 chars, letters/space/`.`/`'`/`-` only, whitespace collapsed | "Full name may contain letters, spaces, apostrophes, dots and hyphens only." |
| Email | required, pattern, no spaces, no `..`, ≤120 chars, stored lower-case | "Enter a valid email address, for example name@example.com." |
| Mobile | required, digits only after removing `+91`/spaces, exactly 10, starts 6–9 | "Mobile number must start with 6, 7, 8 or 9." |
| Date of birth | required, real date, not future, age 18–65 (computed year/month/day) | "Applicants must be at least 18 years old." |
| Gender | required, one of the four published options | "Please select a valid gender option." |
| Role | required, must be one of the five open positions | "Please choose a role from the list." |
| Experience | required, whole number 0–40, **within the role's band**, **≤ age − 16** | "Backend Engineer (Node.js) requires 2-10 years of experience." |
| Expected CTC | required when experience ≥ 1 year; number in lakhs, 1–100 | "Expected CTC is required for experienced applicants." |
| Skills | 1–5 items, all from the published list, duplicates removed | "Please select at least one skill." |
| Portfolio | optional; must parse as a URL with `http(s)` protocol and a dotted host | "Only http:// and https:// links are allowed." |
| Cover note | required, 50–1200 characters after trimming | "Cover note must be at least 50 characters (currently 23)." |
| Joining date | required, not in the past, within 180 days | "Joining date must be within the next 180 days." |
| Relocate | required, `yes` or `no` | "Please tell us whether you are willing to relocate." |
| Declaration | checkbox must be ticked | "You must confirm that the information provided is true." |

---

## 8. Testing

`npm test` runs 39 tests and all pass.

**Unit tests — `tests/validators.test.js` (23 tests, boundary-value analysis)**

| Input | Expected | Result |
| --- | --- | --- |
| Name `Ni` / 61 chars / `Nilesh123` | length and pattern messages | Pass |
| Email `nilesh@`, `@example.com`, `a@b..com` | rejected with specific messages | Pass |
| Phone `98765`, `1234567890`, `+91 98765 43210` | 2 rejected, `+91` form accepted | Pass |
| DOB future / age 17 / age 66 / `18/04/1992` | rejected; 18 exactly accepted | Pass |
| Experience `3.5`, `41`, `-2` | rejected; `0` and `40` accepted | Pass |
| Experience `9` for Frontend (band 1–8) | role-band message | Pass |
| Experience `20` with age 34 | "at most 18 years" | Pass |
| CTC `0.5`, `101`, `abc`, empty + required | rejected; `1`–`100` accepted | Pass |
| Skills `[]`, 6 items, `cobol` | rejected; 1–5 valid ids accepted | Pass |
| Cover note 49 / 50 / 1201 chars | boundary handled correctly | Pass |
| Joining date yesterday / +180 / +181 | 2 rejected, +180 accepted | Pass |
| Portfolio `ftp://…`, `javascript:…`, `github.com/x` | rejected; `https://…` accepted | Pass |

**Integration tests — `tests/api.test.js` (16 tests, real HTTP through supertest)**

| Case | Expected | Result |
| --- | --- | --- |
| `GET /` | 200, HTML, roles listed | Pass |
| `GET /apply` | 200, all 14 field names present, `novalidate` | Pass |
| `POST /apply` empty | **400**, error summary, "12 fields need your attention" | Pass |
| `POST /apply` bad email + bad phone | **400**, input preserved (`value="Nilesh Patil"`), field messages | Pass |
| `POST /apply` role/experience mismatch | **400** with the role-band message | Pass |
| `POST /apply` fully valid | **303** to `/applications/APP-…?submitted=1`; record written to the JSON file | Pass |
| `GET /applications/:id` | 200 confirmation page with reference, CTC, skills | Pass |
| `GET /applications/APP-0000-XXXX` | 404 page | Pass |
| `POST /api/validate` valid / invalid | 200 `valid:true` / 400 with 3 field errors | Pass |
| `POST /api/applications` | **201** + `Location`; readable at `/api/applications/:id` | Pass |
| `GET /api/unknown` | 404 **JSON** (not HTML) | Pass |
| `GET /styles.css` | 200 `text/css` from `express.static` | Pass |

**Browser walk-through — `node e2e-screenshots.mjs`** submits the empty form (400 page), a partly
wrong form (input preserved), then a fully valid form (303 → confirmation `APP-2611-70DE`), checks
the record appears in `/applications`, and visits an unknown URL (404). Screenshots are in `docs/`.

---

## 9. Project structure

```
talentbridge/
├── server.js                 # entry point: create the app, listen, graceful shutdown
├── src/
│   ├── app.js                # express app factory: parsers, static, routers, 404 + error handlers
│   ├── routes/
│   │   ├── pages.js          # HTML routes (GET pages, POST /apply)
│   │   └── api.js            # JSON API routes
│   ├── lib/
│   │   ├── validators.js     # all server-side rules (pure functions) + normalisers
│   │   ├── positions.js      # reference data: roles, skills, gender options
│   │   └── store.js          # JSON-file persistence with a serialised write queue
│   └── views/                # EJS templates
│       ├── partials/         # head, header, footer, reusable field
│       ├── home.ejs, apply.ejs, applications.ejs, application.ejs
│       └── 404.ejs, error.ejs
├── public/styles.css         # served by express.static
├── tests/
│   ├── validators.test.js    # 23 unit tests
│   └── api.test.js           # 16 HTTP integration tests
├── e2e-screenshots.mjs       # scripted browser run + screenshots
├── docs/                     # screenshots of the running app
├── Dockerfile
└── data/applications.json    # created on the first successful submission
```

---

## 10. Deploy it

The app is a standard Node.js HTTP server — no build step.

**Render (free tier, HTTPS URL)**

1. Push the project to GitHub.
2. Render → *New → Web Service* → connect the repo.
3. Build command `npm install`, start command `npm start`. Render sets `PORT` automatically.
4. Optional: add a **persistent disk** mounted at `/app/data` so applications survive a restart
   (otherwise the container's filesystem is ephemeral).

**Railway / Fly.io / Glitch** — same idea: `npm install` then `npm start`, honour `process.env.PORT`.

**Docker**

```bash
docker build -t talentbridge .
docker run -p 3000:3000 -v "$PWD/data:/app/data" talentbridge
```

**College LAN demo** — `npm start`, then share `http://<your-laptop-ip>:3000` with devices on the same
Wi-Fi.

---

## 11. Known limitations

- Applications are stored in a JSON file, not a database; there is no concurrency control beyond the
  in-process write queue, so it suits a single-instance demo, not production.
- No authentication or admin area: `/applications` lists every application (fine for a demo, not for
  real candidate data).
- No CSRF token, rate limiting or HTTPS termination — a deployment behind a PaaS gets HTTPS for free,
  but the other two would be added for production.
- "Confirmation email" is only a message on the page; no mail is sent.
