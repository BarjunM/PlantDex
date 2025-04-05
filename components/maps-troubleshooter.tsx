"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle, ExternalLink } from "lucide-react"

export default function MapsTroubleshooter() {
  const [apiKey, setApiKey] = useState<string | null>(null)
  const [keyStatus, setKeyStatus] = useState<"checking" | "valid" | "invalid" | "missing">("checking")
  const [errorDetails, setErrorDetails] = useState<string | null>(null)

  // Fetch the API key from our secure endpoint
  const fetchApiKey = async () => {
    try {
      const response = await fetch("/api/maps/key")
      if (!response.ok) {
        throw new Error("Failed to fetch Maps API key")
      }
      const data = await response.json()
      setApiKey(data.apiKey || null)
    } catch (error) {
      console.error("Error fetching Maps API key:", error)
      setApiKey(null)
    }
  }

  useEffect(() => {
    // Call this function in useEffect to fetch the key securely
    fetchApiKey()
  }, [])

  useEffect(() => {
    if (apiKey) {
      verifyApiKey(apiKey)
    } else {
      setKeyStatus("missing")
    }
  }, [apiKey])

  const verifyApiKey = async (key: string) => {
    try {
      // Use our secure proxy endpoint instead of calling Google directly
      const response = await fetch(`/api/maps/geocode?address=Mountain+View`)

      const data = await response.json()

      if (data.error_message) {
        setKeyStatus("invalid")
        setErrorDetails(data.error_message)
        return
      }

      if (data.status === "OK") {
        setKeyStatus("valid")
      } else {
        setKeyStatus("invalid")
        setErrorDetails(`API returned status: ${data.status}`)
      }
    } catch (error) {
      setKeyStatus("invalid")
      setErrorDetails(`Network error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">Google Maps API Key Troubleshooter</CardTitle>
        <CardDescription>Diagnose issues with your Google Maps API key</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5">
              {keyStatus === "checking" && (
                <div className="h-5 w-5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
              )}
              {keyStatus === "valid" && <CheckCircle className="h-5 w-5 text-green-500" />}
              {(keyStatus === "invalid" || keyStatus === "missing") && <AlertCircle className="h-5 w-5 text-red-500" />}
            </div>
            <div>
              <h3 className="font-medium">API Key Status</h3>
              {keyStatus === "checking" && <p className="text-sm text-gray-500">Checking API key...</p>}
              {keyStatus === "valid" && <p className="text-sm text-green-600">API key is valid and working</p>}
              {keyStatus === "missing" && <p className="text-sm text-red-600">API key is missing</p>}
              {keyStatus === "invalid" && <p className="text-sm text-red-600">API key is invalid or restricted</p>}

              {apiKey && (
                <div className="mt-1">
                  <p className="text-xs text-gray-500 font-mono break-all">
                    {apiKey.substring(0, 10)}...{apiKey.substring(apiKey.length - 4)}
                  </p>
                </div>
              )}

              {errorDetails && (
                <div className="mt-2 p-2 bg-red-50 border border-red-100 rounded text-xs text-red-800">
                  {errorDetails}
                </div>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2">Common Issues:</h3>
            <ul className="text-sm space-y-2">
              <li className="flex gap-2">
                <div className="min-w-[20px]">1.</div>
                <div>API key is incorrect or invalid</div>
              </li>
              <li className="flex gap-2">
                <div className="min-w-[20px]">2.</div>
                <div>Maps JavaScript API is not enabled for this key</div>
              </li>
              <li className="flex gap-2">
                <div className="min-w-[20px]">3.</div>
                <div>Domain restrictions don't include your current domain</div>
              </li>
              <li className="flex gap-2">
                <div className="min-w-[20px]">4.</div>
                <div>Billing issues with your Google Cloud account</div>
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => window.open("https://console.cloud.google.com/apis/credentials", "_blank")}
        >
          <span>Google Cloud Console</span>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

