"use client"

import type React from "react"

import { createContext, useContext, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Session, User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, username: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getSession = async () => {
      setIsLoading(true)
      try {
        // Check if Supabase is properly initialized
        if (!supabase.auth) {
          console.error("Supabase auth is not available. Check your environment variables.")
          setIsLoading(false)
          return
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Error getting session:", error.message)
          throw error
        }

        if (session) {
          setSession(session)
          setUser(session.user)
        }
      } catch (error) {
        console.error("Error getting session:", error)
      } finally {
        setIsLoading(false)
      }
    }

    getSession()

    try {
      // Check if Supabase is properly initialized
      if (!supabase.auth) {
        console.error("Supabase auth is not available for subscription. Check your environment variables.")
        return () => {}
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setIsLoading(false)
      })

      return () => {
        subscription.unsubscribe()
      }
    } catch (error) {
      console.error("Error setting up auth subscription:", error)
      return () => {}
    }
  }, [supabase.auth])

  const signIn = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      // Check if Supabase is properly initialized
      if (!supabase.auth) {
        throw new Error("Authentication service is not available. Please try again later.")
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        console.error("Supabase auth error:", error.message)
        throw error
      }

      if (data.session) {
        setSession(data.session)
        setUser(data.user)
        router.push("/dashboard")
        router.refresh()
      }
    } catch (error: any) {
      console.error("Error signing in:", error.message || "Unknown error")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string, username: string) => {
    setIsLoading(true)
    try {
      // Check if Supabase is properly initialized
      if (!supabase.auth) {
        throw new Error("Authentication service is not available. Please try again later.")
      }

      // First, sign up the user
      const {
        data: { user, session },
        error,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
          },
        },
      })

      if (error) {
        console.error("Supabase signup error:", error.message)
        throw error
      }

      if (!user) {
        throw new Error("User creation failed")
      }

      // Set session if available (auto-confirmation case)
      if (session) {
        setSession(session)
        setUser(user)
      }

      // Wait a moment to ensure the user is fully registered in the auth system
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Create user profile using a server action to bypass RLS
      try {
        const response = await fetch("/api/create-profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            username,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.warn("Profile creation warning:", errorData.error || "Failed to create user profile")
          // Don't throw here, we'll continue with the flow
        }
      } catch (profileError) {
        console.error("Profile creation error:", profileError)
        // Continue with signup flow even if profile creation fails
        // The profile can be created later
      }

      // If we don't have a session yet, sign in the user
      if (!session) {
        try {
          const { data, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          })

          if (signInError) {
            throw signInError
          }

          if (data.session) {
            setSession(data.session)
            setUser(data.user)
          }
        } catch (signInError) {
          console.error("Error signing in after signup:", signInError)
          // Still redirect to dashboard even if auto-signin fails
        }
      }

      // Redirect to dashboard
      router.push("/dashboard")
      router.refresh()
    } catch (error: any) {
      console.error("Error signing up:", error.message || "Unknown error")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    setIsLoading(true)
    try {
      // Check if Supabase is properly initialized
      if (!supabase.auth) {
        throw new Error("Authentication service is not available. Please try again later.")
      }

      const { error } = await supabase.auth.signOut()

      if (error) {
        console.error("Supabase signout error:", error.message)
        throw error
      }

      setUser(null)
      setSession(null)
      router.push("/")
      router.refresh()
    } catch (error: any) {
      console.error("Error signing out:", error.message || "Unknown error")
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}

