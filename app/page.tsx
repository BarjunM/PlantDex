"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Leaf, Camera, Map, Trophy, Users, MapPin, Loader2 } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import dynamic from "next/dynamic"

// Dynamically import the map component with no SSR to avoid hydration issues
const LiveLocationMap = dynamic(() => import("@/components/live-location-map"), {
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

export default function Home() {
  const [isMapButtonVisible, setIsMapButtonVisible] = useState(false)
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const { toast } = useToast()

  // Check if geolocation is available when component mounts
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      setIsMapButtonVisible(true)
    }

    // We'll check for Maps functionality at runtime instead of using the env var directly
  }, [])

  // Function to handle opening the embedded map
  const handleOpenMap = () => {
    setIsGettingLocation(true)

    // Notify user that we're accessing their location
    toast({
      title: "Accessing Location",
      description: "Please allow location access to see your position on the map.",
    })

    // Short delay to show loading state
    setTimeout(() => {
      setShowMap(true)
      setIsGettingLocation(false)
    }, 500)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="px-4 lg:px-6 h-16 flex items-center border-b">
        <Link className="flex items-center gap-2 font-semibold" href="#">
          <Leaf className="h-6 w-6 text-emerald-500" />
          <span className="text-xl font-bold">PlantDex</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Features
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
            About
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#">
            Contact
          </Link>
        </nav>
      </header>
      <main className="flex-1">
        {/* Embedded Map (shown when Open Maps is clicked) */}
        {showMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-4xl h-[80vh]">
              <LiveLocationMap height="100%" className="w-full" onClose={() => setShowMap(false)} />
            </div>
          </div>
        )}

        <section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-emerald-50 to-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Leaf className="h-12 w-12 text-emerald-500" />
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                Your Pocket Plant Encyclopedia
              </h1>
              <p className="max-w-[700px] text-gray-500 md:text-xl/relaxed">
                Identify plants, learn about their properties, and build your personal collection with PlantDex.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/auth/register">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">Get Started</Button>
                </Link>
                <Link href="/features">
                  <Button variant="outline">Learn More</Button>
                </Link>
                {isMapButtonVisible && (
                  <Button
                    variant="outline"
                    className="flex items-center gap-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
                    onClick={handleOpenMap}
                    disabled={isGettingLocation}
                  >
                    {isGettingLocation ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Getting Location...</span>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-4 w-4" />
                        <span>Open Maps</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Rest of the page content remains the same */}
        <section className="w-full py-12 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
              <div className="inline-block rounded-lg bg-emerald-100 px-3 py-1 text-sm text-emerald-600">
                How It Works
              </div>
              <h2 className="text-3xl font-bold tracking-tighter">Explore Nature Like Never Before</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="border-none shadow-md">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <Camera className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold">Snap</h3>
                  <p className="text-sm text-gray-500">Take a photo of any plant you encounter</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <Leaf className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold">Identify</h3>
                  <p className="text-sm text-gray-500">Our AI instantly identifies the plant species</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <Trophy className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold">Collect</h3>
                  <p className="text-sm text-gray-500">Add plants to your personal collection</p>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                  <div className="bg-emerald-100 p-3 rounded-full">
                    <Users className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="font-semibold">Share</h3>
                  <p className="text-sm text-gray-500">Connect with other plant enthusiasts</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features section and remaining content stays the same */}
        <section className="w-full py-12 md:py-24 bg-emerald-50">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center mb-8">
              <div className="inline-block rounded-lg bg-emerald-100 px-3 py-1 text-sm text-emerald-600">Features</div>
              <h2 className="text-3xl font-bold tracking-tighter">Everything You Need</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Leaf className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Plant Identification</h3>
                      <p className="text-sm text-gray-500">
                        Instantly identify thousands of plant species with just a photo
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Map className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Location Tracking</h3>
                      <p className="text-sm text-gray-500">Remember where you found each plant with GPS tracking</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Trophy className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Achievements</h3>
                      <p className="text-sm text-gray-500">
                        Earn badges and track your progress as you build your collection
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Community</h3>
                      <p className="text-sm text-gray-500">
                        Connect with other plant enthusiasts and share your discoveries
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Camera className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Offline Mode</h3>
                      <p className="text-sm text-gray-500">
                        Access your plant collection even without internet connection
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-none shadow-md">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="bg-emerald-100 p-2 rounded-full">
                      <Leaf className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-2">Plant Details</h3>
                      <p className="text-sm text-gray-500">
                        Learn about edibility, medicinal uses, and care instructions
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="w-full py-12 md:py-24">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center justify-center space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tighter">Ready to Start Your Plant Journey?</h2>
              <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed">
                Join thousands of plant enthusiasts who are discovering and learning about plants every day.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/auth/register">
                  <Button className="bg-emerald-500 hover:bg-emerald-600 text-white">Sign Up Free</Button>
                </Link>
                <Link href="/auth/login">
                  <Button variant="outline">Log In</Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full border-t px-4 md:px-6">
        <p className="text-xs text-gray-500">© 2025 PlantDex. All rights reserved.</p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  )
}

