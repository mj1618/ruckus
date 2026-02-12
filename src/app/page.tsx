"use client";

import { UserProvider, useUser } from "@/components/UserContext";
import { JoinScreen } from "@/components/JoinScreen";
import { ChatLayout } from "@/components/ChatLayout";

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
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}
