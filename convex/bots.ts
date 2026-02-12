import { v } from "convex/values";
import { mutation, query, internalQuery, internalMutation, QueryCtx, MutationCtx } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Generate a random API key with prefix
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 32; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `ruckus_bot_${key}`;
}

// Generate a random webhook secret
function generateWebhookSecret(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let secret = "";
  for (let i = 0; i < 40; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `whsec_${secret}`;
}

// Generate a random avatar color
function generateAvatarColor(): string {
  const colors = [
    "#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16",
    "#22c55e", "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9",
    "#3b82f6", "#6366f1", "#8b5cf6", "#a855f7", "#d946ef",
    "#ec4899", "#f43f5e",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Register a new bot - returns API key (only shown once!)
export const registerBot = mutation({
  args: {
    username: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const username = args.username.trim().toLowerCase();

    // Validate username ends with _bot
    if (!username.endsWith("_bot")) {
      throw new Error("Bot username must end with '_bot'");
    }

    // Validate username format
    if (!/^[a-z0-9_]+$/.test(username)) {
      throw new Error("Username can only contain lowercase letters, numbers, and underscores");
    }

    if (username.length < 4 || username.length > 32) {
      throw new Error("Username must be between 4 and 32 characters");
    }

    // Check if username already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();

    if (existing) {
      throw new Error("Username already taken");
    }

    // Create bot user
    const userId = await ctx.db.insert("users", {
      username,
      sessionId: `bot_${username}_${Date.now()}`, // Bots don't use sessions, but field is required
      avatarColor: generateAvatarColor(),
      lastSeen: Date.now(),
      isBot: true,
    });

    // Generate and store API key
    const apiKey = generateApiKey();
    await ctx.db.insert("botApiKeys", {
      userId,
      apiKey,
      name: args.name,
      createdAt: Date.now(),
    });

    return {
      userId,
      username,
      apiKey, // Only returned once!
    };
  },
});

// Internal function to validate API key and get bot user
export const validateApiKey = internalQuery({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      return null;
    }

    const user = await ctx.db.get("users", keyRecord.userId);
    if (!user || !user.isBot) {
      return null;
    }

    return {
      userId: user._id,
      username: user.username,
      keyId: keyRecord._id,
    };
  },
});

// Update last used timestamp for API key
export const updateApiKeyLastUsed = internalMutation({
  args: {
    keyId: v.id("botApiKeys"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch("botApiKeys", args.keyId, {
      lastUsedAt: Date.now(),
    });
  },
});

// Get mentions for a bot since a timestamp
export const getMentions = internalQuery({
  args: {
    botId: v.id("users"),
    since: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const bot = await ctx.db.get("users", args.botId);
    if (!bot) return [];

    const limit = Math.min(args.limit ?? 50, 100);

    // Search for messages mentioning this bot
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", `@${bot.username}`)
      )
      .take(limit * 2); // Take more to account for filtering

    // Filter by timestamp and exclude bot's own messages
    const filtered = results
      .filter((m) => m._creationTime > args.since && m.userId !== args.botId)
      .slice(0, limit);

    // Get channel info and sender info (only for channel messages, not DMs)
    const channelIds = [...new Set(filtered.map((m) => m.channelId).filter((id): id is Id<"channels"> => id !== undefined))];
    const userIds = [...new Set(filtered.map((m) => m.userId))];

    const [channels, users] = await Promise.all([
      Promise.all(channelIds.map((id) => ctx.db.get("channels", id))),
      Promise.all(userIds.map((id) => ctx.db.get("users", id))),
    ]);

    const channelMap = new Map(
      channels.filter((c) => c !== null).map((c) => [c._id, c])
    );
    const userMap = new Map(
      users.filter((u) => u !== null).map((u) => [u._id, u])
    );

    return filtered.map((m) => ({
      messageId: m._id,
      channelId: m.channelId,
      channelName: m.channelId ? (channelMap.get(m.channelId)?.name ?? "unknown") : undefined,
      text: m.text,
      senderId: m.userId,
      senderUsername: userMap.get(m.userId)?.username ?? "unknown",
      parentMessageId: m.parentMessageId,
      createdAt: m._creationTime,
    }));
  },
});

// Register a webhook for real-time mention notifications
export const registerWebhook = internalMutation({
  args: {
    botId: v.id("users"),
    url: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate URL
    try {
      new URL(args.url);
    } catch {
      throw new Error("Invalid webhook URL");
    }

    // Check if bot already has a webhook
    const existing = await ctx.db
      .query("botWebhooks")
      .withIndex("by_botId", (q) => q.eq("botId", args.botId))
      .unique();

    const secret = generateWebhookSecret();

    if (existing) {
      // Update existing webhook
      await ctx.db.patch("botWebhooks", existing._id, {
        url: args.url,
        secret,
      });
    } else {
      // Create new webhook
      await ctx.db.insert("botWebhooks", {
        botId: args.botId,
        url: args.url,
        secret,
        createdAt: Date.now(),
      });
    }

    return { secret };
  },
});

// Remove webhook registration
export const removeWebhook = internalMutation({
  args: {
    botId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const webhook = await ctx.db
      .query("botWebhooks")
      .withIndex("by_botId", (q) => q.eq("botId", args.botId))
      .unique();

    if (webhook) {
      await ctx.db.delete("botWebhooks", webhook._id);
    }
  },
});

// Get bot info (for /api/bots/me endpoint)
export const getBotInfo = internalQuery({
  args: {
    botId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get("users", args.botId);
    if (!user) return null;

    const webhook = await ctx.db
      .query("botWebhooks")
      .withIndex("by_botId", (q) => q.eq("botId", args.botId))
      .unique();

    const apiKey = await ctx.db
      .query("botApiKeys")
      .withIndex("by_userId", (q) => q.eq("userId", args.botId))
      .unique();

    return {
      userId: user._id,
      username: user.username,
      avatarColor: user.avatarColor,
      createdAt: apiKey?.createdAt,
      lastApiCall: apiKey?.lastUsedAt,
      webhook: webhook ? { url: webhook.url, createdAt: webhook.createdAt } : null,
    };
  },
});

// Get webhooks for bots mentioned in a message (used by webhook dispatcher)
export const getWebhooksForMentionedBots = internalQuery({
  args: {
    text: v.string(),
    excludeUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    // Extract @mentions that end with _bot
    const mentionRegex = /@([a-z0-9_]+_bot)\b/gi;
    const matches = args.text.matchAll(mentionRegex);
    const usernames = [...new Set([...matches].map((m) => m[1].toLowerCase()))];

    if (usernames.length === 0) return [];

    // Find bot users with these usernames
    const botUsers = await Promise.all(
      usernames.map((username) =>
        ctx.db
          .query("users")
          .withIndex("by_username", (q) => q.eq("username", username))
          .unique()
      )
    );

    const validBots = botUsers.filter(
      (u): u is NonNullable<typeof u> => u !== null && u.isBot === true && u._id !== args.excludeUserId
    );

    if (validBots.length === 0) return [];

    // Get webhooks for these bots
    const webhooks = await Promise.all(
      validBots.map((bot) =>
        ctx.db
          .query("botWebhooks")
          .withIndex("by_botId", (q) => q.eq("botId", bot._id))
          .unique()
      )
    );

    return webhooks
      .map((webhook, i) => {
        if (!webhook) return null;
        const bot = validBots[i];
        return {
          botId: bot._id,
          botUsername: bot.username,
          url: webhook.url,
          secret: webhook.secret,
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  },
});

// List all channels (for bots to know where they can post)
// Note: Only returns public channels - bots cannot access private channels
export const listChannels = internalQuery({
  args: {},
  handler: async (ctx) => {
    const channels = await ctx.db.query("channels").collect();
    // Filter out private channels - bots only have access to public channels
    return channels
      .filter((c) => !c.isPrivate)
      .map((c) => ({
        channelId: c._id,
        name: c.name,
        topic: c.topic,
      }));
  },
});

// Internal mutation to set typing indicator (for HTTP endpoint)
export const internalSetTyping = internalMutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();

    if (existing) {
      await ctx.db.patch("typingIndicators", existing._id, {
        expiresAt: Date.now() + 3000,
      });
    } else {
      await ctx.db.insert("typingIndicators", {
        channelId: args.channelId,
        userId: args.userId,
        expiresAt: Date.now() + 3000,
      });
    }
  },
});

// Internal mutation to clear typing indicator (for HTTP endpoint)
export const internalClearTyping = internalMutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();

    if (existing) {
      await ctx.db.delete("typingIndicators", existing._id);
    }
  },
});

// ============================================================
// PUBLIC BOT API (for Convex TypeScript client access)
// ============================================================

// Authenticate a bot using API key - returns bot info if valid
// This is a query so bots can subscribe to their auth status
export const authenticateBot = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      return null;
    }

    const user = await ctx.db.get("users", keyRecord.userId);
    if (!user || !user.isBot) {
      return null;
    }

    return {
      botId: user._id,
      username: user.username,
      avatarColor: user.avatarColor,
    };
  },
});

// Get all channels (authenticated with API key)
// Note: Only returns public channels - bots cannot access private channels
export const getChannelsAsBot = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const channels = await ctx.db.query("channels").collect();
    // Filter out private channels - bots only have access to public channels
    return channels
      .filter((c) => !c.isPrivate)
      .map((c) => ({
        channelId: c._id,
        name: c.name,
        topic: c.topic,
      }));
  },
});

// Get messages from a channel (authenticated with API key)
// Bots can subscribe to this query for real-time updates
// Note: Bots cannot access private channels
export const getChannelMessagesAsBot = query({
  args: {
    apiKey: v.string(),
    channelId: v.id("channels"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    // Check if channel is private
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    if (channel.isPrivate) {
      throw new Error("Bots cannot access private channels");
    }

    const limit = Math.min(args.limit ?? 50, 200);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .order("desc")
      .take(limit);

    // Reverse to get ascending order
    messages.reverse();

    // Fetch user info for each message
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id))
    );
    const userMap = new Map(
      users
        .filter((u) => u !== null)
        .map((u) => [u._id, { username: u.username, isBot: u.isBot }])
    );

    return messages.map((m) => ({
      messageId: m._id,
      channelId: m.channelId,
      text: m.text,
      senderId: m.userId,
      senderUsername: userMap.get(m.userId)?.username ?? "unknown",
      senderIsBot: userMap.get(m.userId)?.isBot ?? false,
      parentMessageId: m.parentMessageId,
      createdAt: m._creationTime,
      editedAt: m.editedAt,
    }));
  },
});

// Subscribe to mentions for a bot (real-time)
// Returns recent messages that mention the bot
export const getMentionsAsBot = query({
  args: {
    apiKey: v.string(),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate API key and get bot info
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    const since = args.since ?? 0;
    const limit = Math.min(args.limit ?? 50, 100);

    // Search for messages mentioning this bot
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_text", (q) =>
        q.search("text", `@${bot.username}`)
      )
      .take(limit * 2);

    // Filter by timestamp and exclude bot's own messages
    const filtered = results
      .filter((m) => m._creationTime > since && m.userId !== bot._id)
      .slice(0, limit);

    // Get channel info and sender info (only for channel messages, not DMs)
    const channelIds = [...new Set(filtered.map((m) => m.channelId).filter((id): id is Id<"channels"> => id !== undefined))];
    const userIds = [...new Set(filtered.map((m) => m.userId))];

    const [channels, users] = await Promise.all([
      Promise.all(channelIds.map((id) => ctx.db.get("channels", id))),
      Promise.all(userIds.map((id) => ctx.db.get("users", id))),
    ]);

    const channelMap = new Map(
      channels.filter((c) => c !== null).map((c) => [c._id, c])
    );
    const userMap = new Map(
      users.filter((u) => u !== null).map((u) => [u._id, u])
    );

    return filtered.map((m) => ({
      messageId: m._id,
      channelId: m.channelId,
      channelName: m.channelId ? (channelMap.get(m.channelId)?.name ?? "unknown") : undefined,
      text: m.text,
      senderId: m.userId,
      senderUsername: userMap.get(m.userId)?.username ?? "unknown",
      parentMessageId: m.parentMessageId,
      createdAt: m._creationTime,
    }));
  },
});

// Send a message as a bot (authenticated with API key)
// Note: Bots cannot post to private channels
export const sendMessageAsBot = mutation({
  args: {
    apiKey: v.string(),
    channelId: v.id("channels"),
    text: v.string(),
    parentMessageId: v.optional(v.id("messages")),
    replyToMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Check if channel is private
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    if (channel.isPrivate) {
      throw new Error("Bots cannot post to private channels");
    }

    // Update last used timestamp
    await ctx.db.patch("botApiKeys", keyRecord._id, {
      lastUsedAt: Date.now(),
    });

    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Handle slash commands
    let messageText = text;
    let messageType: "action" | undefined = undefined;

    if (text.startsWith("/")) {
      const spaceIndex = text.indexOf(" ");
      const command = (spaceIndex === -1 ? text : text.slice(0, spaceIndex)).toLowerCase();

      if (command === "/me") {
        const actionText = text.slice(4).trim();
        if (!actionText) throw new Error("/me requires action text");
        messageText = actionText;
        messageType = "action";
      } else if (command === "/shrug") {
        const prefix = text.slice(6).trim();
        messageText = prefix ? `${prefix} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯";
      }
    }

    let channelId: Id<"channels"> | undefined = args.channelId;
    if (args.parentMessageId) {
      const parent = await ctx.db.get("messages", args.parentMessageId);
      if (!parent) throw new Error("Parent message not found");
      if (!parent.channelId) throw new Error("Cannot reply to a DM message via bot API");
      channelId = parent.channelId;
      if (parent.parentMessageId) {
        throw new Error("Cannot reply to a thread reply — reply to the parent message instead");
      }

      await ctx.db.patch("messages", args.parentMessageId, {
        replyCount: (parent.replyCount ?? 0) + 1,
        latestReplyTime: Date.now(),
      });
    }

    if (!channelId) {
      throw new Error("Channel ID is required");
    }

    const messageId = await ctx.db.insert("messages", {
      channelId,
      userId: bot._id,
      text: messageText,
      ...(messageType ? { type: messageType } : {}),
      ...(args.parentMessageId ? { parentMessageId: args.parentMessageId } : {}),
      ...(args.replyToMessageId ? { replyToMessageId: args.replyToMessageId } : {}),
    });

    // Clear typing indicator
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }

    return { messageId };
  },
});

// Set typing indicator as a bot
export const setTypingAsBot = mutation({
  args: {
    apiKey: v.string(),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (existing) {
      await ctx.db.patch("typingIndicators", existing._id, {
        expiresAt: Date.now() + 3000,
      });
    } else {
      await ctx.db.insert("typingIndicators", {
        channelId: args.channelId,
        userId: bot._id,
        expiresAt: Date.now() + 3000,
      });
    }
  },
});

// Clear typing indicator as a bot
export const clearTypingAsBot = mutation({
  args: {
    apiKey: v.string(),
    channelId: v.id("channels"),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", args.channelId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (existing) {
      await ctx.db.delete("typingIndicators", existing._id);
    }
  },
});

// Heartbeat to show bot as online
export const heartbeatAsBot = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Update lastSeen to show as online
    await ctx.db.patch("users", bot._id, {
      lastSeen: Date.now(),
    });
  },
});

// Mark bot as offline immediately (sets lastSeen far in the past)
export const goOfflineAsBot = mutation({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Set lastSeen to 0 so bot immediately appears offline
    await ctx.db.patch("users", bot._id, {
      lastSeen: 0,
    });
  },
});

// Update a message (for streaming responses)
export const updateMessageAsBot = mutation({
  args: {
    apiKey: v.string(),
    messageId: v.id("messages"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Get the message and verify ownership
    const message = await ctx.db.get("messages", args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    if (message.userId !== bot._id) {
      throw new Error("Cannot update messages from other users");
    }

    const text = args.text.trim();
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Update the message
    await ctx.db.patch("messages", args.messageId, {
      text,
      editedAt: Date.now(),
    });

    return { success: true };
  },
});

// ============================================================
// DIRECT MESSAGE (DM) BOT API
// ============================================================

// Helper to order participant IDs consistently (lower ID first)
function orderParticipants(
  userId1: Id<"users">,
  userId2: Id<"users">
): [Id<"users">, Id<"users">] {
  return userId1 < userId2 ? [userId1, userId2] : [userId2, userId1];
}

// Get all conversations the bot is part of
export const getConversationsAsBot = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Validate API key and get bot info
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Find all conversations where the bot is a participant
    const [asParticipant1, asParticipant2] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_participant1", (q) => q.eq("participant1", bot._id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_participant2", (q) => q.eq("participant2", bot._id))
        .collect(),
    ]);

    const allConversations = [...asParticipant1, ...asParticipant2];

    // Sort by lastMessageTime (most recent first)
    allConversations.sort((a, b) => {
      const aTime = a.lastMessageTime ?? a._creationTime;
      const bTime = b.lastMessageTime ?? b._creationTime;
      return bTime - aTime;
    });

    // Get the other participant's info for each conversation
    const conversationsWithUsers = await Promise.all(
      allConversations.map(async (conv) => {
        const otherUserId =
          conv.participant1 === bot._id ? conv.participant2 : conv.participant1;
        const otherUser = await ctx.db.get("users", otherUserId);

        return {
          conversationId: conv._id,
          createdAt: conv._creationTime,
          lastMessageTime: conv.lastMessageTime,
          otherUser: otherUser
            ? {
              userId: otherUser._id,
              username: otherUser.username,
              avatarColor: otherUser.avatarColor,
              isBot: otherUser.isBot,
            }
            : null,
        };
      })
    );

    // Filter out conversations where the other user no longer exists
    return conversationsWithUsers.filter((c) => c.otherUser !== null);
  },
});

// Get messages from a conversation (for DMs)
export const getConversationMessagesAsBot = query({
  args: {
    apiKey: v.string(),
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate API key and get bot info
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Verify the bot is a participant in this conversation
    const conversation = await ctx.db.get("conversations", args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.participant1 !== bot._id && conversation.participant2 !== bot._id) {
      throw new Error("Bot is not a participant in this conversation");
    }

    const limit = Math.min(args.limit ?? 50, 200);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .order("desc")
      .take(limit);

    // Reverse to get ascending order
    messages.reverse();

    // Fetch user info for each message
    const userIds = [...new Set(messages.map((m) => m.userId))];
    const users = await Promise.all(
      userIds.map((id) => ctx.db.get("users", id))
    );
    const userMap = new Map(
      users
        .filter((u) => u !== null)
        .map((u) => [u._id, { username: u.username, isBot: u.isBot }])
    );

    return messages.map((m) => ({
      messageId: m._id,
      conversationId: m.conversationId,
      text: m.text,
      senderId: m.userId,
      senderUsername: userMap.get(m.userId)?.username ?? "unknown",
      senderIsBot: userMap.get(m.userId)?.isBot ?? false,
      parentMessageId: m.parentMessageId,
      createdAt: m._creationTime,
      editedAt: m.editedAt,
    }));
  },
});

// Poll for new direct messages to the bot (across all conversations)
export const getDirectMessagesAsBot = query({
  args: {
    apiKey: v.string(),
    since: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Validate API key and get bot info
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    const since = args.since ?? 0;
    const limit = Math.min(args.limit ?? 50, 100);

    // Find all conversations where the bot is a participant
    const [asParticipant1, asParticipant2] = await Promise.all([
      ctx.db
        .query("conversations")
        .withIndex("by_participant1", (q) => q.eq("participant1", bot._id))
        .collect(),
      ctx.db
        .query("conversations")
        .withIndex("by_participant2", (q) => q.eq("participant2", bot._id))
        .collect(),
    ]);

    const conversationIds = [...asParticipant1, ...asParticipant2].map((c) => c._id);

    if (conversationIds.length === 0) {
      return [];
    }

    // Get recent messages from all conversations
    const allMessages = await Promise.all(
      conversationIds.map((convId) =>
        ctx.db
          .query("messages")
          .withIndex("by_conversationId", (q) => q.eq("conversationId", convId))
          .order("desc")
          .take(limit)
      )
    );

    // Flatten, filter by timestamp and exclude bot's own messages, then sort
    const filtered = allMessages
      .flat()
      .filter((m) => m._creationTime > since && m.userId !== bot._id)
      .sort((a, b) => a._creationTime - b._creationTime)
      .slice(0, limit);

    // Get conversation info and sender info
    const conversationIdsForMessages = [...new Set(filtered.map((m) => m.conversationId).filter((id): id is Id<"conversations"> => id !== undefined))];
    const userIds = [...new Set(filtered.map((m) => m.userId))];

    const [conversations, users] = await Promise.all([
      Promise.all(conversationIdsForMessages.map((id) => ctx.db.get("conversations", id))),
      Promise.all(userIds.map((id) => ctx.db.get("users", id))),
    ]);

    const conversationMap = new Map(
      conversations.filter((c) => c !== null).map((c) => [c._id, c])
    );
    const userMap = new Map(
      users.filter((u) => u !== null).map((u) => [u._id, u])
    );

    return filtered.map((m) => {
      const conversation = m.conversationId ? conversationMap.get(m.conversationId) : null;
      const otherUserId = conversation
        ? (conversation.participant1 === bot._id ? conversation.participant2 : conversation.participant1)
        : undefined;

      return {
        messageId: m._id,
        conversationId: m.conversationId,
        text: m.text,
        senderId: m.userId,
        senderUsername: userMap.get(m.userId)?.username ?? "unknown",
        parentMessageId: m.parentMessageId,
        createdAt: m._creationTime,
      };
    });
  },
});

// Send a direct message as a bot (creates conversation if needed)
export const sendDirectMessageAsBot = mutation({
  args: {
    apiKey: v.string(),
    userId: v.id("users"), // The user to send the DM to
    text: v.string(),
    parentMessageId: v.optional(v.id("messages")),
    replyToMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Verify target user exists
    const targetUser = await ctx.db.get("users", args.userId);
    if (!targetUser) {
      throw new Error("User not found");
    }

    if (bot._id === args.userId) {
      throw new Error("Cannot send a DM to yourself");
    }

    // Update last used timestamp
    await ctx.db.patch("botApiKeys", keyRecord._id, {
      lastUsedAt: Date.now(),
    });

    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Get or create conversation
    const [participant1, participant2] = orderParticipants(bot._id, args.userId);

    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participants", (q) =>
        q.eq("participant1", participant1).eq("participant2", participant2)
      )
      .unique();

    let conversationId: Id<"conversations">;
    if (conversation) {
      conversationId = conversation._id;
    } else {
      conversationId = await ctx.db.insert("conversations", {
        participant1,
        participant2,
        lastMessageTime: Date.now(),
      });
    }

    // Handle parent message (thread reply)
    let finalConversationId = conversationId;
    if (args.parentMessageId) {
      const parent = await ctx.db.get("messages", args.parentMessageId);
      if (!parent) throw new Error("Parent message not found");
      if (!parent.conversationId) throw new Error("Parent message is not a DM");
      if (parent.conversationId !== conversationId) {
        throw new Error("Parent message is from a different conversation");
      }
      if (parent.parentMessageId) {
        throw new Error("Cannot reply to a thread reply — reply to the parent message instead");
      }

      await ctx.db.patch("messages", args.parentMessageId, {
        replyCount: (parent.replyCount ?? 0) + 1,
        latestReplyTime: Date.now(),
      });
    }

    // Validate inline reply target if provided
    if (args.replyToMessageId) {
      const replyTarget = await ctx.db.get("messages", args.replyToMessageId);
      if (!replyTarget) throw new Error("Reply target message not found");
      if (replyTarget.conversationId !== conversationId) {
        throw new Error("Cannot reply to a message in a different conversation");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: finalConversationId,
      userId: bot._id,
      text,
      ...(args.parentMessageId ? { parentMessageId: args.parentMessageId } : {}),
      ...(args.replyToMessageId ? { replyToMessageId: args.replyToMessageId } : {}),
    });

    // Update conversation lastMessageTime
    await ctx.db.patch("conversations", conversationId, {
      lastMessageTime: Date.now(),
    });

    // Clear typing indicator
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", conversationId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }

    return { messageId, conversationId };
  },
});

// Send a message to a conversation by ID (for replying to existing DMs)
export const sendMessageToConversationAsBot = mutation({
  args: {
    apiKey: v.string(),
    conversationId: v.id("conversations"),
    text: v.string(),
    parentMessageId: v.optional(v.id("messages")),
    replyToMessageId: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Verify conversation exists and bot is a participant
    const conversation = await ctx.db.get("conversations", args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.participant1 !== bot._id && conversation.participant2 !== bot._id) {
      throw new Error("Bot is not a participant in this conversation");
    }

    // Update last used timestamp
    await ctx.db.patch("botApiKeys", keyRecord._id, {
      lastUsedAt: Date.now(),
    });

    const text = args.text.trim();
    if (text.length === 0) {
      throw new Error("Message cannot be empty");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Handle parent message (thread reply)
    if (args.parentMessageId) {
      const parent = await ctx.db.get("messages", args.parentMessageId);
      if (!parent) throw new Error("Parent message not found");
      if (parent.conversationId !== args.conversationId) {
        throw new Error("Parent message is from a different conversation");
      }
      if (parent.parentMessageId) {
        throw new Error("Cannot reply to a thread reply — reply to the parent message instead");
      }

      await ctx.db.patch("messages", args.parentMessageId, {
        replyCount: (parent.replyCount ?? 0) + 1,
        latestReplyTime: Date.now(),
      });
    }

    // Validate inline reply target if provided
    if (args.replyToMessageId) {
      const replyTarget = await ctx.db.get("messages", args.replyToMessageId);
      if (!replyTarget) throw new Error("Reply target message not found");
      if (replyTarget.conversationId !== args.conversationId) {
        throw new Error("Cannot reply to a message in a different conversation");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      userId: bot._id,
      text,
      ...(args.parentMessageId ? { parentMessageId: args.parentMessageId } : {}),
      ...(args.replyToMessageId ? { replyToMessageId: args.replyToMessageId } : {}),
    });

    // Update conversation lastMessageTime
    await ctx.db.patch("conversations", args.conversationId, {
      lastMessageTime: Date.now(),
    });

    // Clear typing indicator
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }

    return { messageId };
  },
});

// Set typing indicator in a conversation as a bot
export const setTypingInConversationAsBot = mutation({
  args: {
    apiKey: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    // Verify bot is a participant in this conversation
    const conversation = await ctx.db.get("conversations", args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.participant1 !== bot._id && conversation.participant2 !== bot._id) {
      throw new Error("Bot is not a participant in this conversation");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (existing) {
      await ctx.db.patch("typingIndicators", existing._id, {
        expiresAt: Date.now() + 3000,
      });
    } else {
      await ctx.db.insert("typingIndicators", {
        conversationId: args.conversationId,
        userId: bot._id,
        expiresAt: Date.now() + 3000,
      });
    }
  },
});

// Clear typing indicator in a conversation as a bot
export const clearTypingInConversationAsBot = mutation({
  args: {
    apiKey: v.string(),
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    // Validate API key
    const keyRecord = await ctx.db
      .query("botApiKeys")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();

    if (!keyRecord) {
      throw new Error("Invalid API key");
    }

    const bot = await ctx.db.get("users", keyRecord.userId);
    if (!bot || !bot.isBot) {
      throw new Error("Invalid bot");
    }

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversationId", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("userId"), bot._id))
      .unique();

    if (existing) {
      await ctx.db.delete("typingIndicators", existing._id);
    }
  },
});

// ============================================================
// INTERNAL FUNCTIONS (for HTTP endpoint handlers)
// ============================================================

// Internal mutation to send message (for HTTP endpoint)
// Note: Bots cannot post to private channels
export const internalSendMessage = internalMutation({
  args: {
    channelId: v.id("channels"),
    userId: v.id("users"),
    text: v.string(),
    parentMessageId: v.optional(v.id("messages")),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    // Check if channel is private
    const channel = await ctx.db.get("channels", args.channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }
    if (channel.isPrivate) {
      throw new Error("Bots cannot post to private channels");
    }

    const text = args.text.trim();
    if (text.length === 0 && (!args.attachments || args.attachments.length === 0)) {
      throw new Error("Message cannot be empty");
    }
    if (args.attachments && args.attachments.length > 5) {
      throw new Error("Maximum 5 attachments per message");
    }
    if (text.length > 4000) {
      throw new Error("Message cannot exceed 4000 characters");
    }

    // Handle slash commands
    let messageText = text;
    let messageType: "action" | undefined = undefined;

    if (text.startsWith("/")) {
      const spaceIndex = text.indexOf(" ");
      const command = (spaceIndex === -1 ? text : text.slice(0, spaceIndex)).toLowerCase();

      if (command === "/me") {
        const actionText = text.slice(4).trim();
        if (!actionText) throw new Error("/me requires action text");
        messageText = actionText;
        messageType = "action";
      } else if (command === "/shrug") {
        const prefix = text.slice(6).trim();
        messageText = prefix ? `${prefix} ¯\\_(ツ)_/¯` : "¯\\_(ツ)_/¯";
      }
    }

    let channelId: Id<"channels"> = args.channelId;
    if (args.parentMessageId) {
      const parent = await ctx.db.get("messages", args.parentMessageId);
      if (!parent) throw new Error("Parent message not found");
      if (!parent.channelId) throw new Error("Cannot reply to a DM message via bot API");
      channelId = parent.channelId;
      if (parent.parentMessageId) {
        throw new Error(
          "Cannot reply to a thread reply — reply to the parent message instead"
        );
      }

      await ctx.db.patch("messages", args.parentMessageId, {
        replyCount: (parent.replyCount ?? 0) + 1,
        latestReplyTime: Date.now(),
      });
    }

    const messageId = await ctx.db.insert("messages", {
      channelId,
      userId: args.userId,
      text: messageText,
      ...(messageType ? { type: messageType } : {}),
      ...(args.parentMessageId
        ? { parentMessageId: args.parentMessageId }
        : {}),
      ...(args.attachments && args.attachments.length > 0
        ? { attachments: args.attachments }
        : {}),
    });

    // Clear typing indicator for this user in this channel
    const typingIndicator = await ctx.db
      .query("typingIndicators")
      .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
      .filter((q) => q.eq(q.field("userId"), args.userId))
      .unique();

    if (typingIndicator) {
      await ctx.db.delete("typingIndicators", typingIndicator._id);
    }

    return messageId;
  },
});
