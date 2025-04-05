import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const lat = searchParams.get("lat")
    const lng = searchParams.get("lng")
    const radius = searchParams.get("radius") || "5000"
    const type = searchParams.get("type") || "park"
    const keyword = searchParams.get("keyword")

    if (!lat || !lng) {
      return NextResponse.json({ error: "Missing required parameters: lat, lng" }, { status: 400 })
    }

    // Use only the server-side API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Maps API is not configured" }, { status: 500 })
    }

    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${apiKey}`

    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`)
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in nearby places API:", error)
    return NextResponse.json({ error: "Failed to fetch nearby places" }, { status: 500 })
  }
}

