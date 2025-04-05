"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Camera, Leaf, Map, Trophy, Users, PlusCircle, Award, Loader2, LogOut, Calendar, Route } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import SavedTreks from "@/components/saved-treks"
import { PlantCard } from "@/components/plant-card"
import { AchievementBadge } from "@/components/achievement-badge"

export default function Dashboard() {
  // Keep the existing state variables
  const [activeTab, setActiveTab] = useState(() => {
    // Try to get from localStorage if available
    if (typeof window !== "undefined") {
      const savedTab = localStorage.getItem("dashboardActiveTab")
      return savedTab || "plantdex"
    }
    return "plantdex"
  })
  const [userPlants, setUserPlants] = useState([])
  const [userAchievements, setUserAchievements] = useState([])
  const [userTrails, setUserTrails] = useState([])
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const { toast } = useToast()
  const router = useRouter()
  const { user, isLoading: authLoading, signOut } = useAuth()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        // Handle the case where profile doesn't exist
        if (profileError) {
          if (profileError.code === "PGRST116") {
            // No rows returned
            // Try to create profile via the API endpoint to bypass RLS
            const response = await fetch("/api/create-profile", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                userId: user.id,
                username: user.email?.split("@")[0] || "user",
              }),
            })

            if (!response.ok) {
              const errorData = await response.json()
              // If it's a duplicate key error, try to fetch the profile again
              if (errorData.error && errorData.error.includes("duplicate key")) {
                // Wait a moment and try fetching again
                await new Promise((resolve) => setTimeout(resolve, 500))
                const { data: retryData, error: retryError } = await supabase
                  .from("user_profiles")
                  .select("*")
                  .eq("id", user.id)
                  .single()

                if (retryError) {
                  throw retryError
                }

                setUserProfile(retryData)
              } else {
                throw new Error(errorData.error || "Failed to create user profile")
              }
            } else {
              // Profile created successfully, fetch it
              const { data: newProfile, error: fetchError } = await supabase
                .from("user_profiles")
                .select("*")
                .eq("id", user.id)
                .single()

              if (fetchError) {
                throw fetchError
              }

              setUserProfile(newProfile)
            }
          } else {
            throw profileError
          }
        } else {
          setUserProfile(profileData)
        }

        // Fetch user's plants
        const { data: plants, error: plantsError } = await supabase
          .from("plants")
          .select("*")
          .order("date_found", { ascending: false })

        if (plantsError) {
          throw plantsError
        }

        console.log("Fetched plants:", plants) // Debug log
        setUserPlants(plants || [])

        // Fetch user's achievements
        const { data: achievements, error: achievementsError } = await supabase
          .from("user_achievements")
          .select(`
            *,
            achievement:achievements(*)
          `)
          .eq("user_id", user.id)

        if (achievementsError) {
          throw achievementsError
        }

        setUserAchievements(achievements || [])

        // Fetch user's trails
        const { data: trails, error: trailsError } = await supabase
          .from("trails")
          .select("*")
          .order("date_completed", { ascending: false })

        if (trailsError) {
          throw trailsError
        }

        setUserTrails(trails || [])

        // Update streak if needed
        await updateStreak(supabase, user.id, profileData)
      } catch (err) {
        console.error("Error fetching user data:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch user data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [user, supabase, toast])

  // Update user streak
  const updateStreak = async (supabase, userId, profile) => {
    try {
      if (!profile) return

      const today = new Date().toISOString().split("T")[0]
      const lastDate = profile.streak_last_date ? profile.streak_last_date.split("T")[0] : null

      // If last date is today, no need to update
      if (lastDate === today) return

      // If last date was yesterday, increment streak
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yesterdayStr = yesterday.toISOString().split("T")[0]

      let newStreak = profile.streak_count || 0

      if (lastDate === yesterdayStr) {
        // Increment streak
        newStreak += 1
      } else if (lastDate !== today) {
        // Reset streak if more than a day has passed
        newStreak = 1
      }

      // Update profile
      await supabase
        .from("user_profiles")
        .update({
          streak_count: newStreak,
          streak_last_date: new Date().toISOString(),
        })
        .eq("id", userId)

      // Update achievement
      const { data: streakAchievement } = await supabase
        .from("achievements")
        .select("id")
        .eq("category", "streaks")
        .single()

      if (streakAchievement) {
        const { data: userAchievement } = await supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", userId)
          .eq("achievement_id", streakAchievement.id)
          .single()

        if (userAchievement) {
          const completed = newStreak >= userAchievement.achievement.requirement_count

          await supabase
            .from("user_achievements")
            .update({
              progress: newStreak,
              completed,
              completed_at:
                completed && !userAchievement.completed ? new Date().toISOString() : userAchievement.completed_at,
            })
            .eq("id", userAchievement.id)
        }
      }
    } catch (error) {
      console.error("Error updating streak:", error)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error("Error signing out:", error)
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      })
    }
  }

  // For debugging - add some sample plants if none exist
  const addSamplePlants = async () => {
    if (!user) return

    const samplePlants = [
      {
        user_id: user.id,
        common_name: "Dandelion",
        scientific_name: "Taraxacum officinale",
        date_found: new Date().toISOString(),
        location: "Backyard",
        edible: true,
        poisonous: false,
        medicinal: true,
        description: "Common yellow flowering plant with edible leaves and roots.",
        image_url: "https://images.unsplash.com/photo-1588167056547-c733701ecaa1?q=80&w=400&auto=format",
      },
      {
        user_id: user.id,
        common_name: "Poison Ivy",
        scientific_name: "Toxicodendron radicans",
        date_found: new Date().toISOString(),
        location: "Forest trail",
        edible: false,
        poisonous: true,
        medicinal: false,
        description: "Causes skin irritation and rash upon contact.",
        image_url: "https://images.unsplash.com/photo-1632422132214-39f3beb2cdc5?q=80&w=400&auto=format",
      },
      {
        user_id: user.id,
        common_name: "Lavender",
        scientific_name: "Lavandula",
        date_found: new Date().toISOString(),
        location: "Garden",
        edible: true,
        poisonous: false,
        medicinal: true,
        description: "Fragrant purple flowering plant used in essential oils.",
        image_url: "https://images.unsplash.com/photo-1595252129837-2f7da223825c?q=80&w=400&auto=format",
      },
    ]

    try {
      const { data, error } = await supabase.from("plants").insert(samplePlants).select()

      if (error) throw error

      toast({
        title: "Sample plants added",
        description: "Sample plants have been added to your collection for demonstration.",
      })

      // Refresh plants
      const { data: plants } = await supabase.from("plants").select("*").order("date_found", { ascending: false })

      setUserPlants(plants || [])
    } catch (err) {
      console.error("Error adding sample plants:", err)
      toast({
        title: "Error",
        description: "Failed to add sample plants.",
        variant: "destructive",
      })
    }
  }

  const handleDeletePlant = (plantId: string) => {
    // Filter out the deleted plant from the state
    setUserPlants((prevPlants) => prevPlants.filter((plant) => plant.id !== plantId))

    // Update the user profile stats if needed
    if (userProfile) {
      setUserProfile({
        ...userProfile,
        total_plants_identified: Math.max(0, (userProfile.total_plants_identified || 1) - 1),
      })
    }
  }

  // Add a function to handle tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    // Save to localStorage if available
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboardActiveTab", tab)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  const getBadgeLevel = (requirementCount, progress) => {
    if (progress >= requirementCount) return "gold"
    if (progress >= requirementCount * 0.75) return "silver"
    return "bronze"
  }

  const getBadgeColor = (category) => {
    switch (category) {
      case "plants":
        return "bg-green-100 text-green-700"
      case "trails":
        return "bg-blue-100 text-blue-700"
      case "streaks":
        return "bg-yellow-100 text-yellow-700"
      default:
        return "bg-gray-100 text-gray-700"
    }
  }

  const getCategoryIcon = (category) => {
    switch (category) {
      case "plants":
        return <Leaf className="h-5 w-5 text-green-500" />
      case "trails":
        return <Route className="h-5 w-5 text-blue-500" />
      case "streaks":
        return <Trophy className="h-5 w-5 text-yellow-500" />
      default:
        return <Award className="h-5 w-5 text-gray-500" />
    }
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
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b shadow-sm">
        <div className="container flex h-16 items-center px-4">
          <Link className="flex items-center gap-2 font-semibold" href="/">
            <Leaf className="h-6 w-6 text-emerald-500" />
            <span className="text-xl font-bold">PlantDex</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="h-5 w-5" />
              <span className="sr-only">Sign out</span>
            </Button>
            <Link href="/dashboard/profile">
              <Avatar>
                <AvatarImage src={userProfile?.avatar_url || "/placeholder.svg?height=40&width=40"} alt="User" />
                <AvatarFallback>{userProfile?.username?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="container grid items-start gap-4 py-6 md:grid-cols-[1fr_3fr]">
          {/* Sidebar - hidden on mobile */}
          <div className="hidden md:flex md:flex-col gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Dashboard</CardTitle>
                <CardDescription>Manage your PlantDex experience</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-1">
                <Button
                  variant={activeTab === "plantdex" ? "default" : "ghost"}
                  className={`justify-start ${activeTab === "plantdex" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                  onClick={() => handleTabChange("plantdex")}
                >
                  <Leaf className="mr-2 h-4 w-4" />
                  PlantDex
                </Button>
                <Button
                  variant={activeTab === "achievements" ? "default" : "ghost"}
                  className={`justify-start ${activeTab === "achievements" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                  onClick={() => handleTabChange("achievements")}
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Achievements
                </Button>
                <Button
                  variant={activeTab === "trails" ? "default" : "ghost"}
                  className={`justify-start ${activeTab === "trails" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                  onClick={() => handleTabChange("trails")}
                >
                  <Map className="mr-2 h-4 w-4" />
                  Trails
                </Button>
                <Button
                  variant={activeTab === "social" ? "default" : "ghost"}
                  className={`justify-start ${activeTab === "social" ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                  onClick={() => handleTabChange("social")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Social
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Your Stats</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-sm">Plants Identified:</span>
                  <span className="text-sm font-medium">{userPlants.length}/150</span>
                </div>
                <Progress
                  value={(userPlants.length / 150) * 100}
                  className="h-2 bg-emerald-100"
                  indicatorClassName="bg-emerald-500"
                />
                <div className="flex justify-between pt-2">
                  <span className="text-sm">Current Streak:</span>
                  <span className="text-sm font-medium">{userProfile?.streak_count || 0} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Distance:</span>
                  <span className="text-sm font-medium">{userProfile?.total_distance || 0} km</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Badges Earned:</span>
                  <span className="text-sm font-medium">
                    {userAchievements.filter((a) => a.completed).length}/{userAchievements.length}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Link href="/plant-identification">
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
                    <Camera className="mr-2 h-4 w-4" />
                    Identify Plant
                  </Button>
                </Link>
                <Link href="/trails">
                  <Button className="w-full">
                    <Map className="mr-2 h-4 w-4" />
                    Track Trail
                  </Button>
                </Link>
                <Link href="/social">
                  <Button className="w-full" variant="outline">
                    <Users className="mr-2 h-4 w-4" />
                    Social Feed
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>

          {/* Main content */}
          <div className="grid gap-4">
            {activeTab === "plantdex" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Your PlantDex</h2>
                  <div className="flex gap-2">
                    {userPlants.length === 0 && (
                      <Button variant="outline" size="sm" onClick={addSamplePlants} className="hidden md:flex">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Samples
                      </Button>
                    )}
                    <Link href="/plant-identification">
                      <Button className="bg-emerald-500 hover:bg-emerald-600">
                        <Camera className="mr-2 h-4 w-4" />
                        <span className="hidden md:inline">Identify Plant</span>
                        <span className="md:hidden">Identify</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
                    <p>Loading your plant collection...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-red-500">
                    <p>{error}</p>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                      Try Again
                    </Button>
                  </div>
                ) : userPlants.length === 0 ? (
                  <div className="text-center py-8 animate-fade-in">
                    <div className="bg-emerald-50 rounded-full p-6 inline-block mb-4">
                      <Leaf className="h-10 w-10 text-emerald-500" />
                    </div>
                    <p className="mb-4">You haven't added any plants to your collection yet.</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Link href="/plant-identification">
                        <Button className="bg-emerald-500 hover:bg-emerald-600">
                          <Camera className="mr-2 h-4 w-4" />
                          Identify Your First Plant
                        </Button>
                      </Link>
                      <Button variant="outline" onClick={addSamplePlants}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Add Sample Plants
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {userPlants.map((plant) => (
                      <PlantCard key={plant.id} plant={plant} onDelete={handleDeletePlant} />
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "achievements" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Your Achievements</h2>
                  <Link href="/achievements">
                    <Button className="bg-emerald-500 hover:bg-emerald-600">
                      <Trophy className="mr-2 h-4 w-4" />
                      View All
                    </Button>
                  </Link>
                </div>
                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
                    <p>Loading your achievements...</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {userAchievements.slice(0, 6).map((userAchievement) => {
                        const achievement = userAchievement.achievement
                        const progress = (userAchievement.progress / achievement.requirement_count) * 100

                        return (
                          <Card
                            key={userAchievement.id}
                            className={`border-none shadow-md ${
                              userAchievement.completed ? "bg-gradient-to-br from-white to-gray-50" : ""
                            }`}
                          >
                            <CardHeader className="pb-2 text-center">
                              <div
                                className={`mx-auto ${
                                  userAchievement.completed
                                    ? "bg-gradient-to-br from-yellow-100 to-amber-100"
                                    : "bg-gray-100"
                                } p-3 rounded-full w-16 h-16 flex items-center justify-center mb-2`}
                              >
                                <Award
                                  className={`h-8 w-8 ${userAchievement.completed ? "text-amber-600" : "text-gray-400"}`}
                                />
                              </div>
                              <CardTitle>{achievement.name}</CardTitle>
                              <CardDescription>{achievement.description}</CardDescription>
                            </CardHeader>
                            <CardContent className="text-center">
                              <Progress value={progress} className="h-2 mb-2" />
                              <p className="text-sm text-muted-foreground">
                                {userAchievement.progress}/{achievement.requirement_count} {achievement.category}
                              </p>
                              {userAchievement.completed && (
                                <div className="mt-2 text-sm text-emerald-600 font-medium">
                                  <Trophy className="h-4 w-4 inline mr-1" />
                                  Completed!
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>

                    <Card className="border-none shadow-md">
                      <CardHeader>
                        <CardTitle className="flex items-center">
                          <Trophy className="h-5 w-5 mr-2 text-amber-500" />
                          Recent Achievements
                        </CardTitle>
                        <CardDescription>Your latest accomplishments</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap justify-center gap-4">
                          {userAchievements
                            .filter((a) => a.completed)
                            .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
                            .slice(0, 5)
                            .map((userAchievement) => (
                              <AchievementBadge
                                key={`recent-${userAchievement.id}`}
                                category={userAchievement.achievement.category}
                                name={userAchievement.achievement.name}
                                level={getBadgeLevel(
                                  userAchievement.achievement.requirement_count,
                                  userAchievement.progress,
                                )}
                                completed={userAchievement.completed}
                                size="md"
                              />
                            ))}

                          {userAchievements.filter((a) => a.completed).length === 0 && (
                            <div className="text-center py-4 text-gray-500">
                              <Trophy className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                              <p>Complete achievements to see them here!</p>
                              <Link href="/achievements">
                                <Button variant="outline" size="sm" className="mt-2">
                                  <Trophy className="h-4 w-4 mr-1" />
                                  View All Achievements
                                </Button>
                              </Link>
                            </div>
                          )}
                        </div>

                        <div className="mt-6">
                          <h3 className="text-sm font-medium mb-3">Next Achievement</h3>
                          {userAchievements
                            .filter((a) => !a.completed)
                            .sort((a, b) => {
                              const aProgress = a.progress / a.achievement.requirement_count
                              const bProgress = b.progress / b.achievement.requirement_count
                              return bProgress - aProgress
                            })
                            .slice(0, 1)
                            .map((userAchievement) => {
                              const achievement = userAchievement.achievement
                              const progress = (userAchievement.progress / achievement.requirement_count) * 100

                              return (
                                <div key={`next-${userAchievement.id}`} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center">
                                      <div className={`p-2 rounded-full mr-2 ${getBadgeColor(achievement.category)}`}>
                                        {getCategoryIcon(achievement.category)}
                                      </div>
                                      <div>
                                        <h3 className="font-medium text-sm">{achievement.name}</h3>
                                        <p className="text-xs text-gray-500">{achievement.description}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <Progress value={progress} className="h-2 mb-1" />
                                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>
                                      {userAchievement.progress}/{achievement.requirement_count}
                                    </span>
                                    <span>{Math.round(progress)}% complete</span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </CardContent>
                      <CardFooter>
                        <Link href="/achievements" className="w-full">
                          <Button variant="outline" className="w-full">
                            <Trophy className="mr-2 h-4 w-4" />
                            View All Achievements
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </>
                )}
              </>
            )}

            {activeTab === "trails" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Your Trails</h2>
                  <div className="flex gap-2">
                    <Link href="/trails/plan">
                      <Button variant="outline">
                        <Route className="mr-2 h-4 w-4" />
                        <span className="hidden md:inline">Plan Route</span>
                        <span className="md:hidden">Plan</span>
                      </Button>
                    </Link>
                    <Link href="/trails">
                      <Button className="bg-emerald-500 hover:bg-emerald-600">
                        <PlusCircle className="mr-2 h-4 w-4" />
                        <span className="hidden md:inline">Track Trail</span>
                        <span className="md:hidden">Track</span>
                      </Button>
                    </Link>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
                    <p>Loading your trails...</p>
                  </div>
                ) : error ? (
                  <div className="text-center py-8 text-red-500">
                    <p>{error}</p>
                    <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
                      Try Again
                    </Button>
                  </div>
                ) : (
                  <>
                    <Card className="border-none shadow-md">
                      <CardHeader>
                        <CardTitle>Recent Treks</CardTitle>
                        <CardDescription>Your completed trails</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {user && <SavedTreks userId={user.id} limit={3} showPlanned={false} showCompleted={true} />}
                      </CardContent>
                      <CardFooter>
                        <Link href="/trails" className="w-full">
                          <Button variant="outline" className="w-full">
                            View All Completed Trails
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>

                    <Card className="border-none shadow-md">
                      <CardHeader>
                        <CardTitle>Planned Routes</CardTitle>
                        <CardDescription>Routes you've planned for future exploration</CardDescription>
                      </CardHeader>
                      <CardContent>
                        {user && <SavedTreks userId={user.id} limit={3} showPlanned={true} showCompleted={false} />}
                      </CardContent>
                      <CardFooter>
                        <Link href="/trails/plan" className="w-full">
                          <Button variant="outline" className="w-full">
                            Plan New Route
                          </Button>
                        </Link>
                      </CardFooter>
                    </Card>
                  </>
                )}
              </>
            )}

            {activeTab === "social" && (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold tracking-tight">Social</h2>
                  <Link href="/social">
                    <Button className="bg-emerald-500 hover:bg-emerald-600">
                      <Users className="mr-2 h-4 w-4" />
                      View Feed
                    </Button>
                  </Link>
                </div>
                <div className="grid gap-4">
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle>Leaderboard</CardTitle>
                      <CardDescription>This week's top plant hunters</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <span className="font-bold mr-4">1</span>
                          <Avatar className="h-10 w-10 mr-4">
                            <AvatarImage src="/placeholder.svg?height=40&width=40&text=JD" />
                            <AvatarFallback>JD</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Jane Doe</p>
                            <p className="text-xs text-muted-foreground">32 plants identified</p>
                          </div>
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Forest Master</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="font-bold mr-4">2</span>
                          <Avatar className="h-10 w-10 mr-4">
                            <AvatarImage src="/placeholder.svg?height=40&width=40&text=JS" />
                            <AvatarFallback>JS</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">John Smith</p>
                            <p className="text-xs text-muted-foreground">28 plants identified</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Urban Explorer</Badge>
                        </div>
                        <div className="flex items-center">
                          <span className="font-bold mr-4">3</span>
                          <Avatar className="h-10 w-10 mr-4">
                            <AvatarImage src="/placeholder.svg?height=40&width=40&text=AL" />
                            <AvatarFallback>AL</AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Alex Lee</p>
                            <p className="text-xs text-muted-foreground">24 plants identified</p>
                          </div>
                          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Trail Blazer</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="border-none shadow-md">
                    <CardHeader>
                      <CardTitle>Upcoming Events</CardTitle>
                      <CardDescription>Join community plant hunts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center">
                          <div className="bg-emerald-100 p-3 rounded-md mr-4">
                            <Calendar className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Spring Wildflower Hunt</p>
                            <p className="text-xs text-muted-foreground">April 15, 2025 • City Botanical Gardens</p>
                          </div>
                          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                            Join
                          </Button>
                        </div>
                        <div className="flex items-center">
                          <div className="bg-emerald-100 p-3 rounded-md mr-4">
                            <Leaf className="h-6 w-6 text-emerald-600" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium">Edible Plants Workshop</p>
                            <p className="text-xs text-muted-foreground">April 22, 2025 • Community Center</p>
                          </div>
                          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
                            Join
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Mobile navigation */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-white shadow-lg md:hidden z-10">
        <div className="grid grid-cols-5">
          <Button
            variant="ghost"
            className={`mobile-nav-button flex flex-col items-center py-2 px-0 h-16 rounded-none ${
              activeTab === "plantdex" ? "active" : ""
            }`}
            onClick={() => handleTabChange("plantdex")}
          >
            <Leaf className="h-5 w-5" />
            <span className="text-xs mt-1">PlantDex</span>
          </Button>
          <Button
            variant="ghost"
            className={`mobile-nav-button flex flex-col items-center py-2 px-0 h-16 rounded-none ${
              activeTab === "achievements" ? "active" : ""
            }`}
            onClick={() => handleTabChange("achievements")}
          >
            <Trophy className="h-5 w-5" />
            <span className="text-xs mt-1">Badges</span>
          </Button>
          <Link href="/plant-identification" className="flex flex-col items-center justify-center h-16 rounded-none">
            <div className="bg-emerald-500 text-white p-3 rounded-full -mt-6 shadow-lg">
              <Camera className="h-5 w-5" />
            </div>
            <span className="text-xs mt-1">Identify</span>
          </Link>
          <Button
            variant="ghost"
            className={`mobile-nav-button flex flex-col items-center py-2 px-0 h-16 rounded-none ${
              activeTab === "trails" ? "active" : ""
            }`}
            onClick={() => handleTabChange("trails")}
          >
            <Map className="h-5 w-5" />
            <span className="text-xs mt-1">Trails</span>
          </Button>
          <Button
            variant="ghost"
            className={`mobile-nav-button flex flex-col items-center py-2 px-0 h-16 rounded-none ${
              activeTab === "social" ? "active" : ""
            }`}
            onClick={() => handleTabChange("social")}
          >
            <Users className="h-5 w-5" />
            <span className="text-xs mt-1">Social</span>
          </Button>
        </div>
      </div>
    </div>
  )
}

