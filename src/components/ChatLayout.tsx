"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { ChannelHeader } from "@/components/ChannelHeader";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OnlineUsers } from "@/components/OnlineUsers";

export function ChatLayout() {
  const [activeChannelId, setActiveChannelId] = useState<Id<"channels"> | null>(null);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "users">("chat");

  const channels = useQuery(api.channels.listChannels);

  // Default to #general once channels load
  useEffect(() => {
    if (channels && channels.length > 0 && activeChannelId === null) {
      const general = channels.find((c) => c.name === "general");
      setActiveChannelId(general ? general._id : channels[0]._id);
    }
  }, [channels, activeChannelId]);

  const activeChannel = channels?.find((c) => c._id === activeChannelId) ?? null;

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Channel Sidebar - desktop always, mobile overlay */}
      <div
        className={`${
          mobileView === "sidebar" ? "fixed inset-0 z-40 block" : "hidden"
        } md:relative md:block md:z-auto`}
      >
        {mobileView === "sidebar" && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setMobileView("chat")}
          />
        )}
        <div className="relative z-50 h-full w-64">
          <ChannelSidebar
            activeChannelId={activeChannelId}
            onSelectChannel={(id) => {
              setActiveChannelId(id);
              setMobileView("chat");
            }}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div
        className={`${
          mobileView === "chat" ? "flex" : "hidden"
        } min-w-0 flex-1 flex-col md:flex`}
      >
        {activeChannel ? (
          <>
            <ChannelHeader
              channel={activeChannel}
              onToggleSidebar={() => setMobileView(mobileView === "sidebar" ? "chat" : "sidebar")}
              onToggleUsers={() => setMobileView(mobileView === "users" ? "chat" : "users")}
            />
            <MessageList channelId={activeChannel._id} />
            <div className="border-t border-zinc-800 px-4 pb-4">
              <TypingIndicator channelId={activeChannel._id} />
              <MessageInput channelId={activeChannel._id} channelName={activeChannel.name} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-zinc-500">
            {channels === undefined ? "Loading..." : "Select a channel"}
          </div>
        )}
      </div>

      {/* Online Users - desktop always, mobile overlay */}
      <div
        className={`${
          mobileView === "users" ? "fixed inset-0 z-40 flex justify-end" : "hidden"
        } md:relative md:block md:z-auto`}
      >
        {mobileView === "users" && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setMobileView("chat")}
          />
        )}
        <div className="relative z-50 h-full w-56">
          <OnlineUsers />
        </div>
      </div>
    </div>
  );
}
