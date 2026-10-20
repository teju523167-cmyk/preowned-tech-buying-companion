# Preowned Tech Buying Companion

## 1. Project Overview

The **Preowned Tech Buying Companion** is a web application designed to help users discover and evaluate preowned technology products, including laptops, cameras, and gaming devices.

The application combines a marketplace backend with AI-assisted product discovery, specification retrieval, and comparison. It helps buyers explore product information and evaluate seller-provided disclosures before making a decision.

The system supports three roles: **buyer, seller, and moderator**. Authentication, authorization, and resource-access rules help control which operations each role can perform.

AI-generated information is intended to assist evaluation. It does not independently authenticate devices, prove ownership, guarantee product condition, or predict remaining useful life.

## 2. Project Objectives

- Build a marketplace for preowned technology products.
- Enable sellers to create and manage product listings.
- Help buyers discover and compare products.
- Provide product questions, shortlists, preferences, viewing requests, and buyer chat.
- Support moderator review of listings, reports, and related information.
- Integrate AI-assisted discovery and specification retrieval.
- Apply authentication, authorization, validation, and access controls to protect application resources.

## 3. Main Features

### 3.1 Marketplace

- Browse and search available listings.
- View individual product details.
- Filter listings using supported criteria.
- Allow sellers to manage their own listings.
- Support seller disclosures and product evidence where implemented.
- Apply listing-status and moderation rules to control which products are available to buyers.

### 3.2 Buyer Features

- Maintain product shortlists and preferences.
- Ask questions about listings.
- Manage viewing requests.
- Use buyer chat and available AI-assisted discovery features.
- Compare product information to support purchasing decisions.

### 3.3 Seller Features

- Create and manage product listings.
- Provide product descriptions and disclosures.
- Upload supporting evidence where supported.
- Share permitted specification-document excerpts with buyers through the AI-source functionality.

Seller disclosures and shared excerpts are seller-provided information, not independent verification of a product's authenticity or condition.

### 3.4 Moderator Features

- Review listings and reports.
- Perform permitted moderation actions.
- Review relevant evidence and moderation history.
- Access role and invitation administration features where implemented.

### 3.5 AI-Assisted Features

The application includes AI-related modules for:

- **Semantic discovery:** helping buyers find relevant products using natural-language queries.
- **Specification retrieval:** retrieving relevant specification information from indexed documents.
- **Product comparison:** using available listing information, specifications, and disclosures to support comparisons.

These features depend on the configured Ollama models, database, and retrieval indexes. Successful operation of every live AI workflow has not yet been confirmed.

## 4. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React |
| Frontend development and build | Vite |
| Backend | Node.js and Express |
| Database | MongoDB |
| Database integration | Mongoose |
| AI integration | LangChain JavaScript |
| Local AI model runtime | Ollama |
| Vector retrieval | MongoDB Atlas Vector Search |
| Data validation | Zod |
| API testing | Postman |
| Automated testing | Vitest |

## 5. System Architecture

The application follows a frontend–backend architecture.

1. **Frontend:** React provides the user interface.
2. **Backend:** Express exposes API endpoints and handles requests.
3. **Authentication and authorization:** The backend identifies users and checks access permissions.
4. **Database:** MongoDB stores application data, accessed through Mongoose.
5. **AI and retrieval:** LangChain JS, Ollama, and Atlas Vector Search support the configured AI workflows.

The frontend communicates with the backend through HTTP requests. The backend performs request validation, business logic, database operations, and access checks.

Local MongoDB supports ordinary marketplace operations. Atlas Vector Search requires a suitable MongoDB Atlas deployment and correctly configured vector indexes.

## 6. Project Structure

The project contains the following main resources:

- `src/` — backend application code.
- `frontend/` — React frontend application.
- `tests/` — automated tests.
- `postman/` — Postman API collection.
- `package.json` — root project scripts and dependencies.
- `package-lock.json` — dependency lockfile.
- `.env.example` — example environment configuration, if included.
- `README.md` — project documentation.

Additional source files organize routes, controllers, database models, middleware, and AI-related functionality.

## 7. Prerequisites

The following software and configuration may be required, depending on the functionality being used:

- Node.js and npm.
- MongoDB, running locally or hosted remotely.
- Ollama and the configured models for local AI inference.
- MongoDB Atlas with Vector Search indexes for Atlas-based semantic retrieval.

The frontend and backend dependencies must be installed before running the application.

## 8. Environment Configuration

The application uses environment variables for configuration. Create a local `.env` file using `.env.example` as a reference, if the example file is included.

Configuration may include:

- Backend port and runtime environment.
- MongoDB connection URI.
- Session secret.
- Frontend origin.
- Ollama URL and model names.
- Atlas Vector Search index names.
- Optional initial moderator account configuration, if supported by the project.

Keep actual credentials and secrets private. **Never include a real `.env` file, database password, session secret, or moderator password in the submission ZIP.**

The `.env.example` file should contain placeholder values rather than real credentials.

## 9. Installation

Open a terminal in the project root.

Install the backend dependencies:

```bash
npm install
```

Install the frontend dependencies:

```bash
npm --prefix frontend install
```

Ensure that the required database and environment configuration are available before starting the application.

## 10. Running the Application

### 10.1 Start the Backend

From the project root:

```bash
npm run dev
```

The backend requires a reachable MongoDB instance and valid environment configuration.

During local testing, the backend successfully connected to the configured local MongoDB instance and started on port `4000`.

### 10.2 Start the Frontend

Open a second terminal:

```bash
cd frontend
npm run dev
```

Open the local URL printed by Vite, normally:

`http://localhost:5173`

The backend health endpoint used during testing is:

`http://localhost:4000/`

The frontend and backend must both be running for the complete application workflow to function.

## 11. Main API Modules

The project includes API modules for the following areas. Refer to the source code and Postman collection for the exact HTTP methods, request bodies, and route parameters.

| API module | Purpose |
|---|---|
| `/api/auth` | Registration, login, email verification, and account-related operations |
| `/api/listings` | Product listings and listing-related operations |
| `/api/shortlists` | Buyer shortlists |
| `/api/preferences` | Buyer preferences |
| `/api/questions` | Listing-related questions |
| `/api/viewings` | Viewing-related operations |
| `/api/buyer-chat` | Buyer chat functionality |
| `/api/moderator` | Moderation operations |
| `/api/ai/discovery` | AI-assisted product discovery |
| `/api/ai/specifications` | Specification retrieval |
| `/api/comparison-agent` | AI-assisted product comparison |

Other routes support listing evidence, seller disclosures, reports, and seller-provided AI source excerpts where implemented.

The Postman collection is located at:

`postman/Preowned-Tech-Backend.postman_collection.json`

Use IDs returned by your own running application when testing endpoints that require resource IDs.

## 12. Authentication, Authorization, and CSRF Protection

The application supports buyer, seller, and moderator roles.

- **Authentication** identifies the user making a request.
- **Authorization** determines whether that user may perform the requested operation.
- **Resource ownership checks** help prevent users from accessing or modifying resources belonging to others.
- **CSRF protection** helps prevent unauthorized state-changing requests from being triggered through an authenticated browser session.

The implementation includes session-related protections and access checks. Public registration is not intended to allow users to create moderator accounts.

### Testing authenticated requests with Postman

For the session-based authentication flow:

1. Register an account and complete email verification when required.
2. Log in using the account.
3. Keep the session cookie in Postman's cookie jar for `localhost`.
4. Request `GET /api/auth/csrf-token` after login.
5. For authenticated `POST`, `PATCH`, and `DELETE` requests that require CSRF protection, include the returned token in the `x-csrf-token` header.
6. Check the response and verify that the user has permission to perform the operation.

The exact requirements depend on the route and middleware. Follow the implementation and the supplied Postman collection.

The development email inbox endpoint is intended for non-production testing only and must not be exposed publicly in a production deployment.

## 13. AI Setup and Atlas Vector Search

AI functionality requires additional configuration beyond starting the backend.

### 13.1 Ollama

Install Ollama and make sure it is running. The configured models include:

- `qwen2.5:7b` — chat model.
- `nomic-embed-text` — embedding model.

The corresponding model names and Ollama URL are configurable through environment variables.

### 13.2 MongoDB Atlas Vector Search

Semantic discovery and document retrieval require MongoDB Atlas Vector Search indexes when the application uses Atlas-based vector retrieval.

The listing and document indexes must use the correct vector fields, embedding dimensions, and filter fields expected by the application.

The stored embeddings and query embeddings must be generated using compatible models and dimensions.

Indexing scripts and index names should be checked against the project's actual scripts and configuration before running them.

**Verification boundary:** The backend was tested with local MongoDB. Live Ollama inference and Atlas Vector Search were not confirmed during the reported test run. Their operation therefore remains dependent on completing and verifying the required setup.

## 14. Testing and Build

### Run automated tests

From the project root:

```bash
npm test
```

### Build the frontend

From the project root:

```bash
npm run build:frontend
```

Alternatively, from the frontend directory:

```bash
npm run build
```

### Verification results

The following checks were completed during project preparation:

- **Automated tests:** 7 tests passed across 2 test files.
- **JavaScript syntax:** The syntax check passed for 57 JavaScript files.
- **Frontend production build:** Completed successfully.
- **Backend startup:** Connected successfully to the configured local MongoDB instance during startup testing.

The automated test output also reported that Ollama was unavailable for AI-related operations. Live Atlas Vector Search was not confirmed.

These results describe the checks performed; they do not mean every feature has been tested end to end.

## 15. Security and Data Handling

The project includes security-related mechanisms in areas such as:

- Password hashing and authentication.
- Expiring, single-use verification and password-reset tokens.
- Session management and session-version checks.
- Role-based access and resource-ownership checks.
- Validation of incoming data.
- CSRF protection for applicable state-changing requests.
- Restricted access to private evidence files.
- Listing moderation and status checks.

Evidence handling is designed to restrict access to authorized users rather than exposing private files as public static resources. Public listing responses are intended to avoid exposing private ownership declarations and evidence metadata.

Security behavior should be understood in terms of the actual implementation and configuration. A security feature should not be described as fully effective merely because it appears in the project documentation.

For a production deployment, additional configuration and operational safeguards may be required, including HTTPS, secure session-cookie settings, restricted database access, private file storage, and backups.

## 16. Scope and Limitations

The project focuses on preowned technology discovery, listing management, buyer–seller interactions, moderation, and AI-assisted evaluation.

- Payment processing and escrow are outside the stated project scope.
- Seller disclosures remain seller-provided claims.
- AI-generated comparisons do not independently verify product authenticity or ownership.
- Remaining product life and condition are not guaranteed by AI-generated information.
- Live AI and vector retrieval require the relevant services and indexes to be configured and running.

## 17. Conclusion

The Preowned Tech Buying Companion combines a preowned technology marketplace with role-based access, moderation, and AI-assisted product discovery and comparison.

The project brings together frontend development, backend API design, database operations, authentication, automated testing, and AI-related components. Its live AI and retrieval capabilities depend on the required services and configuration being available.

The project is intended to help users evaluate available product information more effectively while making the limitations of seller disclosures and AI-generated information clear.