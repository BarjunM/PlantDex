"use client"

import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import { Button } from "@/components/ui/button"
import { Compass, X, AlertTriangle, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"

// Dynamically import the troubleshooter to avoid SSR issues
const MapsTroubleshooter = dynamic(() => import("./maps-troubleshooter"), { ssr: false })

// Function to fetch the Maps API key from our secure endpoint
const fetchMapsApiKey = async (): Promise<string> => {
  try {
    const response = await fetch("/api/maps/key")
    if (!response.ok) {
      throw new Error("Failed to fetch Maps API key")
    }
    const data = await response.json()
    return data.apiKey
  } catch (error) {
    console.error("Error fetching Maps API key:", error)
    return ""
  }
}

interface LiveLocationMapProps {
  height?: string
  className?: string
  onClose?: () => void
}

export default function LiveLocationMap({ height = "400px", className = "", onClose }: LiveLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentMarker, setCurrentMarker] = useState<google.maps.Marker | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [showTroubleshooter, setShowTroubleshooter] = useState(false)
  const { toast } = useToast()

  // Load Google Maps API and initialize map
  useEffect(() => {
    let isMounted = true

    const initMap = async () => {
      try {
        // Check if Google Maps API key is available
        const apiKey = await fetchMapsApiKey()
        if (!apiKey) {
          console.error("Google Maps API key is missing")
          if (isMounted) {
            setError("Google Maps API key is not configured. Please check your environment variables.")
            setLoading(false)
          }
          return
        }

        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places"],
        })

        // Load Google Maps
        try {
          const google = await loader.load()

          if (!isMounted) return

          if (!mapRef.current) return

          // Default location (will be updated with user's location)
          const defaultLocation = { lat: 43.43615, lng: -79.735619 }

          // Create the map instance
          const mapInstance = new google.maps.Map(mapRef.current, {
            center: defaultLocation,
            zoom: 15,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            zoomControl: true,
            styles: [
              {
                featureType: "poi.park",
                elementType: "geometry.fill",
                stylers: [{ color: "#c8e6c9" }],
              },
              {
                featureType: "water",
                elementType: "geometry.fill",
                stylers: [{ color: "#bbdefb" }],
              },
            ],
          })

          if (isMounted) {
            setMap(mapInstance)
            setLoading(false)
          }

          // Create a marker for the user's location
          const marker = new google.maps.Marker({
            position: defaultLocation,
            map: mapInstance,
            title: "Your Location",
            icon: {
              url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            },
          })

          if (isMounted) {
            setCurrentMarker(marker)
          }

          // Start tracking user's location
          startLocationTracking(mapInstance, marker, google, google)
        } catch (mapError) {
          console.error("Error loading Google Maps:", mapError)

          // Check if it's an InvalidKeyMapError
          const errorString = String(mapError)
          if (errorString.includes("InvalidKeyMapError") || errorString.includes("MissingKeyMapError")) {
            setError("Invalid Google Maps API key. Please check your API key configuration.")
          } else {
            setError("Failed to load Google Maps. Please check the console for details.")
          }

          setLoading(false)
        }
      } catch (err) {
        console.error("Error initializing Google Maps:", err)
        if (isMounted) {
          setError("Failed to load Google Maps. Please try again later.")
          setLoading(false)
        }
      }
    }

    initMap()

    // Cleanup function
    return () => {
      isMounted = false
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [toast])

  // Function to start tracking user's location
  const startLocationTracking = (
    mapInstance: google.maps.Map,
    marker: google.maps.Marker,
    google: any, // Declared google variable
    googleMaps: any,
  ) => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Not Available",
        description: "Your browser doesn't support geolocation. Using default location.",
        variant: "warning",
      })
      return
    }

    // First try to get a single position to center the map
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const userLocation = { lat: latitude, lng: longitude }

        // Update marker and center map
        marker.setPosition(userLocation)
        mapInstance.setCenter(userLocation)

        toast({
          title: "Location Found",
          description: "Map centered on your current location.",
        })
      },
      (error) => {
        handleLocationError(error)
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    )

    // Then start watching position for real-time updates
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        const userLocation = { lat: latitude, lng: longitude }

        // Update marker position
        marker.setPosition(userLocation)

        // Create accuracy circle if it doesn't exist
        if (!marker.get("accuracyCircle") && position.coords.accuracy) {
          const circle = new googleMaps.maps.Circle({
            map: mapInstance,
            center: userLocation,
            radius: position.coords.accuracy,
            strokeColor: "#4285F4",
            strokeOpacity: 0.2,
            strokeWeight: 1,
            fillColor: "#4285F4",
            fillOpacity: 0.1,
          })
          marker.set("accuracyCircle", circle)
        }
        // Update accuracy circle if it exists
        else if (marker.get("accuracyCircle") && position.coords.accuracy) {
          const circle = marker.get("accuracyCircle")
          circle.setCenter(userLocation)
          circle.setRadius(position.coords.accuracy)
        }
      },
      (error) => {
        handleLocationError(error)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )

    setWatchId(id)
  }

  // Handle location errors
  const handleLocationError = (error: GeolocationPositionError) => {
    let errorMessage = "Could not access your location. Using default location."

    if (error.code === 1) {
      // Permission denied
      errorMessage = "Location permission denied. Please enable location services to see your position."
    } else if (error.code === 2) {
      // Position unavailable
      errorMessage = "Your location is unavailable. Using default location."
    } else if (error.code === 3) {
      // Timeout
      errorMessage = "Location request timed out. Using default location."
    }

    toast({
      title: "Location Error",
      description: errorMessage,
      variant: "destructive",
    })
  }

  // Center map on current position
  const centerMap = () => {
    if (!map || !currentMarker) return

    const position = currentMarker.getPosition()
    if (position) {
      map.setCenter(position)
      map.setZoom(17)
    }
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        {showTroubleshooter ? (
          <div className="w-full p-4">
            <MapsTroubleshooter />
            <div className="mt-4 flex justify-center">
              <Button variant="outline" size="sm" onClick={() => setShowTroubleshooter(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <>
            <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
            <p className="text-gray-600 mb-2 text-center px-4">{error}</p>
            <div className="flex flex-col gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setShowTroubleshooter(true)}>
                Troubleshoot API Key
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
                onClick={() =>
                  window.open(
                    "https://developers.google.com/maps/documentation/javascript/error-messages#invalid-key-map-error",
                    "_blank",
                  )
                }
              >
                <span>Google Maps Documentation</span>
                <ExternalLink className="h-3 w-3" />
              </Button>
              <Button variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div
      className={`relative rounded-lg overflow-hidden shadow-lg border border-gray-200 ${className}`}
      style={{ height }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 rounded-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      <div ref={mapRef} className="h-full w-full" />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <Button size="icon" variant="secondary" onClick={onClose} className="bg-white shadow-md">
          <X className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="secondary" onClick={centerMap} className="bg-white shadow-md">
          <Compass className="h-4 w-4" />
        </Button>
      </div>

      {/* Map Attribution */}
      <div className="absolute bottom-1 left-1 text-xs text-gray-500 bg-white bg-opacity-75 px-1 rounded">
        © Google Maps
      </div>
    </div>
  )
}

