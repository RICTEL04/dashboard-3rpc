'use client';

import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-base font-bold text-text-primary mt-3 mb-2 pb-1 border-b border-surface-border">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-[15px] font-bold text-text-primary mt-3 mb-1.5">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-text-primary mt-2.5 mb-1">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-[13px] font-semibold text-text-secondary mt-2 mb-1 uppercase tracking-wide">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-text-primary my-1.5 first:mt-0 last:mb-0">
      {children}
    </p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-text-secondary">{children}</em>
  ),
  del: ({ children }) => (
    <del className="line-through text-text-muted">{children}</del>
  ),

  ul: ({ children }) => (
    <ul className="my-1.5 ml-1 space-y-1 list-none">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 ml-5 space-y-1 list-decimal marker:text-brand-blue marker:font-semibold">
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => {
    if ('checked' in props && typeof props.checked === 'boolean') {
      return (
        <li className="flex items-start gap-2 text-sm leading-relaxed">
          <span
            className={`mt-0.5 inline-flex w-3.5 h-3.5 rounded border flex-shrink-0 items-center justify-center
              ${props.checked
                ? 'bg-brand-blue border-brand-blue text-white'
                : 'border-surface-border bg-surface-overlay'}`}
          >
            {props.checked && <span className="text-[10px] leading-none">✓</span>}
          </span>
          <span className="flex-1">{children}</span>
        </li>
      );
    }
    return (
      <li className="text-sm leading-relaxed text-text-primary pl-4 relative
                     before:content-['•'] before:absolute before:left-0
                     before:text-brand-blue before:font-bold">
        {children}
      </li>
    );
  },

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-brand-blue underline decoration-brand-blue/40 underline-offset-2
                 hover:decoration-brand-blue transition-colors"
    >
      {children}
    </a>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-2 pl-3 py-1 border-l-2 border-brand-blue/60
                           bg-brand-blue/5 rounded-r text-text-secondary italic">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-3 border-surface-border" />,

  code: ({ className, children, ...props }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded bg-surface-overlay border border-surface-border
                     text-[12px] font-mono text-brand-blue"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={`${className ?? ''} text-[12px] font-mono`} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-2 p-3 rounded-lg bg-[#0d1117] border border-surface-border
                    overflow-x-auto text-[12px] leading-relaxed">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="my-2 overflow-x-auto rounded-lg border border-surface-border">
      <table className="w-full text-[12px] border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-surface-overlay">{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-surface-border last:border-b-0
                   even:bg-surface-overlay/30">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-2.5 py-1.5 text-left font-semibold text-text-secondary
                   uppercase text-[10px] tracking-wider whitespace-nowrap">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-2.5 py-1.5 text-text-primary align-top">{children}</td>
  ),
};

interface MarkdownMessageProps {
  text: string;
}

function MarkdownMessageBase({ text }: MarkdownMessageProps) {
  return (
    <div className="markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

export const MarkdownMessage = memo(MarkdownMessageBase);