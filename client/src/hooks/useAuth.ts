// This file intentionally left empty - useAuth hook has been completely removed
// All components now use direct useQuery calls for authentication
// If you see this file being imported, remove that import and use:
// const { data: user } = useQuery({ queryKey: ["/api/auth/user"] })

export function useAuth() {
  throw new Error("useAuth is deprecated - use useQuery directly");
}