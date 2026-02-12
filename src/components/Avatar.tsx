"use client";

interface AvatarProps {
  username: string;
  avatarColor: string;
  avatarUrl?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-10 w-10 text-sm",
};

export function Avatar({ 
  username, 
  avatarColor, 
  avatarUrl, 
  size = "md",
  className = "" 
}: AvatarProps) {
  const sizeClass = sizeClasses[size];
  
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username}
        className={`${sizeClass} rounded-full object-cover shadow-sm ${className}`}
      />
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full font-bold text-white shadow-sm ${sizeClass} ${className}`}
      style={{ backgroundColor: avatarColor }}
    >
      {username[0]?.toUpperCase() ?? "?"}
    </div>
  );
}
