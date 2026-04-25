import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const AUTH_FAILURE_EVENT = 'ces:auth-failure'
const NOTIFY_EVENT = 'ces:notify'

type GlobalNotifyPayload = {
    message: string
    durationMs?: number
}

export const AppProviders = ({ children }: PropsWithChildren) => {
    const queryClient = useMemo(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 10_000,
                        refetchOnWindowFocus: false,
                    },
                },
            }),
        [],
    )

    const [toastMessage, setToastMessage] = useState('')
    const clearToastTimerRef = useRef<number | null>(null)

    const showToast = useCallback((message: string, durationMs = 3200) => {
        setToastMessage(message)
        if (clearToastTimerRef.current) {
            window.clearTimeout(clearToastTimerRef.current)
        }
        clearToastTimerRef.current = window.setTimeout(() => {
            setToastMessage((current) => (current === message ? '' : current))
            clearToastTimerRef.current = null
        }, durationMs)
    }, [])

    useEffect(() => {
        const handleAuthFailure = () => {
            showToast('登录状态失效，请重新登录')
        }

        const handleGlobalNotify = (event: Event) => {
            const payload = (event as CustomEvent<GlobalNotifyPayload>).detail
            if (!payload?.message) {
                return
            }
            showToast(payload.message, payload.durationMs)
        }

        window.addEventListener(AUTH_FAILURE_EVENT, handleAuthFailure as EventListener)
        window.addEventListener(NOTIFY_EVENT, handleGlobalNotify as EventListener)
        return () => {
            if (clearToastTimerRef.current) {
                window.clearTimeout(clearToastTimerRef.current)
                clearToastTimerRef.current = null
            }
            window.removeEventListener(AUTH_FAILURE_EVENT, handleAuthFailure as EventListener)
            window.removeEventListener(NOTIFY_EVENT, handleGlobalNotify as EventListener)
        }
    }, [showToast])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {toastMessage ? (
                <div
                    role="status"
                    aria-live="polite"
                    style={{
                        position: 'fixed',
                        top: '20px',
                        right: '20px',
                        zIndex: 9999,
                        padding: '12px 16px',
                        borderRadius: '14px',
                        background: 'rgba(17, 24, 39, 0.96)',
                        color: '#ffffff',
                        boxShadow: '0 16px 32px rgba(15, 23, 42, 0.22)',
                        border: '1px solid rgba(79, 209, 197, 0.28)',
                        fontSize: '0.92rem',
                        backdropFilter: 'blur(14px)',
                    }}
                >
                    {toastMessage}
                </div>
            ) : null}
        </QueryClientProvider>
    )
}
