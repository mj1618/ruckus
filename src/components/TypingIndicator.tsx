"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";

interface TypingIndicatorProps {
  channelId: Id<"channels">;
}

export function TypingIndicator({ channelId }: TypingIndicatorProps) {
  const { user } = useUser();
  const typingUsers = useQuery(api.typing.getTypingUsers, { channelId });

  const others = typingUsers?.filter((u) => u._id !== user?._id) ?? [];

  let text = "";
  if (others.length === 1) {
    text = `${others[0].username} is typing`;
  } else if (others.length === 2) {
    text = `${others[0].username} and ${others[1].username} are typing`;
  } else if (others.length > 2) {
    text = `${others[0].username}, ${others[1].username}, and ${others.length - 2} others are typing`;
  }

  return (
    <div className="h-6 px-1">
      {text && (
        <p className="text-sm italic text-zinc-400">
          {text}
          <span className="typing-dots">
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
          </span>
        </p>
      )}
    </div>
  );
}
