import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// --- Password hashing helpers (Web Crypto API) ---

function generateSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Avatar colors ---

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
    const username = args.username.trim();
    if (!username || username.length > 30) {
      throw new Error("Invalid username");
    }

    const existingSession = await ctx.db
      .query("users")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .unique();

    // Check if username is already taken by another user
    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existingUsername && existingUsername._id !== existingSession?._id) {
      throw new Error("Username already taken");
    }

    if (existingSession) {
      await ctx.db.patch("users", existingSession._id, {
        username,
        avatarColor: getAvatarColor(username),
        lastSeen: Date.now(),
      });
      return existingSession._id;
    }

    const userId = await ctx.db.insert("users", {
      username,
      sessionId: args.sessionId,
      avatarColor: getAvatarColor(username),
      lastSeen: Date.now(),
    });
    return userId;
  },
});

export const signup = mutation({
  args: {
    sessionId: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim();
    if (!username || username.length > 30) {
      throw new Error("Invalid username");
    }
    if (args.password.length < 4) {
      throw new Error("Password must be at least 4 characters");
    }

    // Check if username is already taken
    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existingUsername) {
      throw new Error("Username already taken");
    }

    const salt = generateSalt();
    const hash = await hashPassword(args.password, salt);

    const userId = await ctx.db.insert("users", {
      username,
      sessionId: args.sessionId,
      avatarColor: getAvatarColor(username),
      lastSeen: Date.now(),
      passwordHash: hash,
      passwordSalt: salt,
    });
    return userId;
  },
});

export const login = mutation({
  args: {
    sessionId: v.string(),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim();
    if (!username) {
      throw new Error("Username is required");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (!user) {
      throw new Error("No account found with that username");
    }

    if (!user.passwordHash || !user.passwordSalt) {
      throw new Error("This account does not have a password. Please contact support.");
    }

    const hash = await hashPassword(args.password, user.passwordSalt);
    if (hash !== user.passwordHash) {
      throw new Error("Incorrect password");
    }

    // Transfer session to this user
    await ctx.db.patch("users", user._id, {
      sessionId: args.sessionId,
      lastSeen: Date.now(),
    });

    return user._id;
  },
});

export const changePassword = mutation({
  args: {
    userId: v.id("users"),
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.newPassword.length < 4) {
      throw new Error("New password must be at least 4 characters");
    }

    const user = await ctx.db.get("users", args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.passwordHash || !user.passwordSalt) {
      throw new Error("This account does not have a password set");
    }

    const currentHash = await hashPassword(args.currentPassword, user.passwordSalt);
    if (currentHash !== user.passwordHash) {
      throw new Error("Current password is incorrect");
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(args.newPassword, newSalt);

    await ctx.db.patch("users", user._id, {
      passwordHash: newHash,
      passwordSalt: newSalt,
    });
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
    const onlineUsers = allUsers.filter((u) => u.lastSeen > cutoff);

    return Promise.all(
      onlineUsers.map(async (u) => ({
        _id: u._id,
        username: u.username,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarStorageId
          ? await ctx.storage.getUrl(u.avatarStorageId)
          : null,
        lastSeen: u.lastSeen,
        statusEmoji: u.statusEmoji,
        statusText: u.statusText,
        isBot: u.isBot,
      }))
    );
  },
});

export const getChannelUsers = query({
  args: {
    channelId: v.optional(v.id("channels")),
  },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - 60_000;

    let users;
    if (args.channelId) {
      const channel = await ctx.db.get("channels", args.channelId);
      if (channel?.isPrivate) {
        // Private channel: show only channel members
        const memberships = await ctx.db
          .query("channelMembers")
          .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId!))
          .collect();
        const memberUsers = await Promise.all(
          memberships.map((m) => ctx.db.get("users", m.userId))
        );
        users = memberUsers.filter((u): u is NonNullable<typeof u> => u !== null);
      } else {
        // Public channel: show all users on the platform
        users = await ctx.db.query("users").collect();
      }
    } else {
      // No channel context: show all users
      users = await ctx.db.query("users").collect();
    }

    return Promise.all(
      users.map(async (u) => ({
        _id: u._id,
        username: u.username,
        avatarColor: u.avatarColor,
        avatarUrl: u.avatarStorageId
          ? await ctx.storage.getUrl(u.avatarStorageId)
          : null,
        lastSeen: u.lastSeen,
        isOnline: u.lastSeen > cutoff,
        statusEmoji: u.statusEmoji,
        statusText: u.statusText,
        isBot: u.isBot,
      }))
    );
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

export const setStatus = mutation({
  args: {
    userId: v.id("users"),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const emoji = args.statusEmoji?.slice(0, 10) || undefined;
    const text = args.statusText?.slice(0, 100) || undefined;
    await ctx.db.patch("users", args.userId, {
      statusEmoji: emoji,
      statusText: text,
    });
  },
});

export const clearStatus = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch("users", args.userId, {
      statusEmoji: undefined,
      statusText: undefined,
    });
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
    if (!user) return null;

    const avatarUrl = user.avatarStorageId
      ? await ctx.storage.getUrl(user.avatarStorageId)
      : null;

    return { ...user, avatarUrl };
  },
});

export const getUserByUsername = query({
  args: {
    username: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (!user) return null;

    const avatarUrl = user.avatarStorageId
      ? await ctx.storage.getUrl(user.avatarStorageId)
      : null;

    return {
      _id: user._id,
      username: user.username,
      avatarColor: user.avatarColor,
      avatarUrl,
    };
  },
});

export const generateAvatarUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateAvatar = mutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new Error("User not found");

    // Delete old avatar if exists
    if (user.avatarStorageId) {
      await ctx.storage.delete(user.avatarStorageId);
    }

    await ctx.db.patch("users", args.userId, {
      avatarStorageId: args.storageId,
    });
  },
});

export const removeAvatar = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.userId);
    if (!user) throw new Error("User not found");

    if (user.avatarStorageId) {
      await ctx.storage.delete(user.avatarStorageId);
      await ctx.db.patch("users", args.userId, {
        avatarStorageId: undefined,
      });
    }
  },
});
