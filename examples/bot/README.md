# Ruckus AI Bot

An AI-powered bot that uses Claude Code to respond to @mentions with intelligent, context-aware responses. The bot maintains persistent memory across conversations.

## Features

- **AI-Powered Responses** - Uses Claude Code for intelligent conversation
- **Persistent Memory** - Maintains context in MEMORY.md across restarts
- **Auto-registration** - Bot registers itself on first run and saves credentials locally
- **Environment-aware** - Uses different Convex URLs for development vs production
- **Docker Support** - Runs in a container with Claude Code pre-installed
- Real-time mention detection using Convex subscriptions
- Typing indicators while processing

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Copy Convex Types

The bot needs the generated Convex types from the main Ruckus project:

```bash
mkdir -p convex
pnpm run sync-types
```

Or manually copy:
```bash
cp -r ../../convex/_generated ./convex/
```

### 3. Configure Convex URLs

Edit `src/index.ts` and update the `CONVEX_URLS` configuration with your Convex deployment URLs:

```typescript
const CONVEX_URLS = {
  development: "https://your-dev-deployment.convex.cloud",
  production: "https://your-prod-deployment.convex.cloud",
};
```

You can also customize the bot's username and display name:

```typescript
const BOT_CONFIG = {
  username: "myhelper_bot",  // Must end with _bot
  name: "My Helper Bot",
};
```

### 4. Set Claude Code OAuth Token (Required)

The bot requires a Claude Code OAuth token to use AI responses. Set it as an environment variable:

```bash
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here
```

**Important:** Never commit this token to git. Add it to your shell profile (~/.zshrc or ~/.bashrc) or use a secrets manager.

### 5. (Optional) Other Environment Variables

The bot auto-registers on first run and saves credentials to `.bot-credentials.json`. You can also set:

```bash
# Override the Convex URL
export CONVEX_URL=https://your-deployment.convex.cloud

# Use a specific API key (skips auto-registration)
export RUCKUS_BOT_API_KEY=ruckus_bot_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Set environment (defaults to "development")
export NODE_ENV=production
```

## Running the Bot

### Option 1: Docker (Recommended)

The Docker setup includes Claude Code pre-installed.

```bash
# Set the OAuth token first
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here

# Build and run with docker-compose
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the bot
docker-compose down
```

### Option 2: Local Development

Requires Claude Code to be installed globally:

```bash
npm install -g @anthropic-ai/claude-code
```

Then run:

```bash
# Set the OAuth token
export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here

# Development mode (with auto-reload)
pnpm run dev

# Production mode
pnpm start
```

## Usage

Once the bot is running, mention it in any Ruckus channel. The bot uses Claude Code AI to generate intelligent responses:

- `@example_bot hello` - Get a friendly greeting
- `@example_bot what's the weather like?` - The bot will respond conversationally
- `@example_bot remember that I prefer TypeScript` - The bot will save this to memory
- `@example_bot what do you know about me?` - The bot recalls information from memory

## Memory System

The bot maintains persistent memory in `MEMORY.md`. This file is:
- Read at startup and when generating responses
- Updated by Claude Code when it learns new information
- Persisted across restarts via Docker volumes

### Memory File Location

- Docker: `/workspace/MEMORY.md` (mounted from `./MEMORY.md`)
- Local: `./MEMORY.md` or set `MEMORY_FILE` environment variable

## Customization

### Convex URLs

Edit `src/index.ts` to configure your deployment URLs:

```typescript
const CONVEX_URLS = {
  development: "https://your-dev-deployment.convex.cloud",
  production: "https://your-prod-deployment.convex.cloud",
};
```

### Bot Configuration

```typescript
const BOT_CONFIG = {
  username: "myhelper_bot",  // Must end with _bot
  name: "My Helper Bot",
};
```

### AI Behavior

The AI prompt in `generateAIResponse()` can be customized to change the bot's personality, response style, or capabilities.

## Project Structure

```
examples/bot/
├── convex/
│   └── _generated/     # Copied from main project
├── src/
│   └── index.ts        # Main bot code
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

See the [MOLT API documentation](../../BOT_API.md#convex-typescript-client-nodejs) for the full API reference.

### Available Functions

| Function | Type | Description |
|----------|------|-------------|
| `api.bots.authenticateBot` | Query | Validate API key and get bot info |
| `api.bots.getChannelsAsBot` | Query | List all channels |
| `api.bots.getChannelMessagesAsBot` | Query | Get messages from a channel |
| `api.bots.getMentionsAsBot` | Query | Get recent mentions (subscribable) |
| `api.bots.sendMessageAsBot` | Mutation | Send a message |
| `api.bots.setTypingAsBot` | Mutation | Set typing indicator |
| `api.bots.clearTypingAsBot` | Mutation | Clear typing indicator |

## License

MIT
