"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface SearchPanelProps {
  onClose: () => void;
  onNavigateToChannel: (channelId: Id<"channels">) => void;
  onNavigateToConversation?: (conversationId: Id<"conversations">) => void;
}

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    return time;
  }
  if (diffDays < 7) {
    const day = date.toLocaleDateString([], { weekday: "short" });
    return `${day} ${time}`;
  }
  const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });
  return `${dateStr}, ${time}`;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const truncated = text.length > 200 ? text.slice(0, 200) + "..." : text;
  const words = query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const parts = truncated.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark key={i} className="rounded bg-warning/30 px-0.5 text-warning">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function SearchPanel({ onClose, onNavigateToChannel, onNavigateToConversation }: SearchPanelProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery(
    api.search.searchMessages,
    debouncedQuery.trim().length > 0 ? { query: debouncedQuery } : "skip"
  );

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text">🔍 Search</h3>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
          ✕
        </button>
      </div>

      {/* Search input */}
      <div className="border-b border-border px-4 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full rounded bg-overlay px-3 py-1.5 text-sm text-text placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
          placeholder="Search messages..."
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery.trim().length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-sm text-text-muted">Search across all channels</p>
            <p className="mt-1 text-xs text-text-faint">⌘K to toggle search</p>
          </div>
        ) : results === undefined ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-text-muted">Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-text-muted">No messages match your search</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {results.map((result) => {
              const handleClick = () => {
                if (result.channelId) {
                  onNavigateToChannel(result.channelId);
                } else if (result.conversationId && onNavigateToConversation) {
                  onNavigateToConversation(result.conversationId);
                }
              };

              return (
                <button
                  key={result._id}
                  type="button"
                  className="w-full p-4 text-left transition-colors hover:bg-hover"
                  onClick={handleClick}
                >
                  <div className="mb-1">
                    {result.channelId ? (
                      <span className="inline-block rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent">
                        #{result.channelName}
                      </span>
                    ) : result.conversationId ? (
                      <span className="inline-block rounded bg-success/20 px-1.5 py-0.5 text-xs font-medium text-success">
                        DM with {result.dmUsername}
                      </span>
                    ) : null}
                    {result.parentMessageId && (
                      <span className="ml-1.5 text-xs text-text-faint">in thread</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar
                      username={result.username}
                      avatarColor={result.avatarColor}
                      avatarUrl={result.avatarUrl}
                      size="xs"
                      className="shrink-0"
                    />
                    <span className="text-xs font-medium text-text-secondary">{result.username}</span>
                    <span className="text-xs text-text-faint">{formatTimestamp(result._creationTime)}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {highlightText(result.text, debouncedQuery)}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
