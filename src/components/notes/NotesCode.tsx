import type { ComponentProps } from "react";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

export function NotesCode({ children, ...props }: ComponentProps<typeof CodeBlock>) {
  return (
    <CodeBlock {...props}>
      <Pre>{children}</Pre>
    </CodeBlock>
  );
}
