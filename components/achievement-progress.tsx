import { Progress } from "@/components/ui/progress"
import { Trophy } from "lucide-react"
import { cn } from "@/lib/utils"

interface AchievementProgressProps {
  current: number
  total: number
  completed: boolean
  completedDate?: string
  className?: string
}

export function AchievementProgress({ current, total, completed, completedDate, className }: AchievementProgressProps) {
  const progress = (current / total) * 100

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {current}/{total}
        </span>
        <span>{Math.round(progress)}%</span>
      </div>
      <Progress
        value={progress}
        className="h-2"
        indicatorClassName={cn(completed ? "bg-gradient-to-r from-green-500 to-emerald-500" : "")}
      />
      {completed && completedDate && (
        <div className="flex items-center justify-center text-xs text-emerald-600 font-medium mt-1">
          <Trophy className="h-3 w-3 mr-1" />
          <span>Completed on {new Date(completedDate).toLocaleDateString()}</span>
        </div>
      )}
    </div>
  )
}

