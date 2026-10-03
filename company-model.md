# Company Model Schema

## Required Fields

| Field   | Type   | Description |
|---------|--------|-------------|
| id      | string | CIF/CUI of the company (8 digits, no RO prefix) |
| company | string | Legal name from Trade Register. DIACRITICS REQUIRED. Use uppercase |

## Optional Fields

| Field        | Type     | Description |
|--------------|----------|-------------|
| brand        | string   | Commercial brand name (e.g. "EPAM") |
| group        | string   | Parent company group (e.g. "EPAM Systems") |
| status       | string   | "activ", "suspendat", "inactiv", or "radiat" |
| location     | string[] | Romanian cities/addresses. DIACRITICS ACCEPTED. Multi-valued array |
| website      | string[] | Official company website. Must be valid HTTP/HTTPS URL |
| career       | string[] | Official career/jobs page. Must be valid HTTP/HTTPS URL |
| lastScraped  | string   | Date of last scrape in ISO8601 format |
| scraperFile  | string   | URL to scraper workflow YML file (github raw URL) |

## Notes

- Fields marked `string[]` are multi-valued arrays stored as arrays in SOLR/OpenSearch
- Company status "activ" means jobs should be kept, otherwise remove jobs
- website and career should be canonical URLs without trailing slash
- **scraperFile**: Full URL to GitHub raw workflow YML (e.g. `https://raw.githubusercontent.com/peviitor-scrapers/randstad-romania-nodejs-scraper/main/.github/workflows/job-seeker-ro-spider.yml`)