import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '../types'

interface AuthState {
    token: string | null
    tokenExpiresAt: number | null
    currentUser: UserProfile | null
    setSession: (token: string, user: UserProfile, ttlMs?: number) => void
    updateCurrentUser: (patch: Partial<UserProfile>) => void
    isSessionExpired: () => boolean
    logout: () => void
}

export const SESSION_TTL_MS = 30 * 60 * 1000

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            tokenExpiresAt: null,
            currentUser: null,
            setSession: (token, currentUser, ttlMs = SESSION_TTL_MS) =>
                set({
                    token,
                    currentUser,
                    tokenExpiresAt: Date.now() + ttlMs,
                }),
            updateCurrentUser: (patch) =>
                set((state) => ({
                    currentUser: state.currentUser ? { ...state.currentUser, ...patch } : null,
                })),
            isSessionExpired: () => {
                const expiresAt = get().tokenExpiresAt
                if (!expiresAt) {
                    return true
                }
                return Date.now() >= expiresAt
            },
            logout: () => set({ token: null, tokenExpiresAt: null, currentUser: null }),
        }),
        {
            name: 'ces-auth-store',
        },
    ),
)
