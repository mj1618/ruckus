"use client";

import { useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { MentionAutocomplete } from "@/components/MentionAutocomplete";
import { SlashCommandHint, SLASH_COMMANDS } from "@/components/SlashCommandHint";
import { GifPicker } from "@/components/GifPicker";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf", "text/plain", "text/markdown",
  "application/zip",
]);

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFiles(files: File[], existingCount: number): { valid: File[]; errors: string[] } {
  const errors: string[] = [];
  const valid: File[] = [];
  const remaining = MAX_FILES - existingCount;

  for (const file of files) {
    if (valid.length >= remaining) {
      errors.push(`Maximum ${MAX_FILES} files per message`);
      break;
    }
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name} exceeds 10MB limit`);
      continue;
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name}: unsupported file type`);
      continue;
    }
    valid.push(file);
  }
  return { valid, errors };
}

interface ReplyToMessage {
  _id: Id<"messages">;
  text: string;
  user: {
    username: string;
  };
}

interface MessageInputProps {
  channelId?: Id<"channels">;
  channelName?: string;
  conversationId?: Id<"conversations">;
  conversationName?: string;
  parentMessageId?: Id<"messages">;
  replyToMessage?: ReplyToMessage;
  onCancelReply?: () => void;
  placeholder?: string;
  droppedFiles?: File[];
  onDroppedFilesHandled?: () => void;
}

export function MessageInput({ channelId, channelName, conversationId, conversationName, parentMessageId, replyToMessage, onCancelReply, placeholder, droppedFiles, onDroppedFilesHandled }: MessageInputProps) {
  const contextName = channelName ?? conversationName ?? "Unknown";
  const { user } = useUser();
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastTypingRef = useRef(0);

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendMessage = useMutation(api.messages.sendMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const createPoll = useMutation(api.polls.createPoll);
  const changeUsername = useMutation(api.users.changeUsername);
  const setUserStatus = useMutation(api.users.setStatus);
  const clearUserStatus = useMutation(api.users.clearStatus);
  const setTyping = useMutation(api.typing.setTyping);
  const clearTyping = useMutation(api.typing.clearTyping);
  const searchGifsAction = useAction(api.giphy.searchGifs);

  const onlineUsers = useQuery(api.users.getOnlineUsers);
  const [showGifPicker, setShowGifPicker] = useState(false);

  // Handle files dropped from parent (drag-and-drop zone)
  useEffect(() => {
    if (droppedFiles && droppedFiles.length > 0) {
      addFiles(droppedFiles);
      onDroppedFilesHandled?.();
    }
  }, [droppedFiles]);

  const [slashState, setSlashState] = useState<{
    active: boolean;
    query: string;
    selectedIndex: number;
  } | null>(null);

  const [mentionState, setMentionState] = useState<{
    active: boolean;
    query: string;
    startPos: number;
    selectedIndex: number;
  } | null>(null);

  function detectMention(text: string, cursorPos: number) {
    const textBeforeCursor = text.slice(0, cursorPos);
    const atIndex = textBeforeCursor.lastIndexOf("@");

    if (atIndex === -1) {
      setMentionState(null);
      return;
    }

    if (atIndex > 0 && !/\s/.test(text[atIndex - 1])) {
      setMentionState(null);
      return;
    }

    const query = textBeforeCursor.slice(atIndex + 1);

    if (query.includes(" ") || query.includes("\n")) {
      setMentionState(null);
      return;
    }

    setMentionState({
      active: true,
      query,
      startPos: atIndex,
      selectedIndex: 0,
    });
  }

  function handleMentionSelect(username: string) {
    if (!mentionState) return;
    const before = text.slice(0, mentionState.startPos);
    const after = text.slice(mentionState.startPos + 1 + mentionState.query.length);
    const newText = before + "@" + username + " " + after;
    setText(newText);
    setMentionState(null);

    const textarea = textareaRef.current;
    if (textarea) {
      textarea.focus();
      const newCursorPos = mentionState.startPos + username.length + 2;
      requestAnimationFrame(() => {
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      });
    }
  }

  function addFiles(files: File[]) {
    setFileError(null);
    const { valid, errors } = validateFiles(files, pendingFiles.length);
    if (errors.length > 0) {
      setFileError(errors[0]);
    }
    if (valid.length > 0) {
      setPendingFiles((prev) => [...prev, ...valid]);
    }
  }

  function removeFile(index: number) {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setFileError(null);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      addFiles(imageFiles);
    }
  }

  async function uploadFiles(files: File[]) {
    return Promise.all(
      files.map(async (file) => {
        const uploadUrl = await generateUploadUrl();
        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
        return {
          storageId,
          filename: file.name,
          contentType: file.type,
          size: file.size,
        };
      })
    );
  }

  const handleSend = async () => {
    const trimmed = text.trim();
    const hasFiles = pendingFiles.length > 0;
    if ((!trimmed && !hasFiles) || !user || isSending) return;

    setIsSending(true);
    setIsUploading(hasFiles);
    setText("");
    setMentionState(null);
    setSlashState(null);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);
    setFileError(null);
    // Build context for messages
    const messageContext = channelId ? { channelId } : conversationId ? { conversationId } : null;
    if (!messageContext) {
      throw new Error("No channel or conversation context");
    }

    try {
      // Handle /poll command (only in channels)
      if (trimmed.toLowerCase().startsWith("/poll ")) {
        if (!channelId) {
          throw new Error("Polls are only available in channels");
        }
        const rest = trimmed.slice(6);
        const parts = rest.split("|").map((s) => s.trim()).filter(Boolean);
        if (parts.length < 3) {
          throw new Error("Format: /poll Question | Option 1 | Option 2");
        }
        const [question, ...options] = parts;
        await createPoll({
          channelId,
          userId: user._id,
          question,
          options,
        });
      } else if (trimmed.toLowerCase().startsWith("/nick ")) {
        const newName = trimmed.slice(6).trim();
        if (!newName) throw new Error("/nick requires a username");
        await changeUsername({ userId: user._id, newUsername: newName });
      } else if (trimmed.toLowerCase() === "/status" || trimmed.toLowerCase().startsWith("/status ")) {
        const statusStr = trimmed.slice(7).trim();
        if (!statusStr) {
          await clearUserStatus({ userId: user._id });
        } else {
          const parts = statusStr.split(/\s+/);
          const firstPart = parts[0];
          const isEmoji = firstPart && firstPart.length <= 4 && /[^\x00-\x7F]/.test(firstPart);
          if (isEmoji) {
            await setUserStatus({
              userId: user._id,
              statusEmoji: firstPart,
              statusText: parts.slice(1).join(" ") || undefined,
            });
          } else {
            await setUserStatus({
              userId: user._id,
              statusText: statusStr,
            });
          }
        }
        // Send action message about status change
        await sendMessage({
          ...messageContext,
          userId: user._id,
          text: statusStr
            ? `/me set their status to ${statusStr}`
            : "/me cleared their status",
          ...(parentMessageId ? { parentMessageId } : {}),
        });
      } else if (trimmed.toLowerCase().startsWith("/giphy ")) {
        const giphyQuery = trimmed.slice(7).trim();
        if (!giphyQuery) throw new Error("/giphy requires a search term");
        const results = await searchGifsAction({ query: giphyQuery, limit: 8 });
        if (results.length === 0) throw new Error("No GIFs found for: " + giphyQuery);
        const gif = results[Math.floor(Math.random() * results.length)];
        await sendMessage({
          ...messageContext,
          userId: user._id,
          text: `![GIF](${gif.url})`,
          ...(parentMessageId ? { parentMessageId } : {}),
        });
      } else {
        // Upload files if any
        let attachments: Awaited<ReturnType<typeof uploadFiles>> | undefined;
        if (filesToUpload.length > 0) {
          attachments = await uploadFiles(filesToUpload);
          setIsUploading(false);
        }
        // /me and /shrug are handled server-side; everything else is a normal message
        await sendMessage({
          ...messageContext,
          userId: user._id,
          text: trimmed || " ",
          ...(parentMessageId ? { parentMessageId } : {}),
          ...(replyToMessage ? { replyToMessageId: replyToMessage._id } : {}),
          ...(attachments ? { attachments } : {}),
        });
      }
      // Clear reply after successful send
      onCancelReply?.();
    } catch {
      setText(trimmed);
    } finally {
      setIsSending(false);
      setIsUploading(false);
      textareaRef.current?.focus();
    }
  };

  async function handleGifSelect(gifUrl: string) {
    if (!user) return;
    const messageContext = channelId ? { channelId } : conversationId ? { conversationId } : null;
    if (!messageContext) return;
    setShowGifPicker(false);
    await sendMessage({
      ...messageContext,
      userId: user._id,
      text: `![GIF](${gifUrl})`,
      ...(parentMessageId ? { parentMessageId } : {}),
    });
  }

  function handleSlashSelect(command: string) {
    setText(command + " ");
    setSlashState(null);
    textareaRef.current?.focus();
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash command navigation
    if (slashState) {
      const filtered = SLASH_COMMANDS.filter((c) =>
        c.command.startsWith("/" + slashState.query.toLowerCase())
      );
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashState({
          ...slashState,
          selectedIndex: Math.min(slashState.selectedIndex + 1, filtered.length - 1),
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashState({
          ...slashState,
          selectedIndex: Math.max(slashState.selectedIndex - 1, 0),
        });
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleSlashSelect(filtered[slashState.selectedIndex].command);
        return;
      }
      if (e.key === "Tab" && filtered.length > 0) {
        e.preventDefault();
        handleSlashSelect(filtered[slashState.selectedIndex].command);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashState(null);
        return;
      }
    }

    if (mentionState) {
      const filtered = (onlineUsers ?? [])
        .filter((u) => u.username.toLowerCase().startsWith(mentionState.query.toLowerCase()))
        .sort((a, b) => a.username.localeCompare(b.username))
        .slice(0, 8);

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionState({
          ...mentionState,
          selectedIndex: Math.min(mentionState.selectedIndex + 1, filtered.length - 1),
        });
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionState({
          ...mentionState,
          selectedIndex: Math.max(mentionState.selectedIndex - 1, 0),
        });
        return;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleMentionSelect(filtered[mentionState.selectedIndex].username);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setMentionState(null);
        return;
      }
      if (e.key === "Tab" && filtered.length > 0) {
        e.preventDefault();
        handleMentionSelect(filtered[mentionState.selectedIndex].username);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    // Auto-resize textarea
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }

    // Slash command detection
    if (value.startsWith("/") && !value.includes("\n")) {
      const query = value.slice(1).split(" ")[0];
      // Only show hint when user is still typing the command (no space yet)
      if (!value.includes(" ")) {
        setSlashState({ active: true, query, selectedIndex: 0 });
      } else {
        setSlashState(null);
      }
    } else {
      setSlashState(null);
    }

    // Mention detection
    const cursorPos = e.target.selectionStart;
    detectMention(value, cursorPos);

    // Debounced typing indicator
    if (user && value.trim()) {
      const now = Date.now();
      if (now - lastTypingRef.current > 2000) {
        lastTypingRef.current = now;
        if (channelId) {
          setTyping({ channelId, userId: user._id });
        } else if (conversationId) {
          setTyping({ conversationId, userId: user._id });
        }
      }
    } else if (user && !value.trim()) {
      if (channelId) {
        clearTyping({ channelId, userId: user._id });
      } else if (conversationId) {
        clearTyping({ conversationId, userId: user._id });
      }
    }
  };

  const showCharCount = text.length > 3800;

  return (
    <div className="relative">
      {slashState && (
        <SlashCommandHint
          query={slashState.query}
          selectedIndex={slashState.selectedIndex}
          onSelect={handleSlashSelect}
        />
      )}
      {mentionState && onlineUsers && (
        <MentionAutocomplete
          query={mentionState.query}
          users={onlineUsers}
          selectedIndex={mentionState.selectedIndex}
          onSelect={handleMentionSelect}
          position={{ bottom: 48, left: 0 }}
        />
      )}
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded-lg border border-border bg-overlay/50 p-2">
          {pendingFiles.map((file, i) => (
            <div key={i} className="group/file relative">
              {file.type.startsWith("image/") ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-16 w-16 rounded object-cover"
                />
              ) : (
                <div className="flex h-16 w-24 flex-col items-center justify-center rounded bg-active px-2">
                  <span className="truncate text-xs text-text-secondary">{file.name}</span>
                  <span className="text-xs text-text-muted">{formatFileSize(file.size)}</span>
                </div>
              )}
              <button
                type="button"
                className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] text-white opacity-0 transition-opacity group-hover/file:opacity-100"
                onClick={() => removeFile(i)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      {fileError && (
        <div className="mb-1 text-xs text-danger">{fileError}</div>
      )}
      {isUploading && (
        <div className="mb-1 text-xs text-accent">Uploading files...</div>
      )}
      {/* Reply preview bar */}
      {replyToMessage && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-border bg-overlay/50 px-3 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-text-muted">↩</span>
            <span className="text-sm text-text-muted">Replying to</span>
            <span className="text-sm font-medium text-text-secondary">@{replyToMessage.user.username}</span>
            <span className="truncate text-sm text-text-muted">
              {replyToMessage.text.length > 50 
                ? replyToMessage.text.slice(0, 50) + "…" 
                : replyToMessage.text}
            </span>
          </div>
          <button
            type="button"
            className="ml-2 rounded p-1 text-text-muted hover:bg-active hover:text-text-secondary"
            onClick={onCancelReply}
            title="Cancel reply"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,text/plain,text/markdown,application/zip"
        className="hidden"
        onChange={handleFileInputChange}
      />
      <div className="flex items-end gap-2 rounded-lg border border-border bg-overlay px-3 py-2">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder ?? (channelName ? `Message #${channelName}` : `Message ${conversationName}`)}
          maxLength={4000}
          rows={1}
          className="max-h-[120px] min-h-[24px] flex-1 resize-none bg-transparent text-sm text-text placeholder-text-muted outline-none"
        />
        <div className="flex items-center gap-2">
          {showCharCount && (
            <span className="text-xs text-text-muted">{text.length}/4000</span>
          )}
          <button
            type="button"
            className="rounded px-1.5 py-0.5 text-text-muted transition-colors hover:bg-active hover:text-text"
            onClick={() => fileInputRef.current?.click()}
            title="Attach files"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <div className="relative">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-xs font-bold text-text-muted transition-colors hover:bg-active hover:text-text"
              onClick={() => setShowGifPicker((v) => !v)}
              title="Send a GIF"
            >
              GIF
            </button>
            {showGifPicker && (
              <GifPicker
                onSelect={handleGifSelect}
                onClose={() => setShowGifPicker(false)}
              />
            )}
          </div>
          {(text.trim() || pendingFiles.length > 0) && (
            <button
              onClick={handleSend}
              disabled={isSending}
              className="rounded bg-accent px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
            >
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
