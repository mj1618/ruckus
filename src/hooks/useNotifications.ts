"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

export function useNotifications(
  userId: Id<"users"> | undefined,
  username: string | undefined,
  activeChannelId: Id<"channels"> | null
) {
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState(false);
  const shownIdsRef = useRef(new Set<string>());
  const sinceRef = useRef(Date.now());

  // Track which mentions we've already notified about
  const mentions = useQuery(
    api.messages.getRecentMentions,
    userId ? { userId, since: sinceRef.current } : "skip"
  );

  // Initialize permission state
  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission);
    setDismissed(localStorage.getItem("ruckus-notif-dismissed") === "true");
  }, []);

  // Fire notifications for new mentions
  useEffect(() => {
    if (!mentions || mentions.length === 0) return;
    if (permissionState !== "granted") return;
    if (typeof document === "undefined") return;

    for (const mention of mentions) {
      const id = mention._id as string;
      if (shownIdsRef.current.has(id)) continue;
      shownIdsRef.current.add(id);

      // Only notify when tab is not focused
      if (!document.hidden) continue;

      const body = mention.text.length > 100
        ? mention.text.slice(0, 100) + "..."
        : mention.text;

      const notification = new Notification(`@mention in #${mention.channelName}`, {
        body,
        tag: `ruckus-mention-${id}`,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }, [mentions, permissionState]);

  // Close notifications when tab regains focus
  useEffect(() => {
    function handleVisibilityChange() {
      if (!document.hidden) {
        // Clear shown IDs set periodically to prevent unbounded growth
        if (shownIdsRef.current.size > 100) {
          shownIdsRef.current.clear();
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  function requestPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    Notification.requestPermission().then((result) => {
      setPermissionState(result);
    });
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("ruckus-notif-dismissed", "true");
  }

  return {
    permissionState,
    requestPermission,
    dismissed,
    dismiss,
  };
}
