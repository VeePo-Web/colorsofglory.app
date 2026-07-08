import { QueryClient } from "@tanstack/react-query";

/**
 * The single app-wide React Query client. One instance so every surface shares
 * the same cache, staleness cadence, and invalidation bus.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
});
