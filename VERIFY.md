# Verification Steps

After making changes to this repo, run through these steps in order.

## 1. Rulează testele local

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:e2e
```

Toate testele trebuie să treacă (0 failed).

## 2. Verifică fiecare GitHub Actions workflow

Pentru fiecare workflow din `.github/workflows/`:

| Workflow | Trigger | Ce verifici |
|----------|---------|-------------|
| `job-seeker-ro-spider.yml` | `workflow_dispatch` | Rulează scraperul → jobs in SOLR + docs/jobs.md generat |
| `automation-testing.yml` | `workflow_dispatch` | Toate testele + validare job-uri + company core |

### Cum verifici:

1. Mergi pe GitHub → Actions → selectează workflow-ul
2. Apasă **Run workflow** (pe `main`)
3. Așteaptă să se termine
4. Verifică că toate job-urile sunt **green (PASS)**
5. Dacă un job eșuează → oprește-te, repară, reîncepe de la pasul 1

## 3. Rulează scraperul prin GitHub Actions (ultimul pas)

1. Mergi la **Actions** → **Oportunitati SI Cariere** (`job-seeker-ro-spider.yml`)
2. Apasă **Run workflow** → lasă `main`
3. Așteaptă să se termine
4. Verifică în SOLR că job-urile companiei apar:
   ```bash
   # CIF-ul companiei
   curl --user "${SOLR_AUTH}" "https://solr.peviitor.ro/solr/job/select?q=cif:CIF&rows=10"
   ```
5. Verifică că `docs/jobs.md` a fost generat și este accesibil:
   - https://peviitor-scrapers.github.io/randstad-romania-nodejs-scraper/jobs.md
6. Verifică pe https://peviitor.ro că job-urile sunt vizibile

## 4. Final

Dacă toți pașii de mai sus sunt verzi, modificarea e gata de merge.
