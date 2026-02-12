"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageItem } from "@/components/MessageItem";

interface MessageListProps {
  channelId: Id<"channels">;
  onReplyInThread?: (messageId: Id<"messages">) => void;
  onReply?: (message: { _id: Id<"messages">; text: string; user: { username: string } }) => void;
}

export function MessageList({ channelId, onReplyInThread, onReply }: MessageListProps) {
  const messages = useQuery(api.messages.getMessages, { channelId });
  const pinnedMessageIds = useQuery(api.pins.getPinnedMessageIds, { channelId });
  const { user } = useUser();
  const markRead = useMutation(api.channelReads.markChannelRead);

  const messageIds = useMemo(
    () => (messages ?? []).map((m) => m._id),
    [messages]
  );
  const linkPreviews = useQuery(
    api.linkPreviews.getLinkPreviews,
    messageIds.length > 0 ? { messageIds } : "skip"
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

  const bookmarkedMessageIds = useQuery(
    api.bookmarks.getBookmarkedMessageIds,
    user ? { userId: user._id, channelId } : "skip"
  );

  const pinnedSet = useMemo(
    () => new Set(pinnedMessageIds ?? []),
    [pinnedMessageIds]
  );
  const bookmarkedSet = useMemo(
    () => new Set(bookmarkedMessageIds ?? []),
    [bookmarkedMessageIds]
  );
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  function scrollToMessage(messageId: string) {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightedMessageId(messageId);
      // Clear highlight after animation
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  }

  // Reset scroll state when switching channels so we scroll to bottom on entry
  useEffect(() => {
    prevLengthRef.current = 0;
  }, [channelId]);

  useEffect(() => {
    if (!messages) return;
    const container = containerRef.current;
    if (!container) return;

    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom || messages.length !== prevLengthRef.current) {
      if (prevLengthRef.current === 0 || isAtBottom) {
        bottomRef.current?.scrollIntoView({ behavior: prevLengthRef.current === 0 ? "instant" : "smooth" });
      }
    }
    prevLengthRef.current = messages.length;

    // Mark channel as read when new messages arrive and user is near the bottom
    if (user && isAtBottom) {
      markRead({ userId: user._id, channelId });
    }
  }, [messages]);

  if (messages === undefined) {
    return (
      <div className="flex-1 overflow-y-auto p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mb-4 flex gap-3">
            <div className="h-10 w-10 animate-pulse rounded-full bg-overlay" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-overlay" />
              <div className="h-4 w-64 animate-pulse rounded bg-overlay" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-text-muted">No messages yet. Be the first to say something!</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4">
      {messages.map((message, i) => {
        const prev = i > 0 ? messages[i - 1] : null;
        const isGrouped =
          prev !== null &&
          prev.user._id === message.user._id &&
          message._creationTime - prev._creationTime < 5 * 60 * 1000;
        const isHighlighted = highlightedMessageId === message._id;

        return (
          <div
            key={message._id}
            ref={(el) => {
              if (el) {
                messageRefs.current.set(message._id, el);
              } else {
                messageRefs.current.delete(message._id);
              }
            }}
            className={`transition-colors duration-500 ${
              isHighlighted ? "rounded-lg bg-accent-soft" : ""
            }`}
          >
            <MessageItem
              message={message}
              isGrouped={isGrouped}
              currentUserId={user?._id}
              onReplyInThread={onReplyInThread}
              onReply={onReply}
              onScrollToMessage={scrollToMessage}
              isPinned={pinnedSet.has(message._id)}
              isBookmarked={bookmarkedSet.has(message._id)}
              linkPreviews={previewsByMessageId.get(message._id)}
            />
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
