import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkMdx from "remark-mdx";
import remarkGfm from "remark-gfm";
import remarkStringify from "remark-stringify";

const parser = unified().use(remarkParse).use(remarkMdx).use(remarkGfm);
const writer = unified().use(remarkStringify).use(remarkGfm);

/** Export portable Markdown, keeping code intact and linking to browser-only examples. */
export function createBlogMarkdown({ title, description, body, canonicalUrl, author, date, attribution = true }) {
  const tree = parser.parse(body);

  function clean(nodes) {
    return nodes.flatMap((node) => {
      if (node.type === "mdxjsEsm") return [];
      if (node.type === "mdxFlowExpression" || node.type === "mdxTextExpression") {
        if (/^\s*\/\*[\s\S]*\*\/\s*$/.test(node.value)) return [];
        throw new Error(`${title}: move computed MDX text into Markdown so exports contain the same explanation.`);
      }
      if (node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") {
        if (node.children.length) return clean(node.children);
        const link = {
          type: "link",
          url: canonicalUrl,
          children: [{ type: "text", value: "View interactive example on the website" }],
        };
        return [node.type === "mdxJsxFlowElement" ? { type: "paragraph", children: [link] } : link];
      }
      if (node.children) node.children = clean(node.children);
      if (["link", "image", "definition"].includes(node.type)) node.url = new URL(node.url, canonicalUrl).href;
      return [node];
    });
  }

  tree.children = clean(tree.children);
  const credit = attribution ? `\n---\n\nWritten by ${author} · [Original article](${canonicalUrl})\n` : "";
  return `# ${title}\n\n${description}\n\n${date ? `Published: ${date}\n\n` : ""}${writer.stringify(tree).trim()}\n${credit}`;
}
