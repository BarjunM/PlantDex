import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/lib/supabase/database.types"

export const createClient = () => {
  // Check if environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables. Authentication will not work properly.")
  }

  try {
    return createClientComponentClient<Database>({
      supabaseUrl: supabaseUrl || "",
      supabaseKey: supabaseAnonKey || "",
      options: {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        global: {
          fetch: (...args) => {
            // Use a custom fetch with retry logic for rate limiting
            return customFetchWithRetry(...args)
          },
        },
      },
    })
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    // Return a minimal client that won't crash the app
    return createClientComponentClient<Database>({
      supabaseUrl: supabaseUrl || "",
      supabaseKey: supabaseAnonKey || "",
    })
  }
}

// Custom fetch function with retry logic for rate limiting
const customFetchWithRetry = async (url: RequestInfo | URL, options?: RequestInit, retries = 3, backoff = 300) => {
  try {
    const response = await fetch(url, options)

    // If we get a 429 Too Many Requests, retry after a delay
    if (response.status === 429 && retries > 0) {
      // Get retry-after header or use backoff
      const retryAfter = response.headers.get("retry-after")
      const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1000 : backoff

      // Wait for the specified delay
      await new Promise((resolve) => setTimeout(resolve, delay))

      // Retry with exponential backoff
      return customFetchWithRetry(url, options, retries - 1, backoff * 2)
    }

    return response
  } catch (error) {
    if (retries > 0) {
      // Wait for the backoff period
      await new Promise((resolve) => setTimeout(resolve, backoff))

      // Retry with exponential backoff
      return customFetchWithRetry(url, options, retries - 1, backoff * 2)
    }

    throw error
  }
}

