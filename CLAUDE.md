# NextJS

You'll need to first kill old next/convex servers started with "pnpm run dev" and start them using `pnpm run dev`. Terminate this before you exit.

The NEXT server usually gets stuck - make sure to KILL it at the terminal level along with convex before starting them up.

# use @/ for paths

Use @/ for long ../ style paths

# NextJS Pages and tsx Components

Prefer using "use client" and the client components of nextjs over server ones except if the page only does redirects.

Remember that page.tsx cannot export anything other than the default export.

Don't modify convex/\_generated - this is a generated folder and you cannot modify it.

# React 19

We're on React 19 which has automatic memoization. You generally don't need to use `useMemo` or `useCallback` for performance optimization - the React compiler handles this automatically.

# Commands

Use `pnpm -s convex codegen` for convex codegen.
Don't rm the \_generated directory before building.
Don't disable typecheck.

Use `pnpm -s tsc -p tsconfig.json --noEmit` to find frontend ts build errors.

Use `pnpm run dev:frontend` to run nextjs (you may need to kill it if unresponsive).

# Types

Use "any" sparingly.
Definitely don't use "any" to call convex backend functions.

# Convex db.get, db.patch, and db.delete

These methods now take two arguments: the table name and the document ID.

```typescript
// Get a document
const venue = await ctx.db.get("venues", venueId);

// Patch a document
await ctx.db.patch("customers", customerId, { archived: true });

// Delete a document
await ctx.db.delete("venueUsers", venueUserId);
```

# Convex Indexes and \_creationTime

All Convex indexes implicitly include `_creationTime` at the end. This means after using equality conditions (`.eq()`) on all the explicit index fields, you can use range queries (`.gte()`, `.lte()`, `.gt()`, `.lt()`) on `_creationTime`.


# Server rendered component with convex

Here's how you do server rendered component with convex:

```
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { api } from "@/convex/_generated/api";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { revalidatePath } from "next/cache";

export default async function PureServerPage() {
  const tasks = await fetchQuery(api.tasks.list, { list: "default" });
  async function createTask(formData: FormData) {
    "use server";

    await fetchMutation(
      api.tasks.create,
      {
        text: formData.get("text") as string,
      },
      { token: await convexAuthNextjsToken() },
    );
    revalidatePath("/example");
  }
  // render tasks and task creation form
  return <form action={createTask}>...</form>;
}
```

# Convex performance

When doing a number of "awaits" - prefer using Promise.all rather than a for loop so that things run in parallel.


# Test with a browser using playwright-cli

See `playwright-cli --help` for details on how to use it.

Always test the mobile interface as well as desktop to make sure the layout looks good on mobile.
