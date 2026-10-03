# Contributing

Thank you for your interest in contributing!

## 📐 This Repo Is a Template

This is the **Randstad Romania scraper** for the peviitor.ro ecosystem. It is derived from the [EPAM reference implementation](https://github.com/peviitor-scrapers/epam-systems-international-srl-nodejs-scraper). New scrapers for other Romanian companies should follow the same patterns.

> **✅ Validated in production.** These derived scrapers follow this exact checklist:
> - [mejix-srl-nodejs-scraper](https://github.com/peviitor-scrapers/mejix-srl-nodejs-scraper) — MEJIX S.R.L. (HTML/cheerio, single-page)
> - [talent-matchmakers-srl-nodejs-scraper](https://github.com/peviitor-scrapers/talent-matchmakers-srl-nodejs-scraper) — TALENT MATCHMAKERS S.R.L. (Teamtailor HTML/cheerio)
> - [principal33-srl-nodejs-scraper](https://github.com/peviitor-scrapers/principal33-srl-nodejs-scraper) — PRINCIPAL33 S.R.L. (Personio JSON API)
> Use them as references if anything below is unclear.

## Deriving a New Scraper for Another Company

> **🤖 AI agents:** the comprehensive playbook for derivation (every step + all known pitfalls from past derivations) is in [AI-DERIVATION-GUIDE.md](AI-DERIVATION-GUIDE.md). Read it before starting.

The summary below is for human contributors.


Use this checklist when starting a scraper for `<COMPANY>`:

### 1. Bootstrap the repository

1. Create a new GitHub repo named `<company-slug>-nodejs-scraper` (e.g. `cognizant-romania-nodejs-scraper`)
2. Mark it **public** (required — see [PUBLIC.md](PUBLIC.md))
3. Add the two required topics: `job-seeker-ro-spider`, `peviitor-ro` (see [TOPICS.md](TOPICS.md))
4. Copy this repo's contents as a starting point

### 2. Update company identity

**Primary edit (single source of truth):**

| File | What to change |
|------|---------------|
| `config/company.json` | Edit all fields: `cif`, `legalName`, `brand`, `website`, `careerUrl`, `apiBase`, `apiCountryId`, `defaultLocation`, `scraperFile` |

All scraper code, CI workflows, and the static HTML read from this file. You should not need to edit constants in `index.js`, `company.js`, `demoanaf.js`, `tests/validate-epam-jobs.js`, `docs/index.html`, or `.github/workflows/automation-testing.yml`.

**Secondary edits (cosmetic / metadata):**

| File | What to change |
|------|---------------|
| `tests/company.json` | Replace with ANAF mock for the new company |
| `UPDATE-REPO-ABOUT.md` | New description with legal name and CIF |
| `package.json` | `name` field |
| `README.md` | Title, badges (URLs to the new repo), Overview |
| `tests/validate-epam-jobs.js` | Rename to `validate-<brand>-jobs.js` |

**Critical — update test files to match the new scraper's API:**

When you replace `parseApiJobs()` in `index.js` (EPAM JSON API) with a new parser (e.g. `parseHtmlJobs()` for HTML/cheerio), you **must** update `tests/unit/index.test.js` accordingly:

- Replace the `parseApiJobs` test block with tests for the new function
- Update test data fixtures to match the new source format (e.g. HTML fragments instead of EPAM API JSON)
- Update URL generation tests — the URL construction logic changes per data source
- Also update `tests/unit/company.test.js`: replace `EPAM_ANAF_RECORD` and all hardcoded `33159615` / `EPAM SYSTEMS INTERNATIONAL SRL` values with the new company's CIF and legal name
- Also update `tests/unit/solr.test.js`: replace all hardcoded `'33159615'`, `'EPAM SYSTEMS INTERNATIONAL SRL'`, and `'EPAM'` in mock data with the new company's CIF, legal name, and brand (tests still pass with stale values since mocks are self-referential, but the hardcoded EPAM references are misleading)
- **Also update `tests/integration/workflow.test.js`** and **`tests/e2e/scraper.test.js`**: replace the `EPAM_CIF`/`TEST_CIF` constant (`33159615`) with the new CIF, update all hardcoded company name and brand assertions, and replace EPAM API URLs/parsing with the new data source's URL and parser function name

Failing to update these tests will break CI immediately — the unit test step gates all downstream pipeline steps, and integration/E2E tests run next (if they query real SOLR/ANAF data instead of mocks).

### 3. Adjust the scraper to the new data source

- Each careers site uses a different API/HTML structure — rewrite `fetchJobsPage()` and `parseApiJobs()` in `index.js` to match the new source
- Keep the **output shape identical** — `mapToJobModel()` and `transformJobsForSOLR()` should not change, so the SOLR schema stays uniform across the ecosystem
- Respect the target site's `robots.txt` — update [ROBOTS.md](ROBOTS.md) with the new analysis

### 4. Wire up CI

- The two workflows (`job-seeker-ro-spider.yml`, `automation-testing.yml`) can stay as-is — just confirm the scheduled times don't all hammer SOLR at once
- Add `SOLR_AUTH` as a repo secret
- Enable GitHub Pages (root: `docs/`)

### 5. Validate

Follow [VERIFY.md](VERIFY.md) before merging. The same 4 levels of tests (unit / integration / e2e / consistency) must all pass.

## Code Style for Contributions to This Repo

- Use ES6+ modules (`type: module` in `package.json`)
- Add tests for new features in the matching `tests/<level>/` folder
- Ensure all tests pass before submitting PR
- Update relevant `.md` files (especially `files.md` and `AGENTS.md`) when adding new files
- Reference a GitHub issue in every commit (see [ISSUES.md](ISSUES.md))

## Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/randstad-romania-nodejs-scraper.git

# Install dependencies
npm install

# Run tests
npm test
```

## Reporting Issues

Open a [GitHub Issue](https://github.com/peviitor-scrapers/randstad-romania-nodejs-scraper/issues) with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Environment details (Node version, OS)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
