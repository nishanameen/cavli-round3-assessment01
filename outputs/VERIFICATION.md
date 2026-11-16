# Verification record

The five sample requests and the browser checks ran against the bundled Worker with its checked-in evidence catalog. This verifies the preview answers, citations, numerical shortlist, fallback, feedback interaction, and browser layout on desktop and at 375 px. The browser test intercepts requests and invokes the real Worker handlers in-process. It uses an in-memory feedback sink for assertions.

The live Supabase project was verified separately. It contains two modules and ten 384-dimensional gte-small vectors. A semantic search for “Can I use a SIM already built into the C16QS?” returned HTTP 200. The eSIM evidence was third, after GNSS and platform passages. The Worker adds technical keyword matches before model evidence selection. A structured test feedback request returned HTTP 200 and the row was verified in Postgres. Anonymous roles were verified to lack direct table SELECT and similarity RPC EXECUTE privileges.

Cloudflare rejected the earlier Worker with error 10021 because `crypto.randomUUID()` was called at module initialization. The Worker now initializes the preview signing secret when handling a request. The corrected bundle passed local runtime checks and deployed successfully on November 14, 2026 (Worker version `db68bb2a-fff8-4da8-9b6b-0edb739d307e`).

The [hosted reviewer demo](https://cavli-assignment-1.nishanameenk.workers.dev) challenges anonymous requests with HTTP 401, including the page, JavaScript, CSS, and API. A reviewer can sign in and load the chat. The username is `reviewer`; provide the existing password separately.

All five sample questions passed both the [hosted API check](hosted-verification.json) and the [hosted Chrome checks](hosted-browser-check.json). Chrome displayed the citations, the shortlist, and the support fallback. The hosted answer timings below are Worker-reported processing times from that run.

| Sample | Observed result | Hosted time |
| --- | --- | ---: |
| C16QS peak speeds | 10 Mbps downlink, 5 Mbps uplink; Supabase pgvector and Gemini | 3.86 s |
| C16QS India LTE bands | Bands 1, 3, 5, 8, 40, and 41; Supabase pgvector and Gemini | 1.40 s |
| C16QS eSIM | Varies by SKU; Supabase pgvector and Gemini | 3.22 s |
| 20 Mbps peak downlink shortlist | C20QM; Supabase structured specs | 0.18 s |
| Custom antenna and carrier | Unsupported with a Cavli support link | <1 ms |

The initial API speed question hit the 15-second Gemini timeout and still returned the correct cited answer from verified facts. A direct recheck used live Supabase and Gemini in 1.68 seconds, and all three factual answers used both providers in the Chrome run. A separate 375 px Chrome check displayed the feedback confirmation after clicking Helpful. Postgres confirmed the matching `chat_feedback` row with the rating, answered status, and `c16qs-bands` evidence ID. No deployment or reviewer-flow blocker remains.

## Interface redesign (15 November 2026)

The page was redesigned with the vividsites Prompt Chips component, the official Cavli Wireless logo (`cavliwireless.com/Cavli_Wireless.svg`, unmodified) and self-hosted Space Grotesk. The answer engine, catalog, API and security headers are unchanged. Worker version `73160050-c9b8-43a3-99bb-b43ef5d1dbea` was deployed with `scripts/deploy-hosted.ps1`.

| Check | Result | Record |
| --- | --- | --- |
| Local browser check (desktop and 375 px), including logo and chip-fills-input | 9/9 | [browser-check.json](browser-check.json) |
| Hosted smoke checks: reviewer gate, UI, provider bindings, five samples, live Supabase and Gemini, feedback | 10/10 | [hosted-verification.json](hosted-verification.json) |
| Live interface check (desktop and 390 px): logo, font, chip fill, no focus box, live cited answer, no errors | Passed | [hosted-ui-check.json](hosted-ui-check.json) |
| All 15 chip questions against the Worker | 14 answered or shortlisted with sources; the carrier-approval chip returns the intended "not verified" answer | Manual Playwright run |

Fixed during the redesign: the question box drew the page's dark keyboard-focus outline inside the bar. The bar now shows one soft accent ring, and spell-check underlines on part numbers are off. [hosted-browser-check.json](hosted-browser-check.json) is the 14 November record of the previous interface.
