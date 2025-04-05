"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Leaf, Utensils, Heart, AlertTriangle, MapPin, Loader2, Calendar } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"

export default function PlantDetailsPage({ params }: { params: { id: string } }) {
  const [plant, setPlant] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)
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

  // Fetch plant data
  useEffect(() => {
    const fetchPlant = async () => {
      if (!user) return
      if (!params.id) return

      try {
        setLoading(true)

        // Fetch plant
        const { data, error } = await supabase.from("plants").select("*").eq("id", params.id).single()

        if (error) {
          throw error
        }

        setPlant(data)
      } catch (err) {
        console.error("Error fetching plant:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch plant details",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchPlant()
  }, [user, supabase, params.id, toast])

  // Generate a placeholder color based on the plant name
  const getPlaceholderColor = (name: string) => {
    const colors = ["#10b981", "#059669", "#047857", "#065f46", "#064e3b"]
    let hash = 0
    for (let i = 0; i < name?.length || 0; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }

    return colors[Math.abs(hash) % colors.length]
  }

  const placeholderColor = getPlaceholderColor(plant?.common_name || "Plant")

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Check if the image_url is a base64 string
  const isBase64Image =
    plant?.image_url && (plant.image_url.startsWith("data:image/") || plant.image_url.startsWith("data:application/"))

  // Determine the image source
  const imageSource = isBase64Image
    ? plant?.image_url
    : plant?.image_url && plant.image_url !== "null" && !plant.image_url.includes("undefined")
      ? plant.image_url
      : `/placeholder.svg?height=400&width=400&text=${encodeURIComponent(plant?.common_name || "Plant")}`

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !plant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || "Plant not found"}</p>
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Back to Dashboard
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="container flex h-16 items-center px-4">
          <Link href="/dashboard" className="flex items-center">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="ml-auto flex items-center gap-4">
            <Link className="flex items-center gap-2 font-semibold" href="/">
              <Leaf className="h-6 w-6 text-emerald-500" />
              <span className="text-xl font-bold">PlantDex</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-6">
        <div className="max-w-4xl mx-auto">
          <div className="grid gap-6 md:grid-cols-[2fr_3fr]">
            <div>
              <div className="rounded-lg overflow-hidden border shadow-md aspect-square">
                {!imageError ? (
                  <img
                    src={imageSource || "/placeholder.svg"}
                    alt={plant.common_name}
                    className="object-cover w-full h-full"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ backgroundColor: placeholderColor }}
                  >
                    <Leaf className="h-16 w-16 text-white opacity-70" />
                  </div>
                )}
              </div>

              <div className="mt-4 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Plant Properties</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div
                        className={`flex flex-col items-center p-3 rounded-lg ${plant.edible ? "bg-emerald-50" : "bg-gray-50 opacity-50"}`}
                      >
                        <Utensils className={`h-6 w-6 mb-1 ${plant.edible ? "text-emerald-500" : "text-gray-400"}`} />
                        <span className="text-sm font-medium">{plant.edible ? "Edible" : "Not Edible"}</span>
                      </div>
                      <div
                        className={`flex flex-col items-center p-3 rounded-lg ${plant.medicinal ? "bg-purple-50" : "bg-gray-50 opacity-50"}`}
                      >
                        <Heart className={`h-6 w-6 mb-1 ${plant.medicinal ? "text-purple-500" : "text-gray-400"}`} />
                        <span className="text-sm font-medium">{plant.medicinal ? "Medicinal" : "Not Medicinal"}</span>
                      </div>
                      <div
                        className={`flex flex-col items-center p-3 rounded-lg ${plant.poisonous ? "bg-red-50" : "bg-gray-50"}`}
                      >
                        <AlertTriangle
                          className={`h-6 w-6 mb-1 ${plant.poisonous ? "text-red-500" : "text-gray-400"}`}
                        />
                        <span className="text-sm font-medium">{plant.poisonous ? "Toxic" : "Non-Toxic"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {(plant.location || plant.location_lat) && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Location Found</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center">
                        <MapPin className="h-5 w-5 text-gray-500 mr-2" />
                        <span>{plant.location || "Unknown location"}</span>
                      </div>
                      {plant.location_lat && plant.location_lng && (
                        <div className="text-xs text-gray-500 mt-1">
                          Coordinates: {plant.location_lat.toFixed(4)}, {plant.location_lng.toFixed(4)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Date Added</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center">
                      <Calendar className="h-5 w-5 text-gray-500 mr-2" />
                      <span>{formatDate(plant.date_found || plant.created_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold mb-1">{plant.common_name}</h1>
                <p className="text-xl italic text-gray-600 mb-2">{plant.scientific_name}</p>
                <div
                  className={`inline-block plant-badge ${
                    plant.poisonous ? "poisonous" : plant.edible ? "edible" : plant.medicinal ? "medicinal" : "unknown"
                  }`}
                >
                  {plant.poisonous ? "Poisonous" : plant.edible ? "Edible" : plant.medicinal ? "Medicinal" : "Unknown"}
                </div>
              </div>

              <Tabs defaultValue="about">
                <TabsList>
                  <TabsTrigger value="about">About</TabsTrigger>
                  <TabsTrigger value="uses">Uses</TabsTrigger>
                  <TabsTrigger value="care">Care</TabsTrigger>
                </TabsList>
                <TabsContent value="about" className="space-y-4 pt-4">
                  {plant.description ? (
                    <p>{plant.description}</p>
                  ) : (
                    <p className="text-gray-500">No description available for this plant.</p>
                  )}

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">Taxonomy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-sm font-medium">Common Name</p>
                          <p className="text-sm text-gray-600">{plant.common_name}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Scientific Name</p>
                          <p className="text-sm text-gray-600 italic">{plant.scientific_name}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Family</p>
                          <p className="text-sm text-gray-600">{plant.family || "Unknown"}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="uses" className="space-y-4 pt-4">
                  {plant.edible || plant.medicinal ? (
                    <>
                      {plant.edible && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Edible Uses</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p>
                              This plant has been identified as edible. Always verify with multiple sources before
                              consumption.
                            </p>
                            {plant.edible_parts && (
                              <div className="mt-2">
                                <p className="font-medium">Edible Parts:</p>
                                <ul className="list-disc pl-5 mt-1">
                                  {plant.edible_parts?.map((part, index) => <li key={index}>{part}</li>) || (
                                    <li>Information not available</li>
                                  )}
                                </ul>
                              </div>
                            )}
                            <div className="mt-4 bg-amber-50 p-3 rounded-md">
                              <div className="flex items-start">
                                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                  Always verify plant identification with multiple sources before consumption. Some
                                  plants have poisonous look-alikes.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {plant.medicinal && (
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-lg">Medicinal Uses</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p>This plant has been identified as having potential medicinal properties.</p>
                            <div className="mt-4 bg-amber-50 p-3 rounded-md">
                              <div className="flex items-start">
                                <AlertTriangle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                                <p className="text-sm text-amber-800">
                                  Always consult with a healthcare professional before using any plant for medicinal
                                  purposes.
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500">No known uses available for this plant.</p>
                  )}

                  {plant.poisonous && (
                    <Card className="border-red-200">
                      <CardHeader className="pb-2 bg-red-50 rounded-t-lg">
                        <CardTitle className="text-lg text-red-700">Warning: Poisonous</CardTitle>
                      </CardHeader>
                      <CardContent className="bg-red-50 rounded-b-lg">
                        <div className="flex items-start">
                          <AlertTriangle className="h-5 w-5 text-red-600 mr-2 mt-0.5" />
                          <p className="text-red-800">
                            This plant has been identified as poisonous or toxic. Avoid ingestion and handle with care.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="care" className="space-y-4 pt-4">
                  <p className="text-gray-500">Care information is not available for this plant.</p>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">General Care Tips</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm">
                        Research the specific needs of this plant for optimal care. Consider factors such as:
                      </p>
                      <ul className="list-disc pl-5 mt-2 text-sm space-y-1">
                        <li>Light requirements (full sun, partial shade, etc.)</li>
                        <li>Watering frequency</li>
                        <li>Soil type and pH preferences</li>
                        <li>Temperature and humidity needs</li>
                        <li>Fertilization schedule</li>
                      </ul>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => router.push("/dashboard")}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to Collection
                </Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  <Leaf className="mr-2 h-4 w-4" /> Add to Favorites
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

