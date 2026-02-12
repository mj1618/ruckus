"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageText } from "@/components/MessageText";

interface PinnedMessagesProps {
  channelId: Id<"channels">;
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

export function PinnedMessages({ channelId, onClose }: PinnedMessagesProps) {
  const pinnedMessages = useQuery(api.pins.getPinnedMessages, { channelId });
  const { user } = useUser();
  const unpinMessage = useMutation(api.pins.unpinMessage);

  function handleUnpin(messageId: Id<"messages">) {
    if (!user) return;
    unpinMessage({ messageId, userId: user._id });
  }

  if (pinnedMessages === undefined) {
    return (
      <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-bold text-zinc-100">📌 Pinned Messages</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-zinc-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-bold text-zinc-100">📌 Pinned Messages</h3>
        <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-200">
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {pinnedMessages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <p className="text-sm text-zinc-500">No pinned messages in this channel</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {pinnedMessages.map(({ pin, message }) => (
              <div key={pin._id} className="p-4">
                <div className="flex gap-3">
                  <div
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: message.user.avatarColor }}
                  >
                    {message.user.username[0].toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-zinc-100">{message.user.username}</span>
                      <span className="text-xs text-zinc-500">{formatTimestamp(message._creationTime)}</span>
                    </div>
                    <div className="mt-0.5 text-sm text-zinc-300 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <MessageText text={message.text} />
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                      <span>Pinned by {pin.pinnedByUsername}</span>
                      <button
                        type="button"
                        className="text-zinc-400 hover:text-red-400"
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
