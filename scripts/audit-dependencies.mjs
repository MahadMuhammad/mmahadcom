import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hardenCache } from "./harden-cache.mjs";

const severities = ["info", "low", "moderate", "high", "critical"];

export function evaluateAudit(report, exitCode) {
  assert.equal(report?.auditReportVersion, 2, "Unsupported or malformed npm audit report.");
  assert.ok(!report.error && report.vulnerabilities && report.metadata?.vulnerabilities, "The dependency audit failed.");
  assert.ok(typeof report.vulnerabilities === "object" && !Array.isArray(report.vulnerabilities), "Malformed audit findings map.");
  const entries = Object.entries(report.vulnerabilities);
  const counts = report.metadata.vulnerabilities;
  assert.equal(counts.total, entries.length, "Audit findings and totals disagree.");
  for (const severity of severities) {
    assert.equal(counts[severity], entries.filter(([, entry]) => entry.severity === severity).length, "Audit severity totals disagree.");
  }
  assert.equal(
    severities.reduce((total, severity) => total + counts[severity], 0),
    counts.total,
    "Unknown audit severity."
  );
  assert.equal(entries.length, 0, "Dependency vulnerabilities must be fixed before building; no advisory exceptions are allowed.");
  assert.equal(exitCode, 0, "Audit command failed despite an empty report.");
  return "clean";
}

function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const result = spawnSync(
    "npm",
    [
      "audit",
      "--json",
      "--ignore-scripts",
      "--include=dev",
      "--include=optional",
      "--include=peer",
      "--registry=https://registry.npmjs.org",
      "--offline=false",
    ],
    {
      cwd: root,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 8 * 1024 * 1024,
    }
  );
  assert.ok(!result.error && !result.signal && Number.isInteger(result.status), "The dependency audit could not complete.");
  console.log(result.stdout);
  evaluateAudit(JSON.parse(result.stdout), result.status);
  return hardenCache(root).then(() => console.log("Dependency audit passed without exceptions; cache security guard verified."));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  Promise.resolve()
    .then(main)
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
