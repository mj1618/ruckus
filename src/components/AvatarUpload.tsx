"use client";

import { useState, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Avatar } from "@/components/Avatar";

interface AvatarUploadProps {
  userId: Id<"users">;
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
  onClose: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export function AvatarUpload({ userId, username, avatarColor, avatarUrl, onClose }: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateAvatar = useMutation(api.users.updateAvatar);
  const removeAvatar = useMutation(api.users.removeAvatar);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setError(null);
    
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please select a JPG, PNG, GIF, or WebP image");
      return;
    }
    
    if (file.size > MAX_FILE_SIZE) {
      setError("Image must be less than 5MB");
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    setError(null);
    
    try {
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      
      if (!res.ok) throw new Error("Upload failed");
      
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      await updateAvatar({ userId, storageId });
      onClose();
    } catch {
      setError("Failed to upload image. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    setIsUploading(true);
    setError(null);
    try {
      await removeAvatar({ userId });
      onClose();
    } catch {
      setError("Failed to remove avatar");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancel = () => {
    setPreviewUrl(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={handleCancel} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[60] w-72 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Profile Picture</h3>
          <button
            type="button"
            onClick={handleCancel}
            className="text-text-muted hover:text-text"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4 flex justify-center">
          <Avatar
            username={username}
            avatarColor={avatarColor}
            avatarUrl={previewUrl ?? avatarUrl}
            size="lg"
            className="h-20 w-20 text-2xl"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleFileSelect}
        />

        {error && (
          <p className="mb-2 text-xs text-danger">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          {previewUrl ? (
            <>
              <button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {isUploading ? "Uploading..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isUploading}
                className="w-full rounded border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-hover disabled:opacity-50"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                Upload Image
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isUploading}
                  className="w-full rounded border border-danger/50 px-3 py-1.5 text-sm text-danger transition-colors hover:bg-danger/10 disabled:opacity-50"
                >
                  {isUploading ? "Removing..." : "Remove Picture"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
