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
  return React.Children.toArray(children).reduce<string>((text, child) => {
    if (typeof child === 'string' || typeof child === 'number' || typeof child === 'bigint') return `${text}${child}`;
    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      return `${text}${extractText(child.props.children)}`;
    }
    return text;
  }, '');
}

function normalizeRuleLinkHref(href?: string | null): string {
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('http://') ||
    href.startsWith('https://') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:')
  ) {
    return href ?? '';
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
        a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
          const { href, children, ...anchorProps } = props;

          return (
            <a {...anchorProps} href={normalizeRuleLinkHref(href)}>
              {children}
            </a>
          );
        },
        h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h1 id={id} {...headingAttrs}>{children}</h1>;
        },
        h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h2 id={id} {...headingAttrs}>{children}</h2>;
        },
        h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h3 id={id} {...headingAttrs}>{children}</h3>;
        },
        h4: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h4 id={id} {...headingAttrs}>{children}</h4>;
        },
        h5: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h5 id={id} {...headingAttrs}>{children}</h5>;
        },
        h6: (props: React.HTMLAttributes<HTMLHeadingElement>) => {
          const { children, ...headingAttrs } = props;
          const id = headingProps(children);
          return <h6 id={id} {...headingAttrs}>{children}</h6>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
