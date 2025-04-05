"use client"

import { Badge } from "@/components/ui/badge"

import { useState, useEffect } from "react"
import { useRouter, notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Leaf, Map, Share2, ThumbsUp, Bookmark, Loader2, Route, Clock, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { isValidUUID } from "@/lib/utils"
import GoogleMap from "@/components/map/google-map"

export default function TrailDetailPage({ params }: { params: { id: string } }) {
  const [trail, setTrail] = useState<any>(null)
  const [trailOwner, setTrailOwner] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [comments, setComments] = useState<any[]>([])
  const [commentUsers, setCommentUsers] = useState({})
  const [newComment, setNewComment] = useState("")
  const [isLiked, setIsLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()

  // Check if the ID is a valid UUID
  useEffect(() => {
    if (!isValidUUID(params.id)) {
      // If not a valid UUID, redirect to 404
      notFound()
    }
  }, [params.id])

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch trail data
  useEffect(() => {
    const fetchTrail = async () => {
      if (!user) return
      if (!isValidUUID(params.id)) return

      try {
        setLoading(true)

        // Fetch trail
        const { data: trailData, error: trailError } = await supabase
          .from("trails")
          .select("*")
          .eq("id", params.id)
          .single()

        if (trailError) {
          throw trailError
        }

        setTrail(trailData)

        // Fetch trail owner profile separately
        if (trailData) {
          const { data: ownerData, error: ownerError } = await supabase
            .from("user_profiles")
            .select("username, avatar_url")
            .eq("id", trailData.user_id)
            .single()

          if (!ownerError) {
            setTrailOwner(ownerData)
          } else {
            console.error("Error fetching trail owner:", ownerError)
          }
        }

        // Fetch comments
        const { data: commentsData, error: commentsError } = await supabase
          .from("trail_comments")
          .select("*")
          .eq("trail_id", params.id)
          .order("created_at", { ascending: false })

        if (commentsError) {
          console.error("Error fetching comments:", commentsError)
        } else {
          setComments(commentsData || [])

          // Fetch comment users
          if (commentsData && commentsData.length > 0) {
            const userIds = [...new Set(commentsData.map((comment) => comment.user_id))]

            const { data: usersData, error: usersError } = await supabase
              .from("user_profiles")
              .select("id, username, avatar_url")
              .in("id", userIds)

            if (usersError) {
              console.error("Error fetching comment users:", usersError)
            } else {
              // Create a map of user_id to user data
              const usersMap = {}
              usersData.forEach((user) => {
                usersMap[user.id] = user
              })
              setCommentUsers(usersMap)
            }
          }
        }

        // Check if user has liked the trail
        const { data: likeData, error: likeError } = await supabase
          .from("trail_likes")
          .select("*")
          .eq("trail_id", params.id)
          .eq("user_id", user.id)
          .single()

        if (!likeError) {
          setIsLiked(true)
        }

        // Get like count
        const { count, error: countError } = await supabase
          .from("trail_likes")
          .select("*", { count: "exact" })
          .eq("trail_id", params.id)

        if (!countError) {
          setLikeCount(count || 0)
        }

        // Check if user has saved the trail
        const { data: saveData, error: saveError } = await supabase
          .from("saved_trails")
          .select("*")
          .eq("trail_id", params.id)
          .eq("user_id", user.id)
          .single()

        if (!saveError) {
          setIsSaved(true)
        }
      } catch (err) {
        console.error("Error fetching trail:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch trail",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchTrail()
  }, [user, supabase, params.id, toast])

  // Format duration
  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours > 0 ? `${hours}h ` : ""}${minutes}m`
  }

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Get username for a comment
  const getUserForComment = (comment) => {
    if (commentUsers[comment.user_id]) {
      return commentUsers[comment.user_id]
    }
    return { username: "Unknown user", avatar_url: null }
  }

  // Handle like
  const handleLike = async () => {
    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase.from("trail_likes").delete().eq("trail_id", params.id).eq("user_id", user.id)

        if (error) throw error

        setIsLiked(false)
        setLikeCount((prev) => prev - 1)
      } else {
        // Like
        const { error } = await supabase.from("trail_likes").insert({
          trail_id: params.id,
          user_id: user.id,
        })

        if (error) throw error

        setIsLiked(true)
        setLikeCount((prev) => prev + 1)
      }
    } catch (error) {
      console.error("Error toggling like:", error)
      toast({
        title: "Error",
        description: "Failed to update like status",
        variant: "destructive",
      })
    }
  }

  // Handle save
  const handleSave = async () => {
    try {
      if (isSaved) {
        // Unsave
        const { error } = await supabase.from("saved_trails").delete().eq("trail_id", params.id).eq("user_id", user.id)

        if (error) throw error

        setIsSaved(false)
        toast({
          title: "Trail Unsaved",
          description: "Trail removed from your saved collection",
        })
      } else {
        // Save
        const { error } = await supabase.from("saved_trails").insert({
          trail_id: params.id,
          user_id: user.id,
        })

        if (error) throw error

        setIsSaved(true)
        toast({
          title: "Trail Saved",
          description: "Trail added to your saved collection",
        })
      }
    } catch (error) {
      console.error("Error toggling save:", error)
      toast({
        title: "Error",
        description: "Failed to update save status",
        variant: "destructive",
      })
    }
  }

  // Handle comment
  const handleComment = async () => {
    if (!newComment.trim()) return

    try {
      const { data, error } = await supabase.from("trail_comments").insert({
        trail_id: params.id,
        user_id: user.id,
        content: newComment,
      })

      if (error) throw error

      // Fetch the new comment with user data
      const { data: commentData, error: commentError } = await supabase
        .from("trail_comments")
        .select("*")
        .eq("trail_id", params.id)
        .order("created_at", { ascending: false })

      if (commentError) throw commentError

      setComments(commentData)

      // Add current user to comment users if not already there
      if (!commentUsers[user.id]) {
        const { data: userData, error: userError } = await supabase
          .from("user_profiles")
          .select("id, username, avatar_url")
          .eq("id", user.id)
          .single()

        if (!userError) {
          setCommentUsers((prev) => ({
            ...prev,
            [user.id]: userData,
          }))
        }
      }

      setNewComment("")
      toast({
        title: "Comment Added",
        description: "Your comment has been added successfully",
      })
    } catch (error) {
      console.error("Error adding comment:", error)
      toast({
        title: "Error",
        description: "Failed to add comment",
        variant: "destructive",
      })
    }
  }

  // Handle share
  const handleShare = async () => {
    try {
      await navigator.share({
        title: trail?.name || "TrekDex Trail",
        text: `Check out this trail on TrekDex: ${trail?.name}`,
        url: window.location.href,
      })
    } catch (error) {
      console.error("Error sharing:", error)
      // Fallback for browsers that don't support navigator.share
      navigator.clipboard.writeText(window.location.href)
      toast({
        title: "Link Copied",
        description: "Trail link copied to clipboard",
      })
    }
  }

  // Start trek
  const handleStartTrek = () => {
    // Redirect to the tracking page with the trail ID
    router.push(`/trails/track?trail=${params.id}`)
  }

  // Prepare map data
  const getMapData = () => {
    if (!trail || !trail.path_data) return { center: { lat: 37.7749, lng: -122.4194 }, markers: [], polyline: null }

    // Get positions from path data
    const positions = trail.path_data.positions || []

    if (positions.length === 0) return { center: { lat: 37.7749, lng: -122.4194 }, markers: [], polyline: null }

    // Get center from first position
    const center = { lat: positions[0].lat, lng: positions[0].lng }

    // Create markers for start, end, and POIs
    const markers = [
      // Start marker
      {
        position: { lat: positions[0].lat, lng: positions[0].lng },
        title: "Start",
        icon: {
          url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        },
        id: "start",
      },
      // End marker (if different from start)
      ...(positions.length > 1 &&
      (positions[0].lat !== positions[positions.length - 1].lat ||
        positions[0].lng !== positions[positions.length - 1].lng)
        ? [
            {
              position: { lat: positions[positions.length - 1].lat, lng: positions[positions.length - 1].lng },
              title: "End",
              icon: {
                url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
              },
              id: "end",
            },
          ]
        : []),

      // POI markers
      ...(trail.path_data.markers || []).map((marker) => ({
        position: { lat: marker.position.lat, lng: marker.position.lng },
        title: marker.note || marker.type,
        icon: {
          url: `https://maps.google.com/mapfiles/ms/icons/${marker.type === "plant" ? "green" : "blue"}-dot.png`,
        },
        id: marker.id,
      })),
    ]

    // Get polyline if available
    const polyline = trail.path_data.polyline || null

    return { center, markers, polyline }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (error || !trail) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error || "Trail not found"}</p>
        <Button variant="outline" onClick={() => router.push("/trails")}>
          Back to Trails
        </Button>
      </div>
    )
  }

  const { center, markers, polyline } = getMapData()
  const isPlanned = trail.path_data?.planned === true

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
            <h1 className="text-3xl font-bold mb-2">{trail.name}</h1>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center">
                <Avatar className="h-8 w-8 mr-2">
                  <AvatarImage src={trailOwner?.avatar_url || "/placeholder.svg?height=40&width=40"} />
                  <AvatarFallback>{(trailOwner?.username || "User").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span>{trailOwner?.username || "Unknown user"}</span>
              </div>
              <span className="text-gray-500">•</span>
              <span>{formatDate(trail.date_completed)}</span>
              {isPlanned && <Badge className="bg-blue-100 text-blue-800">Planned</Badge>}
            </div>
            <p className="text-gray-600 mb-4">{trail.description}</p>
            <div className="flex flex-wrap gap-4 mb-6">
              <div className="bg-gray-100 rounded-md px-4 py-2">
                <p className="text-sm text-gray-500">Distance</p>
                <p className="font-medium">{trail.distance} km</p>
              </div>
              <div className="bg-gray-100 rounded-md px-4 py-2">
                <p className="text-sm text-gray-500">Duration</p>
                <p className="font-medium">{formatDuration(trail.duration)}</p>
              </div>
              <div className="bg-gray-100 rounded-md px-4 py-2">
                <p className="text-sm text-gray-500">Plants Found</p>
                <p className="font-medium">{trail.plants_found}</p>
              </div>
            </div>
          </div>

          <div className="h-[400px] rounded-lg overflow-hidden border mb-6">
            <GoogleMap center={center} markers={markers} polylinePath={polyline} height="400px" />
          </div>

          <div className="flex gap-4 mb-8">
            <Button
              variant={isLiked ? "default" : "outline"}
              className={isLiked ? "bg-green-600" : ""}
              onClick={handleLike}
            >
              <ThumbsUp className="mr-2 h-4 w-4" />
              {isLiked ? "Liked" : "Like"} ({likeCount})
            </Button>
            <Button variant="outline" onClick={handleSave}>
              <Bookmark className={`mr-2 h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              {isSaved ? "Save" : "Save"}
            </Button>
            <Button variant="outline" onClick={handleShare}>
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            {isPlanned && (
              <Button className="ml-auto bg-green-600 hover:bg-green-700" onClick={handleStartTrek}>
                <Route className="mr-2 h-4 w-4" />
                Start Trek
              </Button>
            )}
          </div>

          <Tabs defaultValue="comments">
            <TabsList className="mb-4">
              <TabsTrigger value="comments">Comments ({comments.length})</TabsTrigger>
              <TabsTrigger value="plants">Plants Found ({trail.plants_found})</TabsTrigger>
              {isPlanned && <TabsTrigger value="directions">Directions</TabsTrigger>}
            </TabsList>

            <TabsContent value="comments">
              <Card>
                <CardHeader>
                  <CardTitle>Comments</CardTitle>
                  <CardDescription>Join the conversation about this trail</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex gap-4">
                      <textarea
                        className="flex-1 p-2 border rounded-md"
                        placeholder="Add a comment..."
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                      ></textarea>
                      <Button className="self-end" onClick={handleComment} disabled={!newComment.trim()}>
                        Post
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No comments yet. Be the first to comment!</p>
                    ) : (
                      comments.map((comment) => {
                        const commentUser = getUserForComment(comment)
                        return (
                          <div key={comment.id} className="border-b pb-4">
                            <div className="flex items-center mb-2">
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={commentUser?.avatar_url || "/placeholder.svg?height=40&width=40"} />
                                <AvatarFallback>
                                  {(commentUser?.username || "User").charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{commentUser?.username || "Unknown user"}</p>
                                <p className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleString()}</p>
                              </div>
                            </div>
                            <p>{comment.content}</p>
                          </div>
                        )
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="plants">
              <Card>
                <CardHeader>
                  <CardTitle>Plants Found</CardTitle>
                  <CardDescription>Plants discovered during this trail</CardDescription>
                </CardHeader>
                <CardContent>
                  {trail.plants_found === 0 ? (
                    <p className="text-center text-gray-500 py-4">No plants were recorded for this trail.</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {trail.path_data?.markers
                        ?.filter((marker) => marker.type === "plant")
                        .map((marker, index) => (
                          <div key={index} className="border rounded-md p-4">
                            <div className="h-[100px] bg-gray-100 rounded-md flex items-center justify-center mb-2">
                              <Leaf className="h-8 w-8 text-green-600" />
                            </div>
                            <p className="font-medium">Plant #{index + 1}</p>
                            {marker.note && <p className="text-sm text-gray-600">{marker.note}</p>}
                          </div>
                        )) || (
                        <p className="text-center text-gray-500 py-4 col-span-3">
                          Plant details are not available for this trail.
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {isPlanned && (
              <TabsContent value="directions">
                <Card>
                  <CardHeader>
                    <CardTitle>Trek Directions</CardTitle>
                    <CardDescription>Follow these steps to complete your trek</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-md">
                        <div className="bg-green-100 p-2 rounded-full">
                          <Route className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">
                            Start at {trail.path_data?.positions?.[0]?.name || "Starting Point"}
                          </p>
                          <p className="text-sm text-gray-600">Begin your trek here</p>
                        </div>
                      </div>

                      {trail.path_data?.markers?.map((marker, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-md">
                          <div className="bg-gray-100 p-2 rounded-full">
                            {marker.type === "plant" ? (
                              <Leaf className="h-5 w-5 text-green-600" />
                            ) : (
                              <MapPin className="h-5 w-5 text-blue-600" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">Visit {marker.note || `Point of Interest #${index + 1}`}</p>
                            <p className="text-sm text-gray-600">
                              {marker.type === "plant" ? "Look for plants here" : "Explore this landmark"}
                            </p>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-md">
                        <div className="bg-blue-100 p-2 rounded-full">
                          <Map className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Return to starting point</p>
                          <p className="text-sm text-gray-600">Complete your {trail.distance} km trek</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-md">
                        <div className="bg-amber-100 p-2 rounded-full">
                          <Clock className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="font-medium">Estimated Duration: {formatDuration(trail.duration)}</p>
                          <p className="text-sm text-gray-600">Take your time and enjoy the journey</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={handleStartTrek}>
                        <Route className="mr-2 h-4 w-4" />
                        Start This Trek
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  )
}

