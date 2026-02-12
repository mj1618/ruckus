"use client";

import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface ConversationHeaderProps {
  conversation: {
    _id: Id<"conversations">;
    otherUser: {
      _id: Id<"users">;
      username: string;
      avatarColor: string;
      avatarStorageId?: Id<"_storage">;
      lastSeen: number;
      statusEmoji?: string;
      statusText?: string;
      isBot?: boolean;
    } | null;
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

export function ConversationHeader({
  conversation,
  onToggleSidebar,
  onToggleUsers,
  onTogglePins,
  showPins,
  onToggleSearch,
  showSearch,
  onToggleBookmarks,
  showBookmarks,
}: ConversationHeaderProps) {
  const otherUser = conversation.otherUser;
  
  // Calculate if user is online (active in last 60 seconds, matching server-side cutoff)
  const isOnline = otherUser ? Date.now() - otherUser.lastSeen < 60_000 : false;

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

      <div className="min-w-0 flex-1 flex items-center gap-3">
        {otherUser && (
          <div className="relative">
            <Avatar
              username={otherUser.username}
              avatarColor={otherUser.avatarColor}
              size="md"
            />
            <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 ${isOnline ? 'border-surface bg-success' : 'border-surface bg-border'}`} />
          </div>
        )}
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-text">
            {otherUser?.username ?? "Unknown User"}
            {otherUser?.isBot && (
              <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                BOT
              </span>
            )}
          </h2>
          <div className="text-xs text-text-muted">
            {otherUser?.statusEmoji || otherUser?.statusText ? (
              <span>
                {otherUser.statusEmoji} {otherUser.statusText}
              </span>
            ) : isOnline ? (
              "Online"
            ) : (
              "Offline"
            )}
          </div>
        </div>
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
