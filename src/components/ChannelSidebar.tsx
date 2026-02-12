"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { StatusPicker } from "@/components/StatusPicker";
import { ThemePicker } from "@/components/ThemePicker";

interface ChannelSidebarProps {
  activeChannelId: Id<"channels"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
}

export function ChannelSidebar({ activeChannelId, onSelectChannel }: ChannelSidebarProps) {
  const { user } = useUser();
  const channels = useQuery(api.channels.listChannels);
  const createChannel = useMutation(api.channels.createChannel);
  const unreadCounts = useQuery(
    api.channelReads.getUnreadCounts,
    user ? { userId: user._id } : "skip"
  );
  const unreadMap = new Map(
    unreadCounts?.map((c) => [c.channelId, c.unreadCount])
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [error, setError] = useState("");
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newChannelName.trim().toLowerCase();
    if (!name || !user) return;

    try {
      const channelId = await createChannel({ name, userId: user._id });
      setNewChannelName("");
      setIsCreating(false);
      setError("");
      onSelectChannel(channelId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create channel");
    }
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <h1 className="text-xl font-bold text-text">Ruckus</h1>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {channels?.map((channel) => {
          const unreadCount = unreadMap.get(channel._id) ?? 0;
          return (
            <button
              key={channel._id}
              onClick={() => onSelectChannel(channel._id)}
              className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${
                channel._id === activeChannelId
                  ? "bg-selected text-text"
                  : unreadCount > 0
                    ? "text-text font-semibold hover:bg-hover"
                    : "text-text-muted hover:bg-hover hover:text-text-secondary"
              }`}
            >
              <span>{channel.name === "draw" ? "✏️" : "#"} {channel.name}</span>
              {unreadCount > 0 && channel._id !== activeChannelId && (
                <span className="bg-accent text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Create channel */}
        {isCreating ? (
          <form onSubmit={handleCreate} className="mt-2 px-1">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => {
                setNewChannelName(e.target.value);
                setError("");
              }}
              placeholder="channel-name"
              autoFocus
              onBlur={() => {
                if (!newChannelName.trim()) {
                  setIsCreating(false);
                  setError("");
                }
              }}
              className="w-full rounded border border-border bg-overlay px-2 py-1 text-sm text-text placeholder-text-muted outline-none focus:border-accent"
            />
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="mt-2 w-full rounded px-3 py-1.5 text-left text-sm text-text-muted transition-colors hover:bg-hover hover:text-text-secondary"
          >
            + Create Channel
          </button>
        )}
      </div>

      {/* Footer - current user with status */}
      {user && (
        <div className="relative border-t border-border bg-base px-3 py-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover"
              onClick={() => setShowStatusPicker(v => !v)}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.username[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-text">{user.username}</div>
                <div className="truncate text-xs text-text-muted">
                  {user.statusEmoji || user.statusText
                    ? `${user.statusEmoji || ""} ${user.statusText || ""}`.trim()
                    : "Set a status"}
                </div>
              </div>
            </button>
            <div className="relative">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded text-text-muted hover:bg-hover hover:text-text"
                onClick={() => setShowThemePicker(v => !v)}
                title="Change theme"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 2a10 10 0 0 0 0 20 8 8 0 0 0 0-16 6 6 0 0 0 0 12 4 4 0 0 0 0-8" />
                </svg>
              </button>
              {showThemePicker && (
                <ThemePicker onClose={() => setShowThemePicker(false)} />
              )}
            </div>
          </div>
          {showStatusPicker && (
            <StatusPicker
              userId={user._id}
              currentEmoji={user.statusEmoji}
              currentText={user.statusText}
              onClose={() => setShowStatusPicker(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
