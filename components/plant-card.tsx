"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bookmark, Utensils, Heart, AlertTriangle, Leaf, Trash2 } from "lucide-react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"

interface PlantCardProps {
  plant: {
    id: string
    common_name: string
    scientific_name: string
    image_url?: string
    edible: boolean
    poisonous: boolean
    medicinal: boolean
  }
  onDelete?: (id: string) => void
}

export function PlantCard({ plant, onDelete }: PlantCardProps) {
  const [imageError, setImageError] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const { toast } = useToast()

  // Generate a placeholder color based on the plant name for consistent colors
  const getPlaceholderColor = (name: string) => {
    const colors = ["#10b981", "#059669", "#047857", "#065f46", "#064e3b"]
    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  const placeholderColor = getPlaceholderColor(plant.common_name)

  // Check if the image_url is a base64 string
  const isBase64Image =
    plant.image_url && (plant.image_url.startsWith("data:image/") || plant.image_url.startsWith("data:application/"))

  // Determine the image source
  const imageSource = isBase64Image
    ? plant.image_url
    : plant.image_url && plant.image_url !== "null" && !plant.image_url.includes("undefined")
      ? plant.image_url
      : `/placeholder.svg?height=400&width=400&text=${encodeURIComponent(plant.common_name)}`

  const handleDelete = async () => {
    if (!plant.id || !onDelete) return

    setIsDeleting(true)

    try {
      const response = await fetch(`/api/user-plants/${plant.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        let errorMessage = "Failed to delete plant"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (parseError) {
          // If we can't parse the response as JSON, use the status text
          errorMessage = `${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      toast({
        title: "Plant Removed",
        description: `${plant.common_name} has been removed from your collection.`,
      })

      // Call the onDelete callback to update the UI
      onDelete(plant.id)
    } catch (error) {
      console.error("Error deleting plant:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove plant. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  return (
    <>
      <Card className="plant-card overflow-hidden border-none shadow-md animate-slide-up">
        <div className="aspect-square overflow-hidden relative">
          {!imageError ? (
            <img
              src={imageSource || "/placeholder.svg"}
              alt={plant.common_name}
              className="object-cover w-full h-full transition-transform hover:scale-105"
              onError={() => setImageError(true)}
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: placeholderColor }}
            >
              <Leaf className="h-16 w-16 text-white opacity-70" />
            </div>
          )}
        </div>
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <CardTitle className="text-lg">{plant.common_name}</CardTitle>
            <div
              className={`plant-badge ${
                plant.poisonous ? "poisonous" : plant.edible ? "edible" : plant.medicinal ? "medicinal" : "unknown"
              }`}
            >
              {plant.poisonous ? "Poisonous" : plant.edible ? "Edible" : plant.medicinal ? "Medicinal" : "Unknown"}
            </div>
          </div>
          <CardDescription className="italic">{plant.scientific_name}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className={`flex flex-col items-center ${!plant.edible && "opacity-30"}`}>
              <Utensils className={`h-5 w-5 ${plant.edible ? "text-emerald-500" : ""}`} />
              <span className="text-xs mt-1">{plant.edible ? "Edible" : "Not Edible"}</span>
            </div>
            <div className={`flex flex-col items-center ${!plant.medicinal && "opacity-30"}`}>
              <Heart className={`h-5 w-5 ${plant.medicinal ? "text-red-500" : ""}`} />
              <span className="text-xs mt-1">{plant.medicinal ? "Medicinal" : "Not Medicinal"}</span>
            </div>
            <div className={`flex flex-col items-center ${!plant.poisonous && "opacity-30"}`}>
              <AlertTriangle className={`h-5 w-5 ${plant.poisonous ? "text-red-500" : ""}`} />
              <span className="text-xs mt-1">{plant.poisonous ? "Dangerous" : "Safe"}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href={`/plants/${plant.id}`}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm">
              <Bookmark className="h-4 w-4" />
            </Button>
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Plant</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <span className="font-medium">{plant.common_name}</span> from your
              collection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting} className="bg-red-500 hover:bg-red-600">
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

