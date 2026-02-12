import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    username: v.string(),
    sessionId: v.string(),
    avatarColor: v.string(),
    avatarStorageId: v.optional(v.id("_storage")),
    lastSeen: v.number(),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
    isBot: v.optional(v.boolean()),
    passwordHash: v.optional(v.string()),
    passwordSalt: v.optional(v.string()),
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_username", ["username"]),

  botApiKeys: defineTable({
    userId: v.id("users"),
    apiKey: v.string(),
    name: v.string(),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_apiKey", ["apiKey"])
    .index("by_userId", ["userId"]),

  botWebhooks: defineTable({
    botId: v.id("users"),
    url: v.string(),
    secret: v.string(),
    createdAt: v.number(),
  }).index("by_botId", ["botId"]),

  channels: defineTable({
    name: v.string(),
    title: v.optional(v.string()),
    topic: v.optional(v.string()),
    createdBy: v.id("users"),
    isPrivate: v.optional(v.boolean()), // undefined/false = public
  }).index("by_name", ["name"]),

  channelMembers: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
  })
    .index("by_channelId", ["channelId"])
    .index("by_userId", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  channelAccessRequests: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    status: v.union(v.literal("pending"), v.literal("approved"), v.literal("denied")),
    requestedAt: v.number(),
    respondedAt: v.optional(v.number()),
    respondedBy: v.optional(v.id("users")),
  })
    .index("by_channelId", ["channelId"])
    .index("by_userId", ["userId"])
    .index("by_channel_user", ["channelId", "userId"]),

  conversations: defineTable({
    participant1: v.id("users"), // Always the lower ID (for consistent ordering)
    participant2: v.id("users"), // Always the higher ID
    lastMessageTime: v.optional(v.number()), // For sorting DM list
  })
    .index("by_participant1", ["participant1"])
    .index("by_participant2", ["participant2"])
    .index("by_participants", ["participant1", "participant2"]),

  messages: defineTable({
    channelId: v.optional(v.id("channels")), // Optional - either channelId or conversationId must be set
    conversationId: v.optional(v.id("conversations")), // Optional - for DMs
    userId: v.id("users"),
    text: v.string(),
    editedAt: v.optional(v.number()),
    parentMessageId: v.optional(v.id("messages")),
    replyToMessageId: v.optional(v.id("messages")),
    replyCount: v.optional(v.number()),
    latestReplyTime: v.optional(v.number()),
    type: v.optional(v.union(v.literal("action"), v.literal("poll"), v.literal("system"))),
    attachments: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      filename: v.string(),
      contentType: v.string(),
      size: v.number(),
    }))),
  })
    .index("by_channelId", ["channelId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_parentMessageId", ["parentMessageId"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["channelId", "conversationId"],
    }),

  typingIndicators: defineTable({
    channelId: v.optional(v.id("channels")), // Optional - either channelId or conversationId
    conversationId: v.optional(v.id("conversations")), // Optional - for DMs
    userId: v.id("users"),
    expiresAt: v.number(),
  })
    .index("by_channelId", ["channelId"])
    .index("by_conversationId", ["conversationId"]),

  channelReads: defineTable({
    userId: v.id("users"),
    channelId: v.id("channels"),
    lastReadTime: v.number(),
  })
    .index("by_user_channel", ["userId", "channelId"])
    .index("by_user", ["userId"]),

  reactions: defineTable({
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  })
    .index("by_messageId", ["messageId"])
    .index("by_messageId_emoji", ["messageId", "emoji"]),

  pinnedMessages: defineTable({
    messageId: v.id("messages"),
    channelId: v.optional(v.id("channels")), // Optional - either channelId or conversationId
    conversationId: v.optional(v.id("conversations")), // Optional - for DMs
    pinnedBy: v.id("users"),
    pinnedAt: v.number(),
  })
    .index("by_channelId", ["channelId"])
    .index("by_conversationId", ["conversationId"])
    .index("by_messageId", ["messageId"]),

  polls: defineTable({
    channelId: v.id("channels"),
    messageId: v.id("messages"),
    question: v.string(),
    options: v.array(v.object({
      text: v.string(),
      votes: v.number(),
    })),
    createdBy: v.id("users"),
  })
    .index("by_messageId", ["messageId"])
    .index("by_channelId", ["channelId"]),

  pollVotes: defineTable({
    pollId: v.id("polls"),
    userId: v.id("users"),
    optionIndex: v.number(),
  })
    .index("by_pollId", ["pollId"])
    .index("by_pollId_userId", ["pollId", "userId"]),

  linkPreviews: defineTable({
    messageId: v.id("messages"),
    url: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    siteName: v.optional(v.string()),
    domain: v.string(),
    fetchedAt: v.number(),
  })
    .index("by_messageId", ["messageId"]),

  bookmarks: defineTable({
    userId: v.id("users"),
    messageId: v.id("messages"),
    channelId: v.optional(v.id("channels")), // Optional - either channelId or conversationId
    conversationId: v.optional(v.id("conversations")), // Optional - for DMs
    savedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_messageId", ["userId", "messageId"]),

  conversationReads: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    lastReadTime: v.number(),
  })
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_user", ["userId"]),

  drawStrokes: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    points: v.array(v.object({
      x: v.number(),
      y: v.number(),
    })),
    color: v.string(),
    width: v.number(),
    createdAt: v.number(),
  }).index("by_channelId", ["channelId"]),
});

export default schema;
