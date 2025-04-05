"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Map, Route, Calendar, MapPin } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type SavedTreksProps = {
  userId?: string
  limit?: number
  showPlanned?: boolean
  showCompleted?: boolean
  trails?: any[]
  onTrailClick?: (id: string) => void
}

export default function SavedTreks({
  userId,
  limit = 6,
  showPlanned = true,
  showCompleted = true,
  trails,
  onTrailClick,
}: SavedTreksProps) {
  const [treks, setTreks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const fetchTreks = async () => {
      try {
        setLoading(true)

        // If trails are provided directly, use them
        if (trails) {
          setTreks(trails)
          setLoading(false)
          return
        }

        // Otherwise fetch trails if userId is provided
        if (!userId) {
          setTreks([])
          setLoading(false)
          return
        }

        // Build query
        let query = supabase.from("trails").select("*").eq("user_id", userId).order("created_at", { ascending: false })

        // Apply filters
        if (showPlanned && !showCompleted) {
          query = query.eq("path_data->planned", true)
        } else if (!showPlanned && showCompleted) {
          query = query.is("path_data->planned", null)
        }

        // Apply limit
        if (limit > 0) {
          query = query.limit(limit)
        }

        const { data, error } = await query

        if (error) {
          throw error
        }

        setTreks(data || [])
      } catch (error) {
        console.error("Error fetching treks:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchTreks()
  }, [userId, limit, showPlanned, showCompleted, supabase, trails])

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] bg-gray-200 rounded mb-4"></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (treks.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="mb-4">
          {trails
            ? "You haven't saved any trails yet."
            : showPlanned
              ? "You haven't planned any routes yet."
              : "You haven't recorded any trails yet."}
        </p>
        <Button
          className="bg-green-600 hover:bg-green-700"
          onClick={() => router.push(showPlanned ? "/trails/plan" : "/trails")}
        >
          {showPlanned ? <Route className="mr-2 h-4 w-4" /> : <Map className="mr-2 h-4 w-4" />}
          {showPlanned ? "Plan Your First Route" : "Record Your First Trail"}
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {treks.map((trek) => {
        const isPlanned = trek.path_data?.planned === true

        return (
          <Card key={trek.id}>
            <CardHeader>
              <div className="flex justify-between">
                <div>
                  <CardTitle className="line-clamp-1">{trek.name}</CardTitle>
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(isPlanned ? trek.created_at : trek.date_completed)}
                  </CardDescription>
                </div>
                {isPlanned && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-800">
                    Planned
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[150px] rounded-md bg-gray-100 flex items-center justify-center mb-4 relative overflow-hidden">
                {isPlanned ? <Route className="h-8 w-8 text-blue-400" /> : <Map className="h-8 w-8 text-gray-400" />}

                {trek.path_data?.positions && trek.path_data.positions.length > 0 && (
                  <div className="absolute inset-0 opacity-50">
                    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline
                        points={trek.path_data.positions
                          .map((pos: any, i: number) => {
                            // Normalize coordinates to fit in the SVG viewBox
                            const minLat = Math.min(...trek.path_data.positions.map((p: any) => p.lat))
                            const maxLat = Math.max(...trek.path_data.positions.map((p: any) => p.lat))
                            const minLng = Math.min(...trek.path_data.positions.map((p: any) => p.lng))
                            const maxLng = Math.max(...trek.path_data.positions.map((p: any) => p.lng))

                            const x = ((pos.lng - minLng) / (maxLng - minLng || 1)) * 100
                            const y = ((pos.lat - minLat) / (maxLat - minLat || 1)) * 100

                            return `${x},${y}`
                          })
                          .join(" ")}
                        fill="none"
                        stroke={isPlanned ? "#2196F3" : "#4CAF50"}
                        strokeWidth="2"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-sm text-gray-500">Distance</p>
                  <p className="font-medium">{trek.distance} km</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="font-medium">{formatDuration(trek.duration)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">{isPlanned ? "Points" : "Plants"}</p>
                  <p className="font-medium">{isPlanned ? trek.path_data?.markers?.length || 0 : trek.plants_found}</p>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Link href={`/trails/${trek.id}`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
              {isPlanned ? (
                <Button className="bg-green-600 hover:bg-green-700" size="sm">
                  Start Trek
                </Button>
              ) : (
                <Button variant="outline" size="sm">
                  <MapPin className="h-4 w-4 mr-1" /> View Map
                </Button>
              )}
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}

