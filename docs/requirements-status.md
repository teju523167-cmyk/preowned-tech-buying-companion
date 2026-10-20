# Requirements status — 2026-10-19

Statuses reflect files inspected and checks actually executed. Code presence alone is not runtime verification.

## Implemented and verified locally

- Buyer, seller, and moderator account roles, registration, email verification, login, session rotation, password reset invalidation, and CSRF flow exercised against a temporary MongoDB.
- Listing creation, moderation approval, public visibility, seller ownership rejection, shortlist, buyer questions/seller answer, viewing request/seller response, private chat participant checks, private evidence upload/authorization/moderation, and listing report review exercised in integration tests.
- AI request validation and explicit budget/category/RAM/storage constraint extraction covered by unit tests.
- React production build succeeded; interface includes account verification/recovery/password change, public catalog, buyer AI search/RAG/comparison, listing interactions, seller listing/disclosure/evidence/reference workflows, and moderator listing/evidence/report review.
- Updated Postman collection includes the AI endpoints and seller excerpt sharing.
- ZIP has safe `.env.example`, no project `.env`, and includes the source, tests, setup docs and architecture documentation.

## Implemented but not verified against live AI services

- Atlas Vector Search candidate retrieval using approved active listing filters and exact budget/specification constraints.
- Ollama embeddings and LangChain source-grounded RAG; sources carry model, type and page/section metadata. Seller excerpts require explicit sharing; private evidence is not indexed.
- Comparison workflow uses LangChain tools for listing discovery, specification comparison and public seller disclosures, with Zod input/output validation and a 30-second chat-model timeout.
- Re-embedding/indexing scripts print actual vector dimensions and prevent silently mixing document embedding models.
- AI queries are handled server-side; API returns service-unavailable errors if Ollama/Atlas calls fail.

## Incomplete or needs further work

- No full browser automation or accessibility audit has been run. The React build is verified, not every UI interaction in a real browser.
- Seller listing edits currently expose a title-edit shortcut; a complete structured edit form is still needed.
- Moderator workspace does not include invitation/role administration or moderation-history browsing, although those backend APIs exist.
- AI model behavior, citation grounding, Atlas index configuration, vector recall and graceful service outage behavior need live Atlas/Ollama acceptance testing with real model/document examples.
- The original capstone PDF was not among the supplied files, so the project was assessed against the provided handover and images.
- No demo recording is included; README provides a reproducible setup and demo path.

## External setup required

- MongoDB Atlas URI and network access configuration for the project account.
- Atlas Vector Search indexes using the actual dimension printed by the listing embedding script.
- Running Ollama host with the configured chat and embedding models pulled.
- A legal/approved set of manufacturer manual excerpts and approved demo listing IDs.

## Checks actually run

- `npm test`: passed, 7 tests total (4 unit, 3 MongoDB-backed integration tests); JavaScript syntax scan passed for 56 files.
- `npm run build:frontend`: passed.
- `unzip -t` on the deliverable ZIP: passed.
- MongoDB-backed tests use a temporary `mongodb-memory-server` database. Atlas and Ollama network inference are not covered by those tests.
