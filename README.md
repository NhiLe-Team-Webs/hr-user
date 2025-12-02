# HR User Frontend

This is the candidate-facing application for the HR system.

## Architecture & API

This application has been migrated to use a centralized backend API (`nquoc-backend`) for all business logic and data persistence.

### Backend API
- All data fetching and mutations are done via the backend API.
- API Client: `src/lib/httpClient.ts`
- API Definitions: `src/lib/api/*.ts`

### Authentication
- **Primary Auth**: The application uses the backend API for authentication (`/api/hr/auth/*`).
- **OAuth (Google)**: We use Supabase Auth **ONLY** for handling the OAuth flow with Google.
  - The Supabase client is initialized in `src/lib/supabaseClient.ts`.
  - It is used in `AuthContext.tsx` for `signInWithOAuth`.
  - Once authenticated via OAuth, the backend ensures the user exists in our main database via `/api/hr/candidates/ensure`.

> [!IMPORTANT]
> Do not remove Supabase configuration from `.env` as it is required for Google Login to work.
> Do not use Supabase client for database operations (fetching/updating data). Use the backend API instead.

## Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   Copy `.env.example` to `.env` and fill in the required values:
   - `VITE_API_URL`: URL of the nquoc-backend API
   - `VITE_SUPABASE_URL`: Required for OAuth
   - `VITE_SUPABASE_ANON_KEY`: Required for OAuth

3. Run development server:
   ```bash
   npm run dev
   ```
