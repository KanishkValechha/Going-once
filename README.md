# Welcome to your Convex + Next.js + WorkOS AuthKit app

This is a [Convex](https://convex.dev/) project migrated to use WorkOS AuthKit for authentication.

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Next.js](https://nextjs.org/) for optimized web hosting and page routing
- [Tailwind](https://tailwindcss.com/) for building great looking accessible UI
- [WorkOS AuthKit](https://authkit.com/) for authentication

## Get started

1. Clone this repository and install dependencies:

   ```bash
   npm install
   ```

2. Set up your environment variables:
   ```bash
   cp .env.local.example .env.local
   ```
3. Configure WorkOS AuthKit:
   - Create a [WorkOS account](https://workos.com/)
   - Get your Client ID and API Key from the WorkOS dashboard
   - In the WorkOS dashboard, add `http://localhost:3000/callback` as a redirect URI
   - Generate a secure password for cookie encryption (minimum 32 characters)
   - Update your `.env.local` file with these values

4. Configure Convex:

   ```bash
   npx convex dev
   ```

   This will:
   - Set up your Convex deployment
   - Add your Convex URL to `.env.local`
   - Open the Convex dashboard

   Then configure WorkOS authentication in Convex:

   ```bash
   npx convex auth add workos
   ```

   This creates `convex/auth.config.ts` with WorkOS integration

5. Run the development server:

   ```bash
   npm run dev
   ```

   This starts both the Next.js frontend and Convex backend in parallel

6. Open [http://localhost:3000](http://localhost:3000) to see your app

## Going Once — auction app

This app runs offline sports/tournament auctions: an admin drives the bidding from the
**Auction Console**, and a public, view-only **Live Screen** mirrors it in real time.

### Grant admin access

Admin status is bootstrapped from an allowlist read server-side by Convex. Set it on your
Convex deployment (not in `.env.local`):

```bash
npx convex env set ADMIN_EMAILS "you@example.com,organizer@example.com"
```

The first time an allowlisted email signs in via WorkOS, their Convex user is created with the
`admin` role. Admins can promote others in-app afterwards.

### Routes

- `/admin` — tournaments list and creation (WorkOS + admin role required)
- `/admin/[tournamentId]` — manage teams, players, captains, and settings
- `/admin/[tournamentId]/auction` — live auction control console
- `/live?token=…` — public, view-only live screen (no login; gated by the tournament's
  viewer token, shareable from the tournament Settings tab)

## WorkOS AuthKit Setup

This app uses WorkOS AuthKit for authentication. Key features:

- **Redirect-based authentication**: Users are redirected to WorkOS for sign-in/sign-up
- **Session management**: Automatic token refresh and session handling
- **Route protection**: Routes are protected using Next.js Proxy
- **Client and server hooks**: `useAuth()` for client components, `withAuth()` for server components

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
