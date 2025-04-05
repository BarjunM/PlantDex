"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { ArrowLeft, Leaf, Loader2, Save, MapPin, Trash, Route, Search, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import dynamic from "next/dynamic"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"

// Dynamically import LeafletMap with no SSR to avoid window reference issues
const LeafletMap = dynamic(() => import("@/components/leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] flex items-center justify-center bg-gray-100 rounded-lg">
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

type Waypoint = {
  id: string
  position: [number, number]
  note: string
  type?: string
}

type PointOfInterest = {
  id: string
  name: string
  position: [number, number]
  type: string
  vicinity?: string
}

export default function PlanTrailPage() {
  const [loading, setLoading] = useState(true)
  const [routeName, setRouteName] = useState("My Planned Trek")
  const [routeDescription, setRouteDescription] = useState("")
  const [waypoints, setWaypoints] = useState<Waypoint[]>([])
  const [estimatedDistance, setEstimatedDistance] = useState(0)
  const [estimatedDuration, setEstimatedDuration] = useState(0)
  const [isSaving, setIsSaving] = useState(false)
  const [activeTab, setActiveTab] = useState("manual")
  const [targetDistance, setTargetDistance] = useState(3) // Default 3km
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([43.6532, -79.3832]) // Default Toronto
  const [poiTypes, setPoiTypes] = useState({
    park: true,
    natural_feature: true,
    tourist_attraction: false,
    point_of_interest: false,
    museum: false,
  })
  const [nearbyPOIs, setNearbyPOIs] = useState<PointOfInterest[]>([])
  const [selectedPOIs, setSelectedPOIs] = useState<PointOfInterest[]>([])
  const [isGeneratingRoute, setIsGeneratingRoute] = useState(false)
  const [isLoadingPOIs, setIsLoadingPOIs] = useState(false)
  const [routeGenerated, setRouteGenerated] = useState(false)
  const [preferScenicRoutes, setPreferScenicRoutes] = useState(true)
  const [avoidBusyRoads, setAvoidBusyRoads] = useState(true)
  const [includeLoopBack, setIncludeLoopBack] = useState(true)
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    } else if (!authLoading) {
      setLoading(false)
    }
  }, [user, authLoading, router])

  // Get user's current location
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.latitude, position.coords.longitude])
        },
        (error) => {
          console.error("Error getting location:", error)
          // Keep default location
        },
      )
    }
  }, [])

  // Handle adding a waypoint
  const handleAddWaypoint = (position: [number, number]) => {
    const newWaypoint: Waypoint = {
      id: Date.now().toString(),
      position,
      note: `Waypoint ${waypoints.length + 1}`,
    }

    setWaypoints((prev) => [...prev, newWaypoint])

    // Update estimated distance and duration
    if (waypoints.length > 0) {
      const lastWaypoint = waypoints[waypoints.length - 1]
      const newDistance = calculateDistance(
        lastWaypoint.position[0],
        lastWaypoint.position[1],
        position[0],
        position[1],
      )

      setEstimatedDistance((prev) => prev + newDistance)

      // Estimate duration based on walking speed of 5 km/h
      const newDuration = (newDistance / 5) * 60 * 60 // seconds
      setEstimatedDuration((prev) => prev + newDuration)
    }
  }

  // Handle removing a waypoint
  const handleRemoveWaypoint = (id: string) => {
    // Find the waypoint and its index
    const index = waypoints.findIndex((wp) => wp.id === id)
    if (index === -1) return

    // Recalculate distance if removing a middle waypoint
    if (waypoints.length > 1 && index > 0 && index < waypoints.length - 1) {
      const prevWaypoint = waypoints[index - 1]
      const nextWaypoint = waypoints[index + 1]
      const removedWaypoint = waypoints[index]

      // Subtract distance between prev and removed, and removed and next
      const distanceToRemove =
        calculateDistance(
          prevWaypoint.position[0],
          prevWaypoint.position[1],
          removedWaypoint.position[0],
          removedWaypoint.position[1],
        ) +
        calculateDistance(
          removedWaypoint.position[0],
          removedWaypoint.position[1],
          nextWaypoint.position[0],
          nextWaypoint.position[1],
        )

      // Add distance between prev and next
      const distanceToAdd = calculateDistance(
        prevWaypoint.position[0],
        prevWaypoint.position[1],
        nextWaypoint.position[0],
        nextWaypoint.position[1],
      )

      const newDistance = estimatedDistance - distanceToRemove + distanceToAdd
      setEstimatedDistance(Math.max(0, newDistance))

      // Update duration
      const newDuration = (newDistance / 5) * 60 * 60 // seconds
      setEstimatedDuration(Math.max(0, newDuration))
    }
    // If removing the last waypoint
    else if (index === waypoints.length - 1 && index > 0) {
      const prevWaypoint = waypoints[index - 1]
      const removedWaypoint = waypoints[index]

      const distanceToRemove = calculateDistance(
        prevWaypoint.position[0],
        prevWaypoint.position[1],
        removedWaypoint.position[0],
        removedWaypoint.position[1],
      )

      const newDistance = estimatedDistance - distanceToRemove
      setEstimatedDistance(Math.max(0, newDistance))

      // Update duration
      const newDuration = (newDistance / 5) * 60 * 60 // seconds
      setEstimatedDuration(Math.max(0, newDuration))
    }

    // Remove the waypoint
    setWaypoints((prev) => prev.filter((wp) => wp.id !== id))
  }

  // Update waypoint note
  const updateWaypointNote = (id: string, note: string) => {
    setWaypoints((prev) => prev.map((wp) => (wp.id === id ? { ...wp, note } : wp)))
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
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    return `${hours > 0 ? `${hours}h ` : ""}${minutes % 60}m`
  }

  // Fetch nearby points of interest
  const fetchNearbyPOIs = async () => {
    setIsLoadingPOIs(true)
    setNearbyPOIs([])

    try {
      // Get selected POI types
      const selectedTypes = Object.entries(poiTypes)
        .filter(([_, selected]) => selected)
        .map(([type]) => type)

      if (selectedTypes.length === 0) {
        toast({
          title: "No POI types selected",
          description: "Please select at least one type of point of interest",
          variant: "destructive",
        })
        setIsLoadingPOIs(false)
        return
      }

      // Call our API endpoint that proxies to Google Places API
      const promises = selectedTypes.map(async (type) => {
        const response = await fetch(
          `/api/places/nearby?lat=${currentLocation[0]}&lng=${currentLocation[1]}&radius=${targetDistance * 1000}&type=${type}`,
        )

        if (!response.ok) {
          throw new Error(`Failed to fetch ${type} POIs`)
        }

        const data = await response.json()
        return data.results || []
      })

      const results = await Promise.all(promises)

      // Flatten and deduplicate results
      const allPOIs = results.flat()
      const uniquePOIs = Array.from(new Map(allPOIs.map((poi) => [poi.place_id, poi])).values())

      // Convert to our format
      const formattedPOIs: PointOfInterest[] = uniquePOIs.map((poi) => ({
        id: poi.place_id,
        name: poi.name,
        position: [poi.geometry.location.lat, poi.geometry.location.lng],
        type: poi.types[0],
        vicinity: poi.vicinity,
      }))

      setNearbyPOIs(formattedPOIs)

      toast({
        title: "Points of Interest Found",
        description: `Found ${formattedPOIs.length} points of interest nearby`,
      })
    } catch (error) {
      console.error("Error fetching POIs:", error)
      toast({
        title: "Error",
        description: "Failed to fetch nearby points of interest",
        variant: "destructive",
      })
    } finally {
      setIsLoadingPOIs(false)
    }
  }

  // Toggle POI selection
  const togglePOISelection = (poi: PointOfInterest) => {
    if (selectedPOIs.some((p) => p.id === poi.id)) {
      setSelectedPOIs(selectedPOIs.filter((p) => p.id !== poi.id))
    } else {
      setSelectedPOIs([...selectedPOIs, poi])
    }
  }

  // Generate a route based on selected POIs and preferences
  const generateRoute = async () => {
    setIsGeneratingRoute(true)

    try {
      if (selectedPOIs.length === 0) {
        toast({
          title: "No POIs Selected",
          description: "Please select at least one point of interest for your route",
          variant: "destructive",
        })
        setIsGeneratingRoute(false)
        return
      }

      // Start with current location
      const start: Waypoint = {
        id: "start",
        position: [currentLocation[0], currentLocation[1]],
        note: "Starting Point",
        type: "start",
      }

      // Convert selected POIs to waypoints
      const poiWaypoints: Waypoint[] = selectedPOIs.map((poi) => ({
        id: poi.id,
        position: poi.position,
        note: poi.name,
        type: poi.type,
      }))

      // Simple route generation - we'll optimize the order of POIs to create a reasonable route
      // In a real app, you'd use a more sophisticated algorithm or the Google Directions API

      // Sort POIs by distance from start point (greedy algorithm)
      const sortedWaypoints = [...poiWaypoints].sort((a, b) => {
        const distA = calculateDistance(start.position[0], start.position[1], a.position[0], a.position[1])
        const distB = calculateDistance(start.position[0], start.position[1], b.position[0], b.position[1])
        return distA - distB
      })

      // Create a route that visits each POI
      const route: Waypoint[] = [start, ...sortedWaypoints]

      // Add a return to start if loopback is enabled
      if (includeLoopBack) {
        route.push({
          id: "end",
          position: [currentLocation[0], currentLocation[1]],
          note: "End Point (Return to Start)",
          type: "end",
        })
      }

      // Calculate total distance
      let totalDistance = 0
      for (let i = 1; i < route.length; i++) {
        const prev = route[i - 1]
        const curr = route[i]
        totalDistance += calculateDistance(prev.position[0], prev.position[1], curr.position[0], curr.position[1])
      }

      // Update state
      setWaypoints(route)
      setEstimatedDistance(totalDistance)
      setEstimatedDuration((totalDistance / 5) * 60 * 60) // 5 km/h walking speed
      setRouteGenerated(true)

      // Update route name and description
      setRouteName(`${targetDistance}km Trek with ${selectedPOIs.length} Points of Interest`)
      setRouteDescription(
        `A ${totalDistance.toFixed(2)}km route visiting ${selectedPOIs.map((p) => p.name).join(", ")}`,
      )

      toast({
        title: "Route Generated",
        description: `Created a ${totalDistance.toFixed(2)}km route with ${route.length - 1} stops`,
      })
    } catch (error) {
      console.error("Error generating route:", error)
      toast({
        title: "Error",
        description: "Failed to generate route",
        variant: "destructive",
      })
    } finally {
      setIsGeneratingRoute(false)
    }
  }

  // Save the planned route
  const saveRoute = async () => {
    if (waypoints.length < 2) {
      toast({
        title: "Not Enough Waypoints",
        description: "Please add at least two waypoints to create a route.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSaving(true)

      // Convert waypoints to the format expected by the database
      const positions = waypoints.map((wp) => ({
        lat: wp.position[0],
        lng: wp.position[1],
        timestamp: Date.now(),
      }))

      const markers = waypoints.map((wp) => ({
        id: wp.id,
        type: wp.type || "landmark",
        position: {
          lat: wp.position[0],
          lng: wp.position[1],
        },
        note: wp.note,
      }))

      // Save to Supabase
      const { data, error } = await supabase.from("trails").insert({
        user_id: user.id,
        name: routeName || "Planned Trek",
        description: routeDescription || `A planned ${estimatedDistance.toFixed(2)} km trek`,
        distance: Number.parseFloat(estimatedDistance.toFixed(2)),
        duration: Math.floor(estimatedDuration), // In seconds
        date_completed: new Date().toISOString(),
        path_data: {
          type: "walk",
          positions,
          markers,
          planned: true,
          completed: false,
          preferences: {
            targetDistance,
            preferScenicRoutes,
            avoidBusyRoads,
            includeLoopBack,
            poiTypes,
          },
        },
        plants_found: 0, // No plants found yet as this is a planned route
      })

      if (error) {
        throw error
      }

      toast({
        title: "Route Saved",
        description: "Your planned route has been saved successfully.",
      })

      // Redirect to trails page
      router.push("/trails")
    } catch (error) {
      console.error("Error saving route:", error)
      toast({
        title: "Save Error",
        description: "Could not save your route. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Prepare map data
  const getMapData = () => {
    // Convert waypoints to format expected by the map
    const mapMarkers = [
      // Add a marker for the user's current location
      {
        position: currentLocation,
        title: "Your Location",
        icon: "user", // Special icon type for user location
      },

      // Existing waypoint markers
      ...waypoints.map((wp) => ({
        position: wp.position,
        title: wp.note,
        icon: wp.type, // Use type for custom icons
      })),
    ]

    // Create polyline from waypoints
    const polyline = waypoints.map((wp) => wp.position)

    return { markers: mapMarkers, polyline }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const { markers, polyline } = getMapData()

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
            <h1 className="text-2xl font-bold mb-2">Plan Your Trek</h1>
            <p className="text-gray-500">Create personalized walking routes to explore your local community</p>
          </div>

          <Tabs defaultValue="auto" value={activeTab} onValueChange={setActiveTab} className="mb-6">
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="auto">Auto-Generate Route</TabsTrigger>
              <TabsTrigger value="manual">Manual Planning</TabsTrigger>
            </TabsList>

            <TabsContent value="auto" className="mt-4">
              <div className="grid md:grid-cols-5 gap-6">
                <div className="md:col-span-2">
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>Route Preferences</CardTitle>
                      <CardDescription>Customize your walking experience</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label htmlFor="distance">Target Distance: {targetDistance} km</Label>
                        </div>
                        <Slider
                          id="distance"
                          min={1}
                          max={10}
                          step={0.5}
                          value={[targetDistance]}
                          onValueChange={(value) => setTargetDistance(value[0])}
                        />
                        <p className="text-xs text-gray-500">
                          Walking time: ~{Math.round((targetDistance / 5) * 60)} minutes
                        </p>
                      </div>

                      <div className="space-y-3">
                        <Label>Points of Interest</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="poi-park"
                              checked={poiTypes.park}
                              onCheckedChange={(checked) => setPoiTypes({ ...poiTypes, park: !!checked })}
                            />
                            <Label htmlFor="poi-park">Parks</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="poi-nature"
                              checked={poiTypes.natural_feature}
                              onCheckedChange={(checked) => setPoiTypes({ ...poiTypes, natural_feature: !!checked })}
                            />
                            <Label htmlFor="poi-nature">Natural Features</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="poi-attraction"
                              checked={poiTypes.tourist_attraction}
                              onCheckedChange={(checked) => setPoiTypes({ ...poiTypes, tourist_attraction: !!checked })}
                            />
                            <Label htmlFor="poi-attraction">Attractions</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="poi-interest"
                              checked={poiTypes.point_of_interest}
                              onCheckedChange={(checked) => setPoiTypes({ ...poiTypes, point_of_interest: !!checked })}
                            />
                            <Label htmlFor="poi-interest">Points of Interest</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox
                              id="poi-museum"
                              checked={poiTypes.museum}
                              onCheckedChange={(checked) => setPoiTypes({ ...poiTypes, museum: !!checked })}
                            />
                            <Label htmlFor="poi-museum">Museums</Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <Label>Route Options</Label>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="scenic-routes" className="cursor-pointer">
                              Prefer scenic routes
                            </Label>
                            <Switch
                              id="scenic-routes"
                              checked={preferScenicRoutes}
                              onCheckedChange={setPreferScenicRoutes}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="avoid-busy" className="cursor-pointer">
                              Avoid busy roads
                            </Label>
                            <Switch id="avoid-busy" checked={avoidBusyRoads} onCheckedChange={setAvoidBusyRoads} />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label htmlFor="loop-back" className="cursor-pointer">
                              Return to starting point
                            </Label>
                            <Switch id="loop-back" checked={includeLoopBack} onCheckedChange={setIncludeLoopBack} />
                          </div>
                        </div>
                      </div>

                      <Button onClick={fetchNearbyPOIs} className="w-full" disabled={isLoadingPOIs}>
                        {isLoadingPOIs ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Finding Points of Interest...
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            Find Points of Interest
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {nearbyPOIs.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Nearby Points of Interest</CardTitle>
                        <CardDescription>
                          Select points to include in your route
                          {selectedPOIs.length > 0 && ` (${selectedPOIs.length} selected)`}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="max-h-[300px] overflow-y-auto space-y-2">
                          {nearbyPOIs.map((poi) => (
                            <div
                              key={poi.id}
                              className={`p-2 border rounded-md cursor-pointer transition-colors ${
                                selectedPOIs.some((p) => p.id === poi.id)
                                  ? "border-green-500 bg-green-50"
                                  : "hover:bg-gray-50"
                              }`}
                              onClick={() => togglePOISelection(poi)}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium">{poi.name}</p>
                                  <p className="text-xs text-gray-500">{poi.vicinity}</p>
                                </div>
                                {selectedPOIs.some((p) => p.id === poi.id) && (
                                  <Check className="h-4 w-4 text-green-500" />
                                )}
                              </div>
                              <div className="mt-1">
                                <Badge variant="outline" className="text-xs">
                                  {poi.type.replace("_", " ")}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="mt-4">
                          <Button
                            onClick={generateRoute}
                            className="w-full bg-green-600 hover:bg-green-700"
                            disabled={isGeneratingRoute || selectedPOIs.length === 0}
                          >
                            {isGeneratingRoute ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating Route...
                              </>
                            ) : (
                              <>
                                <Route className="mr-2 h-4 w-4" />
                                Generate Route
                              </>
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <div className="md:col-span-3">
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>Route Preview</CardTitle>
                      <CardDescription>
                        {routeGenerated
                          ? `${estimatedDistance.toFixed(2)}km route with ${waypoints.length - 1} stops`
                          : "Your route will appear here after generation"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <LeafletMap
                        mode="view"
                        height="400px"
                        markers={markers}
                        polyline={polyline}
                        initialCenter={currentLocation}
                      />
                    </CardContent>
                  </Card>

                  {routeGenerated && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Route Details</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="route-name">Route Name</Label>
                          <Input
                            id="route-name"
                            value={routeName}
                            onChange={(e) => setRouteName(e.target.value)}
                            placeholder="My Trek Route"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="route-description">Description</Label>
                          <Textarea
                            id="route-description"
                            value={routeDescription}
                            onChange={(e) => setRouteDescription(e.target.value)}
                            placeholder="Describe your route..."
                            rows={3}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <p className="text-sm text-gray-500">Estimated Distance</p>
                            <p className="text-xl font-bold">{estimatedDistance.toFixed(2)} km</p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-500">Estimated Duration</p>
                            <p className="text-xl font-bold">{formatDuration(estimatedDuration)}</p>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Button
                          onClick={saveRoute}
                          className="w-full bg-green-600 hover:bg-green-700"
                          disabled={waypoints.length < 2 || isSaving}
                        >
                          {isSaving ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="mr-2 h-4 w-4" />
                              Save Route
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="manual" className="mt-4">
              <div className="grid md:grid-cols-5 gap-6">
                <div className="md:col-span-3">
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>Route Map</CardTitle>
                      <CardDescription>Click on the map to add waypoints to your route</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <LeafletMap
                        mode="plan"
                        height="400px"
                        markers={markers}
                        polyline={polyline}
                        onMarkerAdded={handleAddWaypoint}
                        initialCenter={currentLocation}
                      />
                    </CardContent>
                  </Card>
                </div>

                <div className="md:col-span-2">
                  <Card className="mb-6">
                    <CardHeader>
                      <CardTitle>Route Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <label htmlFor="route-name" className="text-sm font-medium">
                          Route Name
                        </label>
                        <Input
                          id="route-name"
                          value={routeName}
                          onChange={(e) => setRouteName(e.target.value)}
                          placeholder="My Trek Route"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="route-description" className="text-sm font-medium">
                          Description
                        </label>
                        <Textarea
                          id="route-description"
                          value={routeDescription}
                          onChange={(e) => setRouteDescription(e.target.value)}
                          placeholder="Describe your route..."
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div>
                          <p className="text-sm text-gray-500">Estimated Distance</p>
                          <p className="text-xl font-bold">{estimatedDistance.toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Estimated Duration</p>
                          <p className="text-xl font-bold">{formatDuration(estimatedDuration)}</p>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Button
                        onClick={saveRoute}
                        className="w-full bg-green-600 hover:bg-green-700"
                        disabled={waypoints.length < 2 || isSaving}
                      >
                        {isSaving ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Route
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Waypoints</CardTitle>
                      <CardDescription>
                        {waypoints.length === 0
                          ? "Click on the map to add waypoints"
                          : `${waypoints.length} waypoints added`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {waypoints.length === 0 ? (
                        <div className="text-center py-6 text-gray-500">
                          <MapPin className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                          <p>No waypoints added yet</p>
                          <p className="text-sm">Click on the map to add waypoints to your route</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                          {waypoints.map((waypoint, index) => (
                            <div key={waypoint.id} className="flex items-center gap-2 border rounded-md p-2">
                              <div className="bg-green-100 text-green-800 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                                {index + 1}
                              </div>
                              <input
                                className="flex-1 text-sm border-0 bg-transparent focus:ring-0 p-0"
                                value={waypoint.note}
                                onChange={(e) => updateWaypointNote(waypoint.id, e.target.value)}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleRemoveWaypoint(waypoint.id)}
                                className="h-8 w-8 text-gray-500 hover:text-red-500"
                              >
                                <Trash className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

