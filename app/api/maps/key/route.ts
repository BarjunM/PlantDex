import { NextResponse } from "next/server"

export async function GET() {
  // Only use the server-side environment variable, not the NEXT_PUBLIC one
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || ""

  // Return a limited, restricted API key for client-side use
  // This should be properly restricted in the Google Cloud Console
  return NextResponse.json({
    apiKey: apiKey,
  })
}

