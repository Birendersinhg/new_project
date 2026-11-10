export interface PageParams {
  id?: number;
}

/** Navigate to a tab (the `?tab=` value), optionally passing params to the page. */
export type Go = (tab: string, params?: PageParams) => void;

export interface PageProps {
  go: Go;
  params: PageParams;
}
