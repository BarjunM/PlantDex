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
    const folder = (formData.get("folder") as string) || "plants"

    if (!imageFile) {
      return NextResponse.json({ success: false, error: "No image provided" }, { status: 400 })
    }

    // Get file extension from the original filename
    const fileExt = imageFile.name.split(".").pop() || "jpg"

    // Create a unique filename with the original extension
    const fileName = `${folder}/${session.user.id}/${Date.now()}.${fileExt}`

    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError)
      return NextResponse.json(
        {
          success: false,
          error: "Failed to access storage buckets",
          fallback: "base64",
        },
        { status: 500 },
      )
    }

    // Check if "images" bucket exists
    const bucketExists = buckets.some((bucket) => bucket.name === "images")

    if (!bucketExists) {
      // Try to create the bucket
      try {
        const { data: newBucket, error: createError } = await supabase.storage.createBucket("images", {
          public: true,
          fileSizeLimit: 5242880, // 5MB
        })

        if (createError) {
          console.error("Error creating bucket:", createError)
          // Return a fallback response indicating we should use base64 instead
          return NextResponse.json(
            {
              success: false,
              error: "Failed to create storage bucket",
              fallback: "base64",
            },
            { status: 500 },
          )
        }
      } catch (error) {
        console.error("Error creating bucket:", error)
        // Return a fallback response indicating we should use base64 instead
        return NextResponse.json(
          {
            success: false,
            error: "Failed to create storage bucket",
            fallback: "base64",
          },
          { status: 500 },
        )
      }
    }

    // Upload the file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage.from("images").upload(fileName, imageFile, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      console.error("Error uploading image:", uploadError)

      // Convert to base64 as fallback
      const buffer = await imageFile.arrayBuffer()
      const base64Image = Buffer.from(buffer).toString("base64")
      const base64WithPrefix = `data:${imageFile.type};base64,${base64Image}`

      return NextResponse.json(
        {
          success: false,
          error: "Failed to upload image to storage",
          fallback: "base64",
          base64Data: base64WithPrefix,
        },
        { status: 500 },
      )
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage.from("images").getPublicUrl(fileName)

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error("Failed to get public URL")

      // Convert to base64 as fallback
      const buffer = await imageFile.arrayBuffer()
      const base64Image = Buffer.from(buffer).toString("base64")
      const base64WithPrefix = `data:${imageFile.type};base64,${base64Image}`

      return NextResponse.json(
        {
          success: false,
          error: "Failed to get public URL",
          fallback: "base64",
          base64Data: base64WithPrefix,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      url: publicUrlData.publicUrl,
      path: fileName,
    })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process image upload",
        fallback: "base64",
      },
      { status: 500 },
    )
  }
}

