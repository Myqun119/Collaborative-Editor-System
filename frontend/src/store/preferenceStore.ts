import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserPreference } from '../types'

interface PreferenceState {
    preference: UserPreference
    setPreference: (patch: Partial<UserPreference>) => void
}

const defaults: UserPreference = {
    theme: 'dawn',
    editorFontSize: 16,
    autoSaveIntervalSec: 30,
    showLineNumbers: true,
}

export const usePreferenceStore = create<PreferenceState>()(
    persist(
        (set) => ({
            preference: defaults,
            setPreference: (patch) =>
                set((state) => ({
                    preference: {
                        ...state.preference,
                        ...patch,
                    },
                })),
        }),
        {
            name: 'ces-preference-store',
        },
    ),
)
