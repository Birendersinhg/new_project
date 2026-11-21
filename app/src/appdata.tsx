import { createContext, useContext } from 'react';
import type { Me, PublicSettings } from './api';
import type { Market } from './data';

export interface AppData {
  me: Me;
  markets: Market[];
  settings: PublicSettings;
  /** Reloads balance and user flags (after a bid, for example). */
  refreshMe: () => Promise<void>;
}

export const AppDataContext = createContext<AppData | null>(null);

export function useAppData(): AppData {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error('useAppData must be used inside AppDataContext');
  return ctx;
}
