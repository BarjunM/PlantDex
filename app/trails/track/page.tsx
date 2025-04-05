"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Leaf, Pause, Play, Save, Check, Loader2, MapPin } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Dynamically import LeafletMap with no SSR
const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="flex flex-col items-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-2"></div>
        <p className="text-gray-600">Loading map...</p>
      </div>
    </div>
  ),
})

type Position = {
  lat: number
  lng: number
  timestamp: number
}

export default function TrackTrailPage() {
  const [trail, setTrail] = useState<any>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const [completedPOIs, setCompletedPOIs] = useState<string[]>([])
  const [progress, setProgress] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [addingMarker, setAddingMarker] = useState(false)
  const [markerNote, setMarkerNote] = useState("")
  const [markers, setMarkers] = useState<any[]>([])
  const watchId = useRef<number | null>(null)
  const { toast } = useToast()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()

  // Get trail ID from URL
  const trailId = searchParams.get("trail")

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch trail data if ID is provided
  useEffect(() => {
    const fetchTrail = async () => {
      if (!user) return
      if (!trailId) return

      try {
        setLoading(true)

        // Fetch trail
        const { data, error } = await supabase.from("trails").select("*").eq("id", trailId).single()

        if (error) {
          throw error
        }

        setTrail(data)
      } catch (err) {
        console.error("Error fetching trail:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch trail details",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    if (trailId) {
      fetchTrail()
    } else {
      setLoading(false)
    }
  }, [user, supabase, trailId, toast])

  // Start/stop tracking
  const toggleTracking = () => {
    if (isTracking) {
      // Stop tracking
      setIsTracking(false)
      setDuration(Date.now() - (startTime || Date.now()))
    } else {
      // Start tracking
      setPositions([])
      setDistance(0)
      setStartTime(Date.now())
      setDuration(0)
      setIsTracking(true)
      setShowMap(true)
    }
  }

  // Handle position updates from the map
  const handlePositionUpdate = (position: Position) => {
    setCurrentPosition(position)

    // Check if near any POIs
    if (trail?.path_data?.markers) {
      trail.path_data.markers.forEach((marker) => {
        if (!completedPOIs.includes(marker.id)) {
          const markerPos = marker.position
          const distToMarker = calculateDistance(position.lat, position.lng, markerPos.lat, markerPos.lng)

          // If within 50 meters of a POI, mark it as completed
          if (distToMarker <= 0.05) {
            setCompletedPOIs((prev) => [...prev, marker.id])
            toast({
              title: "Point Reached!",
              description: `You've reached ${marker.note || "a point of interest"}`,
            })
          }
        }
      })
    }
  }

  // Handle route updates from the map
  const handleRouteUpdate = (newPositions: Position[]) => {
    setPositions(newPositions)
    updateDistance(newPositions)

    // Update progress
    if (trail?.path_data?.markers?.length > 0) {
      const progressPercent = (completedPOIs.length / trail.path_data.markers.length) * 100
      setProgress(progressPercent)
    } else {
      // If no markers, calculate progress based on distance
      if (trail?.distance > 0) {
        const progressPercent = Math.min((distance / trail.distance) * 100, 100)
        setProgress(progressPercent)
      }
    }
  }

  // Calculate distance
  const updateDistance = (positions: Position[]) => {
    if (positions.length < 2) return

    let totalDistance = 0
    for (let i = 1; i < positions.length; i++) {
      const prev = positions[i - 1]
      const curr = positions[i]
      totalDistance += calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng)
    }

    setDistance(totalDistance)
  }

  // Calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371 // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1)
    const dLon = deg2rad(lon2 - lon1)
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    const d = R * c // Distance in km
    return d
  }

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180)
  }

  // Format duration
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours.toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}:${(seconds % 60)
      .toString()
      .padStart(2, "0")}`
  }

  // Add marker
  const handleAddMarker = () => {
    if (!currentPosition) return

    const newMarker = {
      id: Date.now().toString(),
      type: "plant",
      position: currentPosition,
      note: markerNote || "Point of Interest",
    }

    setMarkers((prev) => [...prev, newMarker])
    setAddingMarker(false)
    setMarkerNote("")

    toast({
      title: "Marker Added",
      description: "Point of interest added to your route",
    })
  }

  // Save completed trail
  const saveCompletedTrail = async () => {
    if (positions.length === 0) {
      toast({
        title: "No Route Data",
        description: "There is no route data to save.",
        variant: "destructive",
      })
      return
    }

    try {
      // If this is a planned trail, mark it as completed
      if (trail && trailId) {
        // Create a new trail record with the actual data
        const { data, error } = await supabase.from("trails").insert({
          user_id: user.id,
          name: `${trail.name} (Completed)`,
          description: trail.description,
          distance: distance,
          duration: Math.floor(duration / 1000), // Convert to seconds
          date_completed: new Date().toISOString(),
          path_data: {
            type: "walk",
            positions: positions,
            markers:
              trail.path_data?.markers?.map((marker) => ({
                ...marker,
                completed: completedPOIs.includes(marker.id),
              })) || [],
            completed: true,
            original_trail_id: trailId,
          },
          plants_found: completedPOIs.length,
        })

        if (error) {
          throw error
        }

        toast({
          title: "Trail Completed!",
          description: "Your trek has been saved successfully.",
        })
      } else {
        // Save as a new trail
        const { data, error } = await supabase.from("trails").insert({
          user_id: user.id,
          name: `Trek on ${new Date().toLocaleDateString()}`,
          description: `A ${distance.toFixed(2)} km trek`,
          distance: distance,
          duration: Math.floor(duration / 1000), // Convert to seconds
          date_completed: new Date().toISOString(),
          path_data: {
            type: "walk",
            positions: positions,
            markers: markers,
            completed: true,
          },
          plants_found: markers.filter((m) => m.type === "plant").length,
        })

        if (error) {
          throw error
        }

        toast({
          title: "Trek Saved",
          description: "Your trek has been saved successfully.",
        })
      }

      // Redirect to trails page
      router.push("/trails")
    } catch (error) {
      console.error("Error saving trail:", error)
      toast({
        title: "Save Error",
        description: "Could not save your trek. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Prepare map data
  const getMapData = () => {
    // Convert positions to [lat, lng] format for Leaflet
    const polyline = positions.map((pos) => [pos.lat, pos.lng] as [number, number])

    // Create markers for the map
    const mapMarkers = [
      // POI markers from trail
      ...(trail?.path_data?.markers || []).map((marker) => ({
        position: [marker.position.lat, marker.position.lng] as [number, number],
        title: marker.note || marker.type,
        icon: completedPOIs.includes(marker.id) ? "green" : "red",
      })),

      // User added markers
      ...markers.map((marker) => ({
        position: [marker.position.lat, marker.position.lng] as [number, number],
        title: marker.note,
        icon: "green",
      })),
    ]

    return { polyline, markers: mapMarkers }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const { polyline, markers: mapMarkers } = getMapData()

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex h-16 items-center px-4">
          <Link href="/trails" className="flex items-center">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>Back to Trails</span>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Leaf className="h-6 w-6 text-green-600" />
              <span className="text-xl font-bold">TrekDex</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-2">{trail ? `Following: ${trail.name}` : "Track Your Trek"}</h1>
            <p className="text-gray-500">
              {trail
                ? `Follow the planned route and visit points of interest`
                : `Record your trek and save it to your collection`}
            </p>
          </div>

          <Button onClick={() => setShowMap(true)} className="w-full mb-6 bg-green-600 hover:bg-green-700">
            <MapPin className="mr-2 h-4 w-4" />
            {isTracking ? "View Map" : "Record Your Trail"}
          </Button>

          {trail && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Trek Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Progress value={progress} className="h-2" />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Start</span>
                    <span>{Math.round(progress)}% Complete</span>
                    <span>Finish</span>
                  </div>

                  {trail.path_data?.markers && trail.path_data.markers.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-medium mb-2">Points of Interest</h3>
                      <div className="space-y-2">
                        {trail.path_data.markers.map((marker, index) => (
                          <div key={marker.id} className="flex items-center">
                            {completedPOIs.includes(marker.id) ? (
                              <Check className="h-5 w-5 text-green-500 mr-2" />
                            ) : (
                              <div className="h-5 w-5 border border-gray-300 rounded-full mr-2" />
                            )}
                            <span className={completedPOIs.includes(marker.id) ? "text-green-600 font-medium" : ""}>
                              {marker.note || `Point ${index + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Trek Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center mb-6">
                <div>
                  <p className="text-sm text-gray-500">Distance</p>
                  <p className="text-xl font-bold">{distance.toFixed(2)} km</p>
                  {trail && <p className="text-xs text-gray-500">Target: {trail.distance} km</p>}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Duration</p>
                  <p className="text-xl font-bold">
                    {formatDuration(isTracking ? Date.now() - (startTime || Date.now()) : duration)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Points Visited</p>
                  <p className="text-xl font-bold">{completedPOIs.length}</p>
                  {trail && trail.path_data?.markers && (
                    <p className="text-xs text-gray-500">of {trail.path_data.markers.length}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-4">
                <Button
                  onClick={toggleTracking}
                  className={`flex-1 ${isTracking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                >
                  {isTracking ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                  {isTracking ? "Pause" : "Start"}
                </Button>
                <Button onClick={saveCompletedTrail} className="flex-1" disabled={positions.length === 0}>
                  <Save className="mr-2 h-4 w-4" />
                  Complete Trek
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Map Dialog */}
      <Dialog open={showMap} onOpenChange={setShowMap}>
        <DialogContent className="max-w-4xl w-[90vw] h-[80vh] p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b">
            <DialogTitle>{isTracking ? "Recording Trek" : "Start Recording"}</DialogTitle>
            <DialogDescription>
              {isTracking
                ? "Your trek is being recorded. You can add points of interest or complete your trek when finished."
                : "Click Start to begin recording your trek."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex-1 h-[calc(80vh-120px)]">
            <LeafletMap
              mode={isTracking ? "track" : "view"}
              height="100%"
              className="w-full h-full"
              markers={mapMarkers}
              polyline={polyline}
              onPositionUpdate={handlePositionUpdate}
              onRouteUpdate={handleRouteUpdate}
            />
          </div>

          <div className="p-4 border-t flex justify-between">
            {isTracking && (
              <Button variant="outline" onClick={() => setAddingMarker(true)} className="flex-1 mr-2">
                <MapPin className="mr-2 h-4 w-4" />
                Add Point
              </Button>
            )}

            <Button
              onClick={isTracking ? saveCompletedTrail : toggleTracking}
              className={`flex-1 ${isTracking ? "" : "bg-green-600 hover:bg-green-700"}`}
            >
              {isTracking ? (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Complete Trek
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Recording
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Marker Dialog */}
      <Dialog open={addingMarker} onOpenChange={setAddingMarker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Point of Interest</DialogTitle>
            <DialogDescription>Add a note about this location to mark it on your trek.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="note" className="text-sm font-medium">
                Note
              </label>
              <input
                id="note"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="e.g., Beautiful oak tree"
                value={markerNote}
                onChange={(e) => setMarkerNote(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAddingMarker(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddMarker}>Add Point</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

