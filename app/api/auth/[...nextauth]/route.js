import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

const BASE_URL = process.env.NEXTAUTH_URL;
const SYNC_API_ROUTE = `${BASE_URL}/api/user/add`;
export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.NEXT_PUBLIC_GOOGLE_ID_CLIENT,
      clientSecret: process.env.NEXT_PUBLIC_GOOGLE_API_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,

  callbacks: {
    async signIn({ user, account, profile }) {
      // 1. Check if the sign-in is specifically from Google
      if (account?.provider === 'google') {

        // 2. Destructure and prepare the data payload
        const userDataToSync = {
          // Data from the NextAuth 'user' object
          email: user.email,
          name: user.name,
          image: user.image,

          // Credentials from the NextAuth 'account' object
          accessToken: account.access_token, // Google's access token
          idToken: account.id_token,         // Google's ID token (useful for verification)
          providerId: account.providerAccountId, // Google's unique user ID
        };

        try {
          // 3. Send the data to your custom API route
          const response = await fetch(SYNC_API_ROUTE, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // IMPORTANT: Include a secret key or bearer token if this API is exposed
              // 'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET_KEY}`, 
            },
            body: JSON.stringify(userDataToSync),
          });

          // const response = await setUser({
          //   method: 'POST',
          //   headers: {
          //     'Content-Type': 'application/json',
          //     // IMPORTANT: Include a secret key or bearer token if this API is exposed
          //     // 'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET_KEY}`, 
          //   },
          //   body: JSON.stringify(userDataToSync),
          // });

          // 4. Handle the response from your custom API
          if (response.ok) {
            console.log(await response.json());
            
            console.log(`Successfully synced Google user data for ${user.email}`);
            // If your sync API returns specific data (e.g., activation status), you can read it here:
            // const syncResult = await response.json(); 
            return true; // Allow sign-in to proceed
          } else {
            // Log the error from your API route
            const errorText = await response.text();
            console.error(`Sync API failed for ${user.email}: ${response.status} - ${errorText}`);
            // You can return false here to block sign-in if the sync is critical
            return true; // Still allow sign-in, but log the failure
          }
        } catch (error) {
          console.error('Error during user data sync fetch:', error);
          // Decide whether to block sign-in if the network request fails
          return true; // Usually safer to allow sign-in unless data sync is mandatory
        }
      }

      // Allow sign-in for all other providers or if it's not a Google sign-in
      return true;
    },
    // ... other callbacks (session, jwt)
  },
  // ... other NextAuth config
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
