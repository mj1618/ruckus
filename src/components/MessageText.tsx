"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

interface MessageTextProps {
  text: string;
}

// Emoji shortcode map
const EMOJI_MAP: Record<string, string> = {
  fire: "🔥",
  thumbsup: "👍",
  thumbsdown: "👎",
  heart: "❤️",
  smile: "😄",
  laughing: "😆",
  wink: "😉",
  cry: "😢",
  thinking: "🤔",
  clap: "👏",
  rocket: "🚀",
  "100": "💯",
  tada: "🎉",
  wave: "👋",
  eyes: "👀",
  pray: "🙏",
  star: "⭐",
  check: "✅",
  x: "❌",
  warning: "⚠️",
  sparkles: "✨",
  sunglasses: "😎",
  skull: "💀",
  party: "🥳",
  shrug: "🤷",
  muscle: "💪",
  brain: "🧠",
  bug: "🐛",
  hammer: "🔨",
  wrench: "🔧",
  gear: "⚙️",
  link: "🔗",
  pin: "📌",
  bulb: "💡",
  zap: "⚡",
  coffee: "☕",
  pizza: "🍕",
  beer: "🍺",
  poop: "💩",
  ghost: "👻",
  "+1": "👍",
  "-1": "👎",
  ok: "👌",
  raised_hands: "🙌",
  sob: "😭",
  joy: "😂",
  angry: "😡",
  cool: "😎",
  lol: "😂",
};

// Replace emoji shortcodes like :fire: with actual emoji
function replaceEmojiShortcodes(text: string): string {
  return text.replace(/:([a-zA-Z0-9_+-]+):/g, (match, name) => {
    return EMOJI_MAP[name] ?? match;
  });
}

// Regex to find @mentions in text nodes
const mentionRegex = /((?:^|\s)@[\w-]+)/g;

function renderTextWithMentions(text: string): React.ReactNode[] {
  const parts = text.split(mentionRegex);
  return parts.map((part, i) => {
    const mentionMatch = part.match(/^(\s?)(@[\w-]+)$/);
    if (mentionMatch) {
      return (
        <span key={i}>
          {mentionMatch[1]}
          <span className="rounded bg-accent-soft px-0.5 text-accent">
            {mentionMatch[2]}
          </span>
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

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

// Custom components for react-markdown
const markdownComponents: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline decoration-accent/50 hover:decoration-accent break-all"
    >
      {children}
    </a>
  ),
  pre: ({ children }) => (
    <pre className="my-1 max-w-full overflow-x-auto rounded-md bg-base p-3 text-sm">
      {children}
    </pre>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return (
        <code className="text-emerald-300">
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-overlay px-1.5 py-0.5 text-sm text-orange-300">
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-border-strong pl-3 text-text-muted italic">
      {children}
    </blockquote>
  ),
  p: ({ children }) => (
    <span className="block">{wrapTextChildren(children)}</span>
  ),
  strong: ({ children }) => (
    <strong className="font-bold text-text">{wrapTextChildren(children)}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-text-secondary">{wrapTextChildren(children)}</em>
  ),
  del: ({ children }) => (
    <del className="text-text-muted line-through">{wrapTextChildren(children)}</del>
  ),
  ul: ({ children }) => (
    <ul className="my-1 ml-4 list-disc text-text-secondary">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1 ml-4 list-decimal text-text-secondary">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="my-0.5">{wrapTextChildren(children)}</li>
  ),
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt ?? ""}
      className="my-1 max-w-full rounded-lg md:max-w-[300px]"
      loading="lazy"
    />
  ),
  hr: () => (
    <hr className="my-2 border-border" />
  ),
  table: ({ children }) => (
    <div className="my-1 max-w-full overflow-x-auto">
      <table className="border-collapse text-sm">{children}</table>
    </div>
  ),
  td: ({ children }) => (
    <td className="border border-border px-2 py-1">{wrapTextChildren(children)}</td>
  ),
};

export function MessageText({ text }: MessageTextProps) {
  // Replace emoji shortcodes first
  const processed = replaceEmojiShortcodes(text);

  // Quick check: if the text has no markdown-like characters, render with just mention support
  const hasMarkdown = /[*_`~\[#>\-]|^\d+\.\s/m.test(processed);

  if (!hasMarkdown) {
    return <>{renderTextWithMentions(processed)}</>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={markdownComponents}
    >
      {processed}
    </ReactMarkdown>
  );
}
