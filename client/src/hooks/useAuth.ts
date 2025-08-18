import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Reduce stale time to refresh user role changes more quickly
    staleTime: 30000, // 30 seconds instead of Infinity
    // Handle errors gracefully
    throwOnError: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    refetch, // Expose refetch for manual role updates
  };
}
