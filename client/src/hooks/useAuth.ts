// Temporary placeholder file to prevent module loading errors
// This hook was removed and replaced with direct useQuery calls
// This should never be called since it's just a placeholder

export function useAuth() {
  console.warn('useAuth placeholder called - this should not happen');
  return {
    user: null,
    isLoading: false,
    isAuthenticated: false
  };
}