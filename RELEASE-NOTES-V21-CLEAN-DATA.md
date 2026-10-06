# Hisab Flow V21 — Clean Demo Data

## Purpose
This release addresses the duplicate demo-data problem seen during AI testing.

## What changed
- Added a guarded demo-data reset helper.
- Reset is allowed only when the business has the explicit `demo.seed.v1` marker.
- Added `POST /api/demo/reset`.
- Added a **Reset demo data** button in Operations Center.
- Reworked demo seeding into one deterministic clean dataset.
- Customers and products are created once per reset; no repeated `create()` loop is used for the same demo names.
- The seed now creates only a small, controlled transaction set instead of dozens of repeated demo transactions.
- `prisma db:seed` resets the seeded `demo-business` before recreating the clean dataset.
- Existing non-demo businesses are protected by the marker check.

## Important
The application code cannot remotely erase an already-deployed Vercel database merely by packaging this ZIP. After deployment, sign in to the seeded demo business and use **Operations Center → Reset demo data**. The endpoint refuses to reset businesses without the `demo.seed.v1` marker.

## Result
After reset, the demo business contains a clean set of unique customers/products and a small deterministic set of sales, purchases, expenses, inventory records, reminders, batch/serial examples, and business memory.
