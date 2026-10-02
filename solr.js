/**
 * Solr Database Module
 * 
 * PURPOSE: Provides interface to Solr database for storing and retrieving
 * job listings and company data. Solr is used as the primary data store
 * for the peviitor.ro job aggregation system.
 * 
 * This module handles:
 * - Querying jobs by company CIF
 * - Querying company data
 * - Adding/updating (upserting) jobs
 * - Deleting jobs by CIF or URL
 * - URL validation and cleanup
 * 
 * Solr Cores:
 * - job: Stores individual job listings
 * - company: Stores company metadata
 */

import { fetchWithRetry as fetch, isDryRun } from "./src/premium.js";
import fs from "fs";
import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env.local");
} catch {
  // .env.local may not exist in CI — SOLR_AUTH comes from GitHub Secrets
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Solr core URLs
const SOLR_URL = "https://solr.peviitor.ro/solr/job";        // Job listings core
const SOLR_COMPANY_URL = "https://solr.peviitor.ro/solr/company"; // Company core

// HTTP request timeout in milliseconds
const TIMEOUT = 10000;

/**
 * Returns the SOLR_AUTH credential string ("user:password") from the environment,
 * throwing if it is missing. All SOLR operations in this module use this helper
 * so the error message stays consistent.
 *
 * @returns {string} The SOLR_AUTH credential string
 * @throws {Error} If SOLR_AUTH is not set
 */
export function getSolrAuth() {
  const auth = process.env.SOLR_AUTH;
  if (!auth) throw new Error("SOLR_AUTH not set in environment");
  return auth;
}

// ============================================================================
// JOB OPERATIONS - Query, Add, Update, Delete
// ============================================================================

/**
 * Queries jobs from Solr by company CIF
 * @param {string} cif - Company CIF/CUI to search for
 * @returns {Promise<Object>} - Solr response with numFound and docs array
 */
export async function querySOLR(cif) {
  if (isDryRun() && !process.env.SOLR_AUTH) {
    console.log('[dry-run] no SOLR_AUTH - assuming no existing jobs');
    return { numFound: 0, docs: [] };
  }
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({
    q: `cif:${cif}`,  // Query by CIF field
    rows: 100,        // Limit results
    wt: "json"        // Return JSON format
  });

  const res = await fetch(`${SOLR_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

// ============================================================================
// COMPANY OPERATIONS - Query and Upsert company data in Solr
// ============================================================================

/**
 * Upserts (adds or updates) a company document to the SOLR company core
 * @param {Object} companyDoc - Company document with id, company, brand, status, location, etc.
 */
export async function upsertCompany(companyDoc) {
  if (isDryRun()) { console.log('[dry-run] upsertCompany skipped'); return; }
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  const res = await fetch(`${SOLR_COMPANY_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: JSON.stringify([companyDoc])
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Company "${companyDoc.company}" upserted to SOLR company core.`);
}

// ============================================================================

/**
 * Queries company data from Solr company core
 * @param {string} companyQuery - Solr query string (e.g., "company:EPAM*" or "id:33159615")
 * @returns {Promise<Object>} - Solr response with company docs
 */
export async function queryCompanySOLR(companyQuery) {
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({
    q: companyQuery,
    rows: 10,
    wt: "json"
  });

  const res = await fetch(`${SOLR_COMPANY_URL}/select?${params}`, {
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "User-Agent": "job_seeker_ro_spider"
    }
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR company query error: ${res.status} - ${text}`);
  }

  const data = await res.json();
  return data.response;
}

// ============================================================================
// DELETE OPERATIONS - Remove jobs from Solr
// ============================================================================

/**
 * Deletes all jobs for a company by CIF
 * Used when a company becomes inactive in ANAF
 * @param {string} cif - Company CIF to delete jobs for
 */
export async function deleteJobsByCIF(cif) {
  if (isDryRun()) { console.log('[dry-run] deleteJobsByCIF skipped'); return; }
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  // Use Solr delete by query
  const deleteQuery = JSON.stringify({
    delete: { query: `cif:${cif}` }
  });

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: deleteQuery
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR delete error: ${res.status} - ${text}`);
  }

  console.log("✅ Jobs deleted from SOLR.");
}

/**
 * Deletes a single job by its URL
 * Used when a job posting is no longer available
 * @param {string} url - Job URL to delete
 */
export async function deleteJobByUrl(url) {
  if (isDryRun()) { console.log('[dry-run] deleteJobByUrl skipped'); return; }
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  const deleteQuery = JSON.stringify({
    delete: { query: `url:"${url}"` }
  });

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body: deleteQuery
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR delete error: ${res.status} - ${text}`);
  }
}

// ============================================================================
// UPSERT OPERATIONS - Add or update jobs
// ============================================================================

/**
 * Upserts (adds or updates) jobs to Solr
 * Jobs are matched by URL - if URL exists, job is updated; otherwise, new job is added
 * @param {Array} jobs - Array of job objects to upsert
 */
export async function upsertJobs(jobs) {
  if (isDryRun()) { console.log('[dry-run] upsertJobs skipped'); return; }
  const AUTH = getSolrAuth();

  const params = new URLSearchParams({ commit: "true" });

  const body = JSON.stringify(jobs);

  const res = await fetch(`${SOLR_URL}/update?${params}`, {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from(AUTH).toString("base64"),
      "Content-Type": "application/json",
      "User-Agent": "job_seeker_ro_spider"
    },
    body
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SOLR upsert error: ${res.status} - ${text}`);
  }

  console.log(`✅ Upserted ${jobs.length} jobs to SOLR.`);
}

// ============================================================================
// URL VALIDATION - Verify job URLs are still active
// ============================================================================

/**
 * Checks if a job URL is still valid (returns 200 OK)
 * @param {string} url - URL to check
 * @returns {Promise<Object>} - Status info {url, status, valid, error}
 */
async function checkUrl(url) {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      timeout: TIMEOUT,
      headers: { "User-Agent": "job_seeker_ro_spider" }
    });
    return { url, status: res.status, valid: res.ok };
  } catch (err) {
    return { url, status: 0, valid: false, error: err.message };
  }
}

// ============================================================================
// VERIFICATION WORKFLOW - Check and clean up invalid URLs
// ============================================================================

/**
 * Verifies job URLs in jobs_existing.json and removes invalid ones
 * This is used for post-scrape cleanup of expired job postings
 */
async function runVerification(cif) {
  console.log("=== Verify SOLR Jobs ===\n");

  // Get current jobs from Solr
  const result = await querySOLR(cif);
  console.log(`Total jobs in SOLR for CIF ${cif}: ${result.numFound}`);

  console.log("\nFirst 5 jobs:");
  result.docs.slice(0, 5).forEach((job, i) => {
    console.log(`${i+1}. ${job.title} (${job.location?.join(', ')}) - ${job.workmode}`);
  });

  // Check jobs from backup file
  if (fs.existsSync("tmp/jobs_existing.json")) {
    console.log("\n=== Verify existing URLs ===\n");
    const existing = JSON.parse(fs.readFileSync("tmp/jobs_existing.json", "utf-8"));
    const existingJobs = existing.jobs || [];
    console.log(`Checking ${existingJobs.length} URLs...`);

    // Check each URL
    const invalidUrls = [];
    for (let i = 0; i < existingJobs.length; i++) {
      const job = existingJobs[i];
      const res = await checkUrl(job.url);
      console.log(`[${i+1}/${existingJobs.length}] ${res.status > 0 ? res.status : 'ERR'} - ${job.url}`);
      if (!res.valid) invalidUrls.push(job.url);
    }

    // Delete invalid URLs from Solr
    if (invalidUrls.length > 0) {
      console.log(`\n⚠️ ${invalidUrls.length} invalid URLs found - deleting from SOLR...`);
      for (const url of invalidUrls) {
        await deleteJobByUrl(url);
      }
      console.log(`✅ Deleted ${invalidUrls.length} invalid jobs from SOLR`);
    }

    // Clean up backup file
    if (invalidUrls.length === 0) {
      console.log("\n✅ All URLs valid - deleting tmp/jobs_existing.json");
      fs.unlinkSync("tmp/jobs_existing.json");
    } else {
      console.log("⚠️ Keeping tmp/jobs_existing.json for reference");
    }
  }
}

// ============================================================================
// EXTRACT WORKFLOW - Backup jobs before scraping
// ============================================================================

/**
 * Extracts current jobs from Solr and saves to backup file
 * Used before scraping to preserve existing job data
 * @param {string} cif - Company CIF
 */
async function runExtract(cif) {
  console.log("=== Extract existing jobs from SOLR ===\n");

  try {
    const result = await querySOLR(cif);
    console.log(`Found ${result.numFound} existing jobs in SOLR for CIF ${cif}`);

    if (result.numFound === 0) {
      console.log("No existing jobs to backup.");
      return;
    }

    // Save backup
    const backup = {
      extractedAt: new Date().toISOString(),
      cif: cif,
      count: result.numFound,
      jobs: result.docs
    };

    fs.writeFileSync("tmp/jobs_existing.json", JSON.stringify(backup, null, 2), "utf-8");
    console.log("\n✅ Saved existing jobs to tmp/jobs_existing.json\n");
  } catch (err) {
    console.error("Failed to extract existing jobs:", err.message);
    process.exit(1);
  }
}

// ============================================================================
// COMPANY QUERY WORKFLOW - Query company core
// ============================================================================

/**
 * Queries companies from Solr company core
 * Useful for debugging and verification
 * @param {Array} args - Command line arguments
 */
async function runCompanyQuery(args) {
  console.log("=== Query Company in SOLR ===\n");
  
  const query = args[1] || "company:EPAM*";
  console.log(`Query: ${query}`);
  
  const result = await queryCompanySOLR(query);
  console.log(`Found ${result.numFound} companies`);
  
  if (result.docs?.length) {
    console.log("\nFirst company:");
    console.log(JSON.stringify(result.docs[0], null, 2));
  }
}

// ============================================================================
// STANDALONE MODE - Run solr.js directly for maintenance tasks
// ============================================================================

/**
 * Usage:
 *   node solr.js <CIF>              - Verify jobs for a company
 *   node solr.js extract <CIF>      - Extract jobs to backup file
 *   node solr.js company            - Query companies
 */
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("solr.js")) {
  const args = process.argv.slice(2);
  
  if (args.includes("extract")) {
    // Extract mode: backup jobs to file
    const cif = args[1] || null;
    if (!cif) {
      console.error("Error: CIF required. Usage: node solr.js extract <CIF>");
      process.exit(1);
    }
    await runExtract(cif);
  } else if (args.includes("company")) {
    // Company query mode
    await runCompanyQuery(args);
  } else {
    // Verification mode
    const cif = args[0] || null;
    if (!cif) {
      console.error("Error: CIF required. Usage: node solr.js <CIF>");
      process.exit(1);
    }
    await runVerification(cif);
  }
}
