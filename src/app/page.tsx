"use client";

import { UserProvider, useUser } from "@/components/UserContext";
import { JoinScreen } from "@/components/JoinScreen";
import { ChatLayout } from "@/components/ChatLayout";

const PAUSED = true;

function PausedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="flex max-w-lg flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10">
          <svg
            className="h-8 w-8 text-indigo-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 5.25v13.5m-7.5-13.5v13.5"
            />
          </svg>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-100">
          Ruckus
        </h1>
        <p className="text-lg text-zinc-400">
          This is a demo project and is currently paused.
        </p>
        <div className="mt-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-6 py-4">
          <p className="text-sm text-zinc-500">
            The project is not actively running right now. Check back later or
            reach out if you have questions.
          </p>
        </div>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-3xl font-bold text-zinc-100">Ruckus</h1>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-indigo-500" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <JoinScreen />;
  }

  return <ChatLayout />;
}

export default function Home() {
  if (PAUSED) {
    return <PausedPage />;
  }

  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
