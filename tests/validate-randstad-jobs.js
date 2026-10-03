/**
 * Randstad-Specific Job URL Validator (fast, used by CI)
 *
 * Quick nightly cleanup pass over jobs in SOLR. Uses HEAD requests only.
 * Called by .github/workflows/automation-testing.yml on the scheduled run.
 *
 * For deep content-aware validation across any CIF, see validate-jobs.js
 * at the repo root.
 *
 * Flags:
 *   --dry-run    Show invalid jobs but do not delete
 *   --delete     Delete invalid jobs from SOLR after listing
 */
import companyConfig from "../config/company.js";
import { querySOLR, deleteJobByUrl } from "../solr.js";
import { validateByHead } from "../src/job-validator.js";

const CIF = companyConfig.cif;
const COMPANY = companyConfig.legalName;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const doDelete = process.argv.includes("--delete");

  console.log(`=== Validating ${COMPANY} (CIF: ${CIF}) ===\n`);

  const result = await querySOLR(CIF);
  console.log(`Total jobs in SOLR: ${result.numFound}`);

  if (result.numFound === 0) {
    console.log("No jobs to validate.");
    return;
  }

  const invalid = [];
  for (const job of result.docs) {
    const check = await validateByHead(job.url);
    console.log(`[${check.httpStatus}] ${job.title}`);
    if (check.status !== "active") invalid.push(job);
  }

  if (invalid.length === 0) {
    console.log("\n✅ All jobs valid");
    return;
  }

  console.log(`\n⚠️ ${invalid.length} invalid jobs found`);
  if (dryRun) {
    console.log("(dry run — no deletions performed)");
    return;
  }
  if (doDelete) {
    for (const job of invalid) {
      await deleteJobByUrl(job.url);
      console.log(`Deleted: ${job.title}`);
    }
  }
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
