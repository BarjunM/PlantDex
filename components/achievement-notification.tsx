"use client"

import { useState, useEffect } from "react"
import { Trophy, X } from "lucide-react"
import { AchievementBadge } from "./achievement-badge"
import { cn } from "@/lib/utils"

interface AchievementNotificationProps {
  title: string
  description: string
  category: string
  level: "bronze" | "silver" | "gold" | "platinum"
  onClose: () => void
  className?: string
}

export function AchievementNotification({
  title,
  description,
  category,
  level,
  onClose,
  className,
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100)

    // Auto dismiss after 5 seconds
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 500) // Allow animation to complete
    }, 5000)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={cn(
        "fixed bottom-20 right-4 md:bottom-4 md:right-4 bg-white rounded-lg shadow-lg p-4 max-w-xs w-full transition-all duration-500 transform z-50 border-l-4 border-yellow-500",
        isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
        className,
      )}
    >
      <div className="absolute -top-2 -left-2 right-0 h-8">
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
        <div className="confetti-piece"></div>
      </div>

      <button
        onClick={() => {
          setIsVisible(false)
          setTimeout(onClose, 500)
        }}
        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center">
        <div className="mr-3">
          <AchievementBadge category={category} name="" level={level} completed={true} size="md" />
        </div>

        <div className="flex-1">
          <div className="flex items-center">
            <Trophy className="h-4 w-4 text-yellow-500 mr-1" />
            <h3 className="font-bold text-sm">Achievement Unlocked!</h3>
          </div>
          <p className="font-medium text-sm mt-1">{title}</p>
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
}

