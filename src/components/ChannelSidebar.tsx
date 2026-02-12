"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { Avatar } from "@/components/Avatar";
import { UserSettingsModal } from "@/components/UserSettingsModal";

interface ChannelSidebarProps {
  activeChannelId: Id<"channels"> | null;
  activeConversationId?: Id<"conversations"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
  onSelectConversation?: (id: Id<"conversations">) => void;
}

export function ChannelSidebar({ activeChannelId, activeConversationId, onSelectChannel, onSelectConversation }: ChannelSidebarProps) {
  const { user } = useUser();
  const channels = useQuery(
    api.channels.listChannels,
    user ? { userId: user._id } : "skip"
  );
  const createChannel = useMutation(api.channels.createChannel);
  const conversations = useQuery(
    api.conversations.listConversations,
    user ? { userId: user._id } : "skip"
  );
  const unreadCounts = useQuery(
    api.channelReads.getUnreadCounts,
    user ? { userId: user._id } : "skip"
  );
  const unreadConversationCounts = useQuery(
    api.conversationReads.getUnreadCounts,
    user ? { userId: user._id } : "skip"
  );
  const unreadMap = new Map(
    unreadCounts?.map((c) => [c.channelId, c.unreadCount])
  );
  const unreadConversationMap = new Map(
    unreadConversationCounts?.map((c) => [c.conversationId, c.unreadCount])
  );

  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);

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

        {/* Direct Messages section */}
        {conversations && conversations.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase text-text-muted">
              Direct Messages
            </div>
            {conversations.map((conversation) => {
              const unreadCount = unreadConversationMap.get(conversation._id) ?? 0;
              const otherUser = conversation.otherUser;
              if (!otherUser) return null;
              return (
                <button
                  key={conversation._id}
                  onClick={() => onSelectConversation?.(conversation._id)}
                  className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors flex items-center justify-between ${
                    conversation._id === activeConversationId
                      ? "bg-selected text-text"
                      : unreadCount > 0
                        ? "text-text font-semibold hover:bg-hover"
                        : "text-text-muted hover:bg-hover hover:text-text-secondary"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <div className="relative shrink-0">
                      <div
                        className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ backgroundColor: otherUser.avatarColor }}
                      >
                        {otherUser.username[0].toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-[1.5px] ${
                        Date.now() - otherUser.lastSeen < 60_000
                          ? 'border-surface bg-success'
                          : 'border-text-muted bg-surface'
                      }`} />
                    </div>
                    <span className="truncate">{otherUser.username}</span>
                    {otherUser.isBot && (
                      <span className="shrink-0 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-medium text-accent">
                        BOT
                      </span>
                    )}
                  </span>
                  {unreadCount > 0 && conversation._id !== activeConversationId && (
                    <span className="bg-accent text-white text-xs font-medium px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Footer - current user */}
      {user && (
        <div className="px-2 py-2">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-hover"
            onClick={() => setShowSettings(true)}
          >
            <Avatar
              username={user.username}
              avatarColor={user.avatarColor}
              avatarUrl={user.avatarUrl}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-text">{user.username}</div>
              <div className="truncate text-xs text-text-muted">
                {user.statusEmoji || user.statusText
                  ? `${user.statusEmoji || ""} ${user.statusText || ""}`.trim()
                  : "Set a status"}
              </div>
            </div>
            <svg
              className="h-4 w-4 text-text-muted"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {showSettings && (
            <UserSettingsModal user={user} onClose={() => setShowSettings(false)} />
          )}
        </div>
      )}
    </div>
  );
}
