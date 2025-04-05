"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Leaf, Upload, AlertTriangle, Utensils, Heart, ArrowLeft, MapPin, Loader2, Info, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function PlantIdentification() {
  const [stage, setStage] = useState("upload") // upload, analyzing, results
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [plantData, setPlantData] = useState<any>(null)
  const [identificationId, setIdentificationId] = useState<string | null>(null)
  const [identificationError, setIdentificationError] = useState<string | null>(null)
  const [location, setLocation] = useState("")
  const [progress, setProgress] = useState(0)
  const [imageError, setImageError] = useState(false)
  const [duplicateFound, setDuplicateFound] = useState(false)
  const [existingPlants, setExistingPlants] = useState<any[]>([])
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false)
  const [isCameraOpen, setIsCameraOpen] = useState(false)
  const [base64Image, setBase64Image] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Update the fetchExistingPlants function to handle errors better
  const fetchExistingPlants = async () => {
    if (!user) return

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("plants")
        .select("common_name, scientific_name")
        .eq("user_id", user.id)

      if (error) {
        console.error("Error fetching existing plants:", error)
        // Continue with empty array instead of throwing
        setExistingPlants([])
        return
      }

      setExistingPlants(data || [])
    } catch (err) {
      console.error("Error fetching existing plants:", err)
      // Set empty array as fallback
      setExistingPlants([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch existing plants to check for duplicates
  useEffect(() => {
    let isMounted = true

    const fetchPlants = async () => {
      try {
        if (!user) return
        await fetchExistingPlants()
      } catch (error) {
        console.error("Failed to fetch plants:", error)
        // Set empty array to continue without existing plants
        if (isMounted) setExistingPlants([])
      }
    }

    fetchPlants()

    return () => {
      isMounted = false
    }
  }, [user, supabase])

  // Simulate progress during analysis
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined
    if (stage === "analyzing") {
      interval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + (100 - prev) * 0.1
          return newProgress > 95 ? 95 : newProgress
        })
      }, 500)
    } else {
      setProgress(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [stage])

  // Camera setup and cleanup
  useEffect(() => {
    let stream: MediaStream | null = null

    const setupCamera = async () => {
      if (!isCameraOpen || !videoRef.current) return

      try {
        // Request camera access with rear camera preference
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
        }
      } catch (err) {
        console.error("Error accessing camera:", err)
        toast({
          title: "Camera Error",
          description: "Could not access your camera. Please check permissions or try uploading an image instead.",
          variant: "destructive",
        })
        setIsCameraOpen(false)
      }
    }

    setupCamera()

    // Cleanup function
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [isCameraOpen, toast])

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw the video frame to the canvas
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert canvas to blob
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          toast({
            title: "Error",
            description: "Failed to capture image. Please try again.",
            variant: "destructive",
          })
          return
        }

        // Create a File object from the blob
        const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" })

        // Create a URL for preview
        const imageUrl = URL.createObjectURL(blob)

        // Convert to base64 for fallback
        try {
          const base64 = await fileToBase64(file)
          setBase64Image(base64)
        } catch (error) {
          console.error("Error converting to base64:", error)
        }

        // Close camera
        setIsCameraOpen(false)

        // Set the captured image and file
        setSelectedImage(imageUrl)
        setImageFile(file)

        // Proceed with analysis
        await processImage(file)
      },
      "image/jpeg",
      0.9,
    )
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      // Reset any previous errors
      setIdentificationError(null)
      setImageError(false)
      setDuplicateFound(false)

      // Get the file from the input
      const file = e?.target?.files?.[0]

      if (!file) {
        return
      }

      // Create a preview URL for the image
      const imageUrl = URL.createObjectURL(file)
      setSelectedImage(imageUrl)
      setImageFile(file)

      // Convert to base64 for fallback
      try {
        const base64 = await fileToBase64(file)
        setBase64Image(base64)
      } catch (error) {
        console.error("Error converting to base64:", error)
      }

      await processImage(file)
    } catch (err: any) {
      console.error("Error during image upload:", err)
      setIdentificationError(err.message || "An error occurred during image upload")
      setStage("upload")
      toast({
        title: "Error",
        description: err.message || "Failed to upload image",
        variant: "destructive",
      })
    }
  }

  const processImage = async (file: File) => {
    setStage("analyzing")
    setProgress(10)

    // Try to get the user's location
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
          setLocation(`${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`)
        })
      }
    } catch (locError) {
      console.error("Error getting location:", locError)
      // Non-critical error, continue without location
    }

    // Create form data for the API request
    const formData = new FormData()
    formData.append("image", file)

    try {
      // Send the image to our API
      const response = await fetch("/api/identify-plant", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to identify plant")
      }

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || "Failed to identify plant")
      }

      // Check for duplicates
      if (data.result && data.result.plant) {
        const isDuplicate = checkForDuplicate(data.result.plant.common_name, data.result.plant.scientific_name)
        setDuplicateFound(isDuplicate)
      }

      // Store the plant data and move to results stage
      setPlantData(data.result)
      if (data.identification_id) {
        setIdentificationId(data.identification_id)
      }
      setProgress(100)
      setStage("results")
    } catch (err: any) {
      console.error("Error during plant identification:", err)
      setIdentificationError(err.message || "An error occurred during plant identification")
      setStage("upload")
      toast({
        title: "Error",
        description: err.message || "Failed to identify plant",
        variant: "destructive",
      })
    }
  }

  // Update the checkForDuplicate function to be more resilient
  const checkForDuplicate = (commonName?: string, scientificName?: string) => {
    try {
      if (!commonName || !scientificName || !existingPlants || existingPlants.length === 0) {
        return false
      }

      return existingPlants.some(
        (plant) =>
          plant.common_name?.toLowerCase() === commonName?.toLowerCase() ||
          plant.scientific_name?.toLowerCase() === scientificName?.toLowerCase(),
      )
    } catch (err) {
      console.error("Error checking for duplicates:", err)
      // Assume no duplicate if there's an error
      return false
    }
  }

  const handleAddToCollection = async () => {
    try {
      if (!plantData) return

      // Check for duplicates again
      if (duplicateFound) {
        setShowDuplicateDialog(true)
        return
      }

      // Use the image URL from the plant data
      const response = await fetch("/api/user-plants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plant: {
            common_name: plantData.plant.common_name,
            scientific_name: plantData.plant.scientific_name,
          },
          location: location || "Unknown location",
          image_url: plantData.image_url, // Use the URL from the plant data
          properties: plantData.properties,
          description: plantData.description,
          identification_id: identificationId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if it's a duplicate error
        if (response.status === 409 && data.duplicate) {
          setDuplicateFound(true)
          setShowDuplicateDialog(true)
          return
        }

        console.error("Error response:", data)
        throw new Error(data.error || "Failed to add plant to collection")
      }

      toast({
        title: "Success!",
        description: "Plant added to your collection",
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/dashboard")
      }, 1500)
    } catch (err) {
      console.error("Error adding plant to collection:", err)
      toast({
        title: "Error",
        description: err.message || "Failed to add plant to collection",
        variant: "destructive",
      })
    }
  }

  const handleForceAddToCollection = async () => {
    setShowDuplicateDialog(false)
    // Proceed with adding to collection anyway
    try {
      await handleAddToCollection()
    } catch (err) {
      console.error("Error force adding plant:", err)
    }
  }

  const handleTakePhoto = () => {
    setIsCameraOpen(true)
  }

  const resetIdentification = () => {
    setStage("upload")
    setSelectedImage(null)
    setImageFile(null)
    setBase64Image(null)
    setPlantData(null)
    setIdentificationId(null)
    setIdentificationError(null)
    setImageError(false)
    setDuplicateFound(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Generate a placeholder color based on text
  const getPlaceholderColor = (name?: string) => {
    const colors = ["#10b981", "#059669", "#047857", "#065f46", "#064e3b"]
    if (!name) return colors[0]

    let hash = 0
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash)
    }
    return colors[Math.abs(hash) % colors.length]
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="container flex h-16 items-center px-4">
          <Link href="/dashboard" className="flex items-center">
            <ArrowLeft className="h-5 w-5 mr-2" />
            <span>Back</span>
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
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-bold mb-6 text-center">Plant Identification</h1>

          {/* Camera UI */}
          {isCameraOpen && (
            <div className="fixed inset-0 bg-black z-50 flex flex-col">
              <div className="flex justify-between items-center p-4 bg-black text-white">
                <Button variant="ghost" className="text-white" onClick={() => setIsCameraOpen(false)}>
                  <X className="h-6 w-6" />
                </Button>
                <h2 className="text-lg font-medium">Take a Photo</h2>
                <div className="w-10"></div> {/* Spacer for alignment */}
              </div>

              <div className="flex-1 relative">
                <video ref={videoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              </div>

              <div className="p-4 bg-black flex justify-center">
                <Button className="rounded-full w-16 h-16 bg-white border-4 border-gray-300" onClick={captureImage}>
                  <span className="sr-only">Capture</span>
                </Button>
              </div>

              {/* Hidden canvas for capturing the image */}
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {stage === "upload" && (
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-center">Take or Upload a Photo</CardTitle>
                <CardDescription className="text-center">
                  Get information about any plant by taking a clear photo of it
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 w-full flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="bg-emerald-50 rounded-full p-4 mb-4">
                    <Upload className="h-8 w-8 text-emerald-500" />
                  </div>
                  <p className="text-sm text-gray-500 text-center mb-4">
                    Tap to take a photo or select from your gallery
                  </p>
                  <input
                    type="file"
                    className="hidden"
                    id="plant-image"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                </div>
                {identificationError && (
                  <div className="text-red-500 text-sm w-full text-center">{identificationError}</div>
                )}
                <div className="flex gap-4 w-full">
                  <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" onClick={handleTakePhoto}>
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                  <Button
                    className="flex-1 border-emerald-500 text-emerald-500 hover:bg-emerald-50"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col text-sm text-gray-500">
                <p className="text-center">For best results, make sure the plant is clearly visible and well-lit</p>
              </CardFooter>
            </Card>
          )}

          {stage === "analyzing" && (
            <Card className="border-none shadow-md">
              <CardHeader>
                <CardTitle className="text-center">Analyzing Your Plant</CardTitle>
                <CardDescription className="text-center">
                  Our AI is identifying your plant and gathering information
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6 py-6">
                <div className="w-full max-w-[300px] aspect-square overflow-hidden rounded-md shadow-md relative">
                  {!imageError ? (
                    <img
                      src={selectedImage || "/placeholder.svg?height=400&width=400"}
                      alt="Uploaded plant"
                      className="object-cover w-full h-full"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: getPlaceholderColor("Plant Image") }}
                    >
                      <Leaf className="h-16 w-16 text-white opacity-70" />
                    </div>
                  )}
                </div>
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Analyzing image...</span>
                    <span>{Math.round(progress)}%</span>
                  </div>
                  <Progress value={progress} className="h-2 bg-emerald-100" />
                </div>
                <div className="text-sm text-gray-500 text-center">
                  <p>Checking against our database of over 10,000 plant species</p>
                </div>
              </CardContent>
            </Card>
          )}

          {stage === "results" && plantData && (
            <Card className="border-none shadow-md identification-result">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{plantData.plant.common_name}</CardTitle>
                    <CardDescription className="italic">{plantData.plant.scientific_name}</CardDescription>
                  </div>
                  <div
                    className={`plant-badge ${
                      plantData.properties.poisonous
                        ? "poisonous"
                        : plantData.properties.edible
                          ? "edible"
                          : plantData.properties.medicinal
                            ? "medicinal"
                            : "unknown"
                    }`}
                  >
                    {plantData.properties.poisonous
                      ? "Poisonous"
                      : plantData.properties.edible
                        ? "Edible"
                        : plantData.properties.medicinal
                          ? "Medicinal"
                          : "Unknown"}
                  </div>
                </div>
                {location && (
                  <div className="flex items-center text-xs text-gray-500 mt-1">
                    <MapPin className="h-3 w-3 mr-1" />
                    {location}
                  </div>
                )}

                {duplicateFound && (
                  <div className="flex items-center mt-2 p-2 bg-amber-50 text-amber-800 rounded-md text-sm">
                    <Info className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>This plant is already in your collection</span>
                  </div>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="w-full max-w-[300px] mx-auto aspect-square overflow-hidden rounded-md shadow-md relative">
                  {!imageError ? (
                    <img
                      src={
                        plantData.image_url ||
                        selectedImage ||
                        base64Image ||
                        `/placeholder.svg?height=400&width=400&text=${encodeURIComponent(plantData.plant.common_name) || "/placeholder.svg"}`
                      }
                      alt="Identified plant"
                      className="object-cover w-full h-full"
                      onError={() => setImageError(true)}
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center"
                      style={{ backgroundColor: getPlaceholderColor(plantData.plant.common_name) }}
                    >
                      <Leaf className="h-16 w-16 text-white opacity-70" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <div
                    className={`flex flex-col items-center p-3 rounded-lg ${
                      plantData.properties.edible ? "bg-emerald-50" : "bg-gray-50 opacity-50"
                    }`}
                  >
                    <Utensils
                      className={`h-6 w-6 mb-1 ${plantData.properties.edible ? "text-emerald-500" : "text-gray-400"}`}
                    />
                    <span className="text-sm font-medium">{plantData.properties.edible ? "Edible" : "Not Edible"}</span>
                    <span className="text-xs text-gray-500">
                      {plantData.properties.edible ? "Safe to eat" : "Not for consumption"}
                    </span>
                  </div>
                  <div
                    className={`flex flex-col items-center p-3 rounded-lg ${
                      plantData.properties.medicinal ? "bg-purple-50" : "bg-gray-50 opacity-50"
                    }`}
                  >
                    <Heart
                      className={`h-6 w-6 mb-1 ${plantData.properties.medicinal ? "text-purple-500" : "text-gray-400"}`}
                    />
                    <span className="text-sm font-medium">
                      {plantData.properties.medicinal ? "Medicinal" : "Not Medicinal"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {plantData.properties.medicinal ? "Has health benefits" : "No known benefits"}
                    </span>
                  </div>
                  <div
                    className={`flex flex-col items-center p-3 rounded-lg ${
                      plantData.properties.poisonous ? "bg-red-50" : "bg-gray-50"
                    }`}
                  >
                    <AlertTriangle
                      className={`h-6 w-6 mb-1 ${plantData.properties.poisonous ? "text-red-500" : "text-gray-400"}`}
                    />
                    <span className="text-sm font-medium">
                      {plantData.properties.poisonous ? "Toxic" : "Non-Toxic"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {plantData.properties.poisonous ? "Dangerous" : "Safe to touch"}
                    </span>
                  </div>
                </div>

                <Tabs defaultValue="about" className="w-full">
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="about" className="text-sm">
                      About
                    </TabsTrigger>
                    <TabsTrigger value="uses" className="text-sm">
                      Uses
                    </TabsTrigger>
                    <TabsTrigger value="recipes" className="text-sm">
                      Recipes
                    </TabsTrigger>
                    <TabsTrigger value="similar" className="text-sm">
                      Similar
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="about" className="space-y-4 pt-4">
                    <p className="text-sm">{plantData.description || "No description available for this plant."}</p>
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Identification Confidence:</h4>
                      <div className="w-full space-y-2">
                        <Progress value={plantData.plant.confidence * 100} className="h-2 bg-emerald-100" />
                        <p className="text-xs text-right">{Math.round(plantData.plant.confidence * 100)}% match</p>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="uses" className="space-y-4 pt-4">
                    {plantData.properties.edible || plantData.properties.medicinal ? (
                      <>
                        {plantData.properties.medicinal && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Medicinal Uses:</h4>
                            <p className="text-sm">
                              This plant has potential medicinal properties. Always consult with a healthcare
                              professional before using any plant for medicinal purposes.
                            </p>
                          </div>
                        )}
                        {plantData.properties.edible && (
                          <div className="space-y-2">
                            <h4 className="font-medium text-sm">Culinary Uses:</h4>
                            <ul className="text-sm space-y-1 list-disc pl-5">
                              {plantData.uses && plantData.uses.length > 0 ? (
                                plantData.uses.map((use: string, index: number) => <li key={index}>{use}</li>)
                              ) : (
                                <li>This plant is considered edible, but specific uses are not available.</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm">No known uses available for this plant.</p>
                    )}
                  </TabsContent>
                  <TabsContent value="recipes" className="space-y-4 pt-4">
                    {plantData.properties.edible ? (
                      <div className="space-y-4">
                        <p className="text-sm">
                          Here are some ways you might prepare this plant if it's confirmed to be edible:
                        </p>
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm">Simple Preparation:</h4>
                          <p className="text-sm">
                            Clean thoroughly and try adding young leaves to salads, or cook mature parts to reduce
                            bitterness.
                          </p>
                        </div>
                        <div className="mt-4">
                          <p className="text-sm text-amber-600 flex items-center">
                            <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                            <span>Always verify plant identification with multiple sources before consumption</span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-red-500 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                          <span>This plant is not identified as edible and should not be consumed.</span>
                        </p>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="similar" className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Similar Plants:</h4>
                      {plantData.similar_plants && plantData.similar_plants.length > 0 ? (
                        <ul className="text-sm space-y-1 list-disc pl-5">
                          {plantData.similar_plants.map((plant: string, index: number) => (
                            <li key={index}>{plant}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm">No similar plants information available.</p>
                      )}
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-amber-600 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1 flex-shrink-0" />
                        <span>Always verify plant identification before consumption</span>
                      </p>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="outline" onClick={resetIdentification}>
                  <Camera className="mr-2 h-4 w-4" />
                  New Photo
                </Button>
                <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleAddToCollection}>
                  <Leaf className="mr-2 h-4 w-4" />
                  Add to PlantDex
                </Button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      {/* Duplicate Plant Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Plant Already in Collection</DialogTitle>
            <DialogDescription>
              This plant is already in your collection. Would you still like to add it again?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setShowDuplicateDialog(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleForceAddToCollection}>
              Add Anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

