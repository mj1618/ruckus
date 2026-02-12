"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MessageItem } from "@/components/MessageItem";

interface MessageListProps {
  channelId: Id<"channels">;
  onReplyInThread?: (messageId: Id<"messages">) => void;
}

export function MessageList({ channelId, onReplyInThread }: MessageListProps) {
  const messages = useQuery(api.messages.getMessages, { channelId });
  const { user } = useUser();
  const markRead = useMutation(api.channelReads.markChannelRead);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

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
            <div className="h-10 w-10 animate-pulse rounded-full bg-zinc-800" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
              <div className="h-4 w-64 animate-pulse rounded bg-zinc-800" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-zinc-500">No messages yet. Be the first to say something!</p>
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

        return (
          <MessageItem
            key={message._id}
            message={message}
            isGrouped={isGrouped}
            currentUserId={user?._id}
            onReplyInThread={onReplyInThread}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
