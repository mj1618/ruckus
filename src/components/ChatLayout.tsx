"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { ChannelHeader } from "@/components/ChannelHeader";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OnlineUsers } from "@/components/OnlineUsers";
import { ThreadPanel } from "@/components/ThreadPanel";
import { PinnedMessages } from "@/components/PinnedMessages";
import { SearchPanel } from "@/components/SearchPanel";
import { SearchPalette } from "@/components/SearchPalette";
import { NotificationPermission } from "@/components/NotificationPermission";
import { useNotifications } from "@/hooks/useNotifications";

export function ChatLayout() {
  const [activeChannelId, setActiveChannelId] = useState<Id<"channels"> | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<Id<"messages"> | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showSearchPalette, setShowSearchPalette] = useState(false);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "users" | "thread" | "pins" | "search">("chat");

  const { user } = useUser();
  const channels = useQuery(api.channels.listChannels);
  const markRead = useMutation(api.channelReads.markChannelRead);

  // Default to #general once channels load
  useEffect(() => {
    if (channels && channels.length > 0 && activeChannelId === null) {
      const general = channels.find((c) => c.name === "general");
      setActiveChannelId(general ? general._id : channels[0]._id);
    }
  }, [channels, activeChannelId]);

  // Ctrl/Cmd+K to toggle search palette
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowSearchPalette((v) => !v);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close thread, pins, and search panels when switching channels
  useEffect(() => {
    setActiveThreadId(null);
    setShowPinnedMessages(false);
    setShowSearch(false);
  }, [activeChannelId]);

  // Mark channel as read when switching channels
  useEffect(() => {
    if (activeChannelId && user) {
      markRead({ userId: user._id, channelId: activeChannelId });
    }
  }, [activeChannelId, user]);

  const { permissionState, requestPermission, dismissed, dismiss } = useNotifications(
    user?._id,
    user?.username,
    activeChannelId
  );

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
              onTogglePins={() => {
                setShowPinnedMessages((v) => !v);
                if (!showPinnedMessages) {
                  setMobileView("pins");
                } else if (mobileView === "pins") {
                  setMobileView("chat");
                }
              }}
              showPins={showPinnedMessages}
              onToggleSearch={() => {
                setShowSearch((v) => !v);
                if (!showSearch) {
                  setMobileView("search");
                } else if (mobileView === "search") {
                  setMobileView("chat");
                }
              }}
              showSearch={showSearch}
            />
            <NotificationPermission
              permissionState={permissionState}
              dismissed={dismissed}
              onRequestPermission={requestPermission}
              onDismiss={dismiss}
            />
            <MessageList channelId={activeChannel._id} onReplyInThread={(messageId) => {
              setActiveThreadId(messageId);
              setMobileView("thread");
            }} />
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

      {/* Right panel - Thread, Pinned Messages, Search, or Online Users */}
      <div
        className={`${
          mobileView === "users" || mobileView === "thread" || mobileView === "pins" || mobileView === "search"
            ? "fixed inset-0 z-40 flex justify-end"
            : "hidden"
        } md:relative md:block md:z-auto`}
      >
        {(mobileView === "users" || mobileView === "thread" || mobileView === "pins" || mobileView === "search") && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setMobileView("chat")}
          />
        )}
        <div className={`relative z-50 h-full ${activeThreadId || showPinnedMessages || showSearch ? "w-80" : "w-56"}`}>
          {activeThreadId && activeChannel ? (
            <ThreadPanel
              parentMessageId={activeThreadId}
              channelId={activeChannel._id}
              channelName={activeChannel.name}
              onClose={() => {
                setActiveThreadId(null);
                if (mobileView === "thread") setMobileView("chat");
              }}
            />
          ) : showPinnedMessages && activeChannel ? (
            <PinnedMessages
              channelId={activeChannel._id}
              onClose={() => {
                setShowPinnedMessages(false);
                if (mobileView === "pins") setMobileView("chat");
              }}
            />
          ) : showSearch ? (
            <SearchPanel
              onClose={() => {
                setShowSearch(false);
                if (mobileView === "search") setMobileView("chat");
              }}
              onNavigateToChannel={(channelId) => {
                setActiveChannelId(channelId);
                setShowSearch(false);
                setMobileView("chat");
              }}
            />
          ) : (
            <OnlineUsers />
          )}
        </div>
      </div>

      {/* Search Palette Modal (Cmd+K) */}
      <SearchPalette
        open={showSearchPalette}
        onClose={() => setShowSearchPalette(false)}
        channels={channels ?? []}
        onSelectChannel={(channelId) => {
          setActiveChannelId(channelId);
          setShowSearchPalette(false);
          setMobileView("chat");
        }}
      />
    </div>
  );
}
