"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// Simulated geocoding service
const geocodeLocation = async (query: string): Promise<{ lat: number; lng: number; display_name: string } | null> => {
  // In a real app, you would use a geocoding service like Google Maps, Mapbox, or OpenStreetMap Nominatim
  // This is a simplified simulation
  await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate network delay

  // Some hardcoded locations for demo purposes
  const locations = {
    "san francisco": { lat: 37.7749, lng: -122.4194, display_name: "San Francisco, CA, USA" },
    "new york": { lat: 40.7128, lng: -74.006, display_name: "New York City, NY, USA" },
    london: { lat: 51.5074, lng: -0.1278, display_name: "London, UK" },
    tokyo: { lat: 35.6762, lng: 139.6503, display_name: "Tokyo, Japan" },
    sydney: { lat: -33.8688, lng: 151.2093, display_name: "Sydney, Australia" },
  }

  // Try to match the query to our hardcoded locations
  const normalizedQuery = query.toLowerCase().trim()
  for (const [key, location] of Object.entries(locations)) {
    if (key.includes(normalizedQuery) || normalizedQuery.includes(key)) {
      return location
    }
  }

  // If no match, generate a random location near San Francisco
  if (normalizedQuery.length > 0) {
    return {
      lat: 37.7749 + (Math.random() - 0.5) * 0.1,
      lng: -122.4194 + (Math.random() - 0.5) * 0.1,
      display_name: `${query} (Simulated Location)`,
    }
  }

  return null
}

interface LocationInputProps {
  onLocationSelect: (location: { lat: number; lng: number; display_name: string }) => void
  defaultLocation?: { lat: number; lng: number; display_name: string }
  placeholder?: string
}

export default function LocationInput({
  onLocationSelect,
  defaultLocation,
  placeholder = "Enter your location",
}: LocationInputProps) {
  const [query, setQuery] = useState("")
  const [searchResults, setSearchResults] = useState<Array<{ lat: number; lng: number; display_name: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const { toast } = useToast()

  // Set default query if defaultLocation is provided
  useEffect(() => {
    if (defaultLocation && defaultLocation.display_name) {
      setQuery(defaultLocation.display_name)
    }
  }, [defaultLocation])

  const handleSearch = async () => {
    if (!query.trim()) return

    setIsSearching(true)
    try {
      const result = await geocodeLocation(query)
      if (result) {
        setSearchResults([result])
        setShowResults(true)
      } else {
        setSearchResults([])
        toast({
          title: "Location Not Found",
          description: "Could not find the location you entered. Please try again.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error searching for location:", error)
      toast({
        title: "Search Error",
        description: "An error occurred while searching for the location.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }

  const handleSelectLocation = (location: { lat: number; lng: number; display_name: string }) => {
    setQuery(location.display_name)
    setShowResults(false)
    onLocationSelect(location)
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch()
              }
            }}
            onFocus={() => {
              if (searchResults.length > 0) {
                setShowResults(true)
              }
            }}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !query.trim()} variant="outline">
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {showResults && searchResults.length > 0 && (
        <Card className="absolute z-10 w-full mt-1">
          <CardContent className="p-0">
            <ul className="py-2">
              {searchResults.map((result, index) => (
                <li
                  key={index}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelectLocation(result)}
                >
                  <div className="flex items-center">
                    <MapPin className="h-4 w-4 mr-2 text-gray-500" />
                    <span>{result.display_name}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

