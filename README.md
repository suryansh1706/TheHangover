# The Hangover

The Hangover helps friends find new activities that fit the whole group, then shortlist, compare, vote, and learn from completed outings. The repository contains a working local-first implementation across a React client, an Express API, PostgreSQL, and a separate FastAPI recommendation service.

**Data honesty:** the included catalog consists of generic development concepts with clearly labeled sample prices. They are not real venue listings. Live place search is optional and uses Geoapify and OpenStreetMap data, with a source and verification time. No venue, availability, route distance, or model score is fabricated.

## Structure

```text
frontend/                         React, TypeScript, Vite, React Router, Tailwind
backend/                          Express REST API, Zod validation, Prisma
  prisma/schema.prisma            relational database schema
  prisma/migrations/              versioned PostgreSQL migration
  prisma/seed.ts                  labeled development samples
ml-service/                       FastAPI recommendation and model service
  app/recommender.py              group scoring, constraints, novelty, diversity
  app/model.py                    feedback model and grouped validation
docker-compose.yml                local PostgreSQL
```

## Prerequisites

- Node.js 22 LTS or newer and npm
- Python 3.11+
- Docker Desktop with Compose, or a PostgreSQL 16 server

## Run locally

From PowerShell at the repository root:

```powershell
Copy-Item .env.example .env
# Set ML_SERVICE_TOKEN to a new random secret in .env.
Copy-Item .env backend\.env
docker compose up -d postgres
npm install
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
npm run db:seed --workspace backend
```

Run each service in its own terminal:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

```powershell
Set-Location ml-service
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The frontend is at `http://localhost:5173`. The API is at `http://localhost:4000`, and the ML service is at `http://localhost:8000`.

To run the packaged stack with Docker instead, put your local settings in `.env` and run:

```powershell
docker compose --profile app up --build -d
docker compose exec backend npm run db:seed --workspace backend
docker compose ps
```

The API container applies migrations on startup. Seeding is a separate command so sample concepts are never silently added to a production database. Stop the stack with `docker compose --profile app down`; add `-v` only if you intentionally want to delete the local database and saved model volumes.

Set `GEOAPIFY_API_KEY` on the backend to enable live place search; sample activity ideas still work without it. Results use Geoapify and OpenStreetMap data, whose coverage varies by location and category. The ML service downloads `all-MiniLM-L6-v2` on first recommendation use when the model host is reachable; if not, it reports and uses a TF-IDF fallback. Set `OPENAI_API_KEY` to enable LLM preference interpretation. Without it, the service uses a small deterministic parser. Both paths return an editable draft.

## Main product flows

1. Register or log in. Passwords are bcrypt-hashed; sessions use opaque random tokens stored only as hashes and delivered in HTTP-only cookies.
2. Add interests, dislikes, budget, distance and origin coordinates, duration, indoor/outdoor preference, intensity, accessibility, and dietary needs in Preferences.
3. Create a group, issue a single-use invitation token, and have friends join. Tokens expire after seven days and only their hashes are stored. Group organizers can set shared budget, duration, distance, setting, and intensity limits; those constraints apply alongside each member's preferences.
4. Browse labeled sample ideas or search current places through Geoapify. Mark activities as tried to update group novelty.
5. Ask for group picks. The recommender filters hard constraints, scores each member’s fit, gives substantial weight to the lowest member score, favors activities new to more members, and diversifies the list across categories. Each result includes its scoring signals and grounded reasons.
6. Save picks, compare listed price/duration and group vote totals, then vote yes, maybe, or no.
7. Record a completed outing, submit enjoyment and optional dimension ratings, and update the member’s learned preference tags. If a prediction was available, it is logged with its model version and feature snapshot.

## Recommendation and learning

The initial recommender combines structured attributes with cached `all-MiniLM-L6-v2` text embeddings. If the model cannot be loaded, it labels the fallback as TF-IDF. Novelty is the fraction of group members who have not tried an activity. A member’s explicit dislike, known budget, maximum duration, intensity, setting, accessibility/dietary needs, and configured radius are hard filters. For a distance limit, the service uses a straight-line Haversine distance and requires verified coordinates; this is not driving or transit distance.

Before enough feedback exists, the system uses interpretable content and preference scores; it does not present those scores as predicted enjoyment. Model training starts only with at least 30 feature-linked ratings across 5 separate outings. It compares a mean baseline, Ridge regression, and a random forest with GroupKFold splits grouped by outing. A fitted model is used only after training and persists in `ml-service/data/`. Candidate MAE, baseline MAE, row/outing counts, and validation method are stored for the analytics view. Results come only from actual submitted feedback. Observed prediction error in a person’s own later feedback is labeled separately from held-out offline validation.

Natural-language preference interpretation is a proposal, never an authorization or constraint bypass. Model output is validated with Pydantic and Zod, and members can edit the result before saving it. Recommendation explanations are produced from the algorithm’s score breakdown, not generated by an LLM.

## API overview

- `GET /health` — API health
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- `GET/PATCH /api/profile/me`, `POST /api/profile/preference-draft`
- `GET/POST /api/groups`, `GET /api/groups/:id`, `PATCH /api/groups/:id/settings`, invitation create/join, recommendation, shortlist, and vote routes
- `GET /api/experiences`, `GET /api/experiences/:id`, and tried-history updates
- `GET /api/events/search` — optional authenticated provider search and catalog refresh
- `POST /api/groups/:id/outings`, outing completion, and one feedback submission per member
- `GET /api/analytics` — actual feedback, novelty, and held-out evaluation summaries
- `GET /health`, `POST /recommendations`, `POST /preferences/parse`, `POST /models/train` — ML service

Every group-scoped endpoint checks membership. Group details and private profile data are not public. The API uses Helmet, CORS allow-listing with credentials, request-size limits, global and authentication rate limits, Zod validation, and parameterized Prisma queries.

## Checks

```powershell
npm run build
npm test
npm run lint
Set-Location ml-service
pytest
```

The configured checks include TypeScript/Vite builds, Vitest/Supertest tests for the API health and unauthenticated group access, Vitest tests for the frontend request helper, and pytest tests for ML health, group hard constraints, and novelty. There are not yet database-backed integration tests for registration, group creation/invitations, or feedback; those require a test database and should be added before calling the backend integration-tested.

## Deploy on Render

The root `render.yaml` defines a free demo with a static frontend, API, ML service, and managed PostgreSQL database. To deploy, connect this GitHub repository to Render and create a Blueprint from the `main` branch. The Blueprint generates the internal ML token and connects the service URLs and database URL automatically. It selects TF-IDF recommendations to stay within the free ML service memory limit; the semantic embedding model is disabled for this demo. The optional Geoapify and OpenAI keys can be added to the relevant service later.

After deployment, wait for the database and services to report healthy, then open the frontend's Render URL. The API applies Prisma migrations at startup and seeds the clearly labeled sample catalog because `SEED_SAMPLE_DATA` is enabled in this free demo Blueprint. Free web services sleep after 15 minutes idle, and free Postgres expires after 30 days, so treat this setup as a demo and do not store important data in it.

## Current deployment and data limitations

- PostgreSQL migrations and seed data must be applied locally before the full product flow can run.
- Live place search requires a Geoapify API key and depends on Geoapify/OpenStreetMap coverage.
- Sample experience prices and attributes are illustrative development data and are labeled as such in the UI.
- Catalog items without verified location or access attributes cannot satisfy a member’s strict travel/accessibility constraint.
- The default rate limiter and model artifact storage are single-instance development defaults; production deployment should configure trusted proxy behavior, a shared rate-limit store, and persistent private model storage.
- No Render account credentials or production data are configured in this repository, so the Blueprint still needs to be created and reviewed in the Render dashboard.
- A valid resume claim should use only measured offline evaluation and actual user outcomes displayed by the analytics page.

## Phase status

The codebase includes the foundation, authentication/profile, groups/invitations, catalog, shortlist/voting, Geoapify place search adapter, recommendation service, feedback/model evaluation, validated preference interpretation, local Docker packaging, and a free Render demo Blueprint. The production deploy step and full end-to-end verification still require a configured Render account and a successful dashboard deployment. Do not treat the repository as production-deployed until that deployment has been checked with real credentials and data.
