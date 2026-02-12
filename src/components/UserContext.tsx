"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { getOrCreateSessionId } from "@/lib/sessionId";

interface UserContextType {
  user: {
    _id: Id<"users">;
    username: string;
    avatarColor: string;
    avatarUrl?: string | null;
    statusEmoji?: string;
    statusText?: string;
  } | null;
  sessionId: string;
  join: (username: string) => Promise<void>;
  signup: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  isLoading: boolean;
}

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState("");
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  const currentUser = useQuery(
    api.users.getCurrentUser,
    sessionId ? { sessionId } : "skip"
  );
  const joinOrReturn = useMutation(api.users.joinOrReturn);
  const signupMutation = useMutation(api.users.signup);
  const loginMutation = useMutation(api.users.login);
  const heartbeatMutation = useMutation(api.users.heartbeat);
  const seedChannels = useMutation(api.channels.seedDefaultChannels);

  const isLoading = sessionId === "" || currentUser === undefined || isJoining;

  const user = currentUser
    ? {
        _id: currentUser._id,
        username: currentUser.username,
        avatarColor: currentUser.avatarColor,
        avatarUrl: currentUser.avatarUrl,
        statusEmoji: currentUser.statusEmoji,
        statusText: currentUser.statusText,
      }
    : null;

  // Heartbeat interval
  useEffect(() => {
    if (!sessionId || !user) return;
    heartbeatMutation({ sessionId });
    const interval = setInterval(() => {
      heartbeatMutation({ sessionId });
    }, 30_000);
    return () => clearInterval(interval);
  }, [sessionId, !!user]); // eslint-disable-line react-hooks/exhaustive-deps

  const join = async (username: string) => {
    setIsJoining(true);
    try {
      const userId = await joinOrReturn({ sessionId, username });
      await seedChannels({ userId });
    } catch (error) {
      setIsJoining(false);
      throw error;
    }
    setIsJoining(false);
  };

  const signup = async (username: string, password: string) => {
    setIsJoining(true);
    try {
      const userId = await signupMutation({ sessionId, username, password });
      await seedChannels({ userId });
    } catch (error) {
      setIsJoining(false);
      throw error;
    }
    setIsJoining(false);
  };

  const login = async (username: string, password: string) => {
    setIsJoining(true);
    try {
      await loginMutation({ sessionId, username, password });
    } catch (error) {
      setIsJoining(false);
      throw error;
    }
    setIsJoining(false);
  };

  return (
    <UserContext.Provider value={{ user, sessionId, join, signup, login, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
