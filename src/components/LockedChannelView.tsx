"use client";

import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useUser } from "@/components/UserContext";
import { useState } from "react";

interface LockedChannelViewProps {
  channelId: Id<"channels">;
  channelName: string;
  accessRequestStatus?: "pending" | "approved" | "denied";
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M6 9V7.5a6 6 0 1 1 12 0V9h1.5A1.5 1.5 0 0 1 21 10.5v10.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 21V10.5A1.5 1.5 0 0 1 4.5 9H6zm3-1.5a3 3 0 1 1 6 0V9H9V7.5z" clipRule="evenodd" />
    </svg>
  );
}

export function LockedChannelView({ 
  channelId, 
  channelName, 
  accessRequestStatus 
}: LockedChannelViewProps) {
  const { user } = useUser();
  const requestAccess = useMutation(api.channels.requestAccess);
  const [isRequesting, setIsRequesting] = useState(false);
  const [error, setError] = useState("");
  const [justRequested, setJustRequested] = useState(false);

  const handleRequestAccess = async () => {
    if (!user) return;
    
    setIsRequesting(true);
    setError("");
    
    try {
      await requestAccess({ channelId, userId: user._id });
      setJustRequested(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request access");
    } finally {
      setIsRequesting(false);
    }
  };

  const isPending = accessRequestStatus === "pending" || justRequested;
  const wasDenied = accessRequestStatus === "denied" && !justRequested;

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="rounded-full bg-overlay p-6">
        <LockIcon className="h-12 w-12 text-text-muted" />
      </div>
      
      <h2 className="mt-6 text-xl font-semibold text-text">
        #{channelName}
      </h2>
      
      <p className="mt-2 max-w-sm text-text-muted">
        This is a private channel. You need permission from a channel admin to view its contents.
      </p>

      {isPending ? (
        <div className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-warning/10 px-4 py-2 text-sm text-warning">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Access request pending
          </div>
          <p className="mt-2 text-xs text-text-muted">
            A channel admin will review your request
          </p>
        </div>
      ) : wasDenied ? (
        <div className="mt-6">
          <div className="inline-flex items-center gap-2 rounded-full bg-danger/10 px-4 py-2 text-sm text-danger">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Access request denied
          </div>
          <button
            onClick={handleRequestAccess}
            disabled={isRequesting}
            className="mt-4 block rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isRequesting ? "Requesting..." : "Request again"}
          </button>
        </div>
      ) : (
        <button
          onClick={handleRequestAccess}
          disabled={isRequesting || !user}
          className="mt-6 rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {isRequesting ? "Requesting..." : "Request Access"}
        </button>
      )}

      {error && (
        <p className="mt-3 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
