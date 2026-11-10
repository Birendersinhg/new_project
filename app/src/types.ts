import type { LucideIcon } from 'lucide-react';

/** Screens reachable via `go()`. Anything not listed renders the "Coming soon" placeholder with that title. */
export type View =
  | 'home' | 'bids' | 'passbook' | 'funds' | 'notifications' | 'addmoney' | 'withdraw'
  | (string & {});

export type Go = (view: View) => void;

export type { LucideIcon };
