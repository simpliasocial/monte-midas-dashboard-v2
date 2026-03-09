# Welcome to your Lovable project SIMPLIA

## Project infoo

**URL**: https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- **Supabase** - Backend as a Service (autenticación, base de datos, storage)

## 🔌 Supabase Configuration

This project is connected to Supabase for backend services.

### Setup

1. Copy the environment example file:
```sh
cp .env.example .env.local
```

2. Update `.env.local` with your Supabase credentials (already configured if you're using this project).

3. The Supabase client is available at `src/lib/supabase.ts`

### Usage

- **Authentication Hook**: `useSupabaseAuth()` - Get current user, session, and auth methods
- **Query Hook**: `useSupabaseQuery(tableName, queryFn)` - Fetch data with loading/error states
- **Example Component**: Check `src/components/SupabaseExample.tsx` for a complete auth demo

For detailed examples and API usage, see the [Supabase Guide](./SUPABASE_GUIDE.md).

### Quick Examples

```typescript
// Authentication
import { useSupabaseAuth } from '@/hooks/useSupabase';

function MyComponent() {
  const { user, loading, signOut } = useSupabaseAuth();
  // ... use authentication
}

// Query data
import { useSupabaseQuery } from '@/hooks/useSupabase';

function DataComponent() {
  const { data, loading, error } = useSupabaseQuery('table_name');
  // ... render data
}

// Direct client usage
import { supabase } from '@/lib/supabase';

async function fetchData() {
  const { data, error } = await supabase.from('table').select('*');
}
```

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
