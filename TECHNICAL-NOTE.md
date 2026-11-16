# Cavli Module Assistant · Assignment 1

### Architecture

```mermaid
flowchart TD
  "Browser chat" --> "Cloudflare Worker"
  "Cloudflare Worker" --> "Verified product specs"
  "Cloudflare Worker" --> "Supabase catalog function"
  "Supabase catalog function" --> "gte-small and pgvector"
  "Cloudflare Worker" --> "Gemini evidence selection"
```

The Worker serves the React app and handles chat and feedback. Supabase Postgres stores two modules, ten reviewed passages, 384-dimensional embeddings, and feedback. A small Supabase Edge Function runs gte-small for queries and source passages. pgvector orders matching passages by cosine similarity, with a module filter when the question names one. At this catalog size, exact cosine ranking is sufficient. Code also matches technical terms and model IDs exactly. When the Gemini key is available, Gemini chooses evidence IDs from the retrieved candidate set. The Worker validates IDs and emits reviewed text and source links. The Worker evaluates supported throughput comparisons using numeric catalog fields.

### Sources

Verified from public Cavli pages during development. The catalog stores the section title with each link and preserves qualifiers such as published peak and optional by variant.

| Module | Source | Sections used |
| --- | --- | --- |
| C16QS | [Official product page](https://www.cavliwireless.com/iot-modules/c-series/c16qs) | About, location services, Technical Data, cellular bands, sample variants |
| C20QM | [Official product page](https://www.cavliwireless.com/iot-modules/c-series/c20qm) | About, location services, Technical Data, cellular bands, sample variants |

### Controls, feedback and limits

No key is sent to the browser. The hosted reviewer gate uses a Worker secret. Supabase tables use row-level security, deny public direct access, and are reached through a token-authenticated function. Feedback consists of a generated answer ID, rating, optional fixed reason, citation IDs, and timestamp. Raw question text is sent to the configured retrieval and generation services to answer the request. The app does not store it in its feedback table. Review queued feedback in Supabase, compare the cited evidence, add an evaluation case, and mark the item reviewed.

The prototype covers two modules and a selected subset of published specs. A similarity score ranks passages but cannot prove that a passage answers a question. A real eSIM paraphrase ranked a GNSS passage ahead of the eSIM passage, so exact technical matches stay in the candidate set. Carrier, antenna and deployment commitments use an explicit fallback. The model path can fall back to verified facts if credentials are absent or the provider fails. Captured local timings are preview timings, not hosted latency.

### Website integration

The team can mount the chat UI on selected product pages and call the Worker API from its approved site origin. Before production use, agree on where it appears, use the site accessibility and privacy controls, replace the reviewer gate with the agreed access policy, and give Product Engineering ownership of evidence updates and feedback review.

Software includes Hono, React, Zod, Lucide icons, the vividsites Prompt Chips component, and the Space Grotesk font (SIL Open Font License, licence file in `web/fonts`). Hosted dependencies are Cloudflare Workers, Supabase Edge Functions and database, and optional Gemini generation. Provider quotas and costs depend on the configured plans and usage. The database was created under a Free organization. No hosted model or Worker cost was measured in the local test run.
