# Task: Markdown Rendering in Messages

## Overview

Add markdown rendering to chat messages so users can format text with **bold**, *italic*, `inline code`, code blocks with syntax highlighting, ~~strikethrough~~, [links](url), blockquotes, and lists. This is a key Phase 3 feature from PLAN.md — "Messages stop being plain text and start feeling expressive."

Currently, all messages render as plain text (with @mention highlighting via `MessageText`). This task upgrades the `MessageText` component to parse and render a subset of markdown, making the chat feel like a real modern messaging app.

**Demo moment:** Someone sends a message with bold text, a code block, and a link — it all renders beautifully in real time.

**Depends on:** Tasks 001-007 (all complete — schema, backend, chat UI, unread badges, emoji reactions, edit/delete, @mentions)

## Current State

- `MessageText.tsx` renders message text with @mention highlighting using regex parsing
- `MessageItem.tsx` uses `MessageText` inside a `<p>` with `whitespace-pre-wrap`
- Messages are stored as plain text strings — no schema changes needed
- No markdown libraries are installed (`package.json` has no markdown dependencies)
- The app uses Tailwind CSS v4 with a dark theme (zinc-800/900 backgrounds, zinc-100/300 text)

## Requirements

### 1. Install `react-markdown` and `remark-gfm` Packages

Install the markdown rendering library and GFM (GitHub Flavored Markdown) plugin:

```bash
pnpm add react-markdown remark-gfm
```

These provide:
- `react-markdown`: React component that renders markdown as React elements
- `remark-gfm`: Plugin for tables, strikethrough, autolinks, and task lists

### 2. Rewrite `MessageText` Component (`src/components/MessageText.tsx`)

Replace the current regex-based `MessageText` with a new implementation that uses `react-markdown` for rendering, while preserving the @mention highlighting.

The approach: Use `react-markdown` to render the markdown, but pre-process the text to wrap `@mentions` in a custom syntax that can be detected and styled in the custom renderers.

Here is the full replacement for `src/components/MessageText.tsx`:

```typescript
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MessageTextProps {
  text: string;
}

// Pre-process: wrap @mentions in a marker so we can detect them in the rendered output
// We convert @username to a special inline HTML marker that react-markdown passes through
// Actually, a simpler approach: we render mentions inline using custom text processing
// within the react-markdown custom renderers.

// Custom components for react-markdown
const markdownComponents: Components = {
  // Links: open in new tab, styled
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-indigo-400 underline decoration-indigo-400/50 hover:decoration-indigo-400"
    >
      {children}
    </a>
  ),
  // Code blocks
  pre: ({ children }) => (
    <pre className="my-1 overflow-x-auto rounded-md bg-zinc-900 p-3 text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    // If it has a className (language-*), it's a fenced code block rendered inside <pre>
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="text-emerald-300">
          {children}
        </code>
      );
    }
    // Inline code
    return (
      <code className="rounded bg-zinc-700 px-1.5 py-0.5 text-sm text-orange-300">
        {children}
      </code>
    );
  },
  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-zinc-600 pl-3 text-zinc-400 italic">
      {children}
    </blockquote>
  ),
  // Paragraphs - use span to avoid nesting <p> inside parent <p>
  p: ({ children }) => (
    <span className="block">{children}</span>
  ),
  // Strong (bold)
  strong: ({ children }) => (
    <strong className="font-bold text-zinc-100">{children}</strong>
  ),
  // Emphasis (italic)
  em: ({ children }) => (
    <em className="italic text-zinc-300">{children}</em>
  ),
  // Strikethrough
  del: ({ children }) => (
    <del className="text-zinc-500 line-through">{children}</del>
  ),
  // Unordered lists
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc text-zinc-300">{children}</ul>
  ),
  // Ordered lists
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal text-zinc-300">{children}</ol>
  ),
  // List items
  li: ({ children }) => (
    <li className="my-0.5">{children}</li>
  ),
  // Horizontal rule
  hr: () => (
    <hr className="my-2 border-zinc-700" />
  ),
};

// Regex to find @mentions in text nodes
const mentionRegex = /((?:^|\s)@[\w-]+)/g;

function renderTextWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(mentionRegex);
  return parts.map((part, i) => {
    // Check if this part matches @mention pattern
    const mentionMatch = part.match(/^(\s?)(@[\w-]+)$/);
    if (mentionMatch) {
      return (
        <span key={i}>
          {mentionMatch[1]}
          <span className="rounded bg-indigo-500/20 px-0.5 text-indigo-300">
            {mentionMatch[2]}
          </span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// Wrap text nodes to apply mention highlighting
function wrapTextChildren(children: React.ReactNode): React.ReactNode {
  if (typeof children === "string") {
    return renderTextWithMentions(children);
  }
  if (Array.isArray(children)) {
    return children.map((child, i) => {
      if (typeof child === "string") {
        return <span key={i}>{renderTextWithMentions(child)}</span>;
      }
      return child;
    });
  }
  return children;
}

// Create components with mention support by wrapping text-containing elements
function createMentionAwareComponents(): Components {
  return {
    ...markdownComponents,
    // Override text-containing elements to process mentions
    p: ({ children }) => (
      <span className="block">{wrapTextChildren(children)}</span>
    ),
    li: ({ children }) => (
      <li className="my-0.5">{wrapTextChildren(children)}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-bold text-zinc-100">{wrapTextChildren(children)}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-zinc-300">{wrapTextChildren(children)}</em>
    ),
    del: ({ children }) => (
      <del className="text-zinc-500 line-through">{wrapTextChildren(children)}</del>
    ),
    td: ({ children }) => (
      <td className="border border-zinc-700 px-2 py-1">{wrapTextChildren(children)}</td>
    ),
  };
}

const mentionAwareComponents = createMentionAwareComponents();

export function MessageText({ text }: MessageTextProps) {
  // Quick check: if the text has no markdown-like characters, render with just mention support
  // This is a performance optimization for the common case of plain text messages
  const hasMarkdown = /[*_`~\[#>\-]|^\d+\.\s/m.test(text);

  if (!hasMarkdown) {
    // Plain text with mentions only - fast path
    return <>{renderTextWithMentions(text)}</>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={mentionAwareComponents}
    >
      {text}
    </ReactMarkdown>
  );
}
```

### 3. Update MessageItem to Remove `whitespace-pre-wrap` from Markdown Content (`src/components/MessageItem.tsx`)

The current `messageContent` renders inside a `<p>` with `whitespace-pre-wrap`. Since react-markdown handles its own block layout, we need to change the wrapper.

In the `messageContent` variable (around line 223-230), change the non-editing branch from:

```tsx
<p className="whitespace-pre-wrap text-sm text-zinc-300">
  <MessageText text={message.text} />
  {message.editedAt && (
    <span className="ml-1 text-xs text-zinc-500">(edited)</span>
  )}
</p>
```

To:

```tsx
<div className="text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
  <MessageText text={message.text} />
  {message.editedAt && (
    <span className="ml-1 inline text-xs text-zinc-500">(edited)</span>
  )}
</div>
```

Key changes:
- Change `<p>` to `<div>` to avoid invalid HTML (react-markdown may render block elements like `<pre>`, `<ul>`, `<blockquote>` inside)
- Remove `whitespace-pre-wrap` since react-markdown handles line breaks
- Add utility classes to remove top margin from first child and bottom margin from last child for clean spacing

### 4. Run Codegen and Type Check

After all changes:

```bash
pnpm -s convex codegen
pnpm -s tsc -p tsconfig.json --noEmit
```

Fix any TypeScript errors.

### 5. Browser Testing

Test the following markdown patterns in the chat:

1. **Bold**: `**hello**` renders as bold text
2. **Italic**: `*hello*` renders as italic text
3. **Bold italic**: `***hello***` renders as bold italic
4. **Strikethrough**: `~~hello~~` renders as strikethrough
5. **Inline code**: `` `console.log()` `` renders with code styling
6. **Code block**: Triple backticks render as a code block with dark background
7. **Code block with language**: ````typescript` renders with language class
8. **Links**: `[text](url)` renders as clickable link opening in new tab
9. **Auto-links**: URLs like `https://example.com` render as clickable links
10. **Blockquotes**: `> quoted text` renders with left border
11. **Unordered lists**: `- item` renders as bulleted list
12. **Ordered lists**: `1. item` renders as numbered list
13. **Horizontal rule**: `---` renders as a divider
14. **Plain text**: Regular messages still render normally
15. **@mentions**: `@username` still highlights with indigo styling, even inside markdown
16. **Mixed**: A message with both markdown and @mentions renders correctly
17. **Emoji reactions** still work on markdown messages
18. **Edit/delete** still works — editing a markdown message re-renders correctly
19. **(edited)** label still appears on edited messages

Test on both desktop and mobile viewports.

## Files to Modify

- `src/components/MessageText.tsx` — Full rewrite to use react-markdown with mention support
- `src/components/MessageItem.tsx` — Change wrapper from `<p>` to `<div>`, remove `whitespace-pre-wrap`

## No Schema or Backend Changes

This is a purely frontend feature. Messages are stored as plain text — the markdown is only interpreted during rendering.

## Important Notes

- Use `@/` import paths for any new imports
- Don't modify `convex/_generated/` — run codegen instead
- The `p` component in react-markdown renders as `<span className="block">` to avoid nesting `<p>` inside `<p>` (invalid HTML)
- The performance optimization (fast path for non-markdown text) is important since MessageText is rendered for every message in the list
- The mention highlighting must work both in the fast path (plain text) and the markdown path (inside react-markdown custom renderers)
- `remark-gfm` adds support for GitHub-style features: strikethrough (`~~text~~`), tables, autolinks, and task lists
- Code blocks use `bg-zinc-900` (darker than message background) with `text-emerald-300` for visibility
- Inline code uses `bg-zinc-700` with `text-orange-300` for visual distinction from regular text
- Links use `text-indigo-400` to match the app's indigo accent color
- All markdown styles must work with the dark theme (zinc backgrounds)
- The `target="_blank"` and `rel="noopener noreferrer"` on links is important for security
- React 19 compatibility: react-markdown v9+ is compatible with React 19

## Validation Checklist

- [ ] `pnpm add react-markdown remark-gfm` installs successfully
- [ ] `MessageText.tsx` rewritten with react-markdown and mention support
- [ ] `MessageItem.tsx` wrapper changed from `<p>` to `<div>`
- [ ] `pnpm -s convex codegen` succeeds
- [ ] `pnpm -s tsc -p tsconfig.json --noEmit` has no TypeScript errors
- [ ] Plain text messages still render normally (no regressions)
- [ ] **Bold** renders correctly
- [ ] *Italic* renders correctly
- [ ] `inline code` renders with code styling
- [ ] Code blocks render with dark background
- [ ] Links render as clickable, open in new tab
- [ ] Blockquotes render with left border
- [ ] Lists render with bullets/numbers
- [ ] ~~Strikethrough~~ renders correctly
- [ ] @mentions still highlight with indigo styling in plain text
- [ ] @mentions still highlight within markdown-formatted text
- [ ] Emoji reactions still work on markdown messages
- [ ] Edit/delete still works on markdown messages
- [ ] (edited) label still shows on edited messages
- [ ] No invalid HTML nesting warnings in console
- [ ] Layout looks good on mobile
- [ ] Test in browser: full markdown rendering flow works
