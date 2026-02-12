"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";

interface ChannelSidebarProps {
  activeChannelId: Id<"channels"> | null;
  onSelectChannel: (id: Id<"channels">) => void;
}

export function ChannelSidebar({ activeChannelId, onSelectChannel }: ChannelSidebarProps) {
  const { user } = useUser();
  const channels = useQuery(api.channels.listChannels);
  const createChannel = useMutation(api.channels.createChannel);

  const [isCreating, setIsCreating] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [error, setError] = useState("");

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
    <div className="flex h-full flex-col border-r border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <h1 className="text-xl font-bold text-zinc-100">Ruckus</h1>
      </div>

      {/* Channel list */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {channels?.map((channel) => (
          <button
            key={channel._id}
            onClick={() => onSelectChannel(channel._id)}
            className={`w-full rounded px-3 py-1.5 text-left text-sm transition-colors ${
              channel._id === activeChannelId
                ? "bg-zinc-700/50 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
            }`}
          >
            # {channel.name}
          </button>
        ))}

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
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-indigo-500"
            />
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
          </form>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="mt-2 w-full rounded px-3 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-400"
          >
            + Create Channel
          </button>
        )}
      </div>

      {/* Footer - current user */}
      {user && (
        <div className="border-t border-zinc-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: user.avatarColor }}
            >
              {user.username[0].toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-100">{user.username}</p>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs text-zinc-500">Online</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
