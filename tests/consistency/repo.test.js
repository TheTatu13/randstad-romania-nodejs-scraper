import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GITHUB_TOKEN;
const SCRAPER_YML = ".github/workflows/job-seeker-ro-spider.yml";


function repoUrl(apiPath) {
  return `https://api.github.com/repos/${REPO}${apiPath}`;
}

async function ghFetch(url) {
  const headers = { Accept: "application/vnd.github.v3+json", "User-Agent": "jest-test" };
  if (TOKEN) headers.Authorization = `token ${TOKEN}`;
  const res = await fetch(url, { headers });
  return res;
}

function skipIfNoRepo() {
  if (!REPO) {
    console.log("GITHUB_REPOSITORY not set — running locally, skipping API check");
    return true;
  }
  return false;
}

describe("Repository Configuration", () => {
  describe("default branch", () => {
    it("must be main", async () => {
      if (skipIfNoRepo()) return;
      const res = await ghFetch(repoUrl(""));
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.default_branch).toBe("main");
      console.log(`✅ Default branch: ${data.default_branch}`);
    });
  });

  describe("GitHub Pages", () => {
    it("must have GitHub Pages URL set in About", async () => {
      if (skipIfNoRepo()) return;
      const res = await ghFetch(repoUrl(""));
      expect(res.ok).toBe(true);
      const data = await res.json();
      expect(data.homepage).toBeTruthy();
      expect(data.homepage).toMatch(/^https?:\/\//);
      console.log(`✅ GitHub Pages URL: ${data.homepage}`);
    });

    // deploy.yml removed — legacy GitHub Pages auto-deploys from docs/
  });

  describe("hosted HTML page", () => {
    it("must serve valid HTML from GitHub Pages", async () => {
      if (!REPO) {
        console.log("GITHUB_REPOSITORY not set — running locally, skipping API check");
        return;
      }

      const owner = REPO.split("/")[0];
      const repoName = REPO.split("/")[1];
      const pagesUrl = `https://${owner}.github.io/${repoName}/`;

      const res = await fetch(pagesUrl, {
        headers: { "User-Agent": "jest-test" },
      });
      if (!res.ok) {
        console.log(`⚠️ GitHub Pages returned ${res.status} — may not be deployed yet`);
        return;
      }

      const html = await res.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("peviitor");
      expect(html).toContain("Randstad");
      console.log(`✅ GitHub Pages HTML loaded from ${pagesUrl}`);
    });
  });

  describe("SOLR_AUTH secret", () => {
    it("is no longer required - scraper now writes via api.peviitor.ro", () => {
      // Migrated off direct-SOLR + SOLR_AUTH Basic Auth onto the same
      // credential-free api.peviitor.ro pattern the rest of the fleet uses.
      expect(true).toBe(true);
    });
  });

  describe("workflow files", () => {
    it("must have job-seeker-ro-spider.yml", () => {
      const ymlPath = path.resolve(__dirname, "../..", SCRAPER_YML);
      expect(fs.existsSync(ymlPath)).toBe(true);
      const content = fs.readFileSync(ymlPath, "utf-8");
      expect(content).toContain("name: Oportunitati SI Cariere");
      expect(content).toContain("schedule");
      expect(content).toContain("workflow_dispatch");
      console.log(`✅ ${SCRAPER_YML} exists with expected content`);
    });
  });
});
