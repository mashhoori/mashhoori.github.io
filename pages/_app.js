import '../styles/globals.css';
import { SessionProvider } from 'next-auth/react';
import { AuthProvider } from '../lib/auth-context';

export default function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <AuthProvider>
        <Component {...pageProps} />
      </AuthProvider>
    </SessionProvider>
  );
}
