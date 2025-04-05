import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import { NextResponse } from "next/server"

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

    // Get the image from the request
    const formData = await request.formData()
    const imageFile = formData.get("image") as File

    if (!imageFile) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 })
    }

    // Convert the file to base64 for the Plant.id API
    const buffer = await imageFile.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString("base64")

    // Verify that we have the Plant.id API key
    const plantIdApiKey = process.env.PLANT_ID_API_KEY
    if (!plantIdApiKey) {
      console.error("Missing Plant ID API key")
      return NextResponse.json(
        { success: false, error: "Plant identification service is not configured" },
        { status: 500 },
      )
    }

    // Prepare the request to Plant.id API
    const plantIdApiUrl = "https://api.plant.id/v2/identify"
    const requestData = {
      images: [base64Image],
      modifiers: ["crops_fast", "similar_images"],
      plant_language: "en",
      plant_details: [
        "common_names",
        "url",
        "name_authority",
        "wiki_description",
        "taxonomy",
        "synonyms",
        "edible_parts",
        "watering",
        "propagation_methods",
      ],
    }

    console.log("Sending request to Plant.id API...")

    // Send the request to Plant.id API
    const response = await fetch(plantIdApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": plantIdApiKey,
      },
      body: JSON.stringify(requestData),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("Plant.id API error:", errorData)
      return NextResponse.json(
        {
          success: false,
          error: `Failed to identify plant: ${response.status} ${response.statusText}`,
        },
        { status: response.status },
      )
    }

    // Process the Plant.id API response
    const plantData = await response.json()
    console.log("Received response from Plant.id API")

    // Extract and format the relevant information
    const suggestion = plantData.suggestions[0]

    // Try to upload the image to Supabase Storage
    let imageUrl = null
    let base64WithPrefix = null

    try {
      // Create a new FormData to upload the image
      const uploadFormData = new FormData()
      uploadFormData.append("image", imageFile)
      uploadFormData.append("folder", "plants")

      // Upload the image
      const uploadResponse = await fetch("/api/upload-image", {
        method: "POST",
        body: uploadFormData,
      })

      const uploadData = await uploadResponse.json()

      if (uploadData.success) {
        // Use the URL from the upload
        imageUrl = uploadData.url
      } else if (uploadData.fallback === "base64" && uploadData.base64Data) {
        // Use the base64 data as fallback
        base64WithPrefix = uploadData.base64Data
        imageUrl = base64WithPrefix
      } else {
        // Create base64 data as fallback
        base64WithPrefix = `data:${imageFile.type};base64,${base64Image}`
        imageUrl = base64WithPrefix
      }
    } catch (uploadError) {
      console.error("Error uploading image:", uploadError)
      // Create base64 data as fallback
      base64WithPrefix = `data:${imageFile.type};base64,${base64Image}`
      imageUrl = base64WithPrefix
    }

    const formattedResponse = {
      success: true,
      result: {
        plant: {
          common_name: suggestion.plant_name,
          scientific_name: suggestion.plant_details.scientific_name,
          family: suggestion.plant_details.taxonomy.family,
          confidence: suggestion.probability,
        },
        properties: {
          edible: isEdible(suggestion),
          poisonous: isPoisonous(suggestion),
          medicinal: hasMedicinalUses(suggestion),
          endangered: false, // This would need additional data sources
        },
        description: suggestion.plant_details.wiki_description?.value || "No description available.",
        uses: getPlantUses(suggestion),
        similar_plants: plantData.suggestions.slice(1, 4).map((s) => s.plant_name),
        image_url: imageUrl || null,
      },
    }

    // Save identification to database
    try {
      const { data: identificationData, error: identificationError } = await supabase
        .from("plant_identifications")
        .insert({
          user_id: session.user.id,
          image_url: imageUrl,
          plant_data: formattedResponse.result,
          saved_to_collection: false,
        })
        .select()
        .single()

      if (identificationError) {
        console.error("Error saving identification:", identificationError)
      } else {
        formattedResponse.identification_id = identificationData.id
      }
    } catch (dbError) {
      console.error("Error saving to database:", dbError)
    }

    return NextResponse.json(formattedResponse)
  } catch (error) {
    console.error("Error identifying plant:", error)
    return NextResponse.json({ success: false, error: "Failed to identify plant" }, { status: 500 })
  }
}

// Helper functions to process plant data
function isEdible(suggestion) {
  // Check if the plant has edible parts mentioned
  return suggestion.plant_details.edible_parts && suggestion.plant_details.edible_parts.length > 0
}

function isPoisonous(suggestion) {
  // This is a simplified check - in a real app, you'd want a more comprehensive database
  // of poisonous plants or additional API data
  const toxicKeywords = ["toxic", "poison", "poisonous"]
  const description = suggestion.plant_details.wiki_description?.value || ""

  return toxicKeywords.some((keyword) => description.toLowerCase().includes(keyword))
}

function hasMedicinalUses(suggestion) {
  // This is a simplified check - in a real app, you'd want a more comprehensive database
  // of medicinal plants or additional API data
  const medicinalKeywords = ["medicinal", "medicine", "remedy", "treatment", "healing"]
  const description = suggestion.plant_details.wiki_description?.value || ""

  return medicinalKeywords.some((keyword) => description.toLowerCase().includes(keyword))
}

function getPlantUses(suggestion) {
  const uses = []

  // Add edible uses if applicable
  if (suggestion.plant_details.edible_parts && suggestion.plant_details.edible_parts.length > 0) {
    suggestion.plant_details.edible_parts.forEach((part) => {
      uses.push(`${part} can be eaten`)
    })
  }

  // Extract potential uses from wiki description
  const description = suggestion.plant_details.wiki_description?.value || ""
  if (description.includes("used for") || description.includes("used as")) {
    const usesRegex = /used (for|as) ([^.]+)/g
    let match
    while ((match = usesRegex.exec(description)) !== null) {
      uses.push(match[0])
    }
  }

  return uses.length > 0 ? uses : ["No known uses available"]
}

