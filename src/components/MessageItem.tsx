"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { EmojiPicker, EMOJI_LIST } from "@/components/EmojiPicker";
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
  const [mobileEmojiMode, setMobileEmojiMode] = useState(false);
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
    setMobileEmojiMode(false);
  }

  // Lock body scroll when mobile action sheet is open
  useEffect(() => {
    if (!showMobileActions) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [showMobileActions]);

  // Desktop-only hover toolbar
  const hoverToolbar = (
    <div
      className="absolute -top-3 right-2 z-10 hidden gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 md:flex"
      onClick={(e) => e.stopPropagation()}
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
              onSelect={(emoji) => { handleSelectEmoji(emoji); setShowPicker(false); }}
              onClose={() => setShowPicker(false)}
            />
          )}
        </div>
        {/* Reply button - for inline replies */}
        {!message.parentMessageId && onReply && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-text-muted hover:bg-active hover:text-text"
            onClick={() => onReply(message)}
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
            onClick={() => onReplyInThread(message._id)}
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
            onClick={handleTogglePin}
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
          onClick={handleToggleBookmark}
          title={isBookmarked ? "Remove bookmark" : "Bookmark message"}
        >
          🔖
        </button>
        {/* Edit button - only for own messages */}
        {isOwnMessage && (
          <button
            type="button"
            className="px-1.5 py-0.5 text-sm text-text-muted hover:bg-active hover:text-text"
            onClick={() => setIsEditing(true)}
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
            onClick={handleDelete}
            title="Delete message"
          >
            🗑️
          </button>
        )}
      </div>
    </div>
  );

  // Mobile fullscreen context menu (rendered via portal)
  const mobileActionSheet = showMobileActions && typeof document !== "undefined" && createPortal(
    <div
      className="fixed inset-0 z-50 flex flex-col md:hidden"
      style={{
        animation: "contextMenuFadeIn 0.2s ease-out",
      }}
    >
      {/* Blurred backdrop - tappable to dismiss */}
      <div 
        className="absolute inset-0 bg-black/60"
        style={{ backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={(e) => { e.stopPropagation(); closeMobileActions(); }}
        onTouchStart={(e) => e.stopPropagation()}
      />

      {/* Close button in top right */}
      <button
        type="button"
        className="absolute z-10 flex h-8 w-8 items-center justify-center rounded-full bg-overlay/80 text-text-muted active:bg-active"
        style={{ 
          top: "calc(1.5rem + env(safe-area-inset-top))",
          right: "2rem",
        }}
        onClick={(e) => { e.stopPropagation(); closeMobileActions(); }}
      >
        ✕
      </button>

      {/* Scrollable content container */}
      <div 
        className="relative flex flex-1 flex-col overflow-y-auto overscroll-contain"
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        style={{
          paddingTop: "max(1rem, env(safe-area-inset-top))",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {/* Message preview at top */}
        <div 
          className="shrink-0 rounded-xl bg-elevated p-3 shadow-lg"
          style={{
            marginLeft: "1.5rem",
            marginRight: "1.5rem",
            animation: "contextMenuScaleIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >
          <div className="flex gap-3">
            <Avatar
              username={message.user.username}
              avatarColor={message.user.avatarColor}
              avatarUrl={message.user.avatarUrl}
              size="lg"
              className="h-10 w-10 shrink-0 text-sm"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-text">{message.user.username}</span>
                {message.user.isBot && (
                  <span className="rounded bg-accent-soft px-1 py-0.5 text-[10px] font-semibold uppercase text-accent">
                    BOT
                  </span>
                )}
                <span className="text-xs text-text-muted">{formatTimestamp(message._creationTime)}</span>
              </div>
              <div className="mt-0.5 text-sm text-text-secondary overflow-hidden break-words [overflow-wrap:anywhere]">
                <MessageText text={message.text} />
              </div>
            </div>
          </div>
        </div>

        {/* Context menu */}
        <div 
          className="shrink-0 rounded-xl bg-elevated shadow-lg overflow-hidden"
          style={{
            marginLeft: "1.5rem",
            marginRight: "1.5rem",
            marginTop: "0.75rem",
            animation: "contextMenuSlideUp 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
            animationDelay: "0.05s",
            animationFillMode: "backwards",
          }}
        >
          {mobileEmojiMode ? (
            /* Emoji picker view */
            <div className="p-3">
              <div className="mb-3 flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-lg p-1.5 text-sm text-text-muted active:bg-active"
                  onClick={() => setMobileEmojiMode(false)}
                >
                  ← Back
                </button>
                <span className="text-sm font-medium text-text">Add reaction</span>
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {EMOJI_LIST.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-lg p-2.5 text-2xl active:bg-active"
                    onClick={() => { handleSelectEmoji(emoji); closeMobileActions(); }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Action list view */
            <div>
              {/* Quick reactions row */}
              <div className="flex justify-around border-b border-border px-2 py-3">
                {["👍", "❤️", "😂", "😮", "😢", "🎉"].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-full p-2 text-2xl active:scale-110 active:bg-active transition-transform"
                    onClick={() => { handleSelectEmoji(emoji); closeMobileActions(); }}
                  >
                    {emoji}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-full p-2 text-xl text-text-muted active:scale-110 active:bg-active transition-transform"
                  onClick={() => setMobileEmojiMode(true)}
                >
                  +
                </button>
              </div>

              {/* Action buttons */}
              <div className="py-1">
                {/* Reply */}
                {!message.parentMessageId && onReply && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                    onClick={() => { onReply(message); closeMobileActions(); }}
                  >
                    <span className="w-6 text-center text-lg">↩️</span>
                    <span className="text-[15px] text-text">Reply</span>
                  </button>
                )}

                {/* Reply in thread */}
                {!message.parentMessageId && onReplyInThread && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                    onClick={() => { onReplyInThread(message._id); closeMobileActions(); }}
                  >
                    <span className="w-6 text-center text-lg">💬</span>
                    <span className="text-[15px] text-text">Reply in thread</span>
                  </button>
                )}

                {/* Copy text */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                  onClick={() => { navigator.clipboard.writeText(message.text); closeMobileActions(); }}
                >
                  <span className="w-6 text-center text-lg">📋</span>
                  <span className="text-[15px] text-text">Copy text</span>
                </button>

                {/* Pin/Unpin */}
                {!message.parentMessageId && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                    onClick={() => { handleTogglePin(); closeMobileActions(); }}
                  >
                    <span className="w-6 text-center text-lg">📌</span>
                    <span className="text-[15px] text-text">{isPinned ? "Unpin message" : "Pin message"}</span>
                  </button>
                )}

                {/* Bookmark */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                  onClick={() => { handleToggleBookmark(); closeMobileActions(); }}
                >
                  <span className="w-6 text-center text-lg">🔖</span>
                  <span className="text-[15px] text-text">{isBookmarked ? "Remove bookmark" : "Bookmark"}</span>
                </button>

                {/* Edit - only for own messages */}
                {isOwnMessage && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                    onClick={() => { setIsEditing(true); closeMobileActions(); }}
                  >
                    <span className="w-6 text-center text-lg">✏️</span>
                    <span className="text-[15px] text-text">Edit message</span>
                  </button>
                )}

                {/* Delete - only for own messages */}
                {isOwnMessage && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-active"
                    onClick={() => { handleDelete(); closeMobileActions(); }}
                  >
                    <span className="w-6 text-center text-lg">🗑️</span>
                    <span className="text-[15px] text-danger">Delete message</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spacer that's tappable to dismiss */}
        <div 
          className="min-h-[60px] flex-1"
          onClick={(e) => { e.stopPropagation(); closeMobileActions(); }}
        />
      </div>
    </div>,
    document.body,
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
    <div className="text-sm text-text-secondary overflow-hidden break-words [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
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
      className="mb-1 flex min-w-0 max-w-full items-center gap-1 overflow-hidden text-xs text-text-muted hover:text-text-secondary"
      onClick={() => onScrollToMessage?.(message.replyTo!.messageId)}
    >
      <span className="shrink-0 text-text-faint">↩</span>
      <span className="shrink-0 font-medium text-text-muted">@{message.replyTo.username}</span>
      <span className="truncate text-text-muted">{truncateText(message.replyTo.text, 50)}</span>
    </button>
  );

  // Shared inline styles for touch behavior - prevent text selection on long-press
  const touchStyles: React.CSSProperties = {
    WebkitTouchCallout: "none",
    WebkitTapHighlightColor: "transparent",
    WebkitUserSelect: "none",
    userSelect: "none",
  };

  // Action messages: * username does something *
  if (message.type === "action") {
    return (
      <div
        ref={messageContainerRef}
        className="group relative select-none overflow-hidden rounded py-0.5 pl-4 pr-2 hover:bg-hover md:overflow-visible md:select-auto"
        style={touchStyles}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {hoverToolbar}
        {mobileActionSheet}
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
        className="group relative mt-3 flex select-none gap-3 overflow-hidden rounded py-1 pr-2 first:mt-0 hover:bg-hover md:overflow-visible md:select-auto"
        style={touchStyles}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {hoverToolbar}
        {mobileActionSheet}
        <Avatar
          username={message.user.username}
          avatarColor={message.user.avatarColor}
          avatarUrl={message.user.avatarUrl}
          size="lg"
          className="mt-0.5 h-10 w-10 shrink-0 text-sm"
        />
        <div className="min-w-0 flex-1 overflow-hidden">
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
        className="group relative -mt-1 select-none overflow-hidden rounded py-0.5 pl-[52px] pr-2 hover:bg-hover md:overflow-visible md:select-auto"
        style={touchStyles}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {!isEditing && hoverToolbar}
        {mobileActionSheet}
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
      className="group relative mt-3 flex select-none gap-3 overflow-hidden rounded py-1 pr-2 first:mt-0 hover:bg-hover md:overflow-visible md:select-auto"
      style={touchStyles}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
      {!isEditing && hoverToolbar}
      {mobileActionSheet}
      <Avatar
        username={message.user.username}
        avatarColor={message.user.avatarColor}
        avatarUrl={message.user.avatarUrl}
        size="lg"
        className="mt-0.5 h-10 w-10 shrink-0 text-sm"
      />
      <div className="min-w-0 flex-1 overflow-hidden">
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
