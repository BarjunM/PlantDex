import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Leaf } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="bg-gray-100 rounded-full p-6 inline-block mb-6">
          <Leaf className="h-12 w-12 text-gray-400" />
        </div>
        <h1 className="text-4xl font-bold mb-2">Page Not Found</h1>
        <p className="text-gray-500 mb-6">
          We couldn't find the page you're looking for. It might have been removed or the URL is incorrect.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/">
            <Button>Back to Home</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}

