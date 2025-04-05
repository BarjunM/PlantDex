import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { userId, username } = await request.json()

    if (!userId || !username) {
      return NextResponse.json({ success: false, error: "Missing required fields" }, { status: 400 })
    }

    // Create a Supabase client with admin privileges
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co"
    const supabaseAdmin = createRouteHandlerClient(
      { cookies },
      {
        supabaseUrl,
        supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key",
      },
    )

    // Check if the user exists in auth.users
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (authError || !authUser?.user) {
      console.error("Error verifying user:", authError || "User not found")
      return NextResponse.json({ success: false, error: "User not found in auth system" }, { status: 404 })
    }

    // Check if profile already exists
    const { data: existingProfile, error: checkError } = await supabaseAdmin
      .from("user_profiles")
      .select("id")
      .eq("id", userId)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      console.error("Error checking profile:", checkError)
      return NextResponse.json({ success: false, error: "Failed to check user profile" }, { status: 500 })
    }

    // If profile already exists, return success
    if (existingProfile) {
      return NextResponse.json({ success: true, exists: true })
    }

    // Implement retry logic for profile creation
    let retries = 3
    let profileCreated = false
    let lastError = null

    while (retries > 0 && !profileCreated) {
      try {
        // Create user profile
        const { error } = await supabaseAdmin.from("user_profiles").insert({
          id: userId,
          username,
          streak_count: 0,
          total_distance: 0,
          total_plants_identified: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

        if (error) {
          // If it's a duplicate key error, it means the profile was created in another request
          if (error.code === "23505") {
            // PostgreSQL unique violation code
            return NextResponse.json({
              success: true,
              exists: true,
              message: "Profile already exists",
            })
          }

          lastError = error
          retries--

          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          profileCreated = true
        }
      } catch (error) {
        lastError = error
        retries--
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    if (!profileCreated) {
      console.error("Failed to create profile after retries:", lastError)
      return NextResponse.json(
        { success: false, error: lastError?.message || "Failed to create user profile after multiple attempts" },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in create-profile API:", error)
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 })
  }
}

