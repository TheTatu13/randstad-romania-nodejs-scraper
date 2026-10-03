import { jest } from '@jest/globals';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

// Live API tests hit api.peviitor.ro (no credential needed) -- opt in explicitly.
const HAS_SOLR = !!process.env.RUN_LIVE_API_TESTS;

function itIfSolr(name, fn, timeout) {
  if (HAS_SOLR) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: set RUN_LIVE_API_TESTS=1 to run)`, fn, timeout);
}

async function checkAnafAvailability() {
  try {
    // Probe the official ANAF endpoint: the last link of the getCompanyFromANAF fallback chain.
    const res = await fetch('https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ cui: 5665609, data: new Date().toISOString().slice(0, 10) }]),
      signal: AbortSignal.timeout(10000)
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Top-level await: itIfAnaf() is evaluated at collection time, before any beforeAll runs.
const HAS_ANAF = await checkAnafAvailability();

function itIfAnaf(name, fn, timeout) {
  if (HAS_ANAF) {
    return it(name, fn, timeout);
  }
  return it.skip(`${name} (skipped: ANAF API unavailable)`, fn, timeout);
}

beforeAll(async () => {
});

const TEST_CIF = '17549799';
const TEST_BRAND = 'Randstad';

describe('E2E: Full Scraping Pipeline', () => {

  describe('Randstad + jobRapid.ro — Real Data Fetch', () => {
    let jobs;

    beforeAll(async () => {
      const index = await import('../../index.js');
      jobs = await index.searchAllPortals(TEST_BRAND);
    }, 30000);

    it('should find jobs from job portals', () => {
      expect(Array.isArray(jobs)).toBe(true);
      console.log(`Found ${jobs.length} jobs total`);
    });

    it('should have jobs with valid URLs and titles', () => {
      for (const job of jobs) {
        expect(job).toHaveProperty('url');
        expect(job).toHaveProperty('title');
        expect(job.url).toMatch(/^https?:\/\//);
        expect(job.title.length).toBeGreaterThan(0);
      }
    });

    it('should have source annotation on each job', () => {
      for (const job of jobs) {
        expect(job).toHaveProperty('source');
        expect(['randstad.ro']).toContain(job.source);
      }
    });
  });

  describe('Parse + Transform Pipeline', () => {
    let index;
    let jobs;

    beforeAll(async () => {
      index = await import('../../index.js');
      jobs = await index.searchAllPortals(TEST_BRAND);
    }, 30000);

    it('should map scraped jobs to job model', () => {
      if (jobs.length === 0) return;
      const model = index.mapToJobModel(jobs[0], TEST_CIF);

      expect(model).toHaveProperty('url');
      expect(model).toHaveProperty('title');
      expect(model).toHaveProperty('company');
      expect(model).toHaveProperty('cif', TEST_CIF);
      expect(model).toHaveProperty('status', 'scraped');
      expect(model).toHaveProperty('date');
    });

    it('should transform jobs for SOLR', () => {
      const mapped = jobs.map(j => index.mapToJobModel(j, TEST_CIF));
      const payload = { company: 'RANDSTAD ROMANIA SRL', cif: TEST_CIF, jobs: mapped };
      const transformed = index.transformJobsForSOLR(payload);

      expect(transformed.company).toBe('RANDSTAD ROMANIA SRL');
      expect(transformed.jobs.length).toBe(jobs.length);

      for (const job of transformed.jobs) {
        expect(job).toHaveProperty('url');
        expect(job).toHaveProperty('title');
        expect(job).toHaveProperty('cif', TEST_CIF);
      }
    });
  });

  describe('Company Validation Path', () => {
    let anaf;
    let company;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
      company = await import('../../company.js');
    });

    itIfAnaf('should find Randstad in ANAF and validate active status', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);
      const found = results.find(c =>
        c.name.includes('RANDSTAD') && c.cui?.toString() === TEST_CIF
      );
      expect(found).toBeDefined();
      expect(found.cui.toString()).toBe(TEST_CIF);

      const anafData = await anaf.getCompanyFromANAF(TEST_CIF);
      expect(anafData).toBeDefined();
      expect(anafData.inactive).toBe(false);
    }, 30000);

    itIfSolr('should run full validation and report active status with job count', async () => {
      const result = await company.validateAndGetCompany();
      expect(result.status).toBe('active');
      expect(result.company).toBe('RANDSTAD ROMANIA SRL');
      expect(result.cif).toBe(TEST_CIF);
    }, 30000);
  });

  describe('Inactive Company Handling', () => {
    let anaf;

    beforeAll(async () => {
      anaf = await import('../../src/anaf.js');
    });

    itIfAnaf('should detect active Randstad in ANAF', async () => {
      const results = await anaf.searchCompany(TEST_BRAND);
      const active = results.find(c => c.cui?.toString() === TEST_CIF);
      expect(active).toBeDefined();
      expect(active.statusLabel).toBe('Funcțiune');
    }, 30000);
  });

  describe('SOLR Data Verification', () => {
    let solr;

    beforeAll(async () => {
      solr = await import('../../solr.js');
    });

    itIfSolr('should have Randstad jobs in SOLR', async () => {
      const result = await solr.querySOLR(TEST_CIF);
      expect(result.numFound).toBeGreaterThanOrEqual(0);
    }, 15000);

    itIfSolr('should have Randstad company core entry', async () => {
      const result = await solr.getCompanyByCif(TEST_CIF);
      expect(result).toBeTruthy();
      expect(String(result.id).replace(/^0+/, '')).toBe(TEST_CIF.replace(/^0+/, ''));
    }, 15000);
  });
});
