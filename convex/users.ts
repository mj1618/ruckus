import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

const AVATAR_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#14b8a6", "#06b6d4",
  "#0ea5e9", "#3b82f6", "#6366f1", "#8b5cf6",
  "#a855f7", "#d946ef", "#ec4899", "#f43f5e",
];

function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash += username.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export const joinOrReturn = mutation({
  args: {
    sessionId: v.string(),
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (existing) {
      await ctx.db.patch("users", existing._id, {
        username: args.username,
        avatarColor: getAvatarColor(args.username),
        lastSeen: Date.now(),
      });
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      username: args.username,
      sessionId: args.sessionId,
      avatarColor: getAvatarColor(args.username),
      lastSeen: Date.now(),
    });
    return userId;
  },
});

export const heartbeat = mutation({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    if (user) {
      await ctx.db.patch("users", user._id, {
        lastSeen: Date.now(),
      });
    }
  },
});

export const getOnlineUsers = query({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - 60_000;
    const allUsers = await ctx.db.query("users").collect();
    return allUsers
      .filter((u) => u.lastSeen > cutoff)
      .map((u) => ({
        _id: u._id,
        username: u.username,
        avatarColor: u.avatarColor,
        lastSeen: u.lastSeen,
      }));
  },
});

export const changeUsername = mutation({
  args: {
    userId: v.id("users"),
    newUsername: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.newUsername.trim();
    if (!username || username.length > 30) throw new Error("Invalid username");
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing && existing._id !== args.userId) {
      throw new Error("Username already taken");
    }
    await ctx.db.patch("users", args.userId, { username });
  },
});

export const getCurrentUser = query({
  args: {
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();
    return user ?? null;
  },
});
