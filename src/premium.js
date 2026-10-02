/**
 * premium.js - robustness helpers shared by the scrapers
 *
 *  - fetchWithRetry : exponential backoff + full jitter, honours Retry-After,
 *                     retries only transient failures (429/5xx/network), never 401/403/404
 *  - isDryRun       : `--dry-run` flag or DRY_RUN=1 -> nothing is written to Solr
 *  - assertCanary   : a scrape that suddenly returns 0 jobs must be loud, not silent
 */
import nodeFetch from "node-fetch";

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Delay in ms for the given (1-based) attempt: random in [0, min(cap, base * 2^(attempt-1))]. */
export function backoffDelay(attempt, baseMs = 2000, capMs = 60000, rand = Math.random) {
  const ceiling = Math.min(capMs, baseMs * 2 ** (attempt - 1));
  return Math.floor(rand() * ceiling);
}

/** Parses a Retry-After header (seconds or HTTP date) into ms, or null. */
export function parseRetryAfter(value, now = Date.now()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

/**
 * Drop-in replacement for node-fetch. Returns the last response when the status is not
 * retryable or attempts run out (callers keep checking res.ok exactly as before).
 * Under Jest (NODE_ENV=test) it makes a single attempt so existing mocks behave the same.
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
  const underTest = process.env.NODE_ENV === "test";
  const {
    retries = underTest ? 0 : 4,
    baseMs = 2000,
    capMs = 60000,
    maxRetryAfterMs = 120000,
    log = console.log
  } = retryOptions;

  let lastError;
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const res = await nodeFetch(url, options);
      if (!RETRYABLE_STATUS.has(res.status) || attempt > retries) return res;
      const retryAfter = parseRetryAfter(res.headers?.get?.("retry-after"));
      const wait = retryAfter !== null ? Math.min(retryAfter, maxRetryAfterMs) : backoffDelay(attempt, baseMs, capMs);
      log(`  HTTP ${res.status} from ${new URL(url).host} - retry ${attempt}/${retries} in ${wait} ms`);
      await sleep(wait);
    } catch (err) {
      lastError = err;
      if (attempt > retries) throw err;
      const wait = backoffDelay(attempt, baseMs, capMs);
      log(`  ${err.code || err.name}: ${err.message} - retry ${attempt}/${retries} in ${wait} ms`);
      await sleep(wait);
    }
  }
  throw lastError;
}

/** True when the run must not write anything (`node index.js --dry-run` or DRY_RUN=1). */
export function isDryRun() {
  return process.argv.includes("--dry-run") || process.env.DRY_RUN === "1";
}

/**
 * Canary: zero jobs from the primary source is suspicious.
 *  - always logs a warning (and a GitHub Actions ::warning:: annotation)
 *  - throws when Solr already holds `minExisting` or more jobs, so the run fails visibly
 *    instead of silently wiping or freezing the data
 */
export function assertCanary({ scraped, existing = 0, source = "source", minExisting = 5 }) {
  if (scraped > 0) return;
  const msg = `Canary: ${source} returned 0 jobs (Solr currently holds ${existing}).`;
  console.warn(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::warning title=Scraper canary::${msg}`);
  if (existing >= minExisting) {
    throw new Error(`${msg} Refusing to continue - the site layout or API probably changed.`);
  }
}
