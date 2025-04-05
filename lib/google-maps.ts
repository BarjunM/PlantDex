// Google Maps API utility functions

// Types for Google Maps API responses
export interface PlaceResult {
  place_id: string
  name: string
  vicinity?: string
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
  types: string[]
  photos?: {
    photo_reference: string
    height: number
    width: number
  }[]
  rating?: number
  user_ratings_total?: number
}

export interface RouteResult {
  distance: {
    text: string
    value: number // in meters
  }
  duration: {
    text: string
    value: number // in seconds
  }
  start_location: {
    lat: number
    lng: number
  }
  end_location: {
    lat: number
    lng: number
  }
  steps: {
    distance: {
      text: string
      value: number
    }
    duration: {
      text: string
      value: number
    }
    start_location: {
      lat: number
      lng: number
    }
    end_location: {
      lat: number
      lng: number
    }
    polyline: {
      points: string
    }
    travel_mode: string
    instructions: string
  }[]
  overview_polyline: {
    points: string
  }
}

// Search for nearby places based on location and type
export async function searchNearbyPlaces(
  lat: number,
  lng: number,
  radius = 5000,
  type = "park",
  keyword?: string,
): Promise<PlaceResult[]> {
  try {
    // Since we're in the browser, we need to use a proxy or serverless function
    // to make this request to avoid CORS issues
    let url = `/api/places/nearby?lat=${lat}&lng=${lng}&radius=${radius}&type=${type}`

    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch nearby places: ${response.statusText}`)
    }

    const data = await response.json()
    return data.results || []
  } catch (error) {
    console.error("Error searching for nearby places:", error)
    throw error
  }
}

// Get directions between multiple waypoints
export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  waypoints: { lat: number; lng: number }[] = [],
  travelMode: "walking" | "bicycling" | "driving" = "walking",
): Promise<RouteResult[]> {
  try {
    const waypointsStr = waypoints.map((wp) => `${wp.lat},${wp.lng}`).join("|")

    // Use our API route to proxy the request
    const url = `/api/directions?origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=optimize:true|${waypointsStr}&mode=${travelMode}`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch directions: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status !== "OK") {
      throw new Error(`Directions API error: ${data.status}`)
    }

    return data.routes[0].legs || []
  } catch (error) {
    console.error("Error getting directions:", error)
    throw error
  }
}

// Decode Google's polyline format
export function decodePolyline(encoded: string): [number, number][] {
  if (!encoded || encoded.length === 0) {
    return []
  }

  const poly: [number, number][] = []
  let index = 0
  const len = encoded.length
  let lat = 0
  let lng = 0

  while (index < len) {
    let b
    let shift = 0
    let result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lat += dlat

    shift = 0
    result = 0

    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)

    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
    lng += dlng

    poly.push([lat / 1e5, lng / 1e5])
  }

  return poly
}

// Calculate the distance between two points in kilometers
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180)
}

