import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Uploads a file to Supabase Storage with proper error handling and fallbacks
 * @param supabase Supabase client
 * @param file File to upload
 * @param bucket Bucket name
 * @param path Path within the bucket
 * @returns Object with success status, URL, and fallback data if needed
 */
export async function uploadImageToStorage(
  supabase: SupabaseClient,
  file: File,
  bucket = "images",
  path: string,
): Promise<{
  success: boolean
  url?: string
  error?: string
  fallback?: "base64"
  base64Data?: string
}> {
  try {
    // Check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()

    if (bucketsError) {
      console.error("Error listing buckets:", bucketsError)
      return await createBase64Fallback(file, "Failed to access storage buckets")
    }

    // Check if bucket exists
    const bucketExists = buckets.some((b) => b.name === bucket)

    if (!bucketExists) {
      // Try to create the bucket
      try {
        const { error: createError } = await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
        })

        if (createError) {
          console.error("Error creating bucket:", createError)
          return await createBase64Fallback(file, "Failed to create storage bucket")
        }
      } catch (error) {
        console.error("Error creating bucket:", error)
        return await createBase64Fallback(file, "Failed to create storage bucket")
      }
    }

    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    })

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return await createBase64Fallback(file, "Failed to upload file to storage")
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage.from(bucket).getPublicUrl(path)

    if (!publicUrlData || !publicUrlData.publicUrl) {
      console.error("Failed to get public URL")
      return await createBase64Fallback(file, "Failed to get public URL")
    }

    return {
      success: true,
      url: publicUrlData.publicUrl,
    }
  } catch (error) {
    console.error("Error in uploadImageToStorage:", error)
    return await createBase64Fallback(file, "Unexpected error during file upload")
  }
}

/**
 * Creates a base64 fallback for when storage upload fails
 */
async function createBase64Fallback(
  file: File,
  errorMessage: string,
): Promise<{
  success: boolean
  error: string
  fallback: "base64"
  base64Data: string
}> {
  try {
    const buffer = await file.arrayBuffer()
    const base64Image = Buffer.from(buffer).toString("base64")
    const base64WithPrefix = `data:${file.type};base64,${base64Image}`

    return {
      success: false,
      error: errorMessage,
      fallback: "base64",
      base64Data: base64WithPrefix,
    }
  } catch (error) {
    console.error("Error creating base64 fallback:", error)
    return {
      success: false,
      error: errorMessage,
      fallback: "base64",
      base64Data: "",
    }
  }
}

/**
 * Generates a unique file path for storage
 */
export function generateStoragePath(userId: string, fileName: string, folder = "plants"): string {
  // Get file extension from the original filename
  const fileExt = fileName.split(".").pop() || "jpg"

  // Create a unique filename with the original extension
  return `${folder}/${userId}/${Date.now()}.${fileExt}`
}

