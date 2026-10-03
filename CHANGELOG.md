# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-06-21

### Added
- README "Derived Scrapers": added [ulma-packaging-srl-nodejs-scraper](https://github.com/peviitor-scrapers/ulma-packaging-srl-nodejs-scraper) (ULMA PACKAGING S.R.L., CIF 47978792, TalentClue HTML + ANOFM)

## [1.5.0] - 2026-06-18

### Added
- `AI-DERIVATION-GUIDE.md` — comprehensive playbook for AI agents deriving a new scraper from this template. Consolidates lessons learned from 4 derivations (MEJIX, Talent Matchmakers, Artsoft, Continental Hotels) including 9 documented pitfalls and references to all source issues.
- `AGENTS.md` and `CONTRIBUTING.md` now reference the guide so AI agents discover it first.
- README "Derived Scrapers": added [rapel-srl-nodejs-scraper](https://github.com/peviitor-scrapers/rapel-srl-nodejs-scraper) (RAPEL SRL, CIF 5665609, jobRapid.ro HTML)
- README "Derived Scrapers": documented two new pitfalls discovered during RAPEL derivation (ANAF brand search vs CIF lookup, SOLR `_version_` conflict on re-upsert)

## [1.4.3] - 2026-06-17

### Added
- README: "Derived Scrapers" section listing [mejix-srl-nodejs-scraper](https://github.com/peviitor-scrapers/mejix-srl-nodejs-scraper) as first known derivative, with lessons learned from the first derivation
- CONTRIBUTING: "Validated in production" callout pointing to MEJIX as a working reference

### Verified
- Template pattern scales: same checklist + same pipeline produced a working scraper for a company with completely different scraping mechanics (HTML vs JSON API)

## [1.4.2] - 2026-06-17

### Removed
- Dead export `getCompanyBrand()` from `company.js` (only used by a tautological test that asserted `"EPAM" === "EPAM"`). Brand is now sourced from `config/company.json` via `companyConfig.brand`.

### Changed
- `solr.js`: `getSolrAuth()` now throws on missing `SOLR_AUTH` and is used internally by all 6 SOLR operations. Removed 6 inline duplications of `process.env.SOLR_AUTH` reads + error checks.

## [1.4.1] - 2026-06-17

### Fixed
- `index.js`: Step 6 log said "Step 4" (cosmetic console output bug)
- `company.js`: Stale JSDoc about "hardcoded COMPANY_CIF" — now reflects config + cache behavior
- `src/markdown-generator.js`: Added JSDoc for `generateJobsMarkdown()`

### Changed
- Documentation pass — `AGENTS.md`, `README.md`, `docs/README.md`, `INSTRUCTIONS.md` now reflect the post-refactor state (config/, caching, job-validator)

## [1.4.0] - 2026-06-17

### Added
- `src/job-validator.js` — shared validation primitives (`validateByHead`, `validateByContent`)
- Unit tests for the new module (9 tests)

### Changed
- `validate-jobs.js` and `tests/validate-epam-jobs.js` are now thin CLIs that delegate to `src/job-validator.js` and `solr.js` (closes #35)
- `tests/validate-epam-jobs.js` no longer reimplements SOLR auth, query, or delete — uses `querySOLR` + `deleteJobByUrl` from `solr.js`

## [1.3.0] - 2026-06-17

### Added
- `config/company.json` and `config/company.js` — single source of truth for company identity (CIF, brand, URLs, API config)
- ANAF data caching honoured at root `company.json` (committed to repo) — CI no longer hits demoANAF on every scrape; refresh threshold is 7 days
- Graceful fallback to stale cache if ANAF is unreachable
- `docs/company.json` regenerated on each scrape so the live page reads company identity dynamically

### Changed
- `index.js`, `company.js`, `demoanaf.js`, `tests/validate-epam-jobs.js`, `docs/index.html`, `automation-testing.yml` all now read from `config/company.json` instead of hardcoded constants
- CONTRIBUTING.md derivation checklist simplified — editing `config/company.json` is now the primary step

### Fixed
- Stale company.json at repo root was being ignored — codepath only checked `tmp/company.json` which is gitignored, causing every CI run to refetch from ANAF

## [1.2.0] - 2026-06-17

### Added
- Explicit "template repository" framing across README, AGENTS, CONTRIBUTING
- CONTRIBUTING.md now includes a step-by-step checklist for deriving a scraper for a new company
- Rate-limiting and politeness settings table in instructions.md

### Fixed
- CI workflows: moved `git pull --rebase` before `npm install` to avoid dirty-tree rebase failures
- PUBLIC.md test path (`tests/unit/` → `tests/consistency/`)

## [1.1.0] - 2026-06-17

### Added
- `src/markdown-generator.js` — generates `docs/jobs.md` with company info and all scraped jobs
- `docs/jobs.md` committed to repo after each scrape run (available on GitHub Pages)
- "Jobs MD" button in `docs/index.html` linking to `docs/jobs.md` (opens in new tab)
- Workflow updated to commit `docs/jobs.md` alongside test results

## [1.0.0] - 2026-04-16

### Added
- Initial release
- Job scraping from EPAM Careers Romania API
- Company validation via ANAF
- Solr integration for job storage
- GitHub Actions workflows for daily scraping and testing
- Comprehensive test suite (unit, integration, E2E)
- ANAF API fallback with cached data support
- Node 24 compatibility

### Features
- Automated daily job scraping
- Company core validation and management
- Job URL validation
- Data integrity checks
- Romanian location filtering
- Work mode normalization

## License

Copyright (c) 2024-2026 BOGA SEBASTIAN-NICOLAE
Licensed under MIT License
