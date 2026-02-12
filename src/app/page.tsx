"use client";

import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Ruckus</h1>
        <AuthLoading>
          <p className="text-lg text-zinc-500">Loading...</p>
        </AuthLoading>
        <Unauthenticated>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            Welcome to Ruckus. Sign in to get started.
          </p>
        </Unauthenticated>
        <Authenticated>
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            You&apos;re signed in! Start building something great.
          </p>
        </Authenticated>
      </main>
    </div>
  );
}
