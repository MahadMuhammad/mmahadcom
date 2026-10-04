import assert from "node:assert/strict";
import { constants } from "node:fs";
import { appendFile, cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { advisory, assertReviewedInputs, evaluateAudit, expires, ignoredRootEntries, reviewedVersions } from "./audit-dependencies.mjs";
import { assertStaticOutput } from "./check-static-output.mjs";
import { assertBuildDeadline, buildSecurityDeadline } from "./build-security-deadline.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const now = Date.parse("2026-10-04T00:00:00Z");
const context = { now, latest: "4.3.0", versions: [...reviewedVersions] };
function audit() {
  return {
    auditReportVersion: 2,
    vulnerabilities: {
      "http-cache-semantics": {
        name: "http-cache-semantics",
        severity: "high",
        isDirect: false,
        via: [{ name: "http-cache-semantics", dependency: "http-cache-semantics", severity: "high", range: "<=4.2.0", url: advisory }],
        effects: [],
        nodes: ["node_modules/http-cache-semantics"],
      },
    },
    metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } },
  };
}

test("permits only the reviewed unresolved advisory before expiry", () => {
  assert.equal(evaluateAudit(audit(), 1, context), "exception");
});
test("accepts an actually clean audit without using the exception", () => {
  const report = audit();
  report.vulnerabilities = {};
  report.metadata.vulnerabilities.high = report.metadata.vulnerabilities.total = 0;
  assert.equal(evaluateAudit(report, 0, { now: expires }), "clean");
  assert.throws(() => evaluateAudit(report, 1, context));
});
test("fails closed on other findings, extra consumers, paths or advisory chains", () => {
  for (const mutate of [
    (report) => {
      report.vulnerabilities["http-cache-semantics"].via.push({ url: "https://github.com/advisories/GHSA-other", severity: "high" });
    },
    (report) => {
      report.vulnerabilities["http-cache-semantics"].via[0].url = "https://github.com/advisories/GHSA-other";
    },
    (report) => {
      report.vulnerabilities["http-cache-semantics"].nodes.push("node_modules/other/node_modules/http-cache-semantics");
    },
    (report) => {
      report.vulnerabilities.other = structuredClone(report.vulnerabilities["http-cache-semantics"]);
      report.metadata.vulnerabilities.high++;
      report.metadata.vulnerabilities.total++;
    },
    (report) => {
      report.vulnerabilities["http-cache-semantics"].effects.push("another-consumer");
    },
  ]) {
    const report = audit();
    mutate(report);
    assert.throws(() => evaluateAudit(report, 1, context));
  }
});
test("rejects malformed reports and unexpected audit results", () => {
  assert.throws(() => evaluateAudit({ error: { code: "EAI_AGAIN" } }, 1, context));
  for (const vulnerabilities of [[], 7, "", null]) {
    const report = audit();
    report.vulnerabilities = vulnerabilities;
    report.metadata.vulnerabilities.high = report.metadata.vulnerabilities.total = 0;
    assert.throws(() => evaluateAudit(report, 0, context));
  }
  for (const mutate of [
    (report) => {
      report.auditReportVersion = 3;
    },
    (report) => {
      report.error = { code: "EAI_AGAIN" };
    },
    (report) => {
      report.metadata.vulnerabilities.total = 2;
    },
    (report) => {
      report.metadata.vulnerabilities.low = 1;
    },
    (report) => {
      delete report.vulnerabilities["http-cache-semantics"].nodes;
    },
  ]) {
    const report = audit();
    mutate(report);
    assert.throws(() => evaluateAudit(report, 1, context));
  }
  for (const code of [0, 2, null]) assert.throws(() => evaluateAudit(audit(), code, context));
});
test("expires at the deadline and stops when registry state changes or is unavailable", () => {
  for (const timestamp of [expires, expires + 1, Number.NaN]) assert.throws(() => evaluateAudit(audit(), 1, { ...context, now: timestamp }));
  for (const latest of [undefined, "4.2.0", "4.3.1", "5.0.0", { error: "network" }])
    assert.throws(() => evaluateAudit(audit(), 1, { ...context, latest }));
  for (const versions of [undefined, [...reviewedVersions, "4.1.2"], [...reviewedVersions, "4.2.1-beta.1"]])
    assert.throws(() => evaluateAudit(audit(), 1, { ...context, versions }));
});
test("rejects a changed build input, including an added remote-image consumer", async () => {
  await assertReviewedInputs(root);
  const isolated = await mkdtemp(path.join(tmpdir(), "mahad-security-inputs-"));
  try {
    for (const input of await readdir(root)) {
      if (ignoredRootEntries.includes(input)) continue;
      await cp(path.join(root, input), path.join(isolated, input), { recursive: true, mode: constants.COPYFILE_FICLONE });
    }
    await symlink(path.join(root, "node_modules"), path.join(isolated, "node_modules"), "dir");
    await assertReviewedInputs(isolated);
    await appendFile(path.join(isolated, "src/lib/images.ts"), "\n// changed image source\n");
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await writeFile(path.join(isolated, "src/lib/images.ts"), await readFile(path.join(root, "src/lib/images.ts")));
    await writeFile(path.join(isolated, "src/lib/new-remote-image.ts"), 'import { getImage } from "astro:assets";\n');
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await rm(path.join(isolated, "src/lib/new-remote-image.ts"));
    await writeFile(path.join(isolated, ".npmrc"), "strict-allow-scripts=false\n");
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await writeFile(path.join(isolated, ".npmrc"), await readFile(path.join(root, ".npmrc")));
    await appendFile(path.join(isolated, ".github/workflows/verify.yml"), "\n# changed build controls\n");
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await writeFile(path.join(isolated, ".github/workflows/verify.yml"), await readFile(path.join(root, ".github/workflows/verify.yml")));
    await appendFile(path.join(isolated, ".prettierrc"), "\n");
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await writeFile(path.join(isolated, ".prettierrc"), await readFile(path.join(root, ".prettierrc")));
    await writeFile(path.join(isolated, "postcss.config.js"), "export default {}\n");
    await assert.rejects(assertReviewedInputs(isolated), /Build inputs changed/);
    await rm(path.join(isolated, "postcss.config.js"));
    await writeFile(path.join(isolated, ".env.local"), "PRIVATE_ASSET_TOKEN=test-fixture\n");
    await assert.rejects(assertReviewedInputs(isolated), /Environment files/);
  } finally {
    await rm(isolated, { recursive: true, force: true });
  }
});
test("rejects executable/server output, symlinks, unresolved CSP and bundled cache code", async () => {
  const isolated = await mkdtemp(path.join(tmpdir(), "mahad-security-output-"));
  try {
    await writeFile(path.join(isolated, "index.html"), "<!doctype html><title>Static</title>");
    await writeFile(path.join(isolated, "_headers"), "/*\n  Content-Security-Policy: default-src 'self'\n");
    await assertStaticOutput(isolated);
    await assert.rejects(assertStaticOutput(isolated, expires), /exception expired/);
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

// Exercise the same callback Astro awaits, without running third-party code before the audit.
test("direct Astro builds reject the deadline even without npm lifecycle hooks", (context) => {
  assert.doesNotThrow(() => assertBuildDeadline(expires - 1));
  for (const timestamp of [expires, expires + 1, Number.NaN]) assert.throws(() => assertBuildDeadline(timestamp), /exception expired/);
  context.mock.method(Date, "now", () => expires);
  assert.throws(() => buildSecurityDeadline().hooks["astro:build:done"](), /exception expired/);
});
