"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Compass } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Import Leaflet dynamically to avoid SSR issues
let L: any = null

// New state for user location
// Fix: Initialize userLocation outside the component to avoid conditional hook call
const initialUserLocation: [number, number] | null = null

// Fix Leaflet icon issues
const fixLeafletIcon = () => {
  if (!L) return

  // Fix icon paths
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
  })
}

// Add a function to get the user's current location
const getUserLocation = () => {
  if (typeof navigator !== "undefined" && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setUserLocation([latitude, longitude])
      },
      (error) => {
        console.error("Error getting user location:", error)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    )
  }
}

// Custom icon mapping
const getCustomIcon = (type: string | undefined) => {
  if (!L) return null

  const iconMapping: Record<string, any> = {
    user: L.divIcon({
      className: "user-location-marker",
      html: `<div style="background-color: #4285F4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    }),
    start: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    end: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    park: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    natural_feature: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    tourist_attraction: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    point_of_interest: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    museum: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    green: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    red: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
    blue: L.icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
      shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      shadowSize: [41, 41],
    }),
  }

  return type && iconMapping[type] ? iconMapping[type] : null
}

type Position = {
  lat: number
  lng: number
  timestamp: number
}

type LeafletMapProps = {
  mode?: "track" | "plan" | "view"
  initialCenter?: [number, number]
  markers?: Array<{
    position: [number, number]
    title?: string
    icon?: string
  }>
  polyline?: [number, number][]
  onPositionUpdate?: (position: Position) => void
  onMarkerAdded?: (position: [number, number]) => void
  onRouteUpdate?: (positions: Position[]) => void
  height?: string
  className?: string
}

export default function LeafletMap({
  mode = "view",
  initialCenter = [43.6532, -79.3832], // Toronto as default
  markers = [],
  polyline = [],
  onPositionUpdate,
  onMarkerAdded,
  onRouteUpdate,
  height = "400px",
  className = "",
}: LeafletMapProps) {
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const positionMarkerRef = useRef<any>(null)
  const accuracyCircleRef = useRef<any>(null)
  const polylineRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const positionsRef = useRef<Position[]>([])
  const watchIdRef = useRef<number | null>(null)
  const [isMapReady, setIsMapReady] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const { toast } = useToast()
  const resizeObserverRef = useRef<ResizeObserver | null>(null)
  const userMarkerRef = useRef<any>(null)

  // Use the initialUserLocation to initialize the state
  const [userLocation, setUserLocation] = useState<[number, number] | null>(initialUserLocation)

  // Check if we're in the browser
  useEffect(() => {
    setIsClient(true)

    // Import Leaflet CSS
    const linkElement = document.createElement("link")
    linkElement.rel = "stylesheet"
    linkElement.href = "https://unpkg.com/leaflet@1.7.1/dist/leaflet.css"
    linkElement.integrity =
      "sha512-xodZBNTC5n17Xt2atTPuE1HxjVMSvLVW9ocqUKLsCC5CXdbqCmblAshOMAS6/keqq/sMZMZ19scR4PsZChSR7A=="
    linkElement.crossOrigin = ""
    document.head.appendChild(linkElement)

    // Dynamically import Leaflet only on the client side
    const loadLeaflet = async () => {
      try {
        L = await import("leaflet")
        // Now that L is loaded, we can fix the icon
        fixLeafletIcon()
      } catch (error) {
        console.error("Failed to load Leaflet:", error)
      }
    }

    loadLeaflet()

    return () => {
      // Clean up the added stylesheet when component unmounts
      document.head.removeChild(linkElement)
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isClient || !L || !mapContainerRef.current) return

    // Create map
    const map = L.map(mapContainerRef.current, {
      // Add these options to ensure proper rendering
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: true,
      dragging: true,
      preferCanvas: true,
    }).setView(initialCenter, 13)

    // Add tile layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map)

    // Store map reference
    mapRef.current = map

    // Get user location when map is initialized
    getUserLocation()

    setIsMapReady(true)

    // Create a ResizeObserver to watch for container size changes
    if (typeof ResizeObserver !== "undefined") {
      resizeObserverRef.current = new ResizeObserver(() => {
        if (map) {
          // Use a small timeout to ensure the container has fully resized
          setTimeout(() => {
            map.invalidateSize()
          }, 100)
        }
      })

      if (mapContainerRef.current) {
        resizeObserverRef.current.observe(mapContainerRef.current)
      }
    }

    // Force map to update its size after rendering
    setTimeout(() => {
      if (map) {
        map.invalidateSize()
      }
    }, 300)

    // Set up a location watcher if in track mode
    if (mode === "track") {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setUserLocation([latitude, longitude])
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
      }
    }

    // Cleanup
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }

      if (resizeObserverRef.current && mapContainerRef.current) {
        resizeObserverRef.current.unobserve(mapContainerRef.current)
        resizeObserverRef.current.disconnect()
      }

      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
        if (userMarkerRef.current.pulseCircle) {
          userMarkerRef.current.pulseCircle.remove()
        }
      }

      map.remove()
    }
  }, [initialCenter, isClient, mode])

  // Handle markers
  useEffect(() => {
    if (!isClient || !isMapReady || !mapRef.current || !L) return

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Add new markers
    markers.forEach((marker) => {
      // Check if we have a custom icon for this marker type
      const customIcon = getCustomIcon(marker.icon)

      // Create marker with custom icon if available
      const newMarker = customIcon ? L.marker(marker.position, { icon: customIcon }) : L.marker(marker.position)

      if (marker.title) {
        newMarker.bindPopup(marker.title)
      }

      newMarker.addTo(mapRef.current)
      markersRef.current.push(newMarker)
    })

    // Add user location marker if available
    if (userLocation && mapRef.current && L) {
      // Remove previous user marker if it exists
      if (userMarkerRef.current) {
        userMarkerRef.current.remove()
      }

      // Create a custom icon for the user location
      const userIcon = L.divIcon({
        className: "user-location-marker",
        html: `<div style="background-color: #4285F4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      })

      // Add the user marker to the map
      userMarkerRef.current = L.marker(userLocation, {
        icon: userIcon,
        zIndexOffset: 1000, // Make sure it's on top of other markers
      }).addTo(mapRef.current)

      // Add a pulsing effect
      const pulseCircle = L.circle(userLocation, {
        color: "#4285F4",
        fillColor: "#4285F4",
        fillOpacity: 0.2,
        weight: 1,
        radius: 30,
      }).addTo(mapRef.current)

      // Store the pulse circle for later removal
      userMarkerRef.current.pulseCircle = pulseCircle
    }
  }, [markers, isMapReady, isClient, userLocation])

  // Handle polyline
  useEffect(() => {
    if (!isClient || !isMapReady || !mapRef.current || !L) return

    // Remove existing polyline
    if (polylineRef.current) {
      polylineRef.current.remove()
    }

    // Add new polyline if there are points
    if (polyline && polyline.length > 0) {
      polylineRef.current = L.polyline(polyline, {
        color: "#10b981",
        weight: 5,
        opacity: 0.8,
        smoothFactor: 1,
      }).addTo(mapRef.current)

      // Fit map to polyline bounds with padding
      try {
        mapRef.current.fitBounds(polylineRef.current.getBounds(), {
          padding: [50, 50],
          maxZoom: 16,
        })
      } catch (error) {
        console.error("Error fitting bounds:", error)
      }
    }
  }, [polyline, isMapReady, isClient])

  // Handle tracking mode
  useEffect(() => {
    if (!isClient || !isMapReady || !mapRef.current || mode !== "track" || !L) return

    const startTracking = () => {
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        toast({
          title: "Geolocation Error",
          description: "Your browser doesn't support geolocation",
          variant: "destructive",
        })
        return
      }

      // Clear previous tracking
      positionsRef.current = []

      // Start watching position
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          const newPosition = {
            lat: latitude,
            lng: longitude,
            timestamp: position.timestamp,
          }

          // Update positions array
          positionsRef.current.push(newPosition)

          // Update polyline
          if (polylineRef.current) {
            polylineRef.current.remove()
          }

          const positions = positionsRef.current.map((pos) => [pos.lat, pos.lng] as [number, number])
          polylineRef.current = L.polyline(positions, {
            color: "#10b981",
            weight: 5,
            opacity: 0.8,
            smoothFactor: 1,
          }).addTo(mapRef.current)

          // Update position marker
          if (positionMarkerRef.current) {
            positionMarkerRef.current.setLatLng([latitude, longitude])
          } else {
            positionMarkerRef.current = L.marker([latitude, longitude], {
              icon: L.divIcon({
                className: "current-location-marker",
                html: `<div style="background-color: #4285F4; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.3);"></div>`,
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              }),
            }).addTo(mapRef.current)
          }

          // Update accuracy circle
          if (accuracyCircleRef.current) {
            accuracyCircleRef.current.setLatLng([latitude, longitude])
            accuracyCircleRef.current.setRadius(accuracy)
          } else {
            accuracyCircleRef.current = L.circle([latitude, longitude], {
              radius: accuracy,
              color: "#4285F4",
              fillColor: "#4285F4",
              fillOpacity: 0.2,
              weight: 1,
            }).addTo(mapRef.current)
          }

          // Center map on position
          mapRef.current.setView([latitude, longitude], mapRef.current.getZoom() || 15)

          // Call position update callback
          if (onPositionUpdate) {
            onPositionUpdate(newPosition)
          }

          // Call route update callback
          if (onRouteUpdate) {
            onRouteUpdate([...positionsRef.current])
          }
        },
        (error) => {
          console.error("Geolocation error:", error)
          toast({
            title: "Location Error",
            description: `Failed to get your location: ${error.message}`,
            variant: "destructive",
          })
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 5000,
        },
      )
    }

    startTracking()

    // Cleanup
    return () => {
      if (watchIdRef.current !== null && typeof navigator !== "undefined") {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isMapReady, mode, onPositionUpdate, onRouteUpdate, toast, isClient])

  // Handle planning mode
  useEffect(() => {
    if (!isClient || !isMapReady || !mapRef.current || mode !== "plan" || !L) return

    const handleMapClick = (e: any) => {
      const { lat, lng } = e.latlng

      // Add marker at clicked position
      const marker = L.marker([lat, lng]).addTo(mapRef.current)
      markersRef.current.push(marker)

      // Call marker added callback
      if (onMarkerAdded) {
        onMarkerAdded([lat, lng])
      }

      // Update polyline if there are multiple markers
      if (markersRef.current.length > 1) {
        const positions = markersRef.current.map((marker) => marker.getLatLng())

        if (polylineRef.current) {
          polylineRef.current.remove()
        }

        polylineRef.current = L.polyline(positions, {
          color: "#10b981",
          weight: 5,
          opacity: 0.8,
          smoothFactor: 1,
        }).addTo(mapRef.current)
      }
    }

    // Add click event listener
    mapRef.current.on("click", handleMapClick)

    // Cleanup
    return () => {
      if (mapRef.current) {
        mapRef.current.off("click", handleMapClick)
      }
    }
  }, [isMapReady, mode, onMarkerAdded, isClient])

  // Center map on current position
  const centerOnCurrentPosition = () => {
    if (!isClient || !mapRef.current) return

    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast({
        title: "Geolocation Error",
        description: "Your browser doesn't support geolocation",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        if (mapRef.current) {
          mapRef.current.setView([latitude, longitude], 15)
        }
      },
      (error) => {
        console.error("Geolocation error:", error)
        toast({
          title: "Location Error",
          description: `Failed to get your location: ${error.message}`,
          variant: "destructive",
        })
      },
    )
  }

  // If not client-side yet, show a loading placeholder
  if (!isClient) {
    return (
      <div className={`w-full flex items-center justify-center bg-gray-100 rounded-md ${className}`} style={{ height }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p>Loading map...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative w-full h-full ${className}`} style={{ height }}>
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-md overflow-hidden"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        <Button size="icon" variant="secondary" onClick={centerOnCurrentPosition} className="bg-white shadow-md">
          <Compass className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

