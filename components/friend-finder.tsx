"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, UserPlus, Check, X, UserMinus, Loader2, AlertTriangle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase/client"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import React from "react"

export default function FriendFinder() {
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState([])
  const [friends, setFriends] = useState([])
  const [pendingRequests, setPendingRequests] = useState([])
  const [sentRequests, setSentRequests] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("find")
  const [tableExists, setTableExists] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")
  const { toast } = useToast()
  const supabase = createClient()

  // Fetch friends and requests
  useEffect(() => {
    fetchFriends()
  }, [])

  // Update the fetchFriends function to use a stable reference to supabase
  const fetchFriends = async () => {
    try {
      setIsLoading(true)
      setErrorMessage("")

      // Create a stable reference to supabase
      const supabaseClient = createClient()

      // Fetch accepted friends
      const acceptedResponse = await fetch("/api/friends?type=accepted")
      if (!acceptedResponse.ok) {
        throw new Error(`Error fetching friends: ${acceptedResponse.statusText}`)
      }
      const acceptedData = await acceptedResponse.json()

      // Check if the table exists
      if (acceptedData.hasOwnProperty("tableExists") && !acceptedData.tableExists) {
        setTableExists(false)
        setErrorMessage(acceptedData.message || "Friends table does not exist yet.")
        setFriends([])
        setPendingRequests([])
        setSentRequests([])
        return
      }

      setFriends(acceptedData?.friends || [])

      // Only continue if the table exists
      if (tableExists) {
        // Fetch pending requests
        const pendingResponse = await fetch("/api/friends?type=pending")
        if (!pendingResponse.ok) {
          throw new Error(`Error fetching pending requests: ${pendingResponse.statusText}`)
        }
        const pendingData = await pendingResponse.json()
        setPendingRequests(pendingData?.friends || [])

        // Fetch sent requests
        const sentResponse = await fetch("/api/friends?type=sent")
        if (!sentResponse.ok) {
          throw new Error(`Error fetching sent requests: ${sentResponse.statusText}`)
        }
        const sentData = await sentResponse.json()
        setSentRequests(sentData?.friends || [])
      }
    } catch (error) {
      console.error("Error fetching friends:", error)
      setErrorMessage(error.message || "Failed to load friends. Please try again.")
      toast({
        title: "Error",
        description: error.message || "Failed to load friends. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Add a memoized search function to prevent unnecessary re-renders

  // Replace the handleSearch function with this memoized version
  const handleSearch = React.useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }

    try {
      setIsSearching(true)
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`)

      if (!response.ok) {
        throw new Error("Failed to search users")
      }

      const data = await response.json()
      setSearchResults(data.users || [])
    } catch (error) {
      console.error("Error searching users:", error)
      toast({
        title: "Search Error",
        description: "Failed to search for users. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, toast])

  // Send friend request
  const sendFriendRequest = async (userId) => {
    if (!tableExists) {
      toast({
        title: "Feature Not Available",
        description: "The friends feature is not available yet. Please set up the database table.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/friends", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ friendId: userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send friend request")
      }

      toast({
        title: "Request Sent",
        description: "Friend request sent successfully!",
      })

      // Update the UI
      await fetchFriends()

      // Update search results to show pending status
      setSearchResults((prev) => prev.map((user) => (user.id === userId ? { ...user, requestSent: true } : user)))
    } catch (error) {
      console.error("Error sending friend request:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send friend request. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Accept friend request
  const handleFriendRequest = async (requestId, action) => {
    if (!tableExists) {
      toast({
        title: "Feature Not Available",
        description: "The friends feature is not available yet. Please set up the database table.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/friends/${requestId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} friend request`)
      }

      toast({
        title: action === "accept" ? "Request Accepted" : "Request Rejected",
        description: action === "accept" ? "You are now friends!" : "Friend request rejected.",
      })

      // Update the UI
      await fetchFriends()
    } catch (error) {
      console.error(`Error ${action}ing friend request:`, error)
      toast({
        title: "Error",
        description: error.message || `Failed to ${action} friend request. Please try again.`,
        variant: "destructive",
      })
    }
  }

  // Remove friend
  const removeFriend = async (friendshipId) => {
    if (!tableExists) {
      toast({
        title: "Feature Not Available",
        description: "The friends feature is not available yet. Please set up the database table.",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch(`/api/friends/${friendshipId}`, {
        method: "DELETE",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to remove friend")
      }

      toast({
        title: "Friend Removed",
        description: "Friend has been removed from your list.",
      })

      // Update the UI
      await fetchFriends()
    } catch (error) {
      console.error("Error removing friend:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to remove friend. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Check if a user has a pending request
  const hasPendingRequest = (userId) => {
    return sentRequests.some((request) => request.friend.id === userId)
  }

  // Get badge for user based on plants identified
  const getUserBadge = (plantCount) => {
    if (plantCount >= 100) return "Plant Master"
    if (plantCount >= 50) return "Plant Expert"
    if (plantCount >= 25) return "Plant Enthusiast"
    if (plantCount >= 10) return "Plant Collector"
    return "Beginner"
  }

  // Render database setup message
  const renderDatabaseSetupMessage = () => {
    if (!tableExists) {
      return (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Database Setup Required</AlertTitle>
          <AlertDescription>
            The friends feature requires additional database setup. Please run the SQL script to create the necessary
            tables.
          </AlertDescription>
        </Alert>
      )
    }
    return null
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {renderDatabaseSetupMessage()}

      <TabsList className="grid grid-cols-3 mb-4">
        <TabsTrigger value="find">Find Friends</TabsTrigger>
        <TabsTrigger value="requests" className="relative">
          Requests
          {pendingRequests.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="friends">My Friends</TabsTrigger>
      </TabsList>

      <TabsContent value="find" className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for users..."
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch()
                }
              }}
            />
          </div>
          <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim()}>
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
          </Button>
        </div>

        {searchResults.length > 0 ? (
          <div className="space-y-3">
            {searchResults.map((user) => (
              <Card key={user.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={user.avatar_url || "/placeholder.svg?height=40&width=40"} />
                        <AvatarFallback>{user.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <p className="text-xs text-gray-500">{user.total_plants_identified || 0} plants identified</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-100 text-emerald-800">
                        {getUserBadge(user.total_plants_identified || 0)}
                      </Badge>
                      {hasPendingRequest(user.id) ? (
                        <Button variant="outline" size="sm" disabled>
                          <Check className="h-4 w-4 mr-1" /> Requested
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => sendFriendRequest(user.id)}
                          className="bg-emerald-500 hover:bg-emerald-600"
                          disabled={!tableExists}
                        >
                          <UserPlus className="h-4 w-4 mr-1" /> Add Friend
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : searchQuery && !isSearching ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No users found matching "{searchQuery}"</p>
          </div>
        ) : null}
      </TabsContent>

      <TabsContent value="requests" className="space-y-4">
        <h3 className="font-medium text-lg">Friend Requests</h3>
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
            <p>Loading friend requests...</p>
          </div>
        ) : errorMessage ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{errorMessage}</p>
          </div>
        ) : pendingRequests.length > 0 ? (
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={request.friend.avatar_url || "/placeholder.svg?height=40&width=40"} />
                        <AvatarFallback>{request.friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{request.friend.username}</p>
                        <p className="text-xs text-gray-500">Sent you a friend request</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleFriendRequest(request.id, "accept")}
                        className="bg-emerald-500 hover:bg-emerald-600"
                      >
                        <Check className="h-4 w-4 mr-1" /> Accept
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleFriendRequest(request.id, "reject")}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No pending friend requests</p>
          </div>
        )}

        {sentRequests.length > 0 && (
          <>
            <h3 className="font-medium text-lg mt-6">Sent Requests</h3>
            <div className="space-y-3">
              {sentRequests.map((request) => (
                <Card key={request.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={request.friend.avatar_url || "/placeholder.svg?height=40&width=40"} />
                          <AvatarFallback>{request.friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{request.friend.username}</p>
                          <p className="text-xs text-gray-500">
                            Request sent {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => removeFriend(request.id)}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </TabsContent>

      <TabsContent value="friends">
        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto mb-4" />
            <p>Loading your friends...</p>
          </div>
        ) : errorMessage ? (
          <div className="text-center py-8">
            <p className="text-gray-500">{errorMessage}</p>
          </div>
        ) : friends.length > 0 ? (
          <div className="space-y-3">
            {friends.map((friendship) => (
              <Card key={friendship.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={friendship.friend.avatar_url || "/placeholder.svg?height=40&width=40"} />
                        <AvatarFallback>{friendship.friend.username.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{friendship.friend.username}</p>
                        <p className="text-xs text-gray-500">
                          Friends since {new Date(friendship.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeFriend(friendship.id)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <UserMinus className="h-4 w-4 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">You don't have any friends yet</p>
            <Button
              className="mt-4 bg-emerald-500 hover:bg-emerald-600"
              onClick={() => setActiveTab("find")}
              disabled={!tableExists}
            >
              <Search className="h-4 w-4 mr-1" /> Find Friends
            </Button>
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}

