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
  })
    .index("by_sessionId", ["sessionId"])
    .index("by_username", ["username"]),

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
    replyCount: v.optional(v.number()),
    latestReplyTime: v.optional(v.number()),
    type: v.optional(v.union(v.literal("action"), v.literal("poll"), v.literal("system"))),
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
});

export default schema;
