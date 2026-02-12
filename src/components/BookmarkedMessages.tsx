"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageText } from "@/components/MessageText";
import { Avatar } from "@/components/Avatar";

interface BookmarkedMessagesProps {
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

export function BookmarkedMessages({ onClose, onNavigateToChannel, onNavigateToConversation }: BookmarkedMessagesProps) {
  const { user } = useUser();
  const bookmarks = useQuery(api.bookmarks.getBookmarks, user ? { userId: user._id } : "skip");
  const removeBookmark = useMutation(api.bookmarks.removeBookmark);

  function handleRemove(messageId: Id<"messages">) {
    if (!user) return;
    removeBookmark({ userId: user._id, messageId });
  }

  if (bookmarks === undefined) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-text">🔖 Saved Messages</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text">🔖 Saved Messages</h3>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {bookmarks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-text-muted">No saved messages yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {bookmarks.map(({ bookmark, message }) => (
              <div key={bookmark._id} className="p-4 hover:bg-hover">
                <div className="flex gap-3">
                  <Avatar
                    username={message.user.username}
                    avatarColor={message.user.avatarColor}
                    avatarUrl={message.user.avatarUrl}
                    size="md"
                    className="mt-0.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-text">{message.user.username}</span>
                      <span className="text-xs text-text-muted">{formatTimestamp(message._creationTime)}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-text-secondary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <MessageText text={message.text} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                      {message.channelId && message.channelName ? (
                        <button
                          type="button"
                          className="text-accent hover:text-accent-hover hover:underline"
                          onClick={() => onNavigateToChannel(message.channelId!)}
                        >
                          in #{message.channelName}
                        </button>
                      ) : message.conversationId && message.conversationUser && onNavigateToConversation ? (
                        <button
                          type="button"
                          className="text-success hover:text-success/80 hover:underline"
                          onClick={() => onNavigateToConversation(message.conversationId!)}
                        >
                          DM with {message.conversationUser.username}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="text-text-muted hover:text-danger"
                        onClick={() => handleRemove(message._id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
