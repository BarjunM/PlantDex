import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const origin = searchParams.get("origin")
    const destination = searchParams.get("destination")
    const waypoints = searchParams.get("waypoints")
    const mode = searchParams.get("mode") || "walking"

    if (!origin || !destination) {
      return NextResponse.json({ error: "Missing required parameters: origin, destination" }, { status: 400 })
    }

    // Use only the server-side API key
    const apiKey = process.env.GOOGLE_MAPS_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: "Maps API is not configured" }, { status: 500 })
    }

    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&mode=${mode}&key=${apiKey}`

    if (waypoints) {
      url += `&waypoints=optimize:true|${waypoints}`
    }

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Google API error: ${response.statusText}`)
    }

    const data = await response.json()

    return NextResponse.json(data)
  } catch (error) {
    console.error("Error in directions API:", error)
    return NextResponse.json({ error: "Failed to fetch directions" }, { status: 500 })
  }
}

