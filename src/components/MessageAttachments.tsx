"use client";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface Attachment {
  storageId: string;
  filename: string;
  contentType: string;
  size: number;
  url: string | null;
}

interface MessageAttachmentsProps {
  attachments: Attachment[];
}

export function MessageAttachments({ attachments }: MessageAttachmentsProps) {
  if (attachments.length === 0) return null;

  const images = attachments.filter((a) => a.contentType.startsWith("image/"));
  const files = attachments.filter((a) => !a.contentType.startsWith("image/"));

  return (
    <div className="mt-1 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((img) => (
            <a
              key={img.storageId}
              href={img.url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-border"
            >
              {img.url ? (
                <img
                  src={img.url}
                  alt={img.filename}
                  className="max-h-[300px] max-w-[400px] object-contain"
                />
              ) : (
                <div className="flex h-[100px] w-[200px] items-center justify-center bg-overlay text-sm text-text-muted">
                  Image unavailable
                </div>
              )}
            </a>
          ))}
        </div>
      )}
      {files.map((file) => (
        <a
          key={file.storageId}
          href={file.url ?? undefined}
          download={file.filename}
          className="inline-flex max-w-[300px] items-center gap-2 rounded-lg border border-border bg-overlay/50 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-overlay"
        >
          <svg
            className="h-5 w-5 flex-shrink-0 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{file.filename}</div>
            <div className="text-xs text-text-muted">{formatFileSize(file.size)}</div>
          </div>
        </a>
      ))}
    </div>
  );
}
