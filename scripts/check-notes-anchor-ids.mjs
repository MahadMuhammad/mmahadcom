import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = path.join(projectRoot, "src/lib/notes-slug.ts");
const source = await readFile(sourcePath, "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
});
const module = { exports: {} };

new Function("exports", "module", compiled.outputText)(module.exports, module);

const { getNotesTagPath, toNotesAnchorId } = module.exports;
const collisionCandidates = ["C", "C++", "C#", "c"];
const ids = collisionCandidates.map(toNotesAnchorId);

if (new Set(ids).size !== collisionCandidates.length) {
  throw new Error(
    `Notes taxonomy anchor collision: ${JSON.stringify(Object.fromEntries(collisionCandidates.map((value, index) => [value, ids[index]])))}`
  );
}

for (const [index, value] of collisionCandidates.entries()) {
  const anchor = toNotesAnchorId(value);

  if (anchor !== ids[index]) throw new Error(`Notes taxonomy anchor is not deterministic for ${value}`);
  if (getNotesTagPath(value) !== `/notes/tags/#${encodeURIComponent(anchor)}`) {
    throw new Error(`Notes tag href does not use the shared anchor mapping for ${value}`);
  }
}

console.log(`Notes anchor contract passed: ${collisionCandidates.length} distinct punctuation-sensitive labels.`);
