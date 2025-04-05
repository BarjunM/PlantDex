import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

// PATCH: Accept or reject a friend request
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { action } = await request.json()
    const requestId = params.id

    if (!requestId) {
      return NextResponse.json({ success: false, error: "Request ID is required" }, { status: 400 })
    }

    if (!action || !["accept", "reject"].includes(action)) {
      return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 })
    }

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

    // Check if the friend request exists and is addressed to the current user
    const { data: friendRequest, error: requestError } = await supabase
      .from("friends")
      .select("*")
      .eq("id", requestId)
      .eq("user_id_receiver", userId)
      .eq("status", "pending")
      .single()

    if (requestError || !friendRequest) {
      return NextResponse.json({ success: false, error: "Friend request not found" }, { status: 404 })
    }

    if (action === "accept") {
      // Accept the friend request
      const { error } = await supabase
        .from("friends")
        .update({
          status: "accepted",
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        message: "Friend request accepted",
      })
    } else {
      // Reject the friend request (delete it)
      const { error } = await supabase.from("friends").delete().eq("id", requestId)

      if (error) {
        throw error
      }

      return NextResponse.json({
        success: true,
        message: "Friend request rejected",
      })
    }
  } catch (error) {
    console.error("Error handling friend request:", error)
    return NextResponse.json(
      { success: false, error: error.message || "Failed to process friend request" },
      { status: 500 },
    )
  }
}

// DELETE: Remove a friend
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const requestId = params.id

    if (!requestId) {
      return NextResponse.json({ success: false, error: "Friend ID is required" }, { status: 400 })
    }

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

    // Check if the friendship exists and involves the current user
    const { data: friendship, error: friendshipError } = await supabase
      .from("friends")
      .select("*")
      .eq("id", requestId)
      .or(`user_id_sender.eq.${userId},user_id_receiver.eq.${userId}`)
      .single()

    if (friendshipError || !friendship) {
      return NextResponse.json({ success: false, error: "Friendship not found" }, { status: 404 })
    }

    // Delete the friendship
    const { error } = await supabase.from("friends").delete().eq("id", requestId)

    if (error) {
      throw error
    }

    return NextResponse.json({
      success: true,
      message: "Friend removed",
    })
  } catch (error) {
    console.error("Error removing friend:", error)
    return NextResponse.json({ success: false, error: error.message || "Failed to remove friend" }, { status: 500 })
  }
}

