import { Copy } from "lucide-react";
import React, { useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-diff";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

interface Props {
  content: string;
}

const MarkdownRender: React.FC<Props> = ({ content }) => {
  const handleCopy = useCallback((value: string) => {
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(value)
        .then(() => toast.success("Copied code block"))
        .catch(() => toast.error("Copy fehlgeschlagen"));
    }
  }, []);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className="markdown-body"
      components={{
        code({ node, inline, className, children, ...props }) {
          const text = String(children).replace(/\n$/, "");
          const match = /language-(\w+)/.exec(className || "");
          const language = match?.[1] ?? "plaintext";
          if (inline) {
            return (
              <code className="rounded bg-slate-900 px-1.5 py-0.5 text-sm" {...props}>
                {children}
              </code>
            );
          }
          const grammar = Prism.languages[language] ?? Prism.languages.javascript;
          const html = Prism.highlight(text, grammar, language);
          return (
            <div className="group relative mb-4 mt-2">
              <button
                type="button"
                aria-label="Copy code"
                onClick={() => handleCopy(text)}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 bg-slate-900/80 text-slate-300 opacity-0 transition group-hover:opacity-100"
              >
                <Copy className="h-4 w-4" />
              </button>
              <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4 text-sm leading-relaxed">
                <code dangerouslySetInnerHTML={{ __html: html }} className={cn(className)} {...props} />
              </pre>
            </div>
          );
        }
      }}
    >
      {content}
    </ReactMarkdown>
  );
};

export default MarkdownRender;
