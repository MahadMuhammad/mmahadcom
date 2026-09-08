import { parse } from "parse5";

function* elements(node) {
  if (node.attrs) yield node;
  for (const child of node.childNodes ?? []) yield* elements(child);
  if (node.content) yield* elements(node.content);
}

export function assertNoInlineEventHandlers(html, label) {
  for (const element of elements(parse(html))) {
    if (element.attrs.some((attribute) => /^on[a-z][\w:-]*$/i.test(attribute.name))) {
      throw new Error(`Inline event handler found in ${label}; script-src-attr 'none' would block it.`);
    }
  }
}

export function htmlReferences(html) {
  const references = [];

  for (const element of elements(parse(html))) {
    const attributes = Object.fromEntries(element.attrs.map((attribute) => [attribute.name, attribute.value]));
    for (const name of ["href", "src", "poster"]) {
      if (attributes[name] !== undefined) references.push(attributes[name]);
    }

    if (attributes.srcset && !attributes.srcset.includes("data:")) {
      for (const candidate of attributes.srcset.split(",")) {
        const reference = candidate.trim().split(/\s+/, 1)[0];
        if (reference) references.push(reference);
      }
    }

    if (element.tagName === "meta" && attributes["http-equiv"]?.toLowerCase() === "refresh") {
      const target = attributes.content?.match(/(?:^|;)\s*url\s*=\s*(.+?)\s*$/i)?.[1];
      if (target) references.push(target.replace(/^(["'])(.*)\1$/, "$2"));
    }
  }

  return references;
}

export function htmlFragments(html) {
  const fragments = new Set(["top"]);

  for (const element of elements(parse(html))) {
    for (const attribute of element.attrs) {
      if (["id", "name"].includes(attribute.name) && attribute.value) fragments.add(attribute.value);
    }
  }

  return fragments;
}
