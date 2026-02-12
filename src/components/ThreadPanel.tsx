"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageItem } from "@/components/MessageItem";
import { MessageInput } from "@/components/MessageInput";
import { MessageText } from "@/components/MessageText";
import { LinkPreview } from "@/components/LinkPreview";
import { MessageAttachments } from "@/components/MessageAttachments";
import { Avatar } from "@/components/Avatar";

interface ThreadPanelProps {
  parentMessageId: Id<"messages">;
  channelId?: Id<"channels">;
  conversationId?: Id<"conversations">;
  contextName: string;
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

export function ThreadPanel({ parentMessageId, channelId, conversationId, contextName, onClose }: ThreadPanelProps) {
  const threadData = useQuery(api.messages.getThreadMessages, { parentMessageId: parentMessageId });
  const { user } = useUser();

  const threadMessageIds = useMemo(() => {
    if (!threadData) return [];
    return [threadData.parent._id, ...threadData.replies.map((r) => r._id)];
  }, [threadData]);
  const linkPreviews = useQuery(
    api.linkPreviews.getLinkPreviews,
    threadMessageIds.length > 0 ? { messageIds: threadMessageIds } : "skip"
  );
  const previewsByMessageId = useMemo(() => {
    const map = new Map<string, typeof linkPreviews>();
    if (!linkPreviews) return map;
    for (const p of linkPreviews) {
      const existing = map.get(p.messageId) ?? [];
      existing.push(p);
      map.set(p.messageId, existing);
    }
    return map;
  }, [linkPreviews]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!threadData?.replies) return;
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom || threadData.replies.length !== prevLengthRef.current) {
      if (prevLengthRef.current === 0 || isAtBottom) {
        container.scrollTo({ top: container.scrollHeight, behavior: prevLengthRef.current === 0 ? "instant" : "smooth" });
      }
    }
    prevLengthRef.current = threadData.replies.length;
  }, [threadData?.replies]);

  if (threadData === undefined) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-text">Thread</h3>
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

  if (threadData === null) {
    return (
      <div className="flex h-full flex-col border-l border-border bg-surface">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-bold text-text">Thread</h3>
          <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-text-muted">Message not found</p>
        </div>
      </div>
    );
  }

  const { parent, replies } = threadData;

  return (
    <div className="flex h-full flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-bold text-text">Thread</h3>
        <button type="button" onClick={onClose} className="text-text-muted hover:text-text">
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Parent message - read-only display */}
        <div className="border-b border-border p-4">
          <div className="flex gap-3">
            <Avatar
              username={parent.user.username}
              avatarColor={parent.user.avatarColor}
              avatarUrl={parent.user.avatarUrl}
              size="lg"
              className="mt-0.5 h-10 w-10 shrink-0 text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-text">{parent.user.username}</span>
                <span className="text-xs text-text-muted">{formatTimestamp(parent._creationTime)}</span>
              </div>
              <div className="text-sm text-text-secondary overflow-hidden break-words [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                <MessageText text={parent.text} />
                {parent.editedAt && (
                  <span className="ml-1 inline text-xs text-text-muted">(edited)</span>
                )}
              </div>
              {parent.attachments && parent.attachments.length > 0 && (
                <MessageAttachments attachments={parent.attachments} />
              )}
              {previewsByMessageId.get(parent._id)?.filter((p) => p.title || p.description).map((preview) => (
                <LinkPreview key={preview.url} preview={preview} />
              ))}
            </div>
          </div>
        </div>

        {/* Replies */}
        <div className="p-4">
          {replies.length > 0 && (
            <div className="mb-2 text-xs text-text-muted">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </div>
          )}
          {replies.map((reply, i) => {
            const prev = i > 0 ? replies[i - 1] : null;
            const isGrouped =
              prev !== null &&
              prev.user._id === reply.user._id &&
              reply._creationTime - prev._creationTime < 5 * 60 * 1000;

            return (
              <MessageItem
                key={reply._id}
                message={reply}
                isGrouped={isGrouped}
                currentUserId={user?._id}
                linkPreviews={previewsByMessageId.get(reply._id)}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Reply input */}
      <div className="min-w-0 border-t border-border px-4 pb-4 pt-2">
        <MessageInput
          channelId={channelId}
          channelName={channelId ? contextName : undefined}
          conversationId={conversationId}
          conversationName={conversationId ? contextName : undefined}
          parentMessageId={parentMessageId}
          placeholder="Reply in thread..."
        />
      </div>
    </div>
  );
}
