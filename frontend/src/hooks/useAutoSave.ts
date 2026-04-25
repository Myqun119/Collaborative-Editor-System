import { useEffect, useRef } from 'react'

export const useAutoSave = (enabled: boolean, intervalSec: number, onSave: () => Promise<void>) => {
    const latestSave = useRef(onSave)

    useEffect(() => {
        latestSave.current = onSave
    }, [onSave])

    useEffect(() => {
        if (!enabled || intervalSec <= 0) {
            return
        }
        const timer = window.setInterval(() => {
            void latestSave.current()
        }, intervalSec * 1000)

        return () => {
            window.clearInterval(timer)
        }
    }, [enabled, intervalSec])
}
