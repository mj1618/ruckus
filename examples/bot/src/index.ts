/**
 * Ruckus AI Bot
 *
 * An AI-powered bot that uses Claude CLI to respond to @mentions with streaming.
 * Uses the Convex TypeScript client for real-time subscriptions.
 *
 * Features:
 * - Auto-registers on first run
 * - Uses Claude CLI with streaming JSON output
 * - Streams responses in real-time to Ruckus
 * - Maintains persistent memory in MEMORY.md
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";
import * as readline from "readline";

// =============================================================================
// CONFIGURATION - Update these URLs for your Convex deployment
// =============================================================================

const CONVEX_URLS = {
  // Development Convex deployment URL
  development: "https://chatty-snake-456.convex.cloud",
  // Production Convex deployment URL  
  production: "https://fast-wolverine-841.convex.cloud",
};

// Bot configuration
const BOT_CONFIG = {
  username: "claude_ai_bot",  // Must end with _bot
  name: "Claude AI Bot",
};

// Anthropic API key (from environment variable)
// Can be either a regular API key (sk-ant-api03-...) or rely on CLI's existing auth
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

if (!ANTHROPIC_API_KEY) {
  console.log("⚠️  ANTHROPIC_API_KEY not set - will use Claude CLI's existing authentication");
  console.log("   If the bot fails, run 'claude auth login' or set ANTHROPIC_API_KEY=sk-ant-api03-...\n");
}

// Memory file path
const MEMORY_FILE = process.env.MEMORY_FILE || "/workspace/MEMORY.md";
const WORKSPACE_DIR = process.env.WORKSPACE_DIR || "/workspace";

// =============================================================================
// Environment detection and URL selection
// =============================================================================

const NODE_ENV = process.env.NODE_ENV || "development";
const CONVEX_URL = process.env.CONVEX_URL || CONVEX_URLS[NODE_ENV as keyof typeof CONVEX_URLS] || CONVEX_URLS.development;

console.log(`🌍 Environment: ${NODE_ENV}`);
console.log(`🔗 Convex URL: ${CONVEX_URL}\n`);

// =============================================================================
// Credentials management - stores API key locally
// =============================================================================

const CREDENTIALS_FILE = path.join(import.meta.dirname, "../.bot-credentials.json");

interface BotCredentials {
  apiKey: string;
  username: string;
  userId: string;
  registeredAt: string;
}

function loadCredentials(): BotCredentials | null {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.warn("⚠️  Could not load credentials file:", error);
  }
  return null;
}

function saveCredentials(credentials: BotCredentials): void {
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  console.log(`💾 Credentials saved to ${CREDENTIALS_FILE}`);
}

async function registerBot(client: ConvexHttpClient): Promise<BotCredentials> {
  console.log(`📝 Registering new bot: @${BOT_CONFIG.username}...`);

  try {
    const result = await client.mutation(api.bots.registerBot, {
      username: BOT_CONFIG.username,
      name: BOT_CONFIG.name,
    });

    const credentials: BotCredentials = {
      apiKey: result.apiKey,
      username: result.username,
      userId: result.userId as string,
      registeredAt: new Date().toISOString(),
    };

    saveCredentials(credentials);

    console.log(`✅ Bot registered successfully!`);
    console.log(`   Username: @${credentials.username}`);
    console.log(`   User ID: ${credentials.userId}`);
    console.log(`   API Key: ${credentials.apiKey.slice(0, 20)}...`);
    console.log("");

    return credentials;
  } catch (error: unknown) {
    console.error(`❌ Failed to register bot:`, error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Username already taken")) {
      console.error(`\n   Bot username @${BOT_CONFIG.username} is already registered.`);
      console.error(`   Either delete the existing bot or change BOT_CONFIG.username in the code.`);
      console.error(`   If you already have credentials, place them in ${CREDENTIALS_FILE}`);
    }
    throw error;
  }
}

async function getOrRegisterCredentials(client: ConvexHttpClient): Promise<BotCredentials> {
  // First check environment variable
  const envApiKey = process.env.RUCKUS_BOT_API_KEY;
  if (envApiKey) {
    console.log("🔑 Using API key from RUCKUS_BOT_API_KEY environment variable");
    return {
      apiKey: envApiKey,
      username: BOT_CONFIG.username,
      userId: "unknown",
      registeredAt: "unknown",
    };
  }

  // Then check credentials file
  const existingCredentials = loadCredentials();
  if (existingCredentials) {
    console.log(`🔑 Loaded existing credentials for @${existingCredentials.username}`);
    return existingCredentials;
  }

  // Register new bot
  console.log("🆕 No existing credentials found. Registering new bot...\n");
  return registerBot(client);
}

// =============================================================================
// Claude Code Integration
// =============================================================================

function readMemory(): string {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      return fs.readFileSync(MEMORY_FILE, "utf-8");
    }
  } catch (error) {
    console.warn("⚠️  Could not read memory file:", error);
  }
  return "# Bot Memory\n\nNo previous memory found.";
}

function writeMemory(content: string): void {
  try {
    // Ensure the directory exists
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(MEMORY_FILE, content);
    console.log("💾 Memory updated");
  } catch (error) {
    console.error("❌ Failed to write memory:", error);
  }
}

/**
 * Append a message to the chat log section of MEMORY.md
 * This keeps a record of all messages sent to and from the bot
 */
function appendToChatLog(
  direction: "RECEIVED" | "SENT",
  channel: string,
  username: string,
  message: string
): void {
  try {
    const memory = readMemory();
    const timestamp = new Date().toISOString();
    const prefix = direction === "SENT" ? "BOT" : "IN";
    const logEntry = `[${timestamp}] ${prefix} #${channel} @${username}: ${message.replace(/\n/g, " ").slice(0, 500)}${message.length > 500 ? "..." : ""}`;

    // Find the Chat Log section and append to it
    const chatLogMarker = "## Chat Log";
    const markerIndex = memory.indexOf(chatLogMarker);

    if (markerIndex !== -1) {
      // Find where the Chat Log section content should go (after any comment lines)
      const afterMarker = memory.slice(markerIndex + chatLogMarker.length);
      const lines = afterMarker.split("\n");
      let insertIndex = markerIndex + chatLogMarker.length;

      // Skip past comment lines and empty lines at the start of the section
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("<!--") || line === "") {
          insertIndex += lines[i].length + 1; // +1 for newline
          // If we hit a closing comment, continue
          if (line.includes("-->") && !line.startsWith("<!--")) {
            continue;
          }
        } else if (line.startsWith("##")) {
          // Hit another section, stop here
          break;
        } else {
          // Found actual content, insert after comments
          break;
        }
      }

      // Insert the new log entry
      const newMemory = memory.slice(0, insertIndex) + "\n" + logEntry + memory.slice(insertIndex);
      writeMemory(newMemory);
      console.log(`📝 Chat log: ${prefix} @${username} in #${channel}`);
    } else {
      // No Chat Log section found, append one
      const newSection = `\n\n## Chat Log\n\n${logEntry}`;
      writeMemory(memory + newSection);
      console.log(`📝 Chat log (new section): ${prefix} @${username} in #${channel}`);
    }
  } catch (error) {
    console.error("⚠️  Failed to append to chat log:", error);
  }
}

// Stream event types from Claude CLI
interface StreamEvent {
  type: string;
  event?: {
    type: string;
    index?: number;
    delta?: {
      type: string;
      text?: string;
    };
  };
  result?: string;
}

// Callback for streaming text updates
type StreamCallback = (text: string, isDone: boolean) => Promise<void>;

async function runClaudeCodeStreaming(
  prompt: string,
  onUpdate: StreamCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "--model", "claude-opus-4-6",
      "--dangerously-skip-permissions",
      "-p",
      "--verbose",
      "--output-format", "stream-json",
      prompt,
    ];

    console.log("🤖 Running Claude CLI with streaming...");
    console.log("   Command: claude", args.slice(0, -1).join(" "), "\"<prompt>\"");

    const proc = spawn("claude", args, {
      cwd: WORKSPACE_DIR,
      env: {
        ...process.env,
        // Only set API key if provided, otherwise let CLI use its existing auth
        ...(ANTHROPIC_API_KEY ? { ANTHROPIC_API_KEY } : {}),
      },
      stdio: ["ignore", "pipe", "pipe"],  // Close stdin to prevent blocking
    });

    let fullText = "";
    let stderr = "";
    let lastUpdateTime = 0;
    let sentFinalUpdate = false;
    const UPDATE_THROTTLE_MS = 100; // Throttle updates to every 100ms

    // Create readline interface for line-by-line parsing
    const rl = readline.createInterface({
      input: proc.stdout,
      crlfDelay: Infinity,
    });

    rl.on("line", async (line) => {
      if (!line.trim()) return;

      try {
        const event = JSON.parse(line);

        // Debug: log event types we receive
        if (event.type) {
          console.log(`   [stream] Event type: ${event.type}`);
        }

        // Handle content_block_delta events (streaming text)
        // The Claude CLI stream-json format has different structures
        if (event.type === "content_block_delta") {
          const delta = event.delta;
          if (delta?.type === "text_delta" && delta?.text) {
            fullText += delta.text;
            console.log(`   [stream] Got text delta: "${delta.text.slice(0, 50)}..."`);

            // Throttle updates to reduce API calls
            const now = Date.now();
            if (now - lastUpdateTime >= UPDATE_THROTTLE_MS) {
              lastUpdateTime = now;
              try {
                await onUpdate(fullText, false);
              } catch (err) {
                console.error("   [stream] Error sending update:", err);
              }
            }
          }
        }

        // Handle assistant message events (may contain nested content)
        if (event.type === "assistant" && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === "text" && block.text) {
              fullText = block.text;
              console.log(`   [stream] Got assistant text: "${fullText.slice(0, 50)}..."`);
              // Update message with this content
              try {
                await onUpdate(fullText, false);
              } catch (err) {
                console.error("   [stream] Error sending update:", err);
              }
            }
          }
        }

        // Handle result event (final response)
        if (event.type === "result") {
          if (event.result) {
            fullText = event.result;
            console.log(`   [stream] Got result: "${fullText.slice(0, 50)}..."`);
            // Final update with result
            if (!sentFinalUpdate) {
              sentFinalUpdate = true;
              try {
                await onUpdate(fullText, true);
              } catch (err) {
                console.error("   [stream] Error sending final update:", err);
              }
            }
          }
        }
      } catch {
        // Might not be valid JSON, log for debugging
        console.log("   [claude] non-json line:", line.slice(0, 100));
      }
    });

    proc.stderr.on("data", (data) => {
      const str = data.toString();
      stderr += str;
      // Log all stderr for debugging (verbose mode output goes here)
      const lines = str.trim().split("\n");
      for (const line of lines) {
        if (line.trim()) {
          console.log("   [claude stderr]", line.slice(0, 150));
        }
      }
    });

    proc.on("close", async (code) => {
      console.log(`   [claude] exited with code ${code}`);

      // Send final update if not already sent via result event
      if (fullText && !sentFinalUpdate) {
        sentFinalUpdate = true;
        try {
          await onUpdate(fullText, true);
        } catch (err) {
          console.error("   [stream] Error sending final update:", err);
        }
      }

      if (code === 0) {
        resolve(fullText.trim());
      } else {
        console.error("Claude CLI stderr:", stderr);
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (error) => {
      console.error("   [claude] spawn error:", error);
      reject(error);
    });

    // Timeout after 120 seconds (streaming can take longer)
    setTimeout(() => {
      proc.kill();
      reject(new Error("Claude CLI timed out after 120 seconds"));
    }, 120000);
  });
}

// Non-streaming fallback (for simple responses)
async function runClaudeCode(prompt: string): Promise<string> {
  return runClaudeCodeStreaming(prompt, async () => { });
}

async function generateAIResponseStreaming(
  username: string,
  message: string,
  channelName: string,
  onUpdate: StreamCallback
): Promise<string> {
  const memory = readMemory();

  const prompt = `You are a helpful AI assistant bot in the Ruckus chat application. You're responding to a message from @${username} in the #${channelName} channel.

Here is your persistent memory from previous conversations:
<memory>
${memory}
</memory>

The user's message (after removing the @mention of you):
"${message}"

Instructions:
1. First, read your MEMORY.md file to recall any relevant context about this user or topic.
2. Respond helpfully and concisely to the user's message. Keep responses under 500 characters when possible.
3. If you learn something new about the user or the conversation that's worth remembering, update MEMORY.md (but NOT the "## Chat Log" section - that is automatically maintained by the bot system).
4. Be friendly, helpful, and conversational.
5. If the user asks you to do something you can't do (like access external websites), politely explain your limitations.
6. Address the user as @${username} in your response.

Respond with ONLY the message to send back to the user. Do not include any other text or explanation.`;

  try {
    const response = await runClaudeCodeStreaming(prompt, onUpdate);
    return response || `Sorry @${username}, I couldn't generate a response. Please try again.`;
  } catch (error) {
    console.error("Error running Claude CLI:", error);
    return `Sorry @${username}, I encountered an error while processing your message. Please try again later.`;
  }
}

// Non-streaming version for backward compatibility
async function generateAIResponse(
  username: string,
  message: string,
  channelName: string
): Promise<string> {
  return generateAIResponseStreaming(username, message, channelName, async () => { });
}

// Types for the bot
interface BotInfo {
  botId: Id<"users">;
  username: string;
  avatarColor: string;
}

interface Mention {
  messageId: Id<"messages">;
  channelId?: Id<"channels">;  // Optional - undefined for DM mentions
  channelName?: string;        // Optional - undefined for DM mentions
  text: string;
  senderId: Id<"users">;
  senderUsername: string;
  parentMessageId?: Id<"messages">;
  createdAt: number;
}

interface DirectMessage {
  messageId: Id<"messages">;
  conversationId: Id<"conversations">;
  text: string;
  senderId: Id<"users">;
  senderUsername: string;
  parentMessageId?: Id<"messages">;
  createdAt: number;
}

interface Channel {
  channelId: Id<"channels">;
  name: string;
  topic?: string;
}

interface Conversation {
  conversationId: Id<"conversations">;
  createdAt: number;
  lastMessageTime: number | undefined;
  otherUser: {
    userId: Id<"users">;
    username: string;
    avatarColor: string;
    isBot?: boolean;
  } | null;
}

/**
 * RuckusBot - A simple bot that responds to mentions and DMs
 */
class RuckusBot {
  private client: ConvexHttpClient;
  private apiKey: string;
  private botInfo: BotInfo | null = null;
  private lastSeenTimestamp: number;
  private lastSeenDMTimestamp: number;
  private pollInterval?: ReturnType<typeof setInterval>;
  private dmPollInterval?: ReturnType<typeof setInterval>;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private processedMentions = new Set<string>();
  private processedDMs = new Set<string>();
  private isRunning = false;

  constructor(convexUrl: string, apiKey: string) {
    this.client = new ConvexHttpClient(convexUrl);
    this.apiKey = apiKey;
    this.lastSeenTimestamp = Date.now();
    this.lastSeenDMTimestamp = Date.now();
  }

  /**
   * Start the bot - authenticate and begin listening for mentions and DMs
   */
  async start(): Promise<void> {
    console.log("🤖 Starting Ruckus bot...\n");

    // Authenticate with the API key
    this.botInfo = await this.client.query(api.bots.authenticateBot, {
      apiKey: this.apiKey,
    });

    if (!this.botInfo) {
      throw new Error("Invalid API key - could not authenticate");
    }

    console.log(`✅ Authenticated as @${this.botInfo.username}`);
    console.log(`   Bot ID: ${this.botInfo.botId}`);
    console.log("");

    // List available channels
    const channels = await this.getChannels();
    console.log("📢 Available channels:");
    for (const channel of channels) {
      console.log(`   #${channel.name} (${channel.channelId})`);
    }
    console.log("");

    // List existing conversations
    const conversations = await this.getConversations();
    if (conversations.length > 0) {
      console.log("💬 Existing DM conversations:");
      for (const conv of conversations) {
        if (conv.otherUser) {
          console.log(`   @${conv.otherUser.username} (${conv.conversationId})`);
        }
      }
      console.log("");
    }

    // Start heartbeat to show as online
    this.startHeartbeat();

    // Start polling for mentions and DMs
    console.log("👂 Polling for @mentions and DMs every 2 seconds...\n");
    this.isRunning = true;
    this.startPolling();
    this.startDMPolling();
  }

  /**
   * Send heartbeat to show bot as online
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      await this.client.mutation(api.bots.heartbeatAsBot, {
        apiKey: this.apiKey,
      });
    } catch (error) {
      console.error("Error sending heartbeat:", error);
    }
  }

  /**
   * Start periodic heartbeat (every 30 seconds)
   */
  private startHeartbeat(): void {
    // Send initial heartbeat
    this.sendHeartbeat();
    console.log("💚 Bot is now online\n");

    // Send heartbeat every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      if (this.isRunning) {
        this.sendHeartbeat();
      }
    }, 30000);
  }

  /**
   * Get all available channels
   */
  async getChannels(): Promise<Channel[]> {
    return this.client.query(api.bots.getChannelsAsBot, {
      apiKey: this.apiKey,
    });
  }

  /**
   * Get all DM conversations
   */
  async getConversations(): Promise<Conversation[]> {
    return this.client.query(api.bots.getConversationsAsBot, {
      apiKey: this.apiKey,
    });
  }

  /**
   * Start polling for mentions
   */
  private startPolling(): void {
    // Poll immediately, then every 2 seconds
    this.pollForMentions();
    this.pollInterval = setInterval(() => {
      if (this.isRunning) {
        this.pollForMentions();
      }
    }, 2000);
  }

  /**
   * Start polling for DMs
   */
  private startDMPolling(): void {
    // Poll immediately, then every 2 seconds
    this.pollForDMs();
    this.dmPollInterval = setInterval(() => {
      if (this.isRunning) {
        this.pollForDMs();
      }
    }, 2000);
  }

  /**
   * Poll for new mentions
   */
  private async pollForMentions(): Promise<void> {
    try {
      const mentions = await this.client.query(api.bots.getMentionsAsBot, {
        apiKey: this.apiKey,
        since: this.lastSeenTimestamp,
      });
      await this.handleMentions(mentions);
    } catch (error) {
      console.error("Error polling for mentions:", error);
    }
  }

  /**
   * Poll for new DMs
   */
  private async pollForDMs(): Promise<void> {
    try {
      const messages = await this.client.query(api.bots.getDirectMessagesAsBot, {
        apiKey: this.apiKey,
        since: this.lastSeenDMTimestamp,
      });
      await this.handleDMs(messages);
    } catch (error) {
      console.error("Error polling for DMs:", error);
    }
  }

  /**
   * Handle incoming mentions
   */
  private async handleMentions(mentions: Mention[]): Promise<void> {
    for (const mention of mentions) {
      // Skip DM mentions - they're handled by pollForDMs instead
      if (!mention.channelId || !mention.channelName) {
        continue;
      }

      // Skip if already processed or too old
      if (
        mention.createdAt <= this.lastSeenTimestamp ||
        this.processedMentions.has(mention.messageId)
      ) {
        continue;
      }

      // Mark as processed
      this.processedMentions.add(mention.messageId);

      console.log(`📩 New mention from @${mention.senderUsername} in #${mention.channelName}`);
      console.log(`   Message: "${mention.text}"`);

      try {
        await this.respondToMention(mention);
      } catch (error) {
        console.error(`   ❌ Error responding:`, error);
      }

      // Update last seen timestamp
      this.lastSeenTimestamp = Math.max(this.lastSeenTimestamp, mention.createdAt);
    }

    // Clean up old processed mentions (keep last 1000)
    if (this.processedMentions.size > 1000) {
      const arr = Array.from(this.processedMentions);
      this.processedMentions = new Set(arr.slice(-500));
    }
  }

  /**
   * Handle incoming DMs
   */
  private async handleDMs(messages: DirectMessage[]): Promise<void> {
    for (const msg of messages) {
      // Skip if already processed or too old
      if (
        msg.createdAt <= this.lastSeenDMTimestamp ||
        this.processedDMs.has(msg.messageId)
      ) {
        continue;
      }

      // Mark as processed
      this.processedDMs.add(msg.messageId);

      console.log(`💬 New DM from @${msg.senderUsername}`);
      console.log(`   Message: "${msg.text}"`);

      try {
        await this.respondToDM(msg);
      } catch (error) {
        console.error(`   ❌ Error responding to DM:`, error);
      }

      // Update last seen timestamp
      this.lastSeenDMTimestamp = Math.max(this.lastSeenDMTimestamp, msg.createdAt);
    }

    // Clean up old processed DMs (keep last 1000)
    if (this.processedDMs.size > 1000) {
      const arr = Array.from(this.processedDMs);
      this.processedDMs = new Set(arr.slice(-500));
    }
  }

  /**
   * Respond to a mention using Claude CLI with streaming
   * Note: This method expects channel mentions only (not DM mentions)
   */
  private async respondToMention(mention: Mention): Promise<void> {
    // Type guard: ensure this is a channel mention (not a DM)
    if (!mention.channelId || !mention.channelName) {
      console.error("   ⚠️  Skipping DM mention - use pollForDMs instead");
      return;
    }

    const channelId = mention.channelId;
    const channelName = mention.channelName;

    // Log the incoming message to chat history
    appendToChatLog(
      "RECEIVED",
      channelName,
      mention.senderUsername,
      mention.text
    );

    // Show typing indicator while waiting for response
    await this.setTyping(channelId);

    // Keep typing indicator alive with periodic refresh
    const typingInterval = setInterval(() => {
      this.setTyping(channelId).catch(() => { });
    }, 3000);

    try {
      // Extract the message content (remove the @mention)
      const botUsername = this.botInfo!.username;
      const messageText = mention.text
        .replace(new RegExp(`@${botUsername}\\b`, "gi"), "")
        .trim();

      // Track message state - don't create message until we have enough text
      let messageId: Id<"messages"> | null = null;
      let isCreatingMessage = false;  // Guard against concurrent creation
      const MIN_TEXT_LENGTH = 10;

      // Generate AI response with streaming updates
      const response = await generateAIResponseStreaming(
        mention.senderUsername,
        messageText,
        channelName,
        async (text: string, isDone: boolean) => {
          // Only create/update message once we have enough text or we're done
          if (text.length >= MIN_TEXT_LENGTH || isDone) {
            const displayText = isDone ? text : text + " ▌";

            if (!messageId && !isCreatingMessage) {
              // Set guard before async operation to prevent concurrent creation
              isCreatingMessage = true;

              // Create the message for the first time
              clearInterval(typingInterval);
              await this.clearTyping(channelId).catch(() => { });

              const result = await this.sendMessage(
                channelId,
                displayText,
                mention.messageId
              );
              messageId = result.messageId;
              console.log(`   📝 Created streaming message: ${messageId}`);
            } else if (messageId) {
              // Update existing message
              try {
                await this.updateMessage(messageId, displayText);
                if (!isDone) {
                  process.stdout.write(".");  // Progress indicator
                }
              } catch (err) {
                console.error("\n   ⚠️  Failed to update message:", err);
              }
            }
            // If !messageId && isCreatingMessage, skip - another handler is creating it
          }
        }
      );

      // If we never created a message (response was very short), create it now
      // Also check isCreatingMessage in case a creation is still in flight
      if (!messageId && !isCreatingMessage) {
        clearInterval(typingInterval);
        await this.clearTyping(channelId).catch(() => { });
        await this.sendMessage(channelId, response, mention.messageId);
      }

      // Log the outgoing response to chat history
      appendToChatLog(
        "SENT",
        channelName,
        this.botInfo!.username,
        response
      );

      console.log(`\n   ✅ Responded to @${mention.senderUsername}\n`);
    } catch (error) {
      clearInterval(typingInterval);
      console.error(`   ❌ Error responding:`, error);
      await this.clearTyping(channelId).catch(() => { });
      throw error;
    }
  }

  /**
   * Respond to a DM using Claude CLI with streaming
   */
  private async respondToDM(dm: DirectMessage): Promise<void> {
    // Log the incoming message to chat history
    appendToChatLog(
      "RECEIVED",
      `DM:${dm.senderUsername}`,
      dm.senderUsername,
      dm.text
    );

    // Show typing indicator while waiting for response
    await this.setTypingInConversation(dm.conversationId);

    // Keep typing indicator alive with periodic refresh
    const typingInterval = setInterval(() => {
      this.setTypingInConversation(dm.conversationId).catch(() => { });
    }, 3000);

    try {
      // For DMs, we use the full message text (no @mention to remove)
      const messageText = dm.text.trim();

      // Track message state - don't create message until we have enough text
      let messageId: Id<"messages"> | null = null;
      let isCreatingMessage = false;  // Guard against concurrent creation
      const MIN_TEXT_LENGTH = 10;

      // Generate AI response with streaming updates
      const response = await generateAIResponseStreaming(
        dm.senderUsername,
        messageText,
        `DM with ${dm.senderUsername}`,
        async (text: string, isDone: boolean) => {
          // Only create/update message once we have enough text or we're done
          if (text.length >= MIN_TEXT_LENGTH || isDone) {
            const displayText = isDone ? text : text + " ▌";

            if (!messageId && !isCreatingMessage) {
              // Set guard before async operation to prevent concurrent creation
              isCreatingMessage = true;

              // Create the message for the first time
              clearInterval(typingInterval);
              await this.clearTypingInConversation(dm.conversationId).catch(() => { });

              const result = await this.sendDM(
                dm.conversationId,
                displayText,
                dm.messageId
              );
              messageId = result.messageId;
              console.log(`   📝 Created streaming DM: ${messageId}`);
            } else if (messageId) {
              // Update existing message
              try {
                await this.updateMessage(messageId, displayText);
                if (!isDone) {
                  process.stdout.write(".");  // Progress indicator
                }
              } catch (err) {
                console.error("\n   ⚠️  Failed to update DM:", err);
              }
            }
            // If !messageId && isCreatingMessage, skip - another handler is creating it
          }
        }
      );

      // If we never created a message (response was very short), create it now
      // Also check isCreatingMessage in case a creation is still in flight
      if (!messageId && !isCreatingMessage) {
        clearInterval(typingInterval);
        await this.clearTypingInConversation(dm.conversationId).catch(() => { });
        await this.sendDM(dm.conversationId, response, dm.messageId);
      }

      // Log the outgoing response to chat history
      appendToChatLog(
        "SENT",
        `DM:${dm.senderUsername}`,
        this.botInfo!.username,
        response
      );

      console.log(`\n   ✅ Responded to DM from @${dm.senderUsername}\n`);
    } catch (error) {
      clearInterval(typingInterval);
      console.error(`   ❌ Error responding to DM:`, error);
      await this.clearTypingInConversation(dm.conversationId).catch(() => { });
      throw error;
    }
  }

  /**
   * Send a message to a channel (with optional reply reference shown in main chat)
   */
  async sendMessage(
    channelId: Id<"channels">,
    text: string,
    replyToMessageId?: Id<"messages">
  ): Promise<{ messageId: Id<"messages"> }> {
    return this.client.mutation(api.bots.sendMessageAsBot, {
      apiKey: this.apiKey,
      channelId,
      text,
      replyToMessageId,
    });
  }

  /**
   * Update an existing message (for streaming)
   */
  async updateMessage(
    messageId: Id<"messages">,
    text: string
  ): Promise<void> {
    await this.client.mutation(api.bots.updateMessageAsBot, {
      apiKey: this.apiKey,
      messageId,
      text,
    });
  }

  /**
   * Set typing indicator in a channel
   */
  async setTyping(channelId: Id<"channels">): Promise<void> {
    await this.client.mutation(api.bots.setTypingAsBot, {
      apiKey: this.apiKey,
      channelId,
    });
  }

  /**
   * Clear typing indicator in a channel
   */
  async clearTyping(channelId: Id<"channels">): Promise<void> {
    await this.client.mutation(api.bots.clearTypingAsBot, {
      apiKey: this.apiKey,
      channelId,
    });
  }

  /**
   * Send a DM to a conversation (with optional reply reference)
   */
  async sendDM(
    conversationId: Id<"conversations">,
    text: string,
    replyToMessageId?: Id<"messages">
  ): Promise<{ messageId: Id<"messages"> }> {
    return this.client.mutation(api.bots.sendMessageToConversationAsBot, {
      apiKey: this.apiKey,
      conversationId,
      text,
      replyToMessageId,
    });
  }

  /**
   * Set typing indicator in a conversation
   */
  async setTypingInConversation(conversationId: Id<"conversations">): Promise<void> {
    await this.client.mutation(api.bots.setTypingInConversationAsBot, {
      apiKey: this.apiKey,
      conversationId,
    });
  }

  /**
   * Clear typing indicator in a conversation
   */
  async clearTypingInConversation(conversationId: Id<"conversations">): Promise<void> {
    await this.client.mutation(api.bots.clearTypingInConversationAsBot, {
      apiKey: this.apiKey,
      conversationId,
    });
  }

  /**
   * Stop the bot and clean up
   */
  async stop(): Promise<void> {
    console.log("\n🛑 Stopping bot...");
    this.isRunning = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
    if (this.dmPollInterval) {
      clearInterval(this.dmPollInterval);
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Mark bot as offline immediately
    try {
      await this.client.mutation(api.bots.goOfflineAsBot, {
        apiKey: this.apiKey,
      });
      console.log("📴 Bot marked as offline");
    } catch (error) {
      console.error("⚠️  Failed to mark bot as offline:", error);
    }

    console.log("👋 Goodbye!");
  }
}

// Main entry point
async function main(): Promise<void> {
  // Create a client for registration
  const setupClient = new ConvexHttpClient(CONVEX_URL);

  // Get or register credentials
  let credentials: BotCredentials;
  try {
    credentials = await getOrRegisterCredentials(setupClient);
  } catch {
    process.exit(1);
  }

  // Create the bot with the credentials
  const bot = new RuckusBot(CONVEX_URL, credentials.apiKey);

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await bot.stop();
    process.exit(0);
  });

  try {
    await bot.start();

    // Keep the process running
    console.log("Press Ctrl+C to stop the bot.\n");
  } catch (error) {
    console.error("Failed to start bot:", error);
    process.exit(1);
  }
}

main();
