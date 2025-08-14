// ERROR: This file should not be imported anywhere
// All authentication should use direct useQuery calls

throw new Error(`
DEPRECATED: useAuth hook detected!
This import should be removed from the calling component.
Replace with: const { data: user } = useQuery({ queryKey: ["/api/auth/user"] })
`);