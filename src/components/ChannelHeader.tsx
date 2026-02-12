"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ChannelHeaderProps {
  channel: {
    _id: Id<"channels">;
    name: string;
    topic?: string;
  };
  onToggleSidebar: () => void;
  onToggleUsers: () => void;
  onTogglePins: () => void;
  showPins?: boolean;
  onToggleSearch: () => void;
  showSearch?: boolean;
  onToggleBookmarks: () => void;
  showBookmarks?: boolean;
}

export function ChannelHeader({ channel, onToggleSidebar, onToggleUsers, onTogglePins, showPins, onToggleSearch, showSearch, onToggleBookmarks, showBookmarks }: ChannelHeaderProps) {
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicInput, setTopicInput] = useState(channel.topic ?? "");
  const updateTopic = useMutation(api.channels.updateTopic);

  const handleSaveTopic = async () => {
    await updateTopic({ channelId: channel._id, topic: topicInput.trim() });
    setIsEditingTopic(false);
  };

  return (
    <div className="flex h-14 items-center border-b border-border bg-surface/80 px-4 backdrop-blur">
      {/* Mobile hamburger */}
      <button
        onClick={onToggleSidebar}
        className="mr-3 text-text-muted hover:text-text md:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-bold text-text"># {channel.name}</h2>
        {isEditingTopic ? (
          <input
            type="text"
            value={topicInput}
            onChange={(e) => setTopicInput(e.target.value)}
            onBlur={handleSaveTopic}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveTopic();
              if (e.key === "Escape") setIsEditingTopic(false);
            }}
            autoFocus
            className="w-full bg-transparent text-xs text-text-muted outline-none"
            placeholder="Set a topic..."
          />
        ) : (
          <button
            onClick={() => {
              setTopicInput(channel.topic ?? "");
              setIsEditingTopic(true);
            }}
            className="truncate text-xs text-text-muted hover:text-text-secondary"
          >
            {channel.topic || "No topic set — click to add one"}
          </button>
        )}
      </div>

      {/* Search button */}
      <button
        onClick={onToggleSearch}
        className={`ml-3 text-sm ${showSearch ? "text-accent" : "text-text-muted hover:text-text"}`}
        title="Search messages (⌘K)"
      >
        🔍
      </button>

      {/* Saved messages button */}
      <button
        onClick={onToggleBookmarks}
        className={`ml-3 text-sm ${showBookmarks ? "text-accent" : "text-text-muted hover:text-text"}`}
        title="Saved messages"
      >
        🔖
      </button>

      {/* Pinned messages button */}
      <button
        onClick={onTogglePins}
        className={`ml-3 text-sm ${showPins ? "text-warning" : "text-text-muted hover:text-text"}`}
        title="Pinned messages"
      >
        📌
      </button>

      {/* Mobile users button */}
      <button
        onClick={onToggleUsers}
        className="ml-3 text-text-muted hover:text-text md:hidden"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
        </svg>
      </button>
    </div>
  );
}
