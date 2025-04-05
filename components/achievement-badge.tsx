"use client"

import { Award, Leaf, Route, Users, Calendar, Star, Compass, Camera, Heart, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AchievementBadgeProps {
  category: string
  name: string
  level: "bronze" | "silver" | "gold" | "platinum"
  completed: boolean
  size?: "sm" | "md" | "lg"
  className?: string
  onClick?: () => void
}

export function AchievementBadge({
  category,
  name,
  level,
  completed,
  size = "md",
  className,
  onClick,
}: AchievementBadgeProps) {
  // Get badge colors based on level
  const getBadgeColors = () => {
    if (!completed) return "bg-gray-100 border-gray-200 text-gray-400"

    switch (level) {
      case "bronze":
        return "bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300 text-amber-800"
      case "silver":
        return "bg-gradient-to-br from-gray-100 to-gray-300 border-gray-400 text-gray-700"
      case "gold":
        return "bg-gradient-to-br from-yellow-100 to-yellow-300 border-yellow-400 text-yellow-800"
      case "platinum":
        return "bg-gradient-to-br from-blue-100 to-blue-200 border-blue-300 text-blue-800"
      default:
        return "bg-gray-100 border-gray-200 text-gray-600"
    }
  }

  // Get icon based on category
  const getIcon = () => {
    switch (category) {
      case "plants":
        return (
          <Leaf className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "trails":
        return (
          <Route className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "social":
        return (
          <Users className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "streaks":
        return (
          <Calendar className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "special":
        return (
          <Star className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "explorer":
        return (
          <Compass className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "collector":
        return (
          <Camera className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      case "community":
        return (
          <Heart className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
      default:
        return (
          <Award className={cn("text-current", size === "sm" ? "h-3 w-3" : size === "lg" ? "h-6 w-6" : "h-4 w-4")} />
        )
    }
  }

  // Get size classes
  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "w-8 h-8 text-xs"
      case "lg":
        return "w-16 h-16 text-base"
      default:
        return "w-12 h-12 text-sm"
    }
  }

  // Get animation classes
  const getAnimationClasses = () => {
    if (!completed) return ""

    switch (level) {
      case "platinum":
        return "animate-badge-glow"
      case "gold":
        return "animate-badge-pulse"
      default:
        return ""
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center",
        onClick && "cursor-pointer hover:scale-105 transition-transform",
        className,
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          "rounded-full flex items-center justify-center border-2 relative",
          getBadgeColors(),
          getSizeClasses(),
          getAnimationClasses(),
          completed ? "shadow-md" : "opacity-60",
        )}
      >
        {getIcon()}

        {/* Add sparkle effect for platinum badges */}
        {completed && level === "platinum" && (
          <span className="absolute -top-1 -right-1 text-yellow-400">
            <Sparkles className={size === "sm" ? "h-3 w-3" : size === "lg" ? "h-5 w-5" : "h-4 w-4"} />
          </span>
        )}
      </div>
      {name && <span className="mt-1 text-xs text-center font-medium">{name}</span>}
    </div>
  )
}

