"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface SearchPanelProps {
  onClose: () => void;
  onNavigateToChannel: (channelId: Id<"channels">) => void;
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
      <mark key={i} className="rounded bg-yellow-500/30 px-0.5 text-yellow-200">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

export function SearchPanel({ onClose, onNavigateToChannel }: SearchPanelProps) {
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
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-bold text-zinc-100">🔍 Search</h3>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
          ✕
        </button>
      </div>

      {/* Search input */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          className="w-full rounded bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Search messages..."
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {debouncedQuery.trim().length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8">
            <p className="text-sm text-zinc-500">Search across all channels</p>
            <p className="mt-1 text-xs text-zinc-600">⌘K to toggle search</p>
          </div>
        ) : results === undefined ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-zinc-500">Searching...</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex items-center justify-center p-8">
            <p className="text-sm text-zinc-500">No messages match your search</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {results.map((result) => (
              <button
                key={result._id}
                type="button"
                className="w-full p-4 text-left transition-colors hover:bg-zinc-800/50"
                onClick={() => onNavigateToChannel(result.channelId)}
              >
                <div className="mb-1">
                  <span className="inline-block rounded bg-indigo-500/20 px-1.5 py-0.5 text-xs font-medium text-indigo-300">
                    #{result.channelName}
                  </span>
                  {result.parentMessageId && (
                    <span className="ml-1.5 text-xs text-zinc-600">in thread</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ backgroundColor: result.avatarColor }}
                  >
                    {result.username[0].toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-zinc-300">{result.username}</span>
                  <span className="text-xs text-zinc-600">{formatTimestamp(result._creationTime)}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">
                  {highlightText(result.text, debouncedQuery)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
