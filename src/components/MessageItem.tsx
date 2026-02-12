"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmojiPicker } from "@/components/EmojiPicker";
import { MessageText } from "@/components/MessageText";
import { PollMessage } from "@/components/PollMessage";
import { LinkPreview } from "@/components/LinkPreview";
import { MessageAttachments } from "@/components/MessageAttachments";
import { Avatar } from "@/components/Avatar";

interface MessageItemProps {
  message: {
    _id: Id<"messages">;
    text: string;
    _creationTime: number;
    editedAt?: number;
    replyCount?: number;
    latestReplyTime?: number;
    parentMessageId?: Id<"messages">;
    type?: "action" | "poll" | "system";
    replyTo?: {
      messageId: string;
      username: string;
      text: string;
    };
    user: {
      _id: Id<"users">;
      username: string;
      avatarColor: string;
      avatarUrl?: string | null;
      statusEmoji?: string;
      statusText?: string;
      isBot?: boolean;
    };
    reactions: Array<{
      emoji: string;
      count: number;
      userIds: string[];
      usernames: string[];
    }>;
    attachments?: Array<{
      storageId: string;
      filename: string;
      contentType: string;
      size: number;
      url: string | null;
    }>;
  };
  isGrouped: boolean;
  currentUserId: Id<"users"> | undefined;
  onReplyInThread?: (messageId: Id<"messages">) => void;
  onReply?: (message: { _id: Id<"messages">; text: string; user: { username: string } }) => void;
  onScrollToMessage?: (messageId: string) => void;
  isPinned?: boolean;
  isBookmarked?: boolean;
  linkPreviews?: Array<{
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    domain: string;
  }>;
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

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "…";
}

function ReactionBar({
  reactions,
  currentUserId,
  messageId,
}: {
  reactions: MessageItemProps["message"]["reactions"];
  currentUserId: Id<"users"> | undefined;
  messageId: Id<"messages">;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const toggleReaction = useMutation(api.reactions.toggleReaction);

  if (reactions.length === 0 && !showPicker) return null;

  function handleToggle(emoji: string) {
    if (!currentUserId) return;
    toggleReaction({ messageId, userId: currentUserId, emoji });
  }

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {reactions.map((r) => {
        const currentUserReacted = currentUserId
          ? r.userIds.includes(currentUserId)
          : false;
        return (
          <button
            key={r.emoji}
            type="button"
            title={r.usernames.join(", ")}
            className={`inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors ${
              currentUserReacted
                ? "border-accent/50 bg-accent-soft text-accent hover:bg-accent-soft"
                : "border-border bg-overlay text-text-secondary hover:bg-active"
            }`}
            onClick={() => handleToggle(r.emoji)}
          >
            <span>{r.emoji}</span>
            <span>{r.count}</span>
          </button>
        );
      })}
      <div className="relative">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center rounded-full border border-border bg-overlay px-2 py-0.5 text-xs text-text-muted hover:bg-active hover:text-text-secondary"
          onClick={() => setShowPicker((v) => !v)}
        >
          +
        </button>
        {showPicker && (
          <EmojiPicker
            onSelect={handleToggle}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>
    </div>
  );
}

export function MessageItem({ message, isGrouped, currentUserId, onReplyInThread, onReply, onScrollToMessage, isPinned, isBookmarked, linkPreviews }: MessageItemProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const toggleReaction = useMutation(api.reactions.toggleReaction);
  const editMessage = useMutation(api.messages.editMessage);
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const pinMessage = useMutation(api.pins.pinMessage);
  const unpinMessage = useMutation(api.pins.unpinMessage);
  const toggleBookmark = useMutation(api.bookmarks.toggleBookmark);

  const isOwnMessage = currentUserId === message.user._id;

  function handleSelectEmoji(emoji: string) {
    if (!currentUserId) return;
    toggleReaction({ messageId: message._id, userId: currentUserId, emoji });
  }

  async function handleEditSave() {
    const trimmed = editText.trim();
    if (!trimmed || !currentUserId) return;
    await editMessage({ messageId: message._id, userId: currentUserId, text: trimmed });
    setIsEditing(false);
  }

  function handleEditCancel() {
    setEditText(message.text);
    setIsEditing(false);
  }

  function handleDelete() {
    if (!currentUserId) return;
    if (window.confirm("Delete this message? This cannot be undone.")) {
      deleteMessage({ messageId: message._id, userId: currentUserId });
    }
  }

  function handleTogglePin() {
    if (!currentUserId) return;
    if (isPinned) {
      unpinMessage({ messageId: message._id, userId: currentUserId });
    } else {
      pinMessage({ messageId: message._id, userId: currentUserId });
    }
  }

  function handleToggleBookmark() {
    if (!currentUserId) return;
    toggleBookmark({ userId: currentUserId, messageId: message._id });
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEditSave();
    }
    if (e.key === "Escape") {
      handleEditCancel();
    }
  }

  // Long-press detection for mobile
  const LONG_PRESS_DURATION = 500; // ms
  const MOVE_THRESHOLD = 10; // px - cancel if finger moves too far

  function handleTouchStart(e: React.TouchEvent) {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };

    longPressTimerRef.current = setTimeout(() => {
      setShowMobileActions(true);
    }, LONG_PRESS_DURATION);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!touchStartRef.current || !longPressTimerRef.current) return;

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartRef.current.y);

    // Cancel if finger moved too far (user is scrolling)
    if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }

  function handleTouchEnd() {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartRef.current = null;
  }

  function closeMobileActions() {
    setShowMobileActions(false);
  }

  // Close mobile actions when clicking outside
  useEffect(() => {
    if (!showMobileActions) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (messageContainerRef.current && !messageContainerRef.current.contains(e.target as Node)) {
        setShowMobileActions(false);
      }
    }

    // Small delay to prevent immediate close from the same touch event
    const timeoutId = setTimeout(() => {
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("mousedown", handleClickOutside);
    }, 10);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMobileActions]);

  const hoverToolbar = (
    <div
      className={`absolute -top-3 right-2 z-10 flex gap-0.5 transition-opacity ${
        showMobileActions ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      }`}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="flex rounded-md border border-border bg-overlay shadow-lg">
        {/* Emoji reaction button */}
        <div className="relative">
          <button
            type="button"
            className="rounded-l-md px-1.5 py-0.5 text-sm hover:bg-active"
            onClick={() => setShowPicker((v) => !v)}
          >
            😀
          </button>
          {showPicker && (
            <EmojiPicker
              onSelect={(emoji) => { handleSelectEmoji(emoji); setShowPicker(false); closeMobileActions(); }}
              onClose={() => { setShowPicker(false); closeMobileActions(); }}
            />
          )}
        </div>
        {/* Reply button - for inline replies */}
        {!message.parentMessageId && onReply && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-text-muted hover:bg-active hover:text-text"
            onClick={() => { onReply(message); closeMobileActions(); }}
            title="Reply"
          >
            ↩
          </button>
        )}
        {/* Reply in thread button - only for top-level messages */}
        {!message.parentMessageId && onReplyInThread && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-text-muted hover:bg-active hover:text-text"
            onClick={() => { onReplyInThread(message._id); closeMobileActions(); }}
            title="Reply in thread"
          >
            💬
          </button>
        )}
        {/* Pin/Unpin button - only for top-level messages */}
        {!message.parentMessageId && (
          <button
            type="button"
            className={`px-1.5 py-0.5 text-sm hover:bg-active ${
              isPinned ? "text-warning" : "text-text-muted hover:text-text"
            }`}
            onClick={() => { handleTogglePin(); closeMobileActions(); }}
            title={isPinned ? "Unpin message" : "Pin message"}
          >
            📌
          </button>
        )}
        {/* Bookmark button */}
        <button
          type="button"
          className={`px-1.5 py-0.5 text-sm hover:bg-active ${
            isBookmarked ? "text-accent" : "text-text-muted hover:text-text"
          }`}
          onClick={() => { handleToggleBookmark(); closeMobileActions(); }}
          title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
        >
          🔖
        </button>
        {/* Edit button - only for own messages */}
        {isOwnMessage && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-text-muted hover:bg-active hover:text-text"
            onClick={() => { setIsEditing(true); closeMobileActions(); }}
            title="Edit message"
          >
            ✏️
          </button>
        )}
        {/* Delete button - only for own messages */}
        {isOwnMessage && (
          <button
            type="button"
            className="rounded-r-md px-1.5 py-0.5 text-sm text-text-muted hover:bg-danger/20 hover:text-danger"
            onClick={() => { handleDelete(); closeMobileActions(); }}
            title="Delete message"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );

  const messageContent = isEditing ? (
    <div className="mt-1">
      <textarea
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleEditKeyDown}
        className="w-full resize-none rounded border border-border-strong bg-overlay px-2 py-1 text-sm text-text outline-none focus:border-accent"
        maxLength={4000}
        rows={1}
        autoFocus
        ref={(el) => {
          if (el) {
            el.style.height = "auto";
            el.style.height = Math.min(el.scrollHeight, 120) + "px";
          }
        }}
      />
      <div className="mt-1 flex gap-2 text-xs">
        <span className="text-text-muted">
          escape to <button type="button" className="text-accent hover:underline" onClick={handleEditCancel}>cancel</button>
          {" · "}enter to <button type="button" className="text-accent hover:underline" onClick={handleEditSave}>save</button>
        </span>
      </div>
    </div>
  ) : (
    <div className="text-sm text-text-secondary [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <MessageText text={message.text} />
      {message.editedAt && (
        <span className="ml-1 inline text-xs text-text-muted">(edited)</span>
      )}
    </div>
  );

  const attachmentCards = message.attachments && message.attachments.length > 0 && (
    <MessageAttachments attachments={message.attachments} />
  );

  const linkPreviewCards = linkPreviews && linkPreviews.length > 0 && (
    <div>
      {linkPreviews.filter((p) => p.title || p.description).map((preview) => (
        <LinkPreview key={preview.url} preview={preview} />
      ))}
    </div>
  );

  const threadIndicator = message.replyCount && message.replyCount > 0 && (
    <button
      type="button"
      className="mt-1 flex items-center gap-1 text-xs text-accent hover:text-accent-hover hover:underline"
      onClick={() => onReplyInThread?.(message._id)}
    >
      <span>💬</span>
      <span>
        {message.replyCount} {message.replyCount === 1 ? "reply" : "replies"}
      </span>
    </button>
  );

  const pinIndicator = isPinned && (
    <div className="text-xs text-warning/80">📌 Pinned</div>
  );

  const bookmarkIndicator = isBookmarked && (
    <div className="text-xs text-accent/80">🔖 Saved</div>
  );

  const replyReference = message.replyTo && (
    <button
      type="button"
      className="mb-1 flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
      onClick={() => onScrollToMessage?.(message.replyTo!.messageId)}
    >
      <span className="text-text-faint">↩</span>
      <span className="font-medium text-text-muted">@{message.replyTo.username}</span>
      <span className="truncate text-text-muted">{truncateText(message.replyTo.text, 50)}</span>
    </button>
  );

  // Action messages: * username does something *
  if (message.type === "action") {
    return (
      <div
        ref={messageContainerRef}
        className="group relative rounded py-0.5 pl-4 pr-2 hover:bg-hover"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {hoverToolbar}
        <div className="text-sm italic text-text-muted">
          <span className="font-medium text-text-secondary">{message.user.username}</span>
          {message.user.isBot && (
            <span className="ml-1 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-semibold uppercase text-accent">
              BOT
            </span>
          )}{" "}
          <MessageText text={message.text} />
        </div>
        {attachmentCards}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    );
  }

  // Poll messages
  if (message.type === "poll") {
    return (
      <div
        ref={messageContainerRef}
        className="group relative mt-3 flex gap-3 rounded py-1 pr-2 first:mt-0 hover:bg-hover"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {hoverToolbar}
        <Avatar
          username={message.user.username}
          avatarColor={message.user.avatarColor}
          avatarUrl={message.user.avatarUrl}
          size="lg"
          className="mt-0.5 h-10 w-10 shrink-0 text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-bold text-text">{message.user.username}</span>
            {message.user.isBot && (
              <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] font-semibold uppercase text-accent">
                BOT
              </span>
            )}
            {message.user.statusEmoji && (
              <span className="text-sm" title={message.user.statusText || undefined}>
                {message.user.statusEmoji}
              </span>
            )}
            <span className="text-xs text-text-muted">{formatTimestamp(message._creationTime)}</span>
          </div>
          <PollMessage messageId={message._id} currentUserId={currentUserId} />
          <ReactionBar
            reactions={message.reactions}
            currentUserId={currentUserId}
            messageId={message._id}
          />
        </div>
      </div>
    );
  }

  if (isGrouped) {
    return (
      <div
        ref={messageContainerRef}
        className="group relative -mt-1 rounded py-0.5 pl-[52px] pr-2 hover:bg-hover"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {!isEditing && hoverToolbar}
        {pinIndicator}
        {bookmarkIndicator}
        {replyReference}
        {messageContent}
        {attachmentCards}
        {linkPreviewCards}
        {threadIndicator}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    );
  }

  return (
    <div
      ref={messageContainerRef}
      className="group relative mt-3 flex gap-3 rounded py-1 pr-2 first:mt-0 hover:bg-hover"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {!isEditing && hoverToolbar}
      <Avatar
        username={message.user.username}
        avatarColor={message.user.avatarColor}
        avatarUrl={message.user.avatarUrl}
        size="lg"
        className="mt-0.5 h-10 w-10 shrink-0 text-sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-text">{message.user.username}</span>
          {message.user.isBot && (
            <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] font-semibold uppercase text-accent">
              BOT
            </span>
          )}
          {message.user.statusEmoji && (
            <span className="text-sm" title={message.user.statusText || undefined}>
              {message.user.statusEmoji}
            </span>
          )}
          <span className="text-xs text-text-muted">{formatTimestamp(message._creationTime)}</span>
        </div>
        {pinIndicator}
        {bookmarkIndicator}
        {replyReference}
        {messageContent}
        {attachmentCards}
        {linkPreviewCards}
        {threadIndicator}
        <ReactionBar
          reactions={message.reactions}
          currentUserId={currentUserId}
          messageId={message._id}
        />
      </div>
    </div>
  );
}
