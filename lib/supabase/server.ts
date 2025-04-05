import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { cookies } from "next/headers"
import type { Database } from "@/lib/supabase/database.types"

export const createClient = () => {
  const cookieStore = cookies()

  // Check if environment variables are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase environment variables. Server-side authentication will not work properly.")
  }

  return createServerComponentClient<Database>({
    cookies: () => cookieStore,
    supabaseUrl: supabaseUrl || "",
    supabaseKey: supabaseAnonKey || "",
  })
}

