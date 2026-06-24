import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownPreviewProps {
  content: string;
  renderLink: (href: string | undefined, children: ReactNode) => ReactNode;
}

export default function MarkdownPreview({ content, renderLink }: MarkdownPreviewProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => renderLink(href, children),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
