"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface SearchPaletteProps {
  open: boolean;
  onClose: () => void;
  channels: Array<{ _id: Id<"channels">; name: string }>;
  onSelectChannel: (channelId: Id<"channels">) => void;
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const words = query
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${words.join("|")})`, "gi");
  const truncated = text.length > 120 ? text.slice(0, 120) + "..." : text;
  const parts = truncated.split(regex);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        className="rounded bg-yellow-500/30 px-0.5 text-yellow-200"
      >
        {part}
      </mark>
    ) : (
      part
    )
  );
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function SearchPalette({
  open,
  onClose,
  channels,
  onSelectChannel,
}: SearchPaletteProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"channels" | "messages">(
    "channels"
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setDebouncedQuery("");
      setActiveTab("channels");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Search messages query
  const searchResults = useQuery(
    api.search.searchMessages,
    activeTab === "messages" && debouncedQuery.length > 0
      ? { query: debouncedQuery }
      : "skip"
  );

  // Filter channels by query
  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  const currentResults =
    activeTab === "channels" ? filteredChannels : searchResults ?? [];
  const resultCount = currentResults.length;

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, activeTab, resultCount]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, resultCount - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Tab") {
      e.preventDefault();
      setActiveTab((t) => (t === "channels" ? "messages" : "channels"));
      return;
    }
    if (e.key === "Enter" && resultCount > 0) {
      e.preventDefault();
      const item = currentResults[selectedIndex];
      if (activeTab === "channels") {
        onSelectChannel(
          (item as { _id: Id<"channels">; name: string })._id
        );
      } else {
        onSelectChannel(
          (item as { channelId: Id<"channels"> }).channelId
        );
      }
      onClose();
      return;
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative z-10 w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-zinc-700 px-4">
          <svg
            className="mr-2 h-4 w-4 shrink-0 text-zinc-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              activeTab === "channels"
                ? "Search channels..."
                : "Search messages..."
            }
            className="w-full bg-transparent py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none"
          />
          <span className="ml-2 shrink-0 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
            ⌘K
          </span>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab("channels")}
            className={`flex-1 px-4 py-2 text-xs font-medium ${
              activeTab === "channels"
                ? "border-b-2 border-indigo-500 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Channels
          </button>
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex-1 px-4 py-2 text-xs font-medium ${
              activeTab === "messages"
                ? "border-b-2 border-indigo-500 text-indigo-400"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Messages
          </button>
        </div>

        {/* Results */}
        <div className="max-h-[300px] overflow-y-auto">
          {activeTab === "channels" ? (
            filteredChannels.length > 0 ? (
              filteredChannels.map((channel, i) => (
                <button
                  key={channel._id}
                  onClick={() => {
                    onSelectChannel(channel._id);
                    onClose();
                  }}
                  className={`flex w-full items-center px-4 py-2 text-left text-sm ${
                    i === selectedIndex
                      ? "bg-zinc-800 text-zinc-100"
                      : "text-zinc-300 hover:bg-zinc-800/50"
                  }`}
                >
                  <span className="mr-2 text-zinc-500">#</span>
                  {query
                    ? highlightText(channel.name, query)
                    : channel.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                No channels found
              </div>
            )
          ) : debouncedQuery.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Type to search messages across all channels
            </div>
          ) : searchResults === undefined ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              Searching...
            </div>
          ) : searchResults.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">
              No messages match your search
            </div>
          ) : (
            searchResults.map((result, i) => (
              <button
                key={result._id}
                onClick={() => {
                  onSelectChannel(result.channelId);
                  onClose();
                }}
                className={`w-full px-4 py-2.5 text-left ${
                  i === selectedIndex
                    ? "bg-zinc-800"
                    : "hover:bg-zinc-800/50"
                }`}
              >
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-zinc-400">
                    #{result.channelName}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span
                    className="font-medium"
                    style={{ color: result.avatarColor }}
                  >
                    {result.username}
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="text-zinc-600">
                    {formatTime(result._creationTime)}
                  </span>
                </div>
                <div className="mt-0.5 text-sm text-zinc-300">
                  {highlightText(result.text, debouncedQuery)}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex gap-3 border-t border-zinc-700 px-4 py-2 text-[10px] text-zinc-600">
          <span>↑↓ Navigate</span>
          <span>↵ Select</span>
          <span>Tab Switch tabs</span>
          <span>Esc Close</span>
        </div>
      </div>
    </div>
  );
}
