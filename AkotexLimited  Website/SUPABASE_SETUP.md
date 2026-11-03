# Supabase setup

The public site and the admin dashboard use Supabase Auth and the `inquiries` table. The dashboard is at `dashboard.html`. It has no public sign-up; only accounts explicitly added to `admin_users` can access inquiry data.

## 1. Create the Supabase project

Create a project in Supabase, then open **SQL Editor**, paste in `supabase-schema.sql`, and run it. The script creates the tables and row-level security policies. Public visitors can submit inquiries, but only designated admins can read, update, or delete them.

## 2. Configure the browser client

In the Supabase project, open **Project Settings → API** and copy the Project URL and the publishable key (or legacy `anon` key). Put those values in `supabase-config.js`:

```js
export const SUPABASE_URL = "https://your-project-id.supabase.co";
export const SUPABASE_ANON_KEY = "your-publishable-or-anon-key";
```

The publishable/anon key is intended for browser use; the database policies protect the data. **Never** put a `service_role` or secret key in `supabase-config.js` or any other website file.

## 3. Add an administrator

1. In Supabase, open **Authentication → Users** and invite or create an account for the person who will manage inquiries.
2. Copy that user’s UUID.
3. In **SQL Editor**, run the following, replacing the UUID with the invited user’s UUID:

   ```sql
   insert into public.admin_users (oluwatmiwajohn48@gmail.com)
   values ('00000000-0000-0000-0000-000000000000');
   ```

Only users with a matching row in `admin_users` can access the inquiry data. Do not enable public sign-up for the dashboard.

## 4. Run and deploy

Serve the site over HTTP(S)—for example, with VS Code Live Server during development—and open `index.html` to test the inquiry form or `dashboard.html` to sign in. Browser module imports do not work reliably from a `file://` URL. Configure the same site origin in Supabase Auth’s allowed redirect/site URL settings if you use password resets or email invitations.

Submit a test inquiry from the public page, sign in at `dashboard.html`, then verify you can change its status and delete it. Deploy the site to any static HTTPS host after testing.

## Dashboard features

- Password sign-in using Supabase Auth.
- Row-level security restricting inquiry reads, edits, and deletes to manually designated admins.
- Inquiry totals and status counts, status filters, search on the current page, and 25-item pagination.
- Status updates and confirmed deletion.
