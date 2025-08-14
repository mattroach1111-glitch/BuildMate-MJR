// Empty stub file to prevent module loading errors
// This should never be imported - all auth is handled via direct useQuery

export function useAuth() {
  console.error('useAuth is deprecated. Use direct useQuery with "/api/auth/user" instead.');
  return { user: null, isLoading: false, isAuthenticated: false };
}