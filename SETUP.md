# Google OAuth Setup Instructions

## Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
# Google OAuth Configuration
# Get these from Google Cloud Console: https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret_here
```

## Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" in the left sidebar
5. Click "Create Credentials" > "OAuth 2.0 Client IDs"
6. Set the application type to "Web application"
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (for development)
   - `https://yourdomain.com/api/auth/callback/google` (for production)
8. Copy the Client ID and Client Secret to your `.env.local` file

## NextAuth Secret

Generate a random secret for NextAuth:

```bash
openssl rand -base64 32
```

Or use any random string generator.

## Installation

Install the new dependencies:

```bash
npm install
```

## Running the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`
