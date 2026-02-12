import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const schema = defineSchema({
  ...authTables,

  users: defineTable({
    username: v.string(),
    sessionId: v.string(),
    avatarColor: v.string(),
    lastSeen: v.number(),
    statusEmoji: v.optional(v.string()),
    statusText: v.optional(v.string()),
    isBot: v.optional(v.boolean()),
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
    topic: v.optional(v.string()),
    createdBy: v.id("users"),
  }).index("by_name", ["name"]),

  messages: defineTable({
    channelId: v.id("channels"),
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
    .index("by_parentMessageId", ["parentMessageId"])
    .searchIndex("search_text", {
      searchField: "text",
      filterFields: ["channelId"],
    }),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_channelId", ["channelId"]),

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
    channelId: v.id("channels"),
    pinnedBy: v.id("users"),
    pinnedAt: v.number(),
  })
    .index("by_channelId", ["channelId"])
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
    channelId: v.id("channels"),
    savedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_messageId", ["userId", "messageId"]),

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
