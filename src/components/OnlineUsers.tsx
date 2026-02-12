"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function OnlineUsers() {
  const onlineUsers = useQuery(api.users.getOnlineUsers);

  const sorted = onlineUsers
    ? [...onlineUsers].sort((a, b) => a.username.localeCompare(b.username))
    : [];

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase text-zinc-400">
          Online — {sorted.length}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sorted.map((user) => (
          <div key={user._id} className="flex items-center gap-2 rounded px-2 py-1.5">
            <div className="relative">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: user.avatarColor }}
              >
                {user.username[0].toUpperCase()}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-900 bg-green-500" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="truncate text-sm text-zinc-300">{user.username}</span>
              {(user.statusEmoji || user.statusText) && (
                <div className="truncate text-xs text-zinc-500">
                  {user.statusEmoji && <span>{user.statusEmoji} </span>}
                  {user.statusText}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
