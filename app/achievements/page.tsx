"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Leaf,
  Award,
  Loader2,
  Trophy,
  Route,
  Users,
  Camera,
  Calendar,
  Star,
  MapPin,
  Compass,
  Crown,
  Zap,
  Heart,
  Clock,
  Sparkles,
  Medal,
  Target,
  Flame,
  Check,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { AchievementBadge } from "@/components/achievement-badge"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

export default function AchievementsPage() {
  const [achievements, setAchievements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState("all")
  const [sortOrder, setSortOrder] = useState("progress") // progress, alphabetical, newest
  const [userProfile, setUserProfile] = useState(null)
  const [selectedAchievement, setSelectedAchievement] = useState(null)
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

  // Fetch achievements and user profile
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return

      try {
        setLoading(true)

        // Fetch user profile
        const { data: profileData, error: profileError } = await supabase
          .from("user_profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profileError) {
          console.error("Error fetching user profile:", profileError)
        } else {
          setUserProfile(profileData)
        }

        // Fetch user's achievements
        const { data: userAchievements, error: achievementsError } = await supabase
          .from("user_achievements")
          .select(`
            *,
            achievement:achievements(*)
          `)
          .eq("user_id", user.id)

        if (achievementsError) {
          throw achievementsError
        }

        // If no achievements yet, fetch all achievements and create entries for the user
        if (userAchievements.length === 0) {
          const { data: allAchievements, error: allAchievementsError } = await supabase.from("achievements").select("*")

          if (allAchievementsError) {
            throw allAchievementsError
          }

          // Create user achievement entries
          const userAchievementEntries = allAchievements.map((achievement) => ({
            user_id: user.id,
            achievement_id: achievement.id,
            progress: 0,
            completed: false,
          }))

          const { error: insertError } = await supabase.from("user_achievements").insert(userAchievementEntries)

          if (insertError) {
            throw insertError
          }

          // Fetch again after creating
          const { data: newUserAchievements, error: newError } = await supabase
            .from("user_achievements")
            .select(`
              *,
              achievement:achievements(*)
            `)
            .eq("user_id", user.id)

          if (newError) {
            throw newError
          }

          setAchievements(newUserAchievements || [])
        } else {
          setAchievements(userAchievements || [])
        }
      } catch (err) {
        console.error("Error fetching achievements:", err)
        setError(err.message)
        toast({
          title: "Error",
          description: err.message || "Failed to fetch achievements",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, supabase, toast])

  // Filter and sort achievements
  const getFilteredAchievements = () => {
    // First filter by category
    const filtered =
      activeTab === "all" ? achievements : achievements.filter((a) => a.achievement.category === activeTab)

    // Then sort
    switch (sortOrder) {
      case "progress":
        return filtered.sort((a, b) => {
          const aProgress = a.progress / a.achievement.requirement_count
          const bProgress = b.progress / b.achievement.requirement_count
          return bProgress - aProgress
        })
      case "alphabetical":
        return filtered.sort((a, b) => a.achievement.name.localeCompare(b.achievement.name))
      case "newest":
        return filtered.sort((a, b) => {
          if (a.completed && b.completed) {
            return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
          }
          return a.completed ? -1 : b.completed ? 1 : 0
        })
      default:
        return filtered
    }
  }

  // Get badge color based on category
  const getBadgeColor = (category) => {
    const colors = {
      plants: "bg-emerald-100 text-emerald-800",
      trails: "bg-blue-100 text-blue-800",
      social: "bg-purple-100 text-purple-800",
      streaks: "bg-amber-100 text-amber-800",
      special: "bg-rose-100 text-rose-800",
      explorer: "bg-indigo-100 text-indigo-800",
      collector: "bg-cyan-100 text-cyan-800",
      community: "bg-pink-100 text-pink-800",
    }
    return colors[category] || "bg-gray-100 text-gray-800"
  }

  // Get icon based on category
  const getCategoryIcon = (category) => {
    switch (category) {
      case "plants":
        return <Leaf className="h-6 w-6 text-emerald-600" />
      case "trails":
        return <Route className="h-6 w-6 text-blue-600" />
      case "social":
        return <Users className="h-6 w-6 text-purple-600" />
      case "streaks":
        return <Calendar className="h-6 w-6 text-amber-600" />
      case "special":
        return <Star className="h-6 w-6 text-rose-600" />
      case "explorer":
        return <Compass className="h-6 w-6 text-indigo-600" />
      case "collector":
        return <Camera className="h-6 w-6 text-cyan-600" />
      case "community":
        return <Heart className="h-6 w-6 text-pink-600" />
      default:
        return <Award className="h-6 w-6 text-gray-600" />
    }
  }

  // Get badge level based on requirement count and progress
  const getBadgeLevel = (requirementCount, progress) => {
    const percentage = progress / requirementCount
    if (percentage >= 1) return "platinum"
    if (percentage >= 0.75) return "gold"
    if (percentage >= 0.5) return "silver"
    if (percentage >= 0.25) return "bronze"
    return "bronze"
  }

  // Calculate total achievement points
  const calculateTotalPoints = () => {
    return achievements.reduce((total, a) => {
      if (a.completed) {
        // Points based on difficulty/requirement count
        const basePoints = Math.ceil(a.achievement.requirement_count / 5) * 10
        return total + basePoints
      }
      return total
    }, 0)
  }

  // Get user rank based on points
  const getUserRank = (points) => {
    if (points >= 1000) return { name: "Master Explorer", icon: <Crown className="h-5 w-5 text-yellow-500" /> }
    if (points >= 500) return { name: "Expert Naturalist", icon: <Medal className="h-5 w-5 text-blue-500" /> }
    if (points >= 250) return { name: "Seasoned Trekker", icon: <Compass className="h-5 w-5 text-green-500" /> }
    if (points >= 100) return { name: "Plant Enthusiast", icon: <Leaf className="h-5 w-5 text-emerald-500" /> }
    return { name: "Novice Explorer", icon: <MapPin className="h-5 w-5 text-gray-500" /> }
  }

  // Get achievement categories
  const getCategories = () => {
    const categories = new Set(achievements.map((a) => a.achievement.category))
    return Array.from(categories)
  }

  // Show achievement details
  const showAchievementDetails = (achievement) => {
    setSelectedAchievement(achievement)
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  const totalPoints = calculateTotalPoints()
  const userRank = getUserRank(totalPoints)
  const categories = getCategories()

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
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Achievements & Badges</h1>
            <div className="flex items-center mt-2 md:mt-0">
              <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-full px-4 py-1 flex items-center">
                {userRank.icon}
                <span className="ml-2 font-medium">{userRank.name}</span>
                <div className="ml-2 px-2 py-0.5 bg-white rounded-full text-xs font-bold text-emerald-600">
                  {totalPoints} pts
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-green-600 mx-auto mb-4" />
              <p>Loading your achievements...</p>
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
              {/* Achievement Stats */}
              <div className="grid gap-6 md:grid-cols-4 mb-8">
                <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center flex items-center justify-center">
                      <Leaf className="h-5 w-5 mr-2 text-emerald-600" />
                      Plants
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold text-emerald-600 mb-2">
                      {userProfile?.total_plants_identified || 0}
                    </div>
                    <p className="text-xs text-emerald-700">Plants Identified</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center flex items-center justify-center">
                      <Route className="h-5 w-5 mr-2 text-blue-600" />
                      Trails
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {userProfile?.total_distance?.toFixed(1) || 0}
                    </div>
                    <p className="text-xs text-blue-700">Kilometers Trekked</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center flex items-center justify-center">
                      <Flame className="h-5 w-5 mr-2 text-amber-600" />
                      Streak
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold text-amber-600 mb-2">{userProfile?.streak_count || 0}</div>
                    <p className="text-xs text-amber-700">Day Streak</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-center flex items-center justify-center">
                      <Trophy className="h-5 w-5 mr-2 text-purple-600" />
                      Badges
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {achievements.filter((a) => a.completed).length}
                    </div>
                    <p className="text-xs text-purple-700">Badges Earned</p>
                  </CardContent>
                </Card>
              </div>

              {/* Badge Showcase */}
              <Card className="mb-8 border-none bg-gradient-to-r from-gray-50 to-gray-100">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Crown className="h-5 w-5 mr-2 text-amber-500" />
                    Badge Showcase
                  </CardTitle>
                  <CardDescription>Your most impressive achievements</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap justify-center gap-6">
                    {achievements
                      .filter((a) => a.completed)
                      .sort((a, b) => b.achievement.requirement_count - a.achievement.requirement_count)
                      .slice(0, 5)
                      .map((userAchievement) => (
                        <AchievementBadge
                          key={`showcase-${userAchievement.id}`}
                          category={userAchievement.achievement.category}
                          name={userAchievement.achievement.name}
                          level={getBadgeLevel(userAchievement.achievement.requirement_count, userAchievement.progress)}
                          completed={userAchievement.completed}
                          size="lg"
                          onClick={() => showAchievementDetails(userAchievement)}
                        />
                      ))}

                    {achievements.filter((a) => a.completed).length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        <Trophy className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>Complete achievements to showcase your badges here!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Achievement Tabs */}
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    {categories.map((category) => (
                      <TabsTrigger key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>

                <div className="flex items-center mt-4 md:mt-0">
                  <span className="text-sm mr-2">Sort by:</span>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="text-sm border rounded-md px-2 py-1"
                  >
                    <option value="progress">Progress</option>
                    <option value="alphabetical">Alphabetical</option>
                    <option value="newest">Recently Completed</option>
                  </select>
                </div>
              </div>

              {/* Achievement Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                {getFilteredAchievements().map((userAchievement) => {
                  const achievement = userAchievement.achievement
                  const progress = (userAchievement.progress / achievement.requirement_count) * 100
                  const level = getBadgeLevel(achievement.requirement_count, userAchievement.progress)

                  return (
                    <Card
                      key={userAchievement.id}
                      className={`border-none shadow-md transition-all duration-300 hover:shadow-lg cursor-pointer ${
                        userAchievement.completed ? "bg-gradient-to-br from-white to-gray-50" : ""
                      }`}
                      onClick={() => showAchievementDetails(userAchievement)}
                    >
                      <CardHeader className="pb-2 text-center">
                        <div className="flex justify-center mb-2">
                          <AchievementBadge
                            category={achievement.category}
                            name=""
                            level={level}
                            completed={userAchievement.completed}
                            size="md"
                          />
                        </div>
                        <CardTitle>{achievement.name}</CardTitle>
                        <CardDescription>{achievement.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="text-center">
                        <Progress value={progress} className="h-2 mb-2" />
                        <div className="flex justify-between text-xs text-gray-500 mb-3">
                          <span>0</span>
                          <span>{achievement.requirement_count}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className={`text-xs px-2 py-1 rounded-full ${getBadgeColor(achievement.category)}`}>
                            {achievement.category}
                          </div>
                          <p className="text-sm font-medium">
                            {userAchievement.progress}/{achievement.requirement_count}
                          </p>
                        </div>
                        {userAchievement.completed && (
                          <div className="mt-3 flex items-center justify-center text-sm text-emerald-600 font-medium">
                            <Trophy className="h-4 w-4 mr-1" />
                            <span>Completed on {new Date(userAchievement.completed_at).toLocaleDateString()}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* Badge Levels */}
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Medal className="h-5 w-5 mr-2 text-amber-500" />
                  Badge Levels
                </h2>
                <div className="grid gap-4 md:grid-cols-4">
                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-amber-800">Bronze</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-amber-100 to-amber-200 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-amber-300">
                        <Award className="h-8 w-8 text-amber-800" />
                      </div>
                      <p className="text-sm text-amber-800">First steps in your journey</p>
                      <p className="text-xs text-amber-700 mt-1">25% completion</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-gray-50 to-gray-200 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-gray-700">Silver</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-gray-100 to-gray-300 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-gray-400">
                        <Award className="h-8 w-8 text-gray-700" />
                      </div>
                      <p className="text-sm text-gray-700">Building your expertise</p>
                      <p className="text-xs text-gray-600 mt-1">50% completion</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-yellow-50 to-yellow-200 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-yellow-800">Gold</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-yellow-100 to-yellow-300 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-yellow-400">
                        <Award className="h-8 w-8 text-yellow-800" />
                      </div>
                      <p className="text-sm text-yellow-800">Advanced achievements</p>
                      <p className="text-xs text-yellow-700 mt-1">75% completion</p>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-blue-50 to-blue-200 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-blue-800">Platinum</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-blue-100 to-blue-200 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-blue-300">
                        <Award className="h-8 w-8 text-blue-800" />
                      </div>
                      <p className="text-sm text-blue-800">Mastery level accomplishments</p>
                      <p className="text-xs text-blue-700 mt-1">100% completion</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Special Achievements */}
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Sparkles className="h-5 w-5 mr-2 text-purple-500" />
                  Special Achievements
                </h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-purple-800">First Discovery</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-purple-100 to-purple-200 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-purple-300">
                        <Zap className="h-8 w-8 text-purple-800" />
                      </div>
                      <p className="text-sm text-purple-800">Identify your first plant</p>
                      <Badge className="mt-2 bg-purple-200 text-purple-800 hover:bg-purple-200">
                        One-time achievement
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-emerald-800">Trail Blazer</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-emerald-100 to-emerald-200 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-emerald-300">
                        <MapPin className="h-8 w-8 text-emerald-800" />
                      </div>
                      <p className="text-sm text-emerald-800">Complete your first 5km trek</p>
                      <Badge className="mt-2 bg-emerald-200 text-emerald-800 hover:bg-emerald-200">
                        Milestone achievement
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-rose-50 to-rose-100 border-none">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-center text-rose-800">Social Butterfly</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="bg-gradient-to-br from-rose-100 to-rose-200 w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-2 border-2 border-rose-300">
                        <Users className="h-8 w-8 text-rose-800" />
                      </div>
                      <p className="text-sm text-rose-800">Connect with 5 friends</p>
                      <Badge className="mt-2 bg-rose-200 text-rose-800 hover:bg-rose-200">Community achievement</Badge>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Upcoming Achievements */}
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-500" />
                  Next Achievements
                </h2>
                <div className="space-y-4">
                  {achievements
                    .filter((a) => !a.completed)
                    .sort((a, b) => {
                      const aProgress = a.progress / a.achievement.requirement_count
                      const bProgress = b.progress / b.achievement.requirement_count
                      return bProgress - aProgress
                    })
                    .slice(0, 3)
                    .map((userAchievement) => {
                      const achievement = userAchievement.achievement
                      const progress = (userAchievement.progress / achievement.requirement_count) * 100
                      const remaining = achievement.requirement_count - userAchievement.progress

                      return (
                        <Card key={`upcoming-${userAchievement.id}`} className="border-none shadow-sm">
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div className={`p-2 rounded-full mr-2 ${getBadgeColor(achievement.category)}`}>
                                  {getCategoryIcon(achievement.category)}
                                </div>
                                <div>
                                  <h3 className="font-medium">{achievement.name}</h3>
                                  <p className="text-xs text-gray-500">{achievement.description}</p>
                                </div>
                              </div>
                              <div className="text-sm font-medium">
                                {userAchievement.progress}/{achievement.requirement_count}
                              </div>
                            </div>
                            <Progress value={progress} className="h-2 mb-1" />
                            <div className="flex justify-between items-center mt-2">
                              <p className="text-xs text-gray-500">{remaining} more to go!</p>
                              <Button variant="outline" size="sm" className="h-7 text-xs">
                                <Target className="h-3 w-3 mr-1" />
                                Focus on this
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                </div>
              </div>

              {/* Achievement Milestones */}
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center">
                  <Clock className="h-5 w-5 mr-2 text-indigo-500" />
                  Achievement Milestones
                </h2>
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-6 relative z-10">
                    <div className="flex">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <div className="ml-4 bg-white p-4 rounded-lg shadow-sm flex-1">
                        <h3 className="font-medium">Beginner Explorer</h3>
                        <p className="text-sm text-gray-600 mt-1">Identify your first plant</p>
                        <Badge className="mt-2 bg-emerald-100 text-emerald-800">Completed</Badge>
                      </div>
                    </div>

                    <div className="flex">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                        <Check className="h-4 w-4 text-white" />
                      </div>
                      <div className="ml-4 bg-white p-4 rounded-lg shadow-sm flex-1">
                        <h3 className="font-medium">Dedicated Naturalist</h3>
                        <p className="text-sm text-gray-600 mt-1">Identify 10 different plants</p>
                        <Badge className="mt-2 bg-blue-100 text-blue-800">Completed</Badge>
                      </div>
                    </div>

                    <div className="flex">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-white font-medium">3</span>
                      </div>
                      <div className="ml-4 bg-white p-4 rounded-lg shadow-sm flex-1">
                        <h3 className="font-medium">Plant Expert</h3>
                        <p className="text-sm text-gray-600 mt-1">Identify 50 different plants</p>
                        <div className="mt-2">
                          <Progress value={30} className="h-2 mb-1" />
                          <p className="text-xs text-gray-500">15/50 plants identified</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center">
                        <span className="text-white font-medium">4</span>
                      </div>
                      <div className="ml-4 bg-white p-4 rounded-lg shadow-sm flex-1">
                        <h3 className="font-medium">Botanical Master</h3>
                        <p className="text-sm text-gray-600 mt-1">Identify 100 different plants</p>
                        <div className="mt-2">
                          <Progress value={15} className="h-2 mb-1" />
                          <p className="text-xs text-gray-500">15/100 plants identified</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {/* Achievement Detail Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedAchievement?.achievement?.name}</DialogTitle>
            <DialogDescription>{selectedAchievement?.achievement?.description}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-4">
            <AchievementBadge
              category={selectedAchievement?.achievement?.category}
              name=""
              level={
                selectedAchievement
                  ? getBadgeLevel(selectedAchievement.achievement.requirement_count, selectedAchievement.progress)
                  : "bronze"
              }
              completed={selectedAchievement?.completed}
              size="lg"
            />

            <div className="mt-4 w-full">
              <Progress
                value={
                  selectedAchievement
                    ? (selectedAchievement.progress / selectedAchievement.achievement.requirement_count) * 100
                    : 0
                }
                className="h-2 mb-2"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>0</span>
                <span>{selectedAchievement?.achievement?.requirement_count}</span>
              </div>
            </div>

            <div className="mt-4 text-center">
              <div
                className={`inline-block text-xs px-2 py-1 rounded-full ${
                  selectedAchievement ? getBadgeColor(selectedAchievement.achievement.category) : ""
                }`}
              >
                {selectedAchievement?.achievement?.category}
              </div>

              <p className="mt-2 text-sm">
                {selectedAchievement?.completed
                  ? `Completed on ${new Date(selectedAchievement.completed_at).toLocaleDateString()}`
                  : `${selectedAchievement?.progress || 0}/${selectedAchievement?.achievement?.requirement_count || 0} completed`}
              </p>

              {selectedAchievement?.completed && (
                <div className="mt-3 flex items-center justify-center text-sm text-emerald-600 font-medium">
                  <Trophy className="h-4 w-4 mr-1" />
                  <span>Achievement Unlocked!</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-md mt-2">
            <h4 className="font-medium text-sm mb-2">How to earn this badge:</h4>
            <p className="text-sm text-gray-600">
              {selectedAchievement?.achievement?.category === "plants" &&
                "Identify plants and add them to your collection."}
              {selectedAchievement?.achievement?.category === "trails" && "Complete trails and track your distance."}
              {selectedAchievement?.achievement?.category === "social" &&
                "Connect with friends and share your discoveries."}
              {selectedAchievement?.achievement?.category === "streaks" && "Use the app daily to maintain your streak."}
              {selectedAchievement?.achievement?.category === "special" &&
                "Complete special challenges and milestones."}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

