import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { SessionBackup } from "./sessionBackup";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // For 401 errors, log backup availability for debugging
    if (res.status === 401) {
      const hasBackup = SessionBackup.hasValidBackup();
      console.log('🔄 API call failed with 401, backup available:', hasBackup);
    }
    
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
  options?: RequestInit
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
    ...options,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (res.status === 401) {
      console.log('🔄 Query failed with 401 for:', queryKey.join("/"));
      const hasBackup = SessionBackup.hasValidBackup();
      console.log('🔄 Backup session available:', hasBackup);
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

// Global backup mode state that query client can check
let globalBackupModeActive = false;

export const setGlobalBackupMode = (isActive: boolean) => {
  globalBackupModeActive = isActive;
};

export const isGlobalBackupModeActive = () => globalBackupModeActive;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: true, // Re-enable normal behavior
      refetchOnReconnect: true, // Re-enable normal behavior
      staleTime: 30 * 1000, // Shorter stale time for quicker session recovery
      retry: (failureCount, error) => {
        // Allow retry for 401 errors to give backup system time to work
        if (error.message.includes('401')) {
          return failureCount < 1; // Reduced retries for faster fallback
        }
        return failureCount < 1; // Only 1 retry for other errors
      },
      retryDelay: (attemptIndex) => {
        // Longer delay for auth retries to allow session restoration
        return Math.min(1000 * (attemptIndex + 1), 3000);
      },
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on 401 - user needs to re-authenticate
        if (error.message.includes('401')) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});
