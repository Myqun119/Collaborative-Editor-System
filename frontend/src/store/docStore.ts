import { create } from 'zustand'
import type { DocumentItem } from '../types'

interface DocState {
    currentDoc: DocumentItem | null
    setCurrentDoc: (doc: DocumentItem | null) => void
}

export const useDocStore = create<DocState>((set) => ({
    currentDoc: null,
    setCurrentDoc: (currentDoc) => set({ currentDoc }),
}))
