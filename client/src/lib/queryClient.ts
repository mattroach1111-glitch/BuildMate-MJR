import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: (failureCount, error: any) => {
        if (error?.status === 404 || error?.status === 403) {
          return false
        }
        return failureCount < 3
      },
    },
  },
})

// Generic fetcher function for React Query
export async function apiRequest(
  url: string, 
  options: RequestInit = {}
): Promise<any> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}