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
  }).index("by_channelId", ["channelId"]),

  typingIndicators: defineTable({
    channelId: v.id("channels"),
    userId: v.id("users"),
    expiresAt: v.number(),
  }).index("by_channelId", ["channelId"]),
});

export default schema;
