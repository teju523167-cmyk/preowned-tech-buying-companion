
# Demo walkthrough

This 5–7 minute walkthrough uses the local MongoDB demo data. AI sections require Ollama; semantic retrieval and document Q&A also require Atlas Vector Search indexes.

## Before the demo

1. Copy `.env.example` to `.env` and set a private `SESSION_SECRET` and `DEMO_PASSWORD` (at least 12 characters each). Keep `.env` private.
2. Start local MongoDB with Docker Desktop running: `docker compose up -d`.
3. Install dependencies with `npm install` and `npm --prefix frontend install`.
4. Seed demo accounts and listings using `npm run seed:demo`.
5. In separate terminals, start the API and frontend: `npm start` and `npm run dev:frontend`.
6. Open `http://localhost:5173`. Check API health at `http://localhost:4000/`.

## Suggested presentation

1. **Marketplace:** show the approved Dell Latitude listing, its price, specifications, and seller disclosures. Point out that disclosures are seller claims, not independent verification.
2. **Seller workspace:** sign in as `demo.seller@example.com` with `DEMO_PASSWORD`. Show listing management, condition disclosure, and seller-side buyer requests. Avoid adding real personal documents to the demo.
3. **Buyer workflow:** sign out, then sign in as `demo.buyer@example.com` with the same demo password. Open the approved listing, add it to the shortlist, ask a seller question, and request a viewing.
4. **Moderation:** explain that the second seeded listing awaits review. To demonstrate moderator actions, bootstrap a moderator with the documented one-time script, then sign in using the created account.
5. **AI discovery and comparison:** as a buyer, describe a device need and set a budget. These calls need Ollama and Atlas listing vectors/indexes. Show the source-grounded Q&A only after approved manual excerpts are indexed. If those external services are not configured, present this section as setup-pending; do not imply it was live-tested.
6. **Security:** summarize verified accounts, session/CSRF protections, ownership checks, and private evidence access. The automated integration suite exercises these boundaries.

## Reset demo data

The seed command is idempotent for its two demo listings and accounts. For a clean reset, stop the app and remove the local Docker volume with `docker compose down -v`, then start MongoDB and run the seed command again. This deletes all data stored in that local demo volume.
