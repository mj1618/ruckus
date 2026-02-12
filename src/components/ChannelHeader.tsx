"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ChannelHeaderProps {
  channel: {
    _id: Id<"channels">;
    name: string;
    title?: string;
    topic?: string;
    isPrivate?: boolean;
    isAdmin?: boolean;
  };
  onToggleSidebar: () => void;
  onToggleUsers: () => void;
  onTogglePins: () => void;
  showPins?: boolean;
  onToggleSearch: () => void;
  showSearch?: boolean;
  onToggleBookmarks: () => void;
  showBookmarks?: boolean;
  onToggleMembers?: () => void;
  showMembers?: boolean;
}

export function ChannelHeader({ channel, onToggleSidebar, onToggleUsers, onTogglePins, showPins, onToggleSearch, showSearch, onToggleBookmarks, showBookmarks, onToggleMembers, showMembers }: ChannelHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(channel.title ?? "");
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [topicInput, setTopicInput] = useState(channel.topic ?? "");
  const updateTitle = useMutation(api.channels.updateTitle);
  const updateTopic = useMutation(api.channels.updateTopic);

  const handleSaveTitle = async () => {
    await updateTitle({ channelId: channel._id, title: titleInput.trim() });
    setIsEditingTitle(false);
  };

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
        <h2 className="flex items-center gap-1 text-sm font-bold text-text">
          {channel.isPrivate ? (
            <svg className="h-3.5 w-3.5 text-text-muted" viewBox="0 0 16 16" fill="currentColor">
              <path fillRule="evenodd" d="M4 6V4a4 4 0 1 1 8 0v2h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h1zm2-2a2 2 0 1 1 4 0v2H6V4z" clipRule="evenodd" />
            </svg>
          ) : (
            "#"
          )}
          {channel.name}
          {channel.title && (
            <>
              <span className="text-text-muted font-normal mx-1">—</span>
              <span className="font-medium text-text-secondary">{channel.title}</span>
            </>
          )}
        </h2>
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {isEditingTitle ? (
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveTitle();
                if (e.key === "Escape") setIsEditingTitle(false);
              }}
              autoFocus
              className="bg-transparent text-xs text-text-muted outline-none"
              placeholder="Set a title..."
            />
          ) : isEditingTopic ? (
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
              className="bg-transparent text-xs text-text-muted outline-none flex-1"
              placeholder="Set a topic..."
            />
          ) : (
            <>
              {!channel.title && (
                <>
                  <button
                    onClick={() => {
                      setTitleInput(channel.title ?? "");
                      setIsEditingTitle(true);
                    }}
                    className="hover:text-text-secondary"
                  >
                    Add a title
                  </button>
                  <span className="text-text-muted/50">|</span>
                </>
              )}
              {channel.title && (
                <>
                  <button
                    onClick={() => {
                      setTitleInput(channel.title ?? "");
                      setIsEditingTitle(true);
                    }}
                    className="hover:text-text-secondary"
                  >
                    Edit title
                  </button>
                  <span className="text-text-muted/50">|</span>
                </>
              )}
              <button
                onClick={() => {
                  setTopicInput(channel.topic ?? "");
                  setIsEditingTopic(true);
                }}
                className="truncate hover:text-text-secondary"
              >
                {channel.topic || "Add a topic"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Members button (private channel admins only) */}
      {channel.isPrivate && channel.isAdmin && onToggleMembers && (
        <button
          onClick={onToggleMembers}
          className={`ml-3 text-sm ${showMembers ? "text-accent" : "text-text-muted hover:text-text"}`}
          title="Manage members"
        >
          👥
        </button>
      )}

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
