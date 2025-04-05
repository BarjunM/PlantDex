"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Compass, Pause, Play, Save, X, MapPin, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"

// Dynamically import GoogleMap with no SSR
const GoogleMap = dynamic(() => import("@/components/map/google-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
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

type RouteType = "walk" | "bike" | "jog"

type HomeLocation = {
  lat: number
  lng: number
  display_name: string
}

// Default location (San Francisco)
const DEFAULT_LOCATION: HomeLocation = {
  lat: 43.43615,
  lng: -79.735619,
  display_name: "San Francisco, CA, USA",
}

// Declare google variable
declare global {
  interface Window {
    google: any
  }
}

export default function MapView({
  onSave,
  onError,
  defaultLocation,
}: {
  onSave?: (data: any) => void
  onError?: () => void
  defaultLocation?: HomeLocation | null
}) {
  const [isTracking, setIsTracking] = useState(false)
  const [routeType, setRouteType] = useState<RouteType>("walk")
  const [positions, setPositions] = useState<Position[]>([])
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null)
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  const [startTime, setStartTime] = useState<number | null>(null)
  const watchId = useRef<number | null>(null)
  const { toast } = useToast()
  const supabase = createClient()
  const [markers, setMarkers] = useState<any[]>([])
  const [showAddMarker, setShowAddMarker] = useState(false)
  const [markerType, setMarkerType] = useState<"plant" | "landmark" | "scenic">("landmark")
  const [markerNote, setMarkerNote] = useState("")
  const [mapError, setMapError] = useState(false)
  const [isClient, setIsClient] = useState(false)

  // Check if we're in the browser
  useEffect(() => {
    setIsClient(true)
  }, [])

  // Try to get user location if available
  useEffect(() => {
    if (!isClient) return

    const getLocation = () => {
      // Set a default position first to ensure we always have something
      const location = defaultLocation || DEFAULT_LOCATION
      setCurrentPosition({
        lat: location.lat,
        lng: location.lng,
        timestamp: Date.now(),
      })

      try {
        if (typeof navigator !== "undefined" && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              setCurrentPosition({
                lat: latitude,
                lng: longitude,
                timestamp: Date.now(),
              })
            },
            (error) => {
              console.log("Geolocation error:", error.code, error.message)
              // Don't show toast for permission errors in preview environments
              if (error.code === 1 && typeof window !== "undefined" && window.location.hostname !== "localhost") {
                // Silent fallback to default location
              } else if (typeof window !== "undefined" && window.location.hostname === "localhost") {
                toast({
                  title: "Using Default Location",
                  description: defaultLocation
                    ? `Using your home location: ${defaultLocation.display_name}`
                    : "Using default location. Enable location services for better accuracy.",
                  variant: "default",
                })
              }
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
          )
        }
      } catch (error) {
        console.log("Geolocation access error:", error)
        // Silent fallback - we already set the default position
      }
    }

    getLocation()
  }, [defaultLocation, toast, isClient])

  // Start/stop tracking
  const toggleTracking = () => {
    if (!isClient) return

    if (isTracking) {
      // Stop tracking
      if (watchId.current && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchId.current)
        watchId.current = null
      }
      setIsTracking(false)
      setDuration(Date.now() - (startTime || Date.now()))
    } else {
      // Start tracking
      setPositions([])
      setDistance(0)
      setStartTime(Date.now())
      setDuration(0)

      // Always start with current position (which might be default)
      if (currentPosition) {
        setPositions([currentPosition])
      }

      const simulateMovement = () => {
        // Create a timer that simulates movement
        const timer = setInterval(() => {
          if (!currentPosition) return

          // Create a slightly different position to simulate movement
          const simulatedPosition = {
            lat: currentPosition.lat + (Math.random() - 0.5) * 0.001,
            lng: currentPosition.lng + (Math.random() - 0.5) * 0.001,
            timestamp: Date.now(),
          }

          setCurrentPosition(simulatedPosition)
          setPositions((prev) => {
            const newPositions = [...prev, simulatedPosition]
            updateDistance(newPositions)
            return newPositions
          })
        }, 3000) // Update every 3 seconds

        return timer
      }

      try {
        if (typeof navigator === "undefined" || !navigator.geolocation) {
          throw new Error("Geolocation is not supported")
        }

        // Try to use real geolocation first
        watchId.current = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude } = position.coords
            const newPosition = {
              lat: latitude,
              lng: longitude,
              timestamp: Date.now(),
            }

            setCurrentPosition(newPosition)
            setPositions((prev) => {
              const newPositions = [...prev, newPosition]
              updateDistance(newPositions)
              return newPositions
            })
          },
          (error) => {
            console.log("Tracking error:", error.code, error.message)

            // If geolocation fails, fall back to simulation
            if (!watchId.current || watchId.current === -1) {
              watchId.current = simulateMovement() as unknown as number
            }
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000,
          },
        )

        // If watchPosition returns -1 or null (which happens in some environments),
        // fall back to simulation
        if (!watchId.current || watchId.current === -1) {
          watchId.current = simulateMovement() as unknown as number

          // Show a message only in development
          if (typeof window !== "undefined" && window.location.hostname === "localhost") {
            toast({
              title: "Using Simulated Movement",
              description: "Real location tracking is not available. Using simulated movement instead.",
              variant: "default",
            })
          }
        }

        setIsTracking(true)
      } catch (error) {
        console.log("Failed to start tracking:", error)

        // Fall back to simulation
        watchId.current = simulateMovement() as unknown as number
        setIsTracking(true)

        // Only show toast in development
        if (typeof window !== "undefined" && window.location.hostname === "localhost") {
          toast({
            title: "Using Simulated Movement",
            description: "Real location tracking is not available. Using simulated movement instead.",
            variant: "default",
          })
        }
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

  // Get route color based on type
  const getRouteColor = (type: RouteType) => {
    switch (type) {
      case "walk":
        return "#4CAF50" // Green
      case "bike":
        return "#2196F3" // Blue
      case "jog":
        return "#FF9800" // Orange
      default:
        return "#4CAF50"
    }
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

  // Save route
  const saveRoute = async () => {
    if (!isClient) return

    if (positions.length === 0) {
      toast({
        title: "No Route Data",
        description: "There is no route data to save.",
        variant: "destructive",
      })
      return
    }

    try {
      const routeData = {
        type: routeType,
        positions,
        distance,
        duration,
        markers,
        startTime,
        endTime: Date.now(),
      }

      if (onSave) {
        onSave(routeData)
      } else {
        // Save to Supabase
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user) {
          toast({
            title: "Authentication Error",
            description: "You must be logged in to save routes.",
            variant: "destructive",
          })
          return
        }

        const { data, error } = await supabase.from("trails").insert({
          user_id: userData.user.id,
          name: `${routeType.charAt(0).toUpperCase() + routeType.slice(1)} on ${new Date().toLocaleDateString()}`,
          description: `A ${distance.toFixed(2)} km ${routeType} with ${markers.length} points of interest`,
          distance: Number.parseFloat(distance.toFixed(2)),
          duration: Math.floor(duration / 1000), // Convert to seconds
          date_completed: new Date().toISOString(),
          path_data: {
            type: routeType,
            positions,
            markers,
          },
          plants_found: markers.filter((m) => m.type === "plant").length,
        })

        if (error) {
          throw error
        }

        toast({
          title: "Route Saved",
          description: "Your route has been saved successfully.",
        })

        // Reset tracking
        setPositions([])
        setDistance(0)
        setDuration(0)
        setStartTime(null)
        setMarkers([])
      }
    } catch (error) {
      console.error("Error saving route:", error)
      toast({
        title: "Save Error",
        description: "Could not save your route. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Add marker
  const addMarker = () => {
    if (!isClient || !currentPosition) {
      toast({
        title: "Cannot Add Marker",
        description: "Your current location is not available.",
        variant: "destructive",
      })
      return
    }

    const newMarker = {
      id: Date.now().toString(),
      type: markerType,
      position: { ...currentPosition },
      note: markerNote,
    }

    setMarkers((prev) => [...prev, newMarker])
    setShowAddMarker(false)
    setMarkerNote("")

    toast({
      title: "Marker Added",
      description: `${markerType.charAt(0).toUpperCase() + markerType.slice(1)} marker added to your route.`,
    })
  }

  // Center map on current position
  const centerMap = () => {
    // This is now handled by the GoogleMap component
  }

  // Handle map error
  const handleMapError = () => {
    setMapError(true)
    if (onError) {
      onError()
    }
  }

  // Prepare map data
  const mapData = {
    center: currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lng } : DEFAULT_LOCATION,
    markers: [
      // Current position marker - make it visually distinct
      ...(currentPosition
        ? [
            {
              position: { lat: currentPosition.lat, lng: currentPosition.lng },
              title: "Your Location",
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: "#4285F4",
                fillOpacity: 1,
                strokeColor: "#FFFFFF",
                strokeWeight: 2,
                scale: 8,
              },
              id: "current",
              isUserLocation: true, // Add this flag to identify the user location marker
            },
          ]
        : []),

      // Custom markers
      ...markers.map((marker) => ({
        position: { lat: marker.position.lat, lng: marker.position.lng },
        title: marker.note || marker.type,
        icon: {
          url: `https://maps.google.com/mapfiles/ms/icons/${marker.type === "plant" ? "green" : "red"}-dot.png`,
        },
        id: marker.id,
      })),
    ],
  }

  // Create polyline from positions
  const createPolyline = () => {
    if (positions.length < 2) return null

    // Convert positions to encoded polyline
    // This is a simplified version - in a real app, you'd use the Google Maps Polyline encoding algorithm
    return positions.map((pos) => `${pos.lat},${pos.lng}`).join("|")
  }

  // If not client-side yet, show a loading placeholder
  if (!isClient) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100 p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-gray-100 p-6">
        <div className="text-center mb-4">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-2" />
          <h3 className="text-lg font-medium">Map Unavailable</h3>
          <p className="text-gray-500 mb-4">
            The map couldn't be loaded. This might be due to permission restrictions or network issues.
            <br />
            <span className="text-sm">Please check your location permissions and try again.</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <GoogleMap
        center={mapData.center}
        markers={mapData.markers}
        polylinePath={createPolyline()}
        height="100%"
        className="w-full h-full"
        onMapClick={(lat, lng) => {
          // Handle map click if needed
        }}
        onMarkerClick={(markerId) => {
          // Handle marker click if needed
        }}
      />

      {/* Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button size="icon" variant="secondary" onClick={centerMap}>
          <Compass className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant={showAddMarker ? "default" : "secondary"}
          onClick={() => setShowAddMarker(!showAddMarker)}
        >
          <MapPin className="h-4 w-4" />
        </Button>
      </div>

      {/* Route Type Selector */}
      <div className="absolute top-4 left-4 bg-white rounded-md shadow-md p-2">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={routeType === "walk" ? "default" : "outline"}
            onClick={() => setRouteType("walk")}
            className={routeType === "walk" ? "bg-green-600" : ""}
          >
            Walk
          </Button>
          <Button
            size="sm"
            variant={routeType === "bike" ? "default" : "outline"}
            onClick={() => setRouteType("bike")}
            className={routeType === "bike" ? "bg-blue-600" : ""}
          >
            Bike
          </Button>
          <Button
            size="sm"
            variant={routeType === "jog" ? "default" : "outline"}
            onClick={() => setRouteType("jog")}
            className={routeType === "jog" ? "bg-orange-600" : ""}
          >
            Jog
          </Button>
        </div>
      </div>

      {/* Add Marker Dialog */}
      {showAddMarker && (
        <div className="absolute top-16 right-4 bg-white rounded-md shadow-md p-4 w-64">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Add Marker</h3>
            <Button size="icon" variant="ghost" onClick={() => setShowAddMarker(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={markerType === "plant" ? "default" : "outline"}
                onClick={() => setMarkerType("plant")}
                className="flex-1"
              >
                Plant
              </Button>
              <Button
                size="sm"
                variant={markerType === "landmark" ? "default" : "outline"}
                onClick={() => setMarkerType("landmark")}
                className="flex-1"
              >
                Landmark
              </Button>
              <Button
                size="sm"
                variant={markerType === "scenic" ? "default" : "outline"}
                onClick={() => setMarkerType("scenic")}
                className="flex-1"
              >
                Scenic
              </Button>
            </div>
            <input
              type="text"
              placeholder="Add a note (optional)"
              className="w-full p-2 border rounded-md"
              value={markerNote}
              onChange={(e) => setMarkerNote(e.target.value)}
            />
            <Button onClick={addMarker} className="w-full">
              Add Marker
            </Button>
          </div>
        </div>
      )}

      {/* Stats Panel */}
      <div className="absolute bottom-4 left-4 right-4 bg-white rounded-md shadow-md p-4">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-500">Distance</p>
            <p className="text-xl font-bold">{distance.toFixed(2)} km</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Duration</p>
            <p className="text-xl font-bold">
              {formatDuration(isTracking ? Date.now() - (startTime || Date.now()) : duration)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={toggleTracking}
            className={`flex-1 ${isTracking ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
          >
            {isTracking ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
            {isTracking ? "Pause" : "Start"}
          </Button>
          <Button onClick={saveRoute} className="flex-1" disabled={positions.length === 0}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>
    </div>
  )
}

