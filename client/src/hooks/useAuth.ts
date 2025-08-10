import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const { data: user, isLoading, refetch } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Reduce stale time to refresh user role changes more quickly
    staleTime: 30000, // 30 seconds instead of Infinity
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    refetch, // Expose refetch for manual role updates
  };
}
