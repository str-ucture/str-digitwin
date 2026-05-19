import { Navigate } from 'react-router-dom'
import { useSession } from '../../lib/authContext'
import LoadingSpinner from './LoadingSpinner'
import type { ReactNode } from 'react'

export default function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()

  // Still resolving auth state — avoid flashing the login redirect
  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (session === null) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
