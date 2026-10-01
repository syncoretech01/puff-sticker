'use client'

import { createContext, useContext, type ReactNode } from 'react'

import type { CurrentProductionContentPayload } from '../content/currentProductionContent'

const Context = createContext<CurrentProductionContentPayload | null>(null)

export function CurrentProductionContentProvider({ content, children }: { content: CurrentProductionContentPayload | null; children: ReactNode }) {
  return <Context.Provider value={content}>{children}</Context.Provider>
}

export function useCurrentProductionContent() {
  return useContext(Context)
}
