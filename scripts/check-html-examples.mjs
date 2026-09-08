import assert from "node:assert/strict";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import { assertNoInlineEventHandlers, htmlFragments, htmlReferences } from "./html-validation.mjs";

const processor = await createMarkdownProcessor();
const { code: teachingExamples } = await processor.render(
  [
    'An inline example: `<a href="/example-destination/" id="example-only">Visit</a>`.',
    'An event example: `<button onclick="alert(1)">Run</button>`.',
    "",
    "```html",
    '<img src="/example-image.png" onerror="showFallback()">',
    "```",
  ].join("\n")
);

assert.doesNotThrow(() => assertNoInlineEventHandlers(teachingExamples, "teaching examples"));
assert.deepEqual(htmlReferences(teachingExamples), [], "Escaped teaching examples are not live links or images");
assert.deepEqual([...htmlFragments(teachingExamples)], ["top"], "An example id cannot satisfy a real fragment link");

for (const html of [
  '<button onclick="run()">Run</button>',
  '<body ONLOAD="run()"></body>',
  '<template><img src="/photo.jpg" onerror="run()"></template>',
]) {
  assert.throws(() => assertNoInlineEventHandlers(html, "live handler"), /Inline event handler found in live handler/);
}

const liveElements = [
  '<meta http-equiv="refresh" content="0; url=\'/redirect/\'">',
  '<a href="/notes/?a=1&amp;b=2#real" id="real">Notes</a>',
  '<img src="/image.jpg" srcset="/image-640.jpg 640w, /image-1280.jpg 1280w">',
  '<video poster="/poster.jpg"></video>',
  '<a name="legacy">Legacy anchor</a>',
].join("\n");
assert.deepEqual(htmlReferences(liveElements), [
  "/redirect/",
  "/notes/?a=1&b=2#real",
  "/image.jpg",
  "/image-640.jpg",
  "/image-1280.jpg",
  "/poster.jpg",
]);
assert.deepEqual([...htmlFragments(liveElements)], ["top", "real", "legacy"]);
console.log("HTML validation passed: escaped teaching examples are inert; real handlers, links, images, redirects, and anchors remain checked.");
