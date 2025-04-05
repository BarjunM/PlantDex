import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const url = new URL(request.url)
    const query = url.searchParams.get("q") || ""
    const limit = Number.parseInt(url.searchParams.get("limit") || "10")

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!query) {
      return NextResponse.json({ success: true, users: [] })
    }

    // Search for users by username
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, username, avatar_url, total_plants_identified")
      .neq("id", session.user.id) // Exclude current user
      .ilike("username", `%${query}%`)
      .order("username")
      .limit(limit)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, users: data || [] })
  } catch (error) {
    console.error("Error searching users:", error)
    return NextResponse.json({ success: false, error: "Failed to search users" }, { status: 500 })
  }
}

