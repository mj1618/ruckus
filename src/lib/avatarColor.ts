// Discord/Slack-inspired avatar colors - rich, vibrant colors that pop against dark backgrounds
export const AVATAR_COLORS = [
  "#5865f2", // Discord blurple
  "#3ba55c", // Green
  "#faa61a", // Yellow/gold
  "#ed4245", // Red
  "#eb459e", // Fuchsia
  "#9b59b6", // Purple
  "#1abc9c", // Teal
  "#e67e22", // Orange
  "#2ecc71", // Emerald
  "#3498db", // Light blue
  "#e91e63", // Pink
  "#00bcd4", // Cyan
  "#8e44ad", // Deep purple
  "#27ae60", // Forest green
  "#f39c12", // Amber
  "#e74c3c", // Coral red
];

export function getAvatarColor(username: string): string {
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash += username.charCodeAt(i);
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
