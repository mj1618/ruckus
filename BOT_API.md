# Ruckus Bot API (MOLT)

MOLT (Mentions, Operations, Listening, Typing) is the HTTP API for building bots that integrate with Ruckus chat.

## Overview

Bots can:
- Register and authenticate with API keys
- Poll for @mentions or receive real-time webhook notifications
- Show typing indicators while processing
- Post messages with text and file attachments
- Reply to messages in threads

## Base URL

```
https://your-deployment.convex.site/api/bots
```

Replace `your-deployment` with your actual Convex deployment URL.

## Authentication

All API requests require an API key passed in the `Authorization` header:

```
Authorization: Bearer ruckus_bot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

API keys are generated when registering a bot and are only shown once. Store them securely.

## Bot Registration

Bots are registered via the Convex dashboard or programmatically through a mutation. Bot usernames **must** end with `_bot` (e.g., `helper_bot`, `translator_bot`).

```typescript
// Using Convex client (admin/setup only)
import { api } from "./convex/_generated/api";

const result = await client.mutation(api.bots.registerBot, {
  username: "myhelper_bot",
  name: "My Helper Bot",
});

// Returns: { userId, username, apiKey }
// SAVE THE API KEY - it's only shown once!
```

## Endpoints

### Get Bot Info

```http
GET /api/bots/me
Authorization: Bearer <api_key>
```

Returns information about the authenticated bot.

**Response:**
```json
{
  "userId": "j57a8v3kx9...",
  "username": "helper_bot",
  "avatarColor": "#3b82f6",
  "createdAt": 1707753600000,
  "lastApiCall": 1707840000000,
  "webhook": {
    "url": "https://example.com/webhook",
    "createdAt": 1707760000000
  }
}
```

---

### List Channels

```http
GET /api/bots/channels
Authorization: Bearer <api_key>
```

Returns all available channels the bot can post to.

**Response:**
```json
{
  "channels": [
    {
      "channelId": "j57a8v3kx9...",
      "name": "general",
      "topic": "General discussion"
    },
    {
      "channelId": "k68b9w4ly0...",
      "name": "random",
      "topic": null
    }
  ]
}
```

---

### Poll for Mentions

```http
GET /api/bots/mentions?since={timestamp}&limit={n}
Authorization: Bearer <api_key>
```

Returns messages that mention the bot since the given timestamp.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `since` | number | Yes | Unix timestamp in milliseconds. Returns mentions after this time. |
| `limit` | number | No | Maximum number of mentions to return (default: 50, max: 100) |

**Response:**
```json
{
  "mentions": [
    {
      "messageId": "m12345...",
      "channelId": "j57a8v3kx9...",
      "channelName": "general",
      "text": "Hey @helper_bot can you help with this?",
      "senderId": "u98765...",
      "senderUsername": "alice",
      "parentMessageId": null,
      "createdAt": 1707840000000
    }
  ]
}
```

**Example polling loop (Python):**
```python
import requests
import time

API_KEY = "ruckus_bot_xxx..."
BASE_URL = "https://your-deployment.convex.site/api/bots"
last_check = int(time.time() * 1000)  # Current time in ms

while True:
    response = requests.get(
        f"{BASE_URL}/mentions",
        params={"since": last_check},
        headers={"Authorization": f"Bearer {API_KEY}"}
    )
    
    data = response.json()
    for mention in data["mentions"]:
        print(f"Mentioned by {mention['senderUsername']}: {mention['text']}")
        # Process mention...
        last_check = max(last_check, mention["createdAt"])
    
    time.sleep(2)  # Poll every 2 seconds
```

---

### Register Webhook (Real-time Notifications)

```http
POST /api/bots/webhooks
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "url": "https://your-server.com/webhook"
}
```

Registers a webhook URL to receive real-time mention notifications. Each bot can have one webhook. Registering a new URL replaces the existing one.

**Response:**
```json
{
  "message": "Webhook registered",
  "secret": "whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Important:** Save the `secret` - it's used to verify webhook payloads and is only shown once.

#### Webhook Payload

When your bot is mentioned, a POST request is sent to your webhook URL:

```json
{
  "event": "mention",
  "data": {
    "messageId": "m12345...",
    "channelId": "j57a8v3kx9...",
    "channelName": "general",
    "text": "Hey @helper_bot can you help?",
    "senderId": "u98765...",
    "senderUsername": "alice",
    "parentMessageId": null,
    "createdAt": 1707840000000
  },
  "timestamp": 1707840001000
}
```

**Headers:**
| Header | Description |
|--------|-------------|
| `X-Ruckus-Signature` | HMAC-SHA256 signature of the payload using your webhook secret |
| `X-Ruckus-Bot` | Your bot's username |

#### Verifying Webhook Signatures

```python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)

# In your webhook handler:
@app.post("/webhook")
async def handle_webhook(request: Request):
    payload = await request.body()
    signature = request.headers.get("X-Ruckus-Signature")
    
    if not verify_signature(payload, signature, WEBHOOK_SECRET):
        return Response(status_code=401)
    
    data = json.loads(payload)
    # Process mention...
```

---

### Remove Webhook

```http
DELETE /api/bots/webhooks
Authorization: Bearer <api_key>
```

Removes the registered webhook. Bot will need to poll for mentions instead.

**Response:**
```json
{
  "message": "Webhook removed"
}
```

---

### Set Typing Indicator

```http
POST /api/bots/typing
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "channelId": "j57a8v3kx9..."
}
```

Shows that the bot is typing in the specified channel. The indicator automatically expires after 3 seconds, so call this endpoint repeatedly while processing.

**Response:**
```json
{
  "message": "Typing indicator set"
}
```

**Example (Python):**
```python
import threading
import time

def keep_typing(channel_id, stop_event):
    while not stop_event.is_set():
        requests.post(
            f"{BASE_URL}/typing",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={"channelId": channel_id}
        )
        time.sleep(2)

# Start typing indicator
stop_typing = threading.Event()
typing_thread = threading.Thread(target=keep_typing, args=(channel_id, stop_typing))
typing_thread.start()

# Do your processing...
response = generate_response(mention)

# Stop typing and send message
stop_typing.set()
typing_thread.join()
```

---

### Clear Typing Indicator

```http
DELETE /api/bots/typing
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "channelId": "j57a8v3kx9..."
}
```

Explicitly clears the typing indicator. This is optional since indicators auto-expire, but useful for immediate feedback.

**Response:**
```json
{
  "message": "Typing indicator cleared"
}
```

---

### Post Message

```http
POST /api/bots/messages
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "channelId": "j57a8v3kx9...",
  "text": "Hello! I'm here to help.",
  "parentMessageId": "m12345..."  // Optional: reply in thread
}
```

Posts a message to a channel. If `parentMessageId` is provided, the message is posted as a reply in that thread.

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| `channelId` | string | Yes | Target channel ID |
| `text` | string | No* | Message text (max 4000 chars) |
| `parentMessageId` | string | No | Message ID to reply to (creates thread reply) |
| `attachments` | array | No* | File attachments (see below) |

*Either `text` or `attachments` must be provided.

**Response:**
```json
{
  "messageId": "m67890..."
}
```

**Supported slash commands:**
- `/me <action>` - Posts an action message (e.g., "/me waves hello")
- `/shrug [text]` - Appends ¯\\_(ツ)_/¯ to the message

---

### Upload File Attachment

To send file attachments, first get an upload URL, upload the file, then include the storage ID in your message.

#### Step 1: Get Upload URL

```http
POST /api/bots/upload-url
Authorization: Bearer <api_key>
```

**Response:**
```json
{
  "uploadUrl": "https://upload.convex.dev/..."
}
```

#### Step 2: Upload File

```http
POST {uploadUrl}
Content-Type: <mime-type>

<file binary data>
```

**Response:**
```json
{
  "storageId": "kg1234..."
}
```

#### Step 3: Send Message with Attachment

```http
POST /api/bots/messages
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "channelId": "j57a8v3kx9...",
  "text": "Here's the file you requested:",
  "attachments": [
    {
      "storageId": "kg1234...",
      "filename": "report.pdf",
      "contentType": "application/pdf",
      "size": 102400
    }
  ]
}
```

**Attachment limits:**
- Maximum 5 attachments per message
- Maximum 10MB per file
- Supported types: images (jpeg, png, gif, webp, svg), documents (pdf, txt, md), archives (zip)

**Example (Python):**
```python
# Get upload URL
response = requests.post(
    f"{BASE_URL}/upload-url",
    headers={"Authorization": f"Bearer {API_KEY}"}
)
upload_url = response.json()["uploadUrl"]

# Upload file
with open("report.pdf", "rb") as f:
    response = requests.post(
        upload_url,
        headers={"Content-Type": "application/pdf"},
        data=f.read()
    )
storage_id = response.json()["storageId"]

# Send message with attachment
requests.post(
    f"{BASE_URL}/messages",
    headers={"Authorization": f"Bearer {API_KEY}"},
    json={
        "channelId": channel_id,
        "text": "Here's your report:",
        "attachments": [{
            "storageId": storage_id,
            "filename": "report.pdf",
            "contentType": "application/pdf",
            "size": os.path.getsize("report.pdf")
        }]
    }
)
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters or request body |
| 401 | Unauthorized - Missing or invalid API key |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Complete Bot Example

Here's a complete example of a bot that responds to mentions:

```python
import requests
import time
import threading
import os

API_KEY = os.environ["RUCKUS_BOT_API_KEY"]
BASE_URL = "https://your-deployment.convex.site/api/bots"

def send_typing(channel_id: str, duration: float):
    """Show typing indicator for the specified duration."""
    end_time = time.time() + duration
    while time.time() < end_time:
        requests.post(
            f"{BASE_URL}/typing",
            headers={"Authorization": f"Bearer {API_KEY}"},
            json={"channelId": channel_id}
        )
        time.sleep(2)

def send_message(channel_id: str, text: str, parent_id: str = None):
    """Send a message to a channel."""
    payload = {"channelId": channel_id, "text": text}
    if parent_id:
        payload["parentMessageId"] = parent_id
    
    response = requests.post(
        f"{BASE_URL}/messages",
        headers={"Authorization": f"Bearer {API_KEY}"},
        json=payload
    )
    return response.json()

def handle_mention(mention: dict):
    """Process a mention and respond."""
    channel_id = mention["channelId"]
    message_id = mention["messageId"]
    text = mention["text"]
    sender = mention["senderUsername"]
    
    print(f"Mentioned by {sender}: {text}")
    
    # Start typing indicator in background
    typing_thread = threading.Thread(
        target=send_typing,
        args=(channel_id, 3)
    )
    typing_thread.start()
    
    # Generate response (replace with your logic)
    response_text = f"Hi @{sender}! You said: {text}"
    
    # Wait for typing to finish, then send response
    typing_thread.join()
    send_message(channel_id, response_text, message_id)

def main():
    """Main polling loop."""
    last_check = int(time.time() * 1000)
    
    print("Bot started, listening for mentions...")
    
    while True:
        try:
            response = requests.get(
                f"{BASE_URL}/mentions",
                params={"since": last_check},
                headers={"Authorization": f"Bearer {API_KEY}"}
            )
            
            if response.status_code == 200:
                data = response.json()
                for mention in data["mentions"]:
                    handle_mention(mention)
                    last_check = max(last_check, mention["createdAt"])
            else:
                print(f"Error: {response.status_code}")
        
        except Exception as e:
            print(f"Error: {e}")
        
        time.sleep(2)

if __name__ == "__main__":
    main()
```

---

## Rate Limits

Currently, there are no enforced rate limits, but please be considerate:
- Poll for mentions no more than once per second
- Avoid sending more than 10 messages per minute
- Use webhooks or Convex subscriptions for real-time notifications when possible

---

## Convex TypeScript Client (Node.js)

For Node.js/TypeScript bots, you can use the Convex client directly instead of the HTTP API. This provides:
- **Real-time subscriptions** - Listen for mentions instantly without polling
- **Type safety** - Full TypeScript types for all API calls
- **Lower latency** - Direct connection to Convex backend

### Installation

```bash
npm install convex
```

### Setup

```typescript
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api";

const client = new ConvexClient("https://your-deployment.convex.cloud");
const API_KEY = process.env.RUCKUS_BOT_API_KEY!;
```

**Note:** Copy the `convex/_generated` folder from the Ruckus project to your bot's project, or generate it by running `npx convex dev` with the same `convex.json` configuration.

### Authenticate Bot

```typescript
const botInfo = await client.query(api.bots.authenticateBot, {
  apiKey: API_KEY,
});

if (!botInfo) {
  throw new Error("Invalid API key");
}

console.log(`Authenticated as ${botInfo.username} (${botInfo.botId})`);
```

### Get Channels

```typescript
const channels = await client.query(api.bots.getChannelsAsBot, {
  apiKey: API_KEY,
});

for (const channel of channels) {
  console.log(`#${channel.name}: ${channel.channelId}`);
}
```

### Get Messages from a Channel

```typescript
const messages = await client.query(api.bots.getChannelMessagesAsBot, {
  apiKey: API_KEY,
  channelId: "j57a8v3kx9...",
  limit: 50,  // Optional, default 50, max 200
});

for (const msg of messages) {
  console.log(`[${msg.senderUsername}]: ${msg.text}`);
}
```

### Subscribe to Messages (Real-time)

```typescript
// Subscribe to channel messages - callback fires on every change
const unsubscribe = client.onUpdate(
  api.bots.getChannelMessagesAsBot,
  { apiKey: API_KEY, channelId: "j57a8v3kx9..." },
  (messages) => {
    console.log(`Channel now has ${messages.length} messages`);
    const latest = messages[messages.length - 1];
    if (latest) {
      console.log(`Latest: [${latest.senderUsername}]: ${latest.text}`);
    }
  }
);

// Later: stop listening
unsubscribe();
```

### Subscribe to Mentions (Real-time)

This is the recommended way to listen for @mentions of your bot:

```typescript
let lastSeenTimestamp = Date.now();

const unsubscribe = client.onUpdate(
  api.bots.getMentionsAsBot,
  { apiKey: API_KEY, since: lastSeenTimestamp },
  (mentions) => {
    for (const mention of mentions) {
      // Skip if we've already processed this mention
      if (mention.createdAt <= lastSeenTimestamp) continue;
      
      console.log(`Mentioned by @${mention.senderUsername} in #${mention.channelName}`);
      console.log(`Message: ${mention.text}`);
      
      // Process the mention...
      handleMention(mention);
      
      // Update timestamp to avoid reprocessing
      lastSeenTimestamp = Math.max(lastSeenTimestamp, mention.createdAt);
    }
  }
);
```

### Send a Message

```typescript
const result = await client.mutation(api.bots.sendMessageAsBot, {
  apiKey: API_KEY,
  channelId: "j57a8v3kx9...",
  text: "Hello from my bot!",
});

console.log(`Sent message: ${result.messageId}`);
```

### Reply to a Message (Thread)

```typescript
await client.mutation(api.bots.sendMessageAsBot, {
  apiKey: API_KEY,
  channelId: "j57a8v3kx9...",
  text: "This is a thread reply!",
  parentMessageId: "m12345...",  // The message to reply to
});
```

### Set Typing Indicator

```typescript
// Start typing
await client.mutation(api.bots.setTypingAsBot, {
  apiKey: API_KEY,
  channelId: "j57a8v3kx9...",
});

// Typing indicator expires after 3 seconds
// Call repeatedly while processing

// Clear typing when done
await client.mutation(api.bots.clearTypingAsBot, {
  apiKey: API_KEY,
  channelId: "j57a8v3kx9...",
});
```

### Complete Bot Example (TypeScript)

```typescript
import { ConvexClient } from "convex/browser";
import { api } from "./convex/_generated/api";
import { Id } from "./convex/_generated/dataModel";

const API_KEY = process.env.RUCKUS_BOT_API_KEY!;
const CONVEX_URL = process.env.CONVEX_URL!;

interface Mention {
  messageId: Id<"messages">;
  channelId: Id<"channels">;
  channelName: string;
  text: string;
  senderId: Id<"users">;
  senderUsername: string;
  parentMessageId?: Id<"messages">;
  createdAt: number;
}

class RuckusBot {
  private client: ConvexClient;
  private apiKey: string;
  private lastSeenTimestamp: number;
  private unsubscribe?: () => void;

  constructor(convexUrl: string, apiKey: string) {
    this.client = new ConvexClient(convexUrl);
    this.apiKey = apiKey;
    this.lastSeenTimestamp = Date.now();
  }

  async start() {
    // Verify authentication
    const botInfo = await this.client.query(api.bots.authenticateBot, {
      apiKey: this.apiKey,
    });

    if (!botInfo) {
      throw new Error("Invalid API key");
    }

    console.log(`🤖 Bot started as @${botInfo.username}`);

    // Subscribe to mentions
    this.unsubscribe = this.client.onUpdate(
      api.bots.getMentionsAsBot,
      { apiKey: this.apiKey, since: this.lastSeenTimestamp },
      (mentions) => this.handleMentions(mentions)
    );
  }

  private async handleMentions(mentions: Mention[]) {
    for (const mention of mentions) {
      if (mention.createdAt <= this.lastSeenTimestamp) continue;

      console.log(`📩 Mentioned by @${mention.senderUsername}: ${mention.text}`);

      try {
        await this.respondToMention(mention);
      } catch (error) {
        console.error("Error responding to mention:", error);
      }

      this.lastSeenTimestamp = Math.max(this.lastSeenTimestamp, mention.createdAt);
    }
  }

  private async respondToMention(mention: Mention) {
    // Show typing indicator
    await this.client.mutation(api.bots.setTypingAsBot, {
      apiKey: this.apiKey,
      channelId: mention.channelId,
    });

    // Simulate processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate response (replace with your logic)
    const response = `Hi @${mention.senderUsername}! You said: "${mention.text}"`;

    // Send response as a thread reply
    await this.client.mutation(api.bots.sendMessageAsBot, {
      apiKey: this.apiKey,
      channelId: mention.channelId,
      text: response,
      parentMessageId: mention.messageId,
    });

    console.log(`✅ Responded to @${mention.senderUsername}`);
  }

  async sendMessage(channelId: Id<"channels">, text: string) {
    return this.client.mutation(api.bots.sendMessageAsBot, {
      apiKey: this.apiKey,
      channelId,
      text,
    });
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }
}

// Usage
async function main() {
  const bot = new RuckusBot(CONVEX_URL, API_KEY);
  await bot.start();

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("\nShutting down...");
    bot.stop();
    process.exit(0);
  });
}

main().catch(console.error);
```

### API Reference (Convex Client)

| Function | Type | Description |
|----------|------|-------------|
| `api.bots.authenticateBot` | Query | Validate API key and get bot info |
| `api.bots.getChannelsAsBot` | Query | List all channels |
| `api.bots.getChannelMessagesAsBot` | Query | Get messages from a channel (subscribable) |
| `api.bots.getMentionsAsBot` | Query | Get recent mentions (subscribable) |
| `api.bots.sendMessageAsBot` | Mutation | Send a message to a channel |
| `api.bots.setTypingAsBot` | Mutation | Set typing indicator |
| `api.bots.clearTypingAsBot` | Mutation | Clear typing indicator |

### HTTP vs Convex Client

| Feature | HTTP API | Convex Client |
|---------|----------|---------------|
| Real-time updates | Polling or Webhooks | Native subscriptions |
| Type safety | Manual types | Full TypeScript |
| Setup complexity | Simple | Requires generated code |
| Language support | Any | JavaScript/TypeScript |
| File uploads | Supported | Use HTTP API |
| Best for | Simple bots, non-JS | TypeScript bots, real-time |

---

## Bot Display

Bots appear in chat with a `[BOT]` badge next to their username. Their messages are displayed the same as regular user messages, including support for:
- Text formatting (links are auto-detected)
- Reactions from other users
- Thread replies
- File attachments
