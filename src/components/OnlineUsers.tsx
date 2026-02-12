"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";
import { useUser } from "@/components/UserContext";

interface OnlineUsersProps {
  channelId?: Id<"channels">;
  channelName?: string;
  isPrivate?: boolean;
  onStartDM?: (conversationId: Id<"conversations">) => void;
}

export function OnlineUsers({ channelId, channelName, isPrivate, onStartDM }: OnlineUsersProps) {
  const { user: currentUser } = useUser();
  const users = useQuery(api.users.getChannelUsers, { channelId });
  const getOrCreateConversation = useMutation(api.conversations.getOrCreateConversation);

  const onlineUsers = users?.filter((u) => u.isOnline) ?? [];
  const offlineUsers = users?.filter((u) => !u.isOnline) ?? [];

  const sortedOnline = [...onlineUsers].sort((a, b) => a.username.localeCompare(b.username));
  const sortedOffline = [...offlineUsers].sort((a, b) => a.username.localeCompare(b.username));

  const handleStartDM = async (otherUserId: Id<"users">) => {
    if (!currentUser || !onStartDM) return;
    const conversationId = await getOrCreateConversation({
      userId: currentUser._id,
      otherUserId,
    });
    onStartDM(conversationId);
  };

  const headerLabel = channelId
    ? isPrivate
      ? `Members — ${users?.length ?? 0}`
      : `Users — ${users?.length ?? 0}`
    : `Users — ${users?.length ?? 0}`;

  const renderUser = (user: NonNullable<typeof users>[number]) => {
    const isCurrentUser = currentUser?._id === user._id;
    const canStartDM = !isCurrentUser && onStartDM;

    return (
      <div
        key={user._id}
        onClick={canStartDM ? () => handleStartDM(user._id) : undefined}
        className={`group flex items-center gap-2 rounded px-2 py-1.5 hover:bg-hover ${
          canStartDM ? "cursor-pointer active:bg-selected md:cursor-default md:active:bg-hover" : ""
        }`}
      >
        <button
          onClick={canStartDM ? (e) => {
            e.stopPropagation();
            handleStartDM(user._id);
          } : undefined}
          className={`relative ${canStartDM ? "cursor-pointer" : ""}`}
          disabled={!canStartDM}
          title={canStartDM ? `Message ${user.username}` : undefined}
        >
          <Avatar
            username={user.username}
            avatarColor={user.avatarColor}
            avatarUrl={user.avatarUrl}
            size="sm"
          />
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface ${
              user.isOnline ? "bg-success" : "bg-border"
            }`}
          />
        </button>
        <div className="min-w-0 flex-1">
          <span className={`truncate text-sm ${user.isOnline ? "text-text-secondary" : "text-text-muted"}`}>
            {user.username}
            {user.isBot && (
              <span className="ml-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] font-semibold uppercase text-accent">
                BOT
              </span>
            )}
            {isCurrentUser && <span className="text-text-muted"> (you)</span>}
          </span>
          {(user.statusEmoji || user.statusText) && (
            <div className="truncate text-xs text-text-muted">
              {user.statusEmoji && <span>{user.statusEmoji} </span>}
              {user.statusText}
            </div>
          )}
        </div>
        {!isCurrentUser && onStartDM && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleStartDM(user._id);
            }}
            className="hidden shrink-0 rounded bg-accent px-2 py-1 text-xs text-white hover:bg-accent-hover group-hover:block"
            title={`Message ${user.username}`}
          >
            Message
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      <div className="flex h-14 items-center border-b border-border px-4">
        <h3 className="text-xs font-semibold uppercase text-text-muted">
          {headerLabel}
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {sortedOnline.length > 0 && (
          <>
            <div className="px-2 py-1 text-[10px] font-semibold uppercase text-text-muted">
              Online — {sortedOnline.length}
            </div>
            {sortedOnline.map(renderUser)}
          </>
        )}
        {sortedOffline.length > 0 && (
          <>
            <div className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase text-text-muted">
              Offline — {sortedOffline.length}
            </div>
            {sortedOffline.map(renderUser)}
          </>
        )}
      </div>
    </div>
  );
}
