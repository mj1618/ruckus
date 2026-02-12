"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";

interface DrawChatOverlayProps {
  channelId: Id<"channels">;
}

export function DrawChatOverlay({ channelId }: DrawChatOverlayProps) {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const messages = useQuery(api.messages.getMessages, { channelId });
  const sendMessage = useMutation(api.messages.sendMessage);

  const recentMessages = messages?.slice(-20) ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [recentMessages.length]);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !user) return;
    sendMessage({ channelId, userId: user._id, text: text.trim() });
    setText("");
  }

  return (
    <div className="absolute right-2 top-2 z-20 flex flex-col items-end">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg transition-colors ${
          isOpen
            ? "bg-indigo-600 text-white"
            : "bg-zinc-800/80 text-zinc-300 hover:text-white"
        }`}
      >
        {isOpen ? "Hide Chat" : "Chat"}
      </button>

      {isOpen && (
        <div className="mt-2 flex h-80 w-72 flex-col rounded-lg bg-black/60 shadow-xl backdrop-blur-sm">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 text-sm">
            {recentMessages.length === 0 && (
              <div className="text-xs text-zinc-500">No messages yet</div>
            )}
            {recentMessages.map((msg) => (
              <div key={msg._id} className="mb-1.5">
                <span className="font-semibold text-indigo-400">
                  {msg.user?.username ?? "Unknown"}
                </span>{" "}
                <span className="text-zinc-300">{msg.text}</span>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="border-t border-zinc-700/50 p-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Say something..."
              className="w-full rounded bg-zinc-800/80 px-3 py-1.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </form>
        </div>
      )}
    </div>
  );
}
