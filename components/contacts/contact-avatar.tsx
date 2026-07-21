import { cn } from "@/lib/utils"

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

const AVATAR_COLORS = [
  "bg-emerald-700 text-white",
  "bg-pine-800 text-white",
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-amber-600 text-white",
  "bg-graphite-700 text-white",
]

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function ContactAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
        colorForName(name),
        className,
      )}
      aria-hidden="true"
    >
      {getInitials(name)}
    </div>
  )
}
