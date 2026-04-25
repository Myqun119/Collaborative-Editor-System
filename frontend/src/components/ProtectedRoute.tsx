import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import type { PropsWithChildren } from 'react'
import { useAuthStore } from '../store/authStore'

export const ProtectedRoute = ({ children }: PropsWithChildren) => {
    const token = useAuthStore((state) => state.token)
    const tokenExpiresAt = useAuthStore((state) => state.tokenExpiresAt)
    const isSessionExpired = useAuthStore((state) => state.isSessionExpired)
    const logout = useAuthStore((state) => state.logout)
    const location = useLocation()
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    const expired = Boolean(token) && isSessionExpired()

    useEffect(() => {
        if (!token || !tokenExpiresAt) {
            return
        }
        const remaining = tokenExpiresAt - Date.now()
        if (remaining <= 0) {
            logout()
            return
        }
        const timer = window.setTimeout(() => {
            logout()
        }, remaining)
        return () => window.clearTimeout(timer)
    }, [token, tokenExpiresAt, logout])

    if (!token || expired) {
        return (
            <Navigate
                to="/auth"
                replace
                state={{
                    from: returnTo,
                    reason: expired ? 'expired' : 'unauthorized',
                }}
            />
        )
    }

    return <>{children}</>
}
