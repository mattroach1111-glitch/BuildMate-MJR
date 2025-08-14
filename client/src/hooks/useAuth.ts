// Temporary placeholder file to prevent module loading errors
// This hook was removed and replaced with direct useQuery calls

export function useAuth() {
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false
  };
}