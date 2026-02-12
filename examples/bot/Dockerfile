# Ruckus AI Bot with Claude Code
FROM node:20-slim

# Install dependencies for Claude Code
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (required for Claude CLI --dangerously-skip-permissions)
RUN useradd -m -s /bin/bash botuser

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Copy convex types (must be done during build or mounted)
# The convex/_generated folder should be copied before building

# Create workspace directory for Claude Code and set ownership
RUN mkdir -p /workspace && chown -R botuser:botuser /workspace /app

# Set environment variables
ENV NODE_ENV=production

# Switch to non-root user
USER botuser

# Run the bot
CMD ["pnpm", "start"]
