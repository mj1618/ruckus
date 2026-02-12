"use client";

import { useState } from "react";

interface LinkPreviewProps {
  preview: {
    url: string;
    title?: string;
    description?: string;
    imageUrl?: string;
    siteName?: string;
    domain: string;
  };
}

export function LinkPreview({ preview }: LinkPreviewProps) {
  const [imgError, setImgError] = useState(false);

  if (!preview.title && !preview.description) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex max-w-md gap-3 rounded-md border border-border bg-overlay/50 p-3 transition-colors hover:bg-overlay"
    >
      {preview.imageUrl && !imgError && (
        <img
          src={preview.imageUrl}
          alt=""
          className="h-20 w-20 shrink-0 rounded object-cover"
          onError={() => setImgError(true)}
        />
      )}
      <div className="min-w-0 flex-1">
        {preview.title && (
          <div className="line-clamp-1 text-sm font-semibold text-text">
            {preview.title}
          </div>
        )}
        {preview.description && (
          <div className="mt-0.5 line-clamp-2 text-xs text-text-muted">
            {preview.description}
          </div>
        )}
        <div className="mt-1 text-xs text-text-muted">{preview.domain}</div>
      </div>
    </a>
  );
}
