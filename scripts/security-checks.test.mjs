import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateAudit } from "./audit-dependencies.mjs";
import { assertStaticOutput } from "./check-static-output.mjs";
import { buildSecurity } from "./build-security.mjs";
import { assertHardenedCache, cacheGuard, cacheVersion, hardenCache } from "./harden-cache.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const cacheFile = require.resolve("http-cache-semantics");
await assertHardenedCache(root);
const CachePolicy = require("http-cache-semantics");

function cleanAudit() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {},
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } },
  };
}

test("requires a clean audit without advisory exceptions", () => {
  assert.equal(evaluateAudit(cleanAudit(), 0), "clean");
  for (const severity of ["low", "moderate", "high", "critical"]) {
    const report = cleanAudit();
    report.vulnerabilities["http-cache-semantics"] = { severity };
    report.metadata.vulnerabilities[severity] = report.metadata.vulnerabilities.total = 1;
    assert.throws(() => evaluateAudit(report, 1), /no advisory exceptions/);
  }
});

test("rejects malformed reports and failed registry requests", () => {
  for (const code of [1, 2, null]) assert.throws(() => evaluateAudit(cleanAudit(), code));
  assert.throws(() => evaluateAudit({ error: { code: "EAI_AGAIN" } }, 1));
  for (const findings of [[], 7, "", null]) {
    const report = cleanAudit();
    report.vulnerabilities = findings;
    assert.throws(() => evaluateAudit(report, 0));
  }
  for (const mutate of [
    (report) => {
      report.auditReportVersion = 3;
    },
    (report) => {
      report.metadata.vulnerabilities.total = 1;
    },
    (report) => {
      report.metadata.vulnerabilities.high = 1;
    },
    (report) => {
      report.error = { code: "EAI_AGAIN" };
    },
  ]) {
    const report = cleanAudit();
    mutate(report);
    assert.throws(() => evaluateAudit(report, 0));
  }
});

const request = { url: "https://example.com/account", method: "GET", headers: { host: "example.com" } };
function policy(headers, req = request) {
  const instance = new CachePolicy(req, { status: 200, headers });
  const created = instance.now();
  instance.now = () => created + 120_000;
  return instance;
}

test("max-stale cannot revive private, no-store, no-cache, cookie, or revalidation-only responses", () => {
  const cases = [
    { "cache-control": "private, max-age=60", "set-cookie": "session=private-fixture" },
    { "cache-control": "no-store, max-age=60", "set-cookie": "session=no-store-fixture" },
    { "cache-control": "no-cache, max-age=60", "set-cookie": "session=no-cache-fixture" },
    { "set-cookie": "session=cookie-fixture" },
    { "cache-control": "proxy-revalidate, max-age=60" },
    { "cache-control": "public, max-age=0" },
    { "cache-control": "private, stale-while-revalidate=3600" },
  ];
  for (const headers of cases) {
    for (const maxStale of ["max-stale", "max-stale=999999999"]) {
      const instance = policy(headers);
      for (const candidate of [instance, CachePolicy.fromObject(instance.toObject())]) {
        const next = { ...request, headers: { ...request.headers, "cache-control": maxStale } };
        assert.equal(candidate.satisfiesWithoutRevalidation(next), false, JSON.stringify(headers));
        const result = candidate.evaluateRequest(next);
        assert.equal(result.response, undefined);
        assert.equal(result.revalidation.synchronous, true);
      }
    }
  }
  const authenticated = policy({ "cache-control": "max-age=60" }, { ...request, headers: { ...request.headers, authorization: "Bearer fixture" } });
  assert.equal(authenticated.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale" } }), false);
});

test("preserves fresh public cache hits and explicitly allowed stale public entries", () => {
  const fresh = policy({ "cache-control": "public, max-age=600" });
  assert.equal(fresh.satisfiesWithoutRevalidation(request), true);
  const stale = policy({ "cache-control": "public, max-age=60" });
  assert.equal(stale.satisfiesWithoutRevalidation(request), false);
  assert.equal(stale.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale=180" } }), true);
});

test("hardening is idempotent and rejects unknown sources, missing guards, and changed versions", async () => {
  const isolated = await mkdtemp(path.join(tmpdir(), "mahad-cache-security-"));
  try {
    const directory = path.join(isolated, "node_modules/http-cache-semantics");
    await mkdir(directory, { recursive: true });
    const hardened = await readFile(cacheFile, "utf8");
    const upstream = hardened.replace(cacheGuard, "");
    await writeFile(
      path.join(isolated, "package-lock.json"),
      JSON.stringify({ packages: { "node_modules/http-cache-semantics": { version: cacheVersion } } })
    );
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "http-cache-semantics", version: cacheVersion, main: "index.js" }));
    const source = path.join(directory, "index.js");
    await writeFile(source, upstream);
    const UpstreamCachePolicy = require(source);
    const unsafe = new UpstreamCachePolicy(request, { status: 200, headers: { "set-cookie": "session=regression-fixture" } });
    assert.equal(unsafe.satisfiesWithoutRevalidation({ ...request, headers: { ...request.headers, "cache-control": "max-stale=999999999" } }), true);
    await assert.rejects(assertHardenedCache(isolated), /guard is missing/);
    await hardenCache(isolated);
    await hardenCache(isolated);
    assert.equal(await readFile(source, "utf8"), hardened);
    await writeFile(source, upstream + "\n// unexpected source\n");
    await assert.rejects(hardenCache(isolated), /Unknown cache source/);
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ name: "http-cache-semantics", version: cacheVersion, main: "index.js", exports: "./other.js" })
    );
    await assert.rejects(hardenCache(isolated), /export map changed/);
    await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "http-cache-semantics", version: cacheVersion, main: "index.js" }));
    await writeFile(
      path.join(isolated, "package-lock.json"),
      JSON.stringify({ packages: { "node_modules/http-cache-semantics": { version: "4.3.1" } } })
    );
    await assert.rejects(hardenCache(isolated), /dependency changed/);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});

test("direct Astro builds verify the cache guard before configuration and after building", async () => {
  await buildSecurity().hooks["astro:config:setup"]();
  await buildSecurity().hooks["astro:build:done"]();
});

test("rejects executable/server output, symlinks, unresolved CSP and bundled cache code", async () => {
  const isolated = await mkdtemp(path.join(tmpdir(), "mahad-security-output-"));
  try {
    await writeFile(path.join(isolated, "index.html"), "<!doctype html><title>Static</title>");
    await writeFile(path.join(isolated, "_headers"), "/*\n  Content-Security-Policy: default-src 'self'\n");
    await assertStaticOutput(isolated);
    for (const name of ["_worker.js", "functions", "node_modules", "package.json", "wrangler.json"]) {
      await writeFile(path.join(isolated, name), "{}");
      await assert.rejects(assertStaticOutput(isolated));
      await rm(path.join(isolated, name));
    }
    await mkdir(path.join(isolated, "_astro"));
    await writeFile(path.join(isolated, "_astro/cache.js"), "class CachePolicy {}\n");
    await assert.rejects(assertStaticOutput(isolated), /Server cache implementation/);
    await rm(path.join(isolated, "_astro/cache.js"));
    await symlink(path.join(isolated, "index.html"), path.join(isolated, "linked.html"));
    await assert.rejects(assertStaticOutput(isolated), /symlink/);
    await rm(path.join(isolated, "linked.html"));
    await writeFile(path.join(isolated, "_headers"), "__GENERATED_CSP__");
    await assert.rejects(assertStaticOutput(isolated), /Unresolved security policy/);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
