'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function cleanHeadingId(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s*—\s*/g, '--')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extractText(children: React.ReactNode): string {
  return React.Children.toArray(children).reduce((text, child) => {
    if (typeof child === 'string') return `${text}${child}`;
    if (typeof child === 'number') return `${text}${child}`;
    if (React.isValidElement(child) && child.props && 'children' in child.props) {
      return `${text}${extractText(child.props.children)}`;
    }
    return text;
  }, '');
}

function normalizeRuleLinkHref(href: string): string {
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href;
  }

  return href.replace(/\.md(?=(#|\?|$))/gi, '');
}

export function MarkdownContent({ content }: { content: string }) {
  const headingIds = new Map<string, number>();

  const headingProps = (children: React.ReactNode) => {
    const baseId = cleanHeadingId(extractText(children).trim());
    const count = headingIds.get(baseId) ?? 0;
    headingIds.set(baseId, count + 1);

    return count > 0 ? `${baseId}-${count + 1}` : baseId;
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => (
          <a {...props} href={normalizeRuleLinkHref(href || '')}>
            {children}
          </a>
          ),
        h1: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h1 id={id} {...props}>{children}</h1>;
        },
        h2: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h2 id={id} {...props}>{children}</h2>;
        },
        h3: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h3 id={id} {...props}>{children}</h3>;
        },
        h4: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h4 id={id} {...props}>{children}</h4>;
        },
        h5: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h5 id={id} {...props}>{children}</h5>;
        },
        h6: ({ children, ...props }) => {
          const id = headingProps(children);
          return <h6 id={id} {...props}>{children}</h6>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
