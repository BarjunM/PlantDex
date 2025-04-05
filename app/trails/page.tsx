"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Leaf, Route, Map, Plus, Loader2, Calendar, MapPin, Bookmark } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import SavedTreks from "@/components/saved-treks"

export default function TrailsPage() {
  const [loading, setLoading] = useState(true)
  const [userTrails, setUserTrails] = useState<any[]>([])
  const [savedTrails, setSavedTrails] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState("my-trails")
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch user's trails
  useEffect(() => {
    const fetchTrails = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch user's trails
        const { data: trailsData, error: trailsError } = await supabase
          .from("trails")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (trailsError) {
          throw trailsError
        }

        setUserTrails(trailsData || [])

        // Try to fetch saved trails, but handle the case where the table doesn't exist
        try {
          const { data: savedTrailsRelations, error: savedError } = await supabase
            .from("saved_trails")
            .select("trail_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })

          // If there's an error but it's not about the table not existing, throw it
          if (savedError && !savedError.message.includes("does not exist")) {
            throw savedError
          }

          // If we have data, process it
          if (savedTrailsRelations && savedTrailsRelations.length > 0) {
            const savedTrailIds = savedTrailsRelations.map((item) => item.trail_id)

            // Fetch the actual trail data
            const { data: trailsData, error: trailsError } = await supabase
              .from("trails")
              .select("*")
              .in("id", savedTrailIds)

            if (trailsError) {
              throw trailsError
            }

            setSavedTrails(trailsData || [])
          } else {
            // No saved trails or table doesn't exist
            setSavedTrails([])
          }
        } catch (savedTrailsError) {
          console.warn("Saved trails feature not available:", savedTrailsError)
          // Set empty array for saved trails if there's an error
          setSavedTrails([])
        }
      } catch (err) {
        console.error("Error fetching trails:", err)
        toast({
          title: "Error",
          description: "Failed to fetch trails",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTrails()
  }, [user, supabase, toast])

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="container flex h-16 items-center px-4">
          <Link href="/dashboard" className="flex items-center">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>Back to Dashboard</span>
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
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold">Your Trails</h1>
            <div className="flex gap-2">
              <Button onClick={() => router.push("/trails/track")} className="bg-green-600 hover:bg-green-700">
                <Route className="mr-2 h-4 w-4" />
                Track Trail
              </Button>
              <Button onClick={() => router.push("/trails/plan")} variant="outline">
                <Map className="mr-2 h-4 w-4" />
                Plan Route
              </Button>
            </div>
          </div>

          <Tabs defaultValue="my-trails" onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="my-trails">My Trails</TabsTrigger>
              <TabsTrigger value="saved-trails">Saved Trails</TabsTrigger>
            </TabsList>
            <TabsContent value="my-trails">
              {userTrails.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Route className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-xl font-medium mb-2">No Trails Yet</h3>
                    <p className="text-gray-500 text-center mb-6">
                      You haven't recorded any trails yet. Start tracking a new trail or plan a route.
                    </p>
                    <div className="flex gap-4">
                      <Button onClick={() => router.push("/trails/track")} className="bg-green-600 hover:bg-green-700">
                        <Route className="mr-2 h-4 w-4" />
                        Track Trail
                      </Button>
                      <Button onClick={() => router.push("/trails/plan")} variant="outline">
                        <Map className="mr-2 h-4 w-4" />
                        Plan Route
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  {userTrails.map((trail) => (
                    <Card key={trail.id} className="overflow-hidden">
                      <CardHeader className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{trail.name}</CardTitle>
                            <CardDescription>{formatDate(trail.date_completed)}</CardDescription>
                          </div>
                          {trail.path_data?.planned && (
                            <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">Planned</div>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="p-0">
                        <div className="h-[120px] bg-gray-100 relative">
                          {/* Map preview would go here */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Map className="h-8 w-8 text-gray-400" />
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div>
                              <p className="text-gray-500">Distance</p>
                              <p className="font-medium">{trail.distance} km</p>
                            </div>
                            <div>
                              <p className="text-gray-500">Duration</p>
                              <p className="font-medium">
                                {Math.floor(trail.duration / 3600)}h {Math.floor((trail.duration % 3600) / 60)}m
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500">Plants</p>
                              <p className="font-medium">{trail.plants_found}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-4 pt-0 flex justify-between">
                        <Button variant="ghost" size="sm">
                          <Calendar className="mr-2 h-4 w-4" />
                          {trail.path_data?.planned ? "Planned" : "Completed"}
                        </Button>
                        <Button
                          onClick={() => router.push(`/trails/${trail.id}`)}
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                        >
                          View Details
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                  <Card className="flex flex-col items-center justify-center p-6 border-dashed">
                    <Plus className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium mb-2">Add New Trail</h3>
                    <p className="text-gray-500 text-center mb-6">Track a new trail or plan your next adventure</p>
                    <div className="flex gap-4">
                      <Button onClick={() => router.push("/trails/track")} className="bg-green-600 hover:bg-green-700">
                        <Route className="mr-2 h-4 w-4" />
                        Track
                      </Button>
                      <Button onClick={() => router.push("/trails/plan")} variant="outline">
                        <MapPin className="mr-2 h-4 w-4" />
                        Plan
                      </Button>
                    </div>
                  </Card>
                </div>
              )}
            </TabsContent>
            <TabsContent value="saved-trails">
              {savedTrails.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Bookmark className="h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-xl font-medium mb-2">No Saved Trails</h3>
                    <p className="text-gray-500 text-center mb-6">
                      You haven't saved any trails yet. Explore trails and save them for later.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <SavedTreks trails={savedTrails} onTrailClick={(id) => router.push(`/trails/${id}`)} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

