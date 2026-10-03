# job_seeker_ro_spider

**job_seeker_ro_spider** — scraper pentru job-urile Randstad Romania.

Extrage anunțurile de pe [Randstad Romania](https://www.randstad.ro/jobs/) și [jobRapid.ro](https://www.jobrapid.ro) și le publică în [peviitor.ro](https://peviitor.ro) prin API-ul SOLR.

## Identificare

Toate request-urile HTTP folosesc User-Agent-ul:

```
job_seeker_ro_spider
```

## Ce face

1. **Validează compania** — interoghează API-ul public ANAF ([demoanaf.ro](https://demoanaf.ro)) după CIF-ul Randstad (17549799) și verifică:
   - Denumirea oficială: RANDSTAD ROMANIA SRL
   - Status: activ/inactiv/radiat
   - Adresa completă din registrul comerțului
2. **Cross-validează cu Peviitor** — verifică existența companiei în API-ul Peviitor
3. **Scrape-uiește job-urile** — extrage lista de job-uri de pe randstad.ro și jobRapid.ro prin HTML scraping (cheerio)
4. **Transformă datele** — normalizează locațiile, păstrează job-urile existente din surse cunoscute
5. **Stochează în SOLR** — șterge job-urile vechi și upsert în `job` core + `company` core
6. **Generează docs/jobs.md** — fișier markdown cu informații companie + toate job-urile curente, publicat pe [GitHub Pages](https://peviitor-scrapers.github.io/randstad-romania-nodejs-scraper/jobs.md)

## Structură proiect

```
├── config/company.json         # Sursa unică de adevăr (CIF, brand, URL-uri)
├── config/company.js           # Loader ESM pentru config/company.json
├── index.js                    # Orchestrator principal
├── company.js                  # Validare companie (ANAF + Peviitor + SOLR) cu cache 7 zile
├── demoanaf.js                 # CLI wrapper pentru src/anaf.js
├── src/anaf.js                 # Modul ANAF API (search + company details)
├── src/markdown-generator.js   # Generează docs/jobs.md după scrape
├── src/job-validator.js        # Primitivă comună: validateByHead, validateByContent
├── solr.js                     # Operații SOLR (query, upsert, delete, company)
├── company.json                # Cache ANAF (committed, TTL 7 zile, fallback la stale)
├── ROBOTS.md          # Analiză robots.txt și politici de scraping
├── tests/
│   ├── unit/          # Teste unitare
│   ├── integration/   # Teste de integrare (ANAF + SOLR live)
│   └── e2e/           # Teste end-to-end (pipelin complet)
└── .github/workflows/
    ├── job-seeker-ro-spider.yml     # Rulează zilnic la 6 AM UTC
    └── automation-testing.yml       # Teste automate la fiecare push/PR
```

## API-uri folosite

| API | URL | Autentificare |
|---|---|---|
| Randstad | `https://www.randstad.ro/jobs/` | Public |
| jobRapid | `https://www.jobrapid.ro` | Public |
| ANOFM | `https://mediere.anofm.ro/api/entity/vw_public_job_posting` | Public |
| ANAF (demoanaf) | `https://demoanaf.ro/api/...` | Public |
| Peviitor | `https://api.peviitor.ro/v1/company/` | Public |
| SOLR (job core) | `https://solr.peviitor.ro/solr/job` | `SOLR_AUTH` |
| SOLR (company core) | `https://solr.peviitor.ro/solr/company` | `SOLR_AUTH` |

## Robots.txt

Randstad.ro permite accesul la `/jobs/` în robots.txt.

jobRapid.ro dezactivează secțiunile de căutare dar permite accesul la paginile individuale de job.

Scraper-ul folosește HTML scraping cu respectarea ratelor de request și un singur User-Agent identificabil.

Pentru analiza completă, vezi [ROBOTS.md](../ROBOTS.md).

## Testare

```bash
# Toate testele
npm test

# Doar unitare
npm run test:unit

# Doar integrare (necesită ANAF live, SOLR conditional)
npm run test:integration

# Doar E2E (API-uri reale + ANAF + SOLR)
npm run test:e2e
```

Testele SOLR folosesc `itIfSolr` — se auto-skip dacă variabila `SOLR_AUTH` nu e setată.
