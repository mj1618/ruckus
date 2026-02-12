"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageText } from "@/components/MessageText";
import { MessageAttachments } from "@/components/MessageAttachments";
import { Avatar } from "@/components/Avatar";

interface PinnedMessagesProps {
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  onClose: () => void;
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

export function PinnedMessages({ channelId, conversationId, onClose }: PinnedMessagesProps) {
  const pinnedMessages = useQuery(
    api.pins.getPinnedMessages,
    channelId ? { channelId } : conversationId ? { conversationId } : "skip"
  );
  const { user } = useUser();
  const unpinMessage = useMutation(api.pins.unpinMessage);

  function handleUnpin(messageId: Id<"messages">) {
    if (!user) return;
    unpinMessage({ messageId, userId: user._id });
  }

  if (pinnedMessages === undefined) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-text">📌 Pinned Messages</h3>
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
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text">📌 Pinned Messages</h3>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-text-muted">No pinned messages in this channel</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {pinnedMessages.map(({ pin, message }) => (
              <div key={pin._id} className="p-4 hover:bg-hover">
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
                    {message.attachments && message.attachments.length > 0 && (
                      <MessageAttachments attachments={message.attachments} />
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-text-muted">
                      <span>Pinned by {pin.pinnedByUsername}</span>
                      <button
                        type="button"
                        className="text-text-muted hover:text-danger"
                        onClick={() => handleUnpin(message._id)}
                      >
                        Unpin
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
