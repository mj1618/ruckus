"use client";

import { useEffect } from "react";

export function PreventZoom() {
  useEffect(() => {
    // Prevent pinch-to-zoom
    const preventZoom = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Prevent double-tap zoom
    const preventDoubleTapZoom = (e: TouchEvent) => {
      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;
      if (now - lastTap < DOUBLE_TAP_DELAY) {
        e.preventDefault();
      }
      lastTap = now;
    };

    let lastTap = 0;

    // Add listeners with passive: false to allow preventDefault
    document.addEventListener("touchstart", preventZoom, { passive: false });
    document.addEventListener("touchstart", preventDoubleTapZoom, { passive: false });
    
    // Also prevent gesturestart (iOS-specific zoom gesture)
    const preventGesture = (e: Event) => {
      e.preventDefault();
    };
    document.addEventListener("gesturestart", preventGesture);
    document.addEventListener("gesturechange", preventGesture);
    document.addEventListener("gestureend", preventGesture);

    return () => {
      document.removeEventListener("touchstart", preventZoom);
      document.removeEventListener("touchstart", preventDoubleTapZoom);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
    };
  }, []);

  return null;
}
