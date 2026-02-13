"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { ChannelSidebar } from "@/components/ChannelSidebar";
import { ChannelHeader } from "@/components/ChannelHeader";
import { ConversationHeader } from "@/components/ConversationHeader";
import { MessageList } from "@/components/MessageList";
import { MessageInput } from "@/components/MessageInput";
import { TypingIndicator } from "@/components/TypingIndicator";
import { OnlineUsers } from "@/components/OnlineUsers";
import { ThreadPanel } from "@/components/ThreadPanel";
import { PinnedMessages } from "@/components/PinnedMessages";
import { SearchPanel } from "@/components/SearchPanel";
import { SearchPalette } from "@/components/SearchPalette";
import { BookmarkedMessages } from "@/components/BookmarkedMessages";
import { NotificationPermission } from "@/components/NotificationPermission";
import { DrawCanvas } from "@/components/DrawCanvas";
import { DrawChatOverlay } from "@/components/DrawChatOverlay";
import { LockedChannelView } from "@/components/LockedChannelView";
import { ChannelMemberManagement } from "@/components/ChannelMemberManagement";
import { useNotifications } from "@/hooks/useNotifications";

type ReplyToMessage = {
  _id: Id<"messages">;
  text: string;
  user: {
    username: string;
  };
};

export function ChatLayout() {
  const [activeChannelId, setActiveChannelId] = useState<Id<"channels"> | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<Id<"conversations"> | null>(null);
  const [activeThreadId, setActiveThreadId] = useState<Id<"messages"> | null>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showSearchPalette, setShowSearchPalette] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [mobileView, setMobileView] = useState<"sidebar" | "chat" | "users" | "thread" | "pins" | "search" | "bookmarks" | "members">("chat");
  const [isDragOver, setIsDragOver] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[] | undefined>(undefined);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToMessage | null>(null);
  const dragCounterRef = useRef(0);

  const { user } = useUser();
  const channels = useQuery(
    api.channels.listChannels,
    user ? { userId: user._id } : "skip"
  );
  const conversations = useQuery(
    api.conversations.listConversations,
    user ? { userId: user._id } : "skip"
  );
  const activeConversation = useQuery(
    api.conversations.getConversation,
    activeConversationId && user ? { conversationId: activeConversationId, userId: user._id } : "skip"
  );
  const markChannelRead = useMutation(api.channelReads.markChannelRead);
  const markConversationRead = useMutation(api.conversationReads.markConversationRead);

  // Default to #general once channels load
  useEffect(() => {
    if (channels && channels.length > 0 && activeChannelId === null && activeConversationId === null) {
      const general = channels.find((c) => c.name === "general");
      setActiveChannelId(general ? general._id : channels[0]._id);
    }
  }, [channels, activeChannelId, activeConversationId]);

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

  // Close thread, pins, search, members panels, and clear reply when switching channels or conversations
  useEffect(() => {
    setActiveThreadId(null);
    setShowPinnedMessages(false);
    setShowSearch(false);
    setShowBookmarks(false);
    setShowMembers(false);
    setReplyToMessage(null);
  }, [activeChannelId, activeConversationId]);

  // Mark channel/conversation as read when switching
  useEffect(() => {
    if (activeChannelId && user) {
      markChannelRead({ userId: user._id, channelId: activeChannelId });
    }
  }, [activeChannelId, user]);

  useEffect(() => {
    if (activeConversationId && user) {
      markConversationRead({ userId: user._id, conversationId: activeConversationId });
    }
  }, [activeConversationId, user]);

  const { permissionState, requestPermission, dismissed, dismiss } = useNotifications(
    user?._id,
    user?.username,
    activeChannelId
  );

  const activeChannel = channels?.find((c) => c._id === activeChannelId) ?? null;

  // Helper to select a channel (clears conversation)
  const handleSelectChannel = (channelId: Id<"channels">) => {
    setActiveChannelId(channelId);
    setActiveConversationId(null);
    setMobileView("chat");
  };

  // Helper to select a conversation (clears channel)
  const handleSelectConversation = (conversationId: Id<"conversations">) => {
    setActiveConversationId(conversationId);
    setActiveChannelId(null);
    setMobileView("chat");
  };

  return (
    <div className="flex h-screen overflow-hidden bg-elevated">
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
            activeConversationId={activeConversationId}
            onSelectChannel={handleSelectChannel}
            onSelectConversation={handleSelectConversation}
          />
        </div>
      </div>

      {/* Main chat area */}
      <div
        className={`${
          mobileView === "chat" ? "flex" : "hidden"
        } relative min-w-0 flex-1 flex-col md:flex`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragCounterRef.current++;
          if (e.dataTransfer.types.includes("Files")) {
            setIsDragOver(true);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          dragCounterRef.current--;
          if (dragCounterRef.current === 0) {
            setIsDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragCounterRef.current = 0;
          setIsDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            setDroppedFiles(Array.from(e.dataTransfer.files));
          }
        }}
      >
        {isDragOver && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-accent-soft backdrop-blur-sm">
            <div className="rounded-xl border-2 border-dashed border-accent bg-surface/95 px-8 py-6 text-center shadow-xl">
              <div className="text-3xl">📎</div>
              <div className="mt-2 text-sm font-medium text-accent">Drop files to upload</div>
            </div>
          </div>
        )}
        {activeChannel ? (
          <>
            {/* Fixed header on mobile */}
            <div className="fixed left-0 right-0 top-0 z-20 md:relative md:z-auto">
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
                onToggleBookmarks={() => {
                  setShowBookmarks((v) => !v);
                  if (!showBookmarks) {
                    setMobileView("bookmarks");
                  } else if (mobileView === "bookmarks") {
                    setMobileView("chat");
                  }
                }}
                showBookmarks={showBookmarks}
                onToggleMembers={() => {
                  setShowMembers((v) => !v);
                  if (!showMembers) {
                    setMobileView("members");
                  } else if (mobileView === "members") {
                    setMobileView("chat");
                  }
                }}
                showMembers={showMembers}
              />
              <NotificationPermission
                permissionState={permissionState}
                dismissed={dismissed}
                onRequestPermission={requestPermission}
                onDismiss={dismiss}
              />
            </div>
            {/* Check if user has access to private channel */}
            {activeChannel.isPrivate && !activeChannel.isMember ? (
              <div className="flex flex-1 flex-col overflow-hidden pt-14 md:pt-0">
                <LockedChannelView
                  channelId={activeChannel._id}
                  channelName={activeChannel.name}
                  accessRequestStatus={activeChannel.accessRequestStatus}
                />
              </div>
            ) : activeChannel.name === "draw" ? (
              <div className="relative flex flex-1 overflow-hidden pt-14 md:pt-0">
                <DrawCanvas channelId={activeChannel._id} />
                <DrawChatOverlay channelId={activeChannel._id} />
              </div>
            ) : (
              <>
                {/* Message list with padding for fixed header/footer on mobile */}
                <div className="flex flex-1 flex-col overflow-hidden pt-14 pb-[88px] md:pt-0 md:pb-0">
                  <MessageList 
                    channelId={activeChannel._id} 
                    onReplyInThread={(messageId) => {
                      setActiveThreadId(messageId);
                      setMobileView("thread");
                    }}
                    onReply={(message) => setReplyToMessage(message)}
                  />
                </div>
                {/* Fixed input on mobile */}
                <div className="fixed bottom-0 left-0 right-0 z-20 bg-elevated px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:relative md:z-auto md:pb-4 md:pt-0">
                  <TypingIndicator channelId={activeChannel._id} />
                  <MessageInput
                    channelId={activeChannel._id}
                    channelName={activeChannel.name}
                    droppedFiles={droppedFiles}
                    onDroppedFilesHandled={() => setDroppedFiles(undefined)}
                    replyToMessage={replyToMessage ?? undefined}
                    onCancelReply={() => setReplyToMessage(null)}
                  />
                </div>
              </>
            )}
          </>
        ) : activeConversation ? (
          <>
            {/* Fixed header on mobile for DMs */}
            <div className="fixed left-0 right-0 top-0 z-20 md:relative md:z-auto">
              <ConversationHeader
                conversation={activeConversation}
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
                onToggleBookmarks={() => {
                  setShowBookmarks((v) => !v);
                  if (!showBookmarks) {
                    setMobileView("bookmarks");
                  } else if (mobileView === "bookmarks") {
                    setMobileView("chat");
                  }
                }}
                showBookmarks={showBookmarks}
              />
            </div>
            <>
              {/* Message list for DMs */}
              <div className="flex flex-1 flex-col overflow-hidden pt-14 pb-[88px] md:pt-0 md:pb-0">
                <MessageList 
                  conversationId={activeConversation._id} 
                  onReplyInThread={(messageId) => {
                    setActiveThreadId(messageId);
                    setMobileView("thread");
                  }}
                  onReply={(message) => setReplyToMessage(message)}
                />
              </div>
              {/* Fixed input on mobile for DMs */}
              <div className="fixed bottom-0 left-0 right-0 z-20 bg-elevated px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 md:relative md:z-auto md:pb-4 md:pt-0">
                <TypingIndicator conversationId={activeConversation._id} />
                <MessageInput
                  conversationId={activeConversation._id}
                  conversationName={activeConversation.otherUser?.username ?? "Unknown"}
                  droppedFiles={droppedFiles}
                  onDroppedFilesHandled={() => setDroppedFiles(undefined)}
                  replyToMessage={replyToMessage ?? undefined}
                  onCancelReply={() => setReplyToMessage(null)}
                />
              </div>
            </>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-text-muted">
            {channels === undefined ? "Loading..." : "Select a channel or conversation"}
          </div>
        )}
      </div>

      {/* Right panel - Thread, Pinned Messages, Search, Members, or Online Users */}
      <div
        className={`${
          mobileView === "users" || mobileView === "thread" || mobileView === "pins" || mobileView === "search" || mobileView === "bookmarks" || mobileView === "members"
            ? "fixed inset-0 z-40 flex justify-end"
            : "hidden"
        } md:relative md:block md:z-auto`}
      >
        {(mobileView === "users" || mobileView === "thread" || mobileView === "pins" || mobileView === "search" || mobileView === "bookmarks" || mobileView === "members") && (
          <div
            className="fixed inset-0 bg-black/50 md:hidden"
            onClick={() => setMobileView("chat")}
          />
        )}
        <div className={`relative z-50 h-full ${activeThreadId || showPinnedMessages || showSearch || showBookmarks || showMembers ? "w-80" : "w-56"}`}>
          {activeThreadId && (activeChannel || activeConversation) ? (
            <ThreadPanel
              parentMessageId={activeThreadId}
              channelId={activeChannel?._id}
              conversationId={activeConversation?._id}
              contextName={activeChannel?.name ?? activeConversation?.otherUser?.username ?? "DM"}
              onClose={() => {
                setActiveThreadId(null);
                if (mobileView === "thread") setMobileView("chat");
              }}
            />
          ) : showPinnedMessages && (activeChannel || activeConversation) ? (
            <PinnedMessages
              channelId={activeChannel?._id}
              conversationId={activeConversation?._id}
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
              onNavigateToChannel={handleSelectChannel}
              onNavigateToConversation={handleSelectConversation}
            />
          ) : showBookmarks ? (
            <BookmarkedMessages
              onClose={() => {
                setShowBookmarks(false);
                if (mobileView === "bookmarks") setMobileView("chat");
              }}
              onNavigateToChannel={handleSelectChannel}
              onNavigateToConversation={handleSelectConversation}
            />
          ) : showMembers && activeChannel?.isPrivate && activeChannel?.isAdmin ? (
            <ChannelMemberManagement
              channelId={activeChannel._id}
              channelName={activeChannel.name}
              onClose={() => {
                setShowMembers(false);
                if (mobileView === "members") setMobileView("chat");
              }}
            />
          ) : (
            <OnlineUsers
              channelId={activeChannel?._id}
              channelName={activeChannel?.name}
              isPrivate={activeChannel?.isPrivate}
              onStartDM={handleSelectConversation}
            />
          )}
        </div>
      </div>

      {/* Search Palette Modal (Cmd+K) */}
      <SearchPalette
        open={showSearchPalette}
        onClose={() => setShowSearchPalette(false)}
        channels={channels ?? []}
        conversations={conversations ?? []}
        onSelectChannel={(channelId) => {
          handleSelectChannel(channelId);
          setShowSearchPalette(false);
        }}
        onSelectConversation={(conversationId) => {
          handleSelectConversation(conversationId);
          setShowSearchPalette(false);
        }}
      />
    </div>
  );
}
