import { jest } from '@jest/globals';

jest.unstable_mockModule('node-fetch', () => ({ default: jest.fn() }));

const { default: nodeFetch } = await import('node-fetch');
const { fetchWithRetry, backoffDelay, parseRetryAfter, assertCanary, isDryRun } = await import('../../src/premium.js');

const res = (status, headers = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null }
});
const quiet = { baseMs: 0, capMs: 0, log: () => {} };

describe('src/premium.js', () => {
  beforeEach(() => nodeFetch.mockReset());

  describe('fetchWithRetry', () => {
    it('returns immediately on success', async () => {
      nodeFetch.mockResolvedValueOnce(res(200));
      const r = await fetchWithRetry('https://example.com/a', {}, { ...quiet, retries: 3 });
      expect(r.ok).toBe(true);
      expect(nodeFetch).toHaveBeenCalledTimes(1);
    });

    it('retries 503 then succeeds', async () => {
      nodeFetch.mockResolvedValueOnce(res(503)).mockResolvedValueOnce(res(200));
      const r = await fetchWithRetry('https://example.com/a', {}, { ...quiet, retries: 3 });
      expect(r.status).toBe(200);
      expect(nodeFetch).toHaveBeenCalledTimes(2);
    });

    it('does not retry 404 / 403 / 401', async () => {
      for (const status of [404, 403, 401]) {
        nodeFetch.mockReset();
        nodeFetch.mockResolvedValue(res(status));
        const r = await fetchWithRetry('https://example.com/a', {}, { ...quiet, retries: 3 });
        expect(r.status).toBe(status);
        expect(nodeFetch).toHaveBeenCalledTimes(1);
      }
    });

    it('gives the last response back when attempts run out', async () => {
      nodeFetch.mockResolvedValue(res(500));
      const r = await fetchWithRetry('https://example.com/a', {}, { ...quiet, retries: 2 });
      expect(r.status).toBe(500);
      expect(nodeFetch).toHaveBeenCalledTimes(3);
    });

    it('retries network errors and rethrows the last one', async () => {
      nodeFetch.mockRejectedValue(new Error('ECONNRESET'));
      await expect(fetchWithRetry('https://example.com/a', {}, { ...quiet, retries: 2 })).rejects.toThrow('ECONNRESET');
      expect(nodeFetch).toHaveBeenCalledTimes(3);
    });

    it('makes a single attempt under Jest by default', async () => {
      nodeFetch.mockResolvedValue(res(500));
      const r = await fetchWithRetry('https://example.com/a');
      expect(r.status).toBe(500);
      expect(nodeFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('backoffDelay / parseRetryAfter', () => {
    it('grows exponentially and respects the cap', () => {
      const max = () => 0.999999;
      expect(backoffDelay(1, 2000, 60000, max)).toBeLessThan(2000);
      expect(backoffDelay(3, 2000, 60000, max)).toBeLessThan(8000);
      expect(backoffDelay(10, 2000, 60000, max)).toBeLessThan(60000);
      expect(backoffDelay(2, 2000, 60000, () => 0)).toBe(0);
    });

    it('parses seconds and HTTP dates', () => {
      expect(parseRetryAfter('3')).toBe(3000);
      expect(parseRetryAfter(null)).toBeNull();
      expect(parseRetryAfter('garbage')).toBeNull();
      const now = Date.parse('2026-01-01T00:00:00Z');
      expect(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', now)).toBe(10000);
    });
  });

  describe('assertCanary', () => {
    it('is silent when jobs were found', () => {
      expect(() => assertCanary({ scraped: 3, existing: 50 })).not.toThrow();
    });

    it('only warns when nothing is lost (few jobs in Solr)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => assertCanary({ scraped: 0, existing: 2, source: 'x' })).not.toThrow();
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('throws when 0 jobs but Solr already holds many', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(() => assertCanary({ scraped: 0, existing: 12, source: 'x' })).toThrow(/Canary/);
      warn.mockRestore();
    });
  });

  describe('isDryRun', () => {
    it('follows DRY_RUN=1', () => {
      const old = process.env.DRY_RUN;
      process.env.DRY_RUN = '1';
      expect(isDryRun()).toBe(true);
      delete process.env.DRY_RUN;
      expect(isDryRun()).toBe(false);
      if (old !== undefined) process.env.DRY_RUN = old;
    });
  });
});
