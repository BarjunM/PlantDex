import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// GET: Fetch user's friends and friend requests
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const url = new URL(request.url)
    const type = url.searchParams.get("type") || "all" // all, pending, accepted

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Check if the friends table exists
    try {
      // Try a simple query to check if the table exists
      const { data: tableCheck, error: tableError } = await supabase.from("friends").select("id").limit(1)

      // If there's an error about the table not existing, return empty results
      if (tableError && tableError.message.includes("does not exist")) {
        console.log("Friends table does not exist yet. Returning empty results.")
        return NextResponse.json({
          success: true,
          friends: [],
          tableExists: false,
          message: "Friends table does not exist yet. Please set up the database table.",
        })
      }
    } catch (tableCheckError) {
      // If there's any error checking the table, assume it doesn't exist
      console.log("Error checking friends table:", tableCheckError)
      return NextResponse.json({
        success: true,
        friends: [],
        tableExists: false,
        message: "Error checking friends table. Please set up the database table.",
      })
    }

    // If we get here, the table exists, so proceed with the query
    const userId = session.user.id

    // Build query based on type
    let query = supabase.from("friends").select("*")

    if (type === "pending") {
      // Pending requests (received)
      query = query.eq("status", "pending").eq("user_id_receiver", userId)
    } else if (type === "sent") {
      // Sent requests
      query = query.eq("status", "pending").eq("user_id_sender", userId)
    } else if (type === "accepted") {
      // Accepted friends
      query = query.eq("status", "accepted").or(`user_id_sender.eq.${userId},user_id_receiver.eq.${userId}`)
    } else {
      // All friend relationships involving the user
      query = query.or(`user_id_sender.eq.${userId},user_id_receiver.eq.${userId}`)
    }

    const { data, error } = await query

    if (error) {
      throw error
    }

    // If no data, return empty array
    if (!data || data.length === 0) {
      return NextResponse.json({ success: true, friends: [] })
    }

    // Fetch user details for the friends
    const friendIds = data.flatMap((item) => {
      if (item.user_id_sender === userId) return [item.user_id_receiver]
      if (item.user_id_receiver === userId) return [item.user_id_sender]
      return []
    })

    let friendProfiles = []
    if (friendIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from("user_profiles")
        .select("id, username, avatar_url")
        .in("id", friendIds)

      if (profilesError) {
        console.error("Error fetching friend profiles:", profilesError)
      } else {
        friendProfiles = profiles || []
      }
    }

    // Format the response to make it easier to work with
    const formattedData = data.map((item) => {
      const isSender = item.user_id_sender === userId
      const friendId = isSender ? item.user_id_receiver : item.user_id_sender
      const friendProfile = friendProfiles.find((profile) => profile.id === friendId) || {
        id: friendId,
        username: "Unknown User",
        avatar_url: null,
      }

      return {
        id: item.id,
        status: item.status,
        created_at: item.created_at,
        updated_at: item.updated_at,
        friend: {
          id: friendProfile.id,
          username: friendProfile.username,
          avatar_url: friendProfile.avatar_url,
        },
        is_sender: isSender,
      }
    })

    return NextResponse.json({ success: true, friends: formattedData })
  } catch (error) {
    console.error("Error fetching friends:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to fetch friends" }, { status: 500 })
  }
}

// POST: Send a friend request
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { friendId } = await request.json()

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Check if the friends table exists
    try {
      const { data: tableCheck, error: tableError } = await supabase.from("friends").select("id").limit(1)

      if (tableError && tableError.message.includes("does not exist")) {
        return NextResponse.json(
          {
            success: false,
            error: "Friends table does not exist yet. Please set up the database table.",
          },
          { status: 400 },
        )
      }
    } catch (tableCheckError) {
      return NextResponse.json(
        {
          success: false,
          error: "Error checking friends table. Please set up the database table.",
        },
        { status: 400 },
      )
    }

    const userId = session.user.id

    if (userId === friendId) {
      return NextResponse.json({ success: false, error: "Cannot add yourself as a friend" }, { status: 400 })
    }

    // Check if the friend exists
    const { data: friendData, error: friendError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", friendId)
      .single()

    if (friendError || !friendData) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 })
    }

    // Check if a friend request already exists
    const { data: existingRequest, error: existingError } = await supabase
      .from("friends")
      .select("id, status")
      .or(
        `and(user_id_sender.eq.${userId},user_id_receiver.eq.${friendId}),and(user_id_sender.eq.${friendId},user_id_receiver.eq.${userId})`,
      )
      .maybeSingle()

    if (existingError && !existingError.message.includes("does not exist")) {
      throw existingError
    }

    if (existingRequest) {
      if (existingRequest.status === "accepted") {
        return NextResponse.json({ success: false, error: "Already friends" }, { status: 400 })
      } else if (existingRequest.status === "pending") {
        return NextResponse.json({ success: false, error: "Friend request already sent" }, { status: 400 })
      }
    }

    // Create friend request
    const { data, error } = await supabase
      .from("friends")
      .insert({
        user_id_sender: userId,
        user_id_receiver: friendId,
        status: "pending",
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Friend request sent",
      request: data,
    })
  } catch (error) {
    console.error("Error sending friend request:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to send friend request" },
      { status: 500 },
    )
  }
}

