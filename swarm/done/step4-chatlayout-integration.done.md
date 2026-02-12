# Task: ChatLayout Integration for #draw Channel

## Requirements
Modify `src/components/ChatLayout.tsx`:
- Check if `activeChannel.name === "draw"`
- When true, render `DrawCanvas` + `DrawChatOverlay` instead of normal MessageList + MessageInput
- Keep ChannelHeader visible

## Dependencies
- step2-draw-canvas-component
- step3-draw-chat-overlay
