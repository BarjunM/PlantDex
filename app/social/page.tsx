"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Leaf, Users, ThumbsUp, MessageSquare, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import FriendFinder from "@/components/friend-finder"

export default function SocialPage() {
  const [activeTab, setActiveTab] = useState("feed")
  const [feed, setFeed] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [userProfiles, setUserProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading } = useAuth()
  const supabase = createClient()

  // At the top of the component, add a state to track if data has been loaded for each tab
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({
    feed: false,
    friends: false,
    leaderboard: false,
  })

  // Add this at the top of the component
  const [initialLoad, setInitialLoad] = useState(true)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch social data
  useEffect(() => {
    const fetchSocialData = async () => {
      if (!user) return

      try {
        // Only set loading to true on initial load
        if (initialLoad) {
          setLoading(true)
        }

        // Create a stable reference to supabase
        const supabaseClient = createClient()

        // Fetch feed (recent trails and plant identifications)
        const { data: feedData, error: feedError } = await supabaseClient
          .from("trails")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10)

        if (feedError) {
          throw feedError
        }

        // Fetch user profiles for feed items
        const profilesMap = {}
        if (feedData && feedData.length > 0) {
          const userIds = [...new Set(feedData.map((item) => item.user_id))]

          const { data: profilesData, error: profilesError } = await supabaseClient
            .from("user_profiles")
            .select("id, username, avatar_url")
            .in("id", userIds)

          if (profilesError) {
            console.error("Error fetching user profiles:", profilesError)
          } else {
            // Create a map of user_id to profile data
            profilesData.forEach((profile) => {
              profilesMap[profile.id] = profile
            })
          }
        }

        // Format feed data
        const formattedFeed = feedData.map((item) => ({
          id: item.id,
          type: "trail",
          title: item.name,
          description: item.description,
          user: {
            id: item.user_id,
            username: profilesMap[item.user_id]?.username || "Unknown user",
            avatar_url: profilesMap[item.user_id]?.avatar_url,
          },
          created_at: item.created_at,
          data: {
            distance: item.distance,
            duration: item.duration,
            plants_found: item.plants_found,
          },
        }))

        setFeed(formattedFeed)
        setUserProfiles(profilesMap)

        // Fetch leaderboard
        const { data: leaderboardData, error: leaderboardError } = await supabaseClient
          .from("user_profiles")
          .select("id, username, avatar_url, total_plants_identified, streak_count, total_distance")
          .order("total_plants_identified", { ascending: false })
          .limit(10)

        if (leaderboardError) {
          throw leaderboardError
        }

        setLeaderboard(leaderboardData || [])
      } catch (err) {
        console.error("Error fetching social data:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch social data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
        setInitialLoad(false)
      }
    }

    if (user) {
      fetchSocialData()
    }
  }, [user, toast, initialLoad]) // Remove supabase and userProfiles from dependencies

  // Update the tab change handler
  const handleTabChange = (value: string) => {
    setActiveTab(value)

    // If we haven't loaded this tab's data yet, set loading to true
    if (!loadedTabs[value]) {
      setLoading(true)
    }
  }

  // Update the useEffect to mark tabs as loaded
  useEffect(() => {
    if (!loading && user) {
      setLoadedTabs((prev) => ({
        ...prev,
        [activeTab]: true,
      }))
    }
  }, [loading, user, activeTab])

  // Format date
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Format time ago
  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (seconds < 60) return `${seconds} seconds ago`
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes} minutes ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours} hours ago`
    const days = Math.floor(hours / 24)
    if (days < 30) return `${days} days ago`
    const months = Math.floor(days / 30)
    if (months < 12) return `${months} months ago`
    return `${Math.floor(months / 12)} years ago`
  }

  if (authLoading) {
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
          <h1 className="text-2xl font-bold mb-6">Social</h1>

          <Tabs defaultValue="feed" value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="feed">Activity Feed</TabsTrigger>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            <TabsContent value="feed">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
                  <p>Loading activity feed...</p>
                </div>
              ) : feed.length === 0 ? (
                <div className="text-center py-8">
                  <p>No activity in your feed yet.</p>
                  <Button className="bg-green-600 hover:bg-green-700 mt-4" onClick={() => setActiveTab("friends")}>
                    <Users className="mr-2 h-4 w-4" />
                    Find Friends
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {feed.map((item) => (
                    <Card key={`${item.type}-${item.id}`}>
                      <CardHeader>
                        <div className="flex justify-between">
                          <div className="flex items-center">
                            <Avatar className="h-10 w-10 mr-3">
                              <AvatarImage src={item.user.avatar_url || "/placeholder-user.jpg"} />
                              <AvatarFallback>{item.user.username.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{item.user.username}</p>
                              <p className="text-xs text-gray-500">{formatTimeAgo(item.created_at)}</p>
                            </div>
                          </div>
                          <Badge variant="outline">
                            {item.type === "trail" ? "Completed a Trail" : "Identified a Plant"}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <h3 className="text-lg font-medium mb-1">{item.title}</h3>
                        <p className="text-gray-600 mb-4">{item.description}</p>

                        {item.type === "trail" && (
                          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-md p-3 mb-4">
                            <div>
                              <p className="text-sm text-gray-500">Distance</p>
                              <p className="font-medium">{item.data.distance} km</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Duration</p>
                              <p className="font-medium">{Math.floor(item.data.duration / 60)} min</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Plants</p>
                              <p className="font-medium">{item.data.plants_found}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex justify-between">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            Like
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Comment
                          </Button>
                        </div>
                        <Link href={`/trails/${item.id}`}>
                          <Button variant="outline" size="sm">
                            View Details
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="friends">
              <Card>
                <CardHeader>
                  <CardTitle>Find & Manage Friends</CardTitle>
                  <CardDescription>Connect with other plant enthusiasts</CardDescription>
                </CardHeader>
                <CardContent>
                  <FriendFinder />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="leaderboard">
              {loading ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
                  <p>Loading leaderboard...</p>
                </div>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Top Plant Hunters</CardTitle>
                    <CardDescription>See who's discovered the most plants</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {leaderboard.map((user, index) => (
                        <div key={user.id} className="flex items-center p-3 bg-gray-50 rounded-md">
                          <span className="font-bold text-lg mr-4 w-6 text-center">{index + 1}</span>
                          <Avatar className="h-10 w-10 mr-4">
                            <AvatarImage src={user.avatar_url || "/placeholder-user.jpg"} />
                            <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-medium">{user.username}</p>
                            <p className="text-xs text-gray-500">
                              {user.total_plants_identified} plants • {user.streak_count} day streak
                            </p>
                          </div>
                          <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                            {getBadgeForUser(user)}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

// Helper function to get badge for user based on plants identified
function getBadgeForUser(user) {
  if (user.total_plants_identified >= 100) return "Plant Master"
  if (user.total_plants_identified >= 50) return "Plant Expert"
  if (user.total_plants_identified >= 25) return "Plant Enthusiast"
  if (user.total_plants_identified >= 10) return "Plant Collector"
  return "Beginner"
}

