"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { Loader } from "@googlemaps/js-api-loader"
import { Button } from "@/components/ui/button"
import { Compass, AlertTriangle } from "lucide-react"
import { decodePolyline } from "@/lib/google-maps"

interface GoogleMapProps {
  center: { lat: number; lng: number }
  zoom?: number
  markers?: {
    position: { lat: number; lng: number }
    title?: string
    icon?: any
    id?: string
  }[]
  polylinePath?: string
  onMarkerClick?: (markerId: string) => void
  onMapClick?: (lat: number, lng: number) => void
  height?: string
  className?: string
}

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

// Add a function to get the user's current location
// Add this after the fetchMapsApiKey function
const getUserLocation = (
  google: typeof google.maps | null,
  setUserLocation: React.Dispatch<React.SetStateAction<google.maps.LatLng | null>>,
) => {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (google) {
          setUserLocation(new google.maps.LatLng(latitude, longitude))
        }
      },
      (error) => {
        console.error("Error getting user location:", error)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }
}

export default function GoogleMap({
  center,
  zoom = 14,
  markers = [],
  polylinePath,
  onMarkerClick,
  onMapClick,
  height = "500px",
  className = "",
}: GoogleMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [mapMarkers, setMapMarkers] = useState<google.maps.Marker[]>([])
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [googleMapsLoaded, setGoogleMapsLoaded] = useState<boolean>(false)
  const [google, setGoogle] = useState<typeof google.maps | null>(null)

  // Add a new state for user location after the other state declarations
  const [userLocation, setUserLocation] = useState<google.maps.LatLng | null>(null)
  const userMarkerRef = useRef<google.maps.Marker | null>(null)

  // Load Google Maps API
  useEffect(() => {
    const initMap = async () => {
      try {
        // Check if Google Maps API key is available
        const apiKey = await fetchMapsApiKey()
        if (!apiKey) {
          console.error("Google Maps API key is missing")
          setError("Google Maps API key is not configured. Please check your environment variables.")
          setLoading(false)
          return
        }

        const loader = new Loader({
          apiKey,
          version: "weekly",
          libraries: ["places"],
        })

        // Load Google Maps
        const googleMaps = await loader.load()
        setGoogleMapsLoaded(true)
        setGoogle(googleMaps.maps)

        if (!mapRef.current) return

        // Create the map instance
        const mapInstance = new googleMaps.maps.Map(mapRef.current, {
          center,
          zoom,
          mapTypeId: googleMaps.maps.MapTypeId.ROADMAP,
          mapTypeControl: true,
          streetViewControl: false,
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

        setMap(mapInstance)

        // Add click event listener to map
        if (onMapClick) {
          googleMaps.maps.event.addListener(mapInstance, "click", (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
              onMapClick(event.latLng.lat(), event.latLng.lng())
            }
          })
        }

        setLoading(false)

        // Get user location when map is initialized
        if (googleMapsLoaded && google) {
          getUserLocation(google, setUserLocation)

          // Set up a location watcher
          const watchId = navigator.geolocation.watchPosition(
            (position) => {
              const { latitude, longitude } = position.coords
              setUserLocation(new google.maps.LatLng(latitude, longitude))
            },
            (error) => {
              console.error("Error watching position:", error)
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
          )

          return () => {
            if (watchId) {
              navigator.geolocation.clearWatch(watchId)
            }
            if (userMarkerRef.current) {
              userMarkerRef.current.setMap(null)
              const pulseCircle = userMarkerRef.current.get("pulseCircle")
              if (pulseCircle) {
                pulseCircle.setMap(null)
              }
            }
          }
        }
      } catch (err) {
        console.error("Error initializing Google Maps:", err)
        setError("Failed to load Google Maps. Please try again later.")
        setLoading(false)
      }
    }

    initMap()
  }, [center, zoom, onMapClick])

  // Update markers when they change
  useEffect(() => {
    if (!map || !googleMapsLoaded || !google) return

    // Clear existing markers
    mapMarkers.forEach((marker) => marker.setMap(null))

    // Add new markers
    const newMarkers = markers.map((markerData) => {
      const marker = new google.maps.Marker({
        position: markerData.position,
        map,
        title: markerData.title,
        icon: markerData.icon,
      })

      if (onMarkerClick && markerData.id) {
        marker.addListener("click", () => {
          onMarkerClick(markerData.id!)
        })
      }

      return marker
    })

    setMapMarkers(newMarkers)

    // Fit bounds if we have markers
    if (newMarkers.length > 1) {
      const bounds = new google.maps.LatLngBounds()
      newMarkers.forEach((marker) => {
        bounds.extend(marker.getPosition()!)
      })
      map.fitBounds(bounds)
    }
  }, [map, markers, onMarkerClick, googleMapsLoaded, google])

  // Update polyline when path changes
  useEffect(() => {
    if (!map || !googleMapsLoaded || !polylinePath || !google) return

    // Clear existing polyline
    if (polyline) {
      polyline.setMap(null)
    }

    // Decode the polyline
    const path = decodePolyline(polylinePath)

    // Create new polyline
    const newPolyline = new google.maps.Polyline({
      path: path.map(([lat, lng]) => ({ lat, lng })),
      geodesic: true,
      strokeColor: "#4CAF50",
      strokeOpacity: 0.8,
      strokeWeight: 5,
    })

    newPolyline.setMap(map)
    setPolyline(newPolyline)

    // Fit bounds to the polyline
    if (path.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      path.forEach(([lat, lng]) => {
        bounds.extend({ lat, lng })
      })
      map.fitBounds(bounds)
    }
  }, [map, polylinePath, googleMapsLoaded, google])

  // Add a new useEffect to handle the user location marker
  useEffect(() => {
    if (!map || !googleMapsLoaded || !google || !userLocation) return

    // Remove previous user marker if it exists
    if (userMarkerRef.current) {
      userMarkerRef.current.setMap(null)
    }

    // Create a custom icon for the user location
    const userIcon = {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeColor: "#FFFFFF",
      strokeWeight: 2,
      scale: 8,
    }

    // Add the user marker to the map
    userMarkerRef.current = new google.maps.Marker({
      position: userLocation,
      map: map,
      icon: userIcon,
      zIndex: 1000, // Make sure it's on top of other markers
      title: "Your Location",
    })

    // Add a pulsing effect (circle) around the user marker
    const pulseCircle = new google.maps.Circle({
      strokeColor: "#4285F4",
      strokeOpacity: 0.8,
      strokeWeight: 1,
      fillColor: "#4285F4",
      fillOpacity: 0.2,
      map: map,
      center: userLocation,
      radius: 30,
      zIndex: 999,
    })

    // Store the pulse circle for later removal
    userMarkerRef.current.set("pulseCircle", pulseCircle)
  }, [map, googleMapsLoaded, google, userLocation])

  // Center map on current position
  const centerMap = () => {
    if (map) {
      map.setCenter(center)
      map.setZoom(zoom)
    }
  }

  if (error) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gray-100 rounded-lg ${className}`}
        style={{ height }}
      >
        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
        <p className="text-gray-600 mb-2 text-center px-4">{error}</p>
        <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
          Try Again
        </Button>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10 rounded-lg">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mb-2"></div>
            <p className="text-gray-600">Loading map...</p>
          </div>
        </div>
      )}

      <div ref={mapRef} className="h-full w-full rounded-lg" />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
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

