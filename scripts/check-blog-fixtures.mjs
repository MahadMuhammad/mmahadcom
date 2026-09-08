import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const { values: options } = parseArgs({
  options: {
    theme: { type: "string", default: "dark" },
    screenshots: { type: "boolean", default: false },
  },
});
if (!["light", "dark"].includes(options.theme)) throw new Error("--theme must be light or dark.");
const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const fixtureRoot = await mkdtemp(join(tmpdir(), "mmahad-blog-qa-"));
const copyOptions = { recursive: true, mode: constants.COPYFILE_FICLONE, verbatimSymlinks: true };

function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: fixtureRoot, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${script} failed with ${result.signal ?? `exit code ${result.status}`}`);
}

try {
  // A separate content root keeps synthetic posts out of the production collection and dist.
  // Copy dependencies rather than symlinking them: Astro resolves package paths from this root.
  for (const input of ["src", "public", "scripts", "node_modules", "package.json", "package-lock.json", "astro.config.mjs", "tsconfig.json"]) {
    await cp(join(projectRoot, input), join(fixtureRoot, input), copyOptions);
  }
  const fixtureContent = join(fixtureRoot, "src/content/blog/__qa");
  await mkdir(fixtureContent);
  await cp(join(projectRoot, "scripts/fixtures/blog"), fixtureContent, copyOptions);
  const images = join(fixtureRoot, "public/images/__blog-qa");
  await mkdir(images);
  for (const [name, color] of [
    ["before", "#486b80"],
    ["after", "#80503c"],
  ]) {
    await writeFile(
      join(images, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${color}"/><rect x="80" y="70" width="480" height="220" rx="12" fill="white"/><circle cx="320" cy="180" r="70" fill="${color}"/></svg>`
    );
  }

  console.log("Building isolated Blog fixtures; real drafts and production dist remain untouched.");
  const astroPackage = JSON.parse(await readFile(join(fixtureRoot, "node_modules/astro/package.json"), "utf8"));
  run(join("node_modules/astro", astroPackage.bin.astro), ["build"]);
  run("scripts/apply-security-headers.mjs");
  run("scripts/check-accessibility.mjs", [
    "--routes",
    "/blog/,/blog/qa-blog-reader/,/blog/qa-blog-tagless/",
    "--theme",
    options.theme,
    ...(options.screenshots ? ["--screenshots"] : []),
  ]);
  console.log("Blog fixtures passed: archive filters, reader controls, two comparisons, references, and a tagless post.");
} finally {
  // Keep screenshots for diagnosis, but never keep or publish the synthetic build.
  try {
    await cp(join(fixtureRoot, "test-results"), join(projectRoot, "test-results/blog-fixtures"), copyOptions);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
}
