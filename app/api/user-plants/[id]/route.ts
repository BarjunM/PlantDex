import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const plantId = params.id

    if (!plantId) {
      return NextResponse.json({ success: false, error: "Plant ID is required" }, { status: 400 })
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Verify the plant belongs to the user
    const { data: plant, error: fetchError } = await supabase
      .from("plants")
      .select("user_id")
      .eq("id", plantId)
      .single()

    if (fetchError) {
      return NextResponse.json({ success: false, error: "Plant not found" }, { status: 404 })
    }

    if (plant.user_id !== session.user.id) {
      return NextResponse.json({ success: false, error: "Unauthorized to delete this plant" }, { status: 403 })
    }

    // Delete the plant
    const { error: deleteError } = await supabase.from("plants").delete().eq("id", plantId)

    if (deleteError) {
      throw deleteError
    }

    // Update user stats - decrement the counter
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("total_plants_identified")
      .eq("id", session.user.id)
      .single()

    if (!profileError && userProfile) {
      // Ensure we don't go below zero
      const newCount = Math.max(0, (userProfile.total_plants_identified || 1) - 1)

      await supabase
        .from("user_profiles")
        .update({
          total_plants_identified: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id)
    }

    // Update achievements
    await updateAchievements(supabase, session.user.id)

    return NextResponse.json({
      success: true,
      message: "Plant removed from collection",
    })
  } catch (error) {
    console.error("Error deleting plant:", error)
    return NextResponse.json({ success: false, error: "Failed to delete plant" }, { status: 500 })
  }
}

async function updateAchievements(supabase, userId) {
  try {
    // Get user's plant count
    const { data: plantCountResult, error: countError } = await supabase
      .from("plants")
      .select("id", { count: "exact" })
      .eq("user_id", userId)

    if (countError) {
      console.error("Error getting plant count:", countError)
      return // Exit early if we can't get the count
    }

    const count = plantCountResult?.count || 0

    // Get all plant-related achievements
    const { data: achievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("*")
      .eq("category", "plants")

    if (achievementsError) {
      console.error("Error getting achievements:", achievementsError)
      return // Exit early if we can't get achievements
    }

    if (!achievements || achievements.length === 0) {
      return // No achievements to update
    }

    // For each achievement, update user progress
    for (const achievement of achievements) {
      try {
        // Check if user already has this achievement
        const { data: userAchievement, error: userAchievementError } = await supabase
          .from("user_achievements")
          .select("*")
          .eq("user_id", userId)
          .eq("achievement_id", achievement.id)
          .single()

        if (userAchievementError) {
          // Only log and continue if it's not a "no rows returned" error
          if (userAchievementError.code !== "PGRST116") {
            console.error("Error checking user achievement:", userAchievementError)
          }
          continue
        }

        if (!userAchievement) {
          // Skip if user doesn't have this achievement
          continue
        }

        const completed = count >= achievement.requirement_count

        // Update existing user achievement
        const { error: updateError } = await supabase
          .from("user_achievements")
          .update({
            progress: count,
            completed,
            completed_at: completed ? userAchievement.completed_at || new Date().toISOString() : null,
          })
          .eq("id", userAchievement.id)

        if (updateError) {
          console.error("Error updating achievement:", updateError)
        }

        // Add a small delay between requests to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100))
      } catch (achievementError) {
        console.error("Error processing achievement:", achievementError)
        // Continue with the next achievement
      }
    }
  } catch (error) {
    console.error("Error updating achievements:", error)
  }
}

