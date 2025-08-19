import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
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
    const url = queryKey.join("/") as string;
    
    // Only log for timesheet queries to avoid noise
    if (url.includes('/api/admin/timesheets/') || url.includes('/api/timesheet')) {
      console.log(`🌐 TIMESHEET FETCH REQUEST: ${url}`);
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (url.includes('/api/admin/timesheets/') || url.includes('/api/timesheet')) {
      console.log(`🌐 TIMESHEET FETCH RESPONSE: ${url} - Status: ${res.status}`);
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      if (url.includes('/api/admin/timesheets/') || url.includes('/api/timesheet')) {
        console.log(`🚫 TIMESHEET AUTH ERROR: Returning null for 401 response from ${url}`);
      }
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    
    if (url.includes('/api/admin/timesheets/') || url.includes('/api/timesheet')) {
      console.log(`✅ TIMESHEET FETCH SUCCESS: ${url} - Data length: ${Array.isArray(data) ? data.length : 'not-array'}`);
    }
    
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
