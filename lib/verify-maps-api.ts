/**
 * Utility function to verify if the Google Maps API key is valid
 * This can be called from the browser console for debugging
 */
export async function verifyGoogleMapsApiKey() {
  try {
    const response = await fetch("/api/maps/key")
    if (!response.ok) {
      console.error("❌ Failed to fetch Google Maps API key")
      return false
    }

    const data = await response.json()
    const apiKey = data.apiKey

    if (!apiKey) {
      console.error("❌ Google Maps API key is missing")
      return false
    }

    // Make a simple request to the Maps API via our proxy
    const geoResponse = await fetch(`/api/maps/geocode?address=Mountain+View`)

    if (!geoResponse.ok) {
      const errorData = await geoResponse.json()
      console.error("❌ Google Maps API key error:", errorData.error || geoResponse.statusText)
      return false
    }

    const geoData = await geoResponse.json()

    if (geoData.status === "OK") {
      console.log("✅ Google Maps API key is valid")
      return true
    } else {
      console.error("❌ Google Maps API key returned status:", geoData.status)
      return false
    }
  } catch (error) {
    console.error("❌ Error verifying Google Maps API key:", error)
    return false
  }
}

// Only make the function available globally in the browser
if (typeof window !== "undefined") {
  // Using a safer approach to add to window
  try {
    ;(window as any).verifyGoogleMapsApiKey = verifyGoogleMapsApiKey
  } catch (e) {
    console.error("Could not attach verifyGoogleMapsApiKey to window", e)
  }
}

