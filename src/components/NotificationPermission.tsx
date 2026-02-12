"use client";

interface NotificationPermissionProps {
  permissionState: NotificationPermission | "unsupported";
  dismissed: boolean;
  onRequestPermission: () => void;
  onDismiss: () => void;
}

export function NotificationPermission({
  permissionState,
  dismissed,
  onRequestPermission,
  onDismiss,
}: NotificationPermissionProps) {
  // Only show when permission hasn't been asked yet and user hasn't dismissed
  if (permissionState !== "default" || dismissed) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border bg-overlay/90 px-3 py-2 sm:px-4 sm:gap-3">
      <span className="text-sm text-text-secondary">
        Get notified when you&apos;re @mentioned
      </span>
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={onRequestPermission}
          className="rounded px-3 py-1 text-sm font-medium text-white bg-accent hover:bg-accent-hover transition-colors"
        >
          Enable
        </button>
        <button
          onClick={onDismiss}
          className="whitespace-nowrap rounded px-3 py-1 text-sm text-text-muted hover:text-text-secondary transition-colors"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
