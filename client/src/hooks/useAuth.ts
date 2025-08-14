import { useQuery } from '@tanstack/react-query'

interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'staff'
}

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/auth/user')
        if (!response.ok) {
          if (response.status === 401) {
            return null // Not authenticated
          }
          throw new Error('Failed to fetch user')
        }
        return response.json()
      } catch (error) {
        console.error('Auth error:', error)
        return null
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
  })

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    error
  }
}