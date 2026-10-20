# Backend architecture and workflows

## AI data flow

```mermaid
flowchart LR
    React[React UI] --> API[Express API]
    API --> Zod[Zod request validation]
    Zod --> Discovery[Semantic discovery]
    Discovery --> OllamaEmbeddings[Ollama embeddings]
    OllamaEmbeddings --> AtlasListing[(Atlas listing Vector Search)]
    Zod --> RAG[Specification RAG]
    RAG --> AtlasDocs[(Atlas document Vector Search)]
    AtlasDocs --> LangChain[LangChain prompt and chat model]
    LangChain --> OllamaChat[Ollama chat model]
    Zod --> Agent[Comparison workflow]
    Agent --> Find[findListings]
    Agent --> Compare[compareSpecifications]
    Agent --> Inspect[inspectDisclosures]
    Find --> AtlasListing
    Compare --> Mongo[(Approved listing records)]
    Inspect --> Mongo
    OllamaChat --> API
    API --> React
```

Only active, moderator-approved listings are searched. Manufacturer source excerpts and seller excerpts explicitly shared with buyers are separately typed and cited. Private ownership evidence is never inserted into AI context.

## Request architecture

```mermaid
flowchart TD
    Client[Postman or React client] --> CORS[CORS allowlist and body limits]
    CORS --> Session[MongoDB-backed session]
    Session --> CSRF[CSRF validation for mutations]
    CSRF --> Routes[Express routes]
    Routes --> Auth[Authentication and role checks]
    Auth --> Controllers[Controllers and input validation]
    Controllers --> Models[Mongoose models]
    Models --> Mongo[(MongoDB)]
    Controllers --> PrivateFiles[Private evidence files]
```

## Listing lifecycle

```mermaid
stateDiagram-v2
    [*] --> pending_review: Seller creates listing
    pending_review --> active: Moderator approves
    pending_review --> removed: Moderator removes
    active --> pending_review: Seller changes listing or disclosure
    active --> suspended: Moderator flags
    suspended --> removed: Moderator removes
    active --> sold: Listing is sold outside payment/escrow scope
    active --> removed: Seller withdraws or moderator removes
```

Only records with `status=active` and `moderationStatus=approved` are returned by public listing endpoints. Seller-authored condition disclosures remain separate from moderation decisions.

## Access boundaries

- Buyer: public approved listings, own shortlist/questions/viewings, and chat conversations in which the buyer participates.
- Seller: own listings and evidence, questions about own listings, viewing requests received for own listings, and replies to existing conversations.
- Moderator: moderation queue, reports, evidence review/download, moderation history, invitations, and membership administration.
- Public clients never receive evidence storage paths or the seller's `ownershipConfirmed` field.
