import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    // Get user's plants
    const { data: plants, error } = await supabase.from("plants").select("*").order("date_found", { ascending: false })

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, plants })
  } catch (error) {
    console.error("Error fetching user plants:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch user plants" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.plant || !data.plant.common_name || !data.plant.scientific_name) {
      return NextResponse.json({ success: false, error: "Missing required plant information" }, { status: 400 })
    }

    // Check for duplicates - more robust check with better error handling
    try {
      const { data: existingPlants, error: checkError } = await supabase
        .from("plants")
        .select("id, common_name, scientific_name")
        .eq("user_id", session.user.id)
        .or(`common_name.ilike.${data.plant.common_name},scientific_name.ilike.${data.plant.scientific_name}`)
        .limit(1)

      if (checkError) {
        console.error("Error checking for duplicates:", checkError)
        // Continue with the process even if the duplicate check fails
      } else if (existingPlants && existingPlants.length > 0) {
        // If client-side duplicate check was bypassed, we'll still prevent duplicates
        return NextResponse.json(
          {
            success: false,
            error: "This plant is already in your collection",
            duplicate: true,
            existingPlant: existingPlants[0],
          },
          { status: 409 },
        )
      }
    } catch (error) {
      console.error("Error in duplicate check:", error)
      // Continue with the process even if the duplicate check fails completely
    }

    // Parse location coordinates if available
    let locationLat = null
    let locationLng = null

    if (data.location && typeof data.location === "string") {
      const coords = data.location.split(",").map((coord) => Number.parseFloat(coord.trim()))
      if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
        locationLat = coords[0]
        locationLng = coords[1]
      }
    }

    // Handle image data - use base64 directly if provided
    let imageUrl = null

    if (data.image_data) {
      // Use the base64 data directly
      imageUrl = data.image_data
      console.log("Using base64 image data")
    } else if (data.image_url) {
      // Use the provided URL
      imageUrl = data.image_url
    } else {
      // Fall back to placeholder
      imageUrl = `/placeholder.svg?height=400&width=400&text=${encodeURIComponent(data.plant.common_name)}`
    }

    // Insert plant into database
    const { data: plant, error } = await supabase
      .from("plants")
      .insert({
        user_id: session.user.id,
        common_name: data.plant.common_name,
        scientific_name: data.plant.scientific_name,
        location: data.location || "Unknown location",
        location_lat: locationLat,
        location_lng: locationLng,
        image_url: imageUrl,
        edible: data.properties?.edible || false,
        poisonous: data.properties?.poisonous || false,
        medicinal: data.properties?.medicinal || false,
        description: data.description || null,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update user stats - first get current profile
    const { data: userProfile, error: profileError } = await supabase
      .from("user_profiles")
      .select("total_plants_identified")
      .eq("id", session.user.id)
      .single()

    if (profileError) {
      console.error("Error fetching user profile:", profileError)
    } else {
      // Increment the counter directly
      const newCount = (userProfile.total_plants_identified || 0) + 1

      const { error: statsError } = await supabase
        .from("user_profiles")
        .update({
          total_plants_identified: newCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", session.user.id)

      if (statsError) {
        console.error("Error updating user stats:", statsError)
      }
    }

    // Update plant identification record if it exists
    if (data.identification_id) {
      const { error: idError } = await supabase
        .from("plant_identifications")
        .update({ saved_to_collection: true })
        .eq("id", data.identification_id)

      if (idError) {
        console.error("Error updating identification record:", idError)
      }
    }

    // Check and update achievements
    await updateAchievements(supabase, session.user.id)

    return NextResponse.json({
      success: true,
      message: "Plant added to collection",
      plant_id: plant.id,
    })
  } catch (error) {
    console.error("Error adding plant to collection:", error)
    return NextResponse.json({ success: false, error: "Failed to add plant to collection" }, { status: 500 })
  }
}

async function updateAchievements(supabase, userId) {
  try {
    // Get user's plant count
    const { data: plantCount, error: countError } = await supabase
      .from("plants")
      .select("id", { count: "exact" })
      .eq("user_id", userId)

    if (countError) {
      throw countError
    }

    // Get all plant-related achievements
    const { data: achievements, error: achievementsError } = await supabase
      .from("achievements")
      .select("*")
      .eq("category", "plants")

    if (achievementsError) {
      throw achievementsError
    }

    // For each achievement, update user progress
    for (const achievement of achievements) {
      // Check if user already has this achievement
      const { data: userAchievement, error: userAchievementError } = await supabase
        .from("user_achievements")
        .select("*")
        .eq("user_id", userId)
        .eq("achievement_id", achievement.id)
        .single()

      if (userAchievementError && userAchievementError.code !== "PGRST116") {
        // PGRST116 is "no rows returned" error, which is expected if user doesn't have the achievement yet
        console.error("Error checking user achievement:", userAchievementError)
        continue
      }

      const count = plantCount.count || 0
      const completed = count >= achievement.requirement_count

      if (!userAchievement) {
        // Create new user achievement
        await supabase.from("user_achievements").insert({
          user_id: userId,
          achievement_id: achievement.id,
          progress: count,
          completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
      } else if (userAchievement.progress !== count || userAchievement.completed !== completed) {
        // Update existing user achievement
        await supabase
          .from("user_achievements")
          .update({
            progress: count,
            completed,
            completed_at:
              completed && !userAchievement.completed ? new Date().toISOString() : userAchievement.completed_at,
          })
          .eq("id", userAchievement.id)
      }
    }
  } catch (error) {
    console.error("Error updating achievements:", error)
  }
}

