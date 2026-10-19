# The Hangover

The Hangover helps a group decide what to do together. It finds real places, checks what each person likes, makes a ranked list, and gives the group tools to save and vote on ideas. After an outing, people can say how it went. That feedback can help improve future predictions.

This guide explains the app, its data, and its recommendation system in everyday language.

## What happens when someone uses the app

1. A person creates an account and fills in preferences such as favorite activities, budget, travel distance, and accessibility or dietary needs.
2. They create a group and invite friends with a link. An invited person opens the link, signs in if needed, and joins the group.
3. The group searches for nearby places. The app asks Geoapify for place listings based on OpenStreetMap data.
4. The app removes places that clearly break a known filter, then sorts the remaining places. Unknown details are allowed through with a small ranking penalty.
5. The group saves ideas, votes on them, and can mark places they have already tried.
6. After an outing, each person can rate how much they enjoyed it. When enough ratings exist, the app can train a small model to estimate enjoyment.

## How the pieces fit together

```text
Web browser (React)
    | asks for places, groups, and recommendations
    v
Backend API (Express) <----> PostgreSQL database
    |
    +----> Geoapify place search
    |
    +----> ML service (FastAPI, Python)
```

- **Frontend (`frontend/`)** is the website people use. React draws pages and TypeScript helps catch mistakes in the data passed between pages.
- **Backend (`backend/`)** is the app's rule keeper. It checks requests, confirms group access, talks to the database, searches for places, and asks the ML service to rank group picks.
- **Database (PostgreSQL)** remembers accounts, preferences, groups, places, votes, and feedback. Prisma describes these records and safely sends database queries.
- **ML service (`ml-service/`)** compares people with places and returns ranked picks. It is separate so its Python data-science tools can be used without making the web API do that work.
- **Geoapify** supplies real-world place listings and coordinates. OpenStreetMap contributors provide much of the underlying map information. The app does not invent a place's price, hours, route, or availability.
- **Docker Compose** can start a local database and, if wanted, the app services together.

## Find places

The place search lives in `backend/src/services/places.service.ts`. The `/api/places` route checks the search request and calls this service.

### Search with no filters

When someone has not entered a keyword or filters, the service asks Geoapify for named places in hangout categories such as cafes, restaurants, ice-cream shops, cinemas, museums, parks, zoos, attractions, and sights. It asks for one page of up to 100 places. Named places are used because an unnamed map feature is not a useful suggestion to most people.

The service gives each place a simple popularity score. It adds points for details that often indicate a well-documented place: Wikidata or Wikipedia, a website, a brand, opening hours, and a phone number. It subtracts points as distance increases. The service returns up to 10 places at a time, and Discover can request the next page with **Load more**. The provider result is bounded to about 200 candidates so ranking does not grow without limit.

### Search with filters

Keyword and category searches use the matching place categories and text. Budget, duration, intensity, setting, and distance can also affect which places fit. A known value that clearly breaks a filter removes the place. If the value is not listed, the place can still appear, but it ranks lower and carries a `missingFields` flag. This avoids pretending that a place is too expensive or unsuitable when its listing simply has no such detail.

Every result can include:

- `missingFields`: details the listing does not verify, such as price, duration, setting, or distance.
- `matchedFilters`: filters for which the place has a known match.
- `distanceKm` and `popularityScore`: signals used to order nearby places.
- `hasMore` and `nextOffset`: whether another page can be requested.

Discover shows **Details unverified** when important information is missing. Geoapify results are cached in memory for 60 seconds for the same location and filters. The cache lets quick repeat searches reuse results; it clears when the service restarts. Results and coverage depend on what Geoapify/OpenStreetMap has for that area. A `GEOAPIFY_API_KEY` is needed for live search.

## How group recommendations work

Recommendation happens in two broad steps: first find a manageable set of possible places, then rank those places for the group. Ranking is a collection of visible rules and scores; an AI chat bot does not make up the picks.

### 1. Gather possible places

Discover sends the current nearby places and filter signals with the group request. The backend also looks in the saved place catalog. Database queries allow a place through when a filtered field is either unknown or a possible match. This means an empty price or duration does not automatically hide the place. The ML service only scores a capped set of about 200 candidates so a very large catalog does not make every request slow.

### 2. Remove known bad fits

The service checks each place against group limits and each person's preferences. A known over-budget price, too-long duration, conflicting setting or intensity, explicit dislike, or listed accessibility/dietary conflict can rule a place out. Missing information is not treated as proof of a conflict. It passes with a score penalty instead.

Distance uses the Haversine formula. That formula measures the straight line between two coordinates on a round Earth. It is useful for comparing nearby places, but it is not a driving, walking, or transit route.

### 3. Score and sort the remaining places

The score balances several clues:

- **Preference fit:** how the place's category and tags match each person's likes and dislikes.
- **Text similarity:** whether the place description resembles a person's preferred types, tags, or written preferences.
- **Popularity and proximity:** well-documented places nearby get a boost.
- **Group fit:** a place that works reasonably well for everyone is preferred over one that only suits a single member.
- **Novelty:** the service checks who has marked a place as tried and favors places that are new to more members.
- **Variety:** category diversification helps prevent a list made up of near-identical suggestions.
- **Missing details:** unknown fields receive a small penalty, rather than being treated as a known failure.

The final order is based on relevance and preference fit, plus popularity and closeness, minus missing-data penalties. Results include grounded reasons and the `missingFields` and `matchedFilters` signals. The UI can therefore explain both why a pick ranked well and which details still need checking.

### Text and embeddings

When enabled, the recommender uses the `all-MiniLM-L6-v2` sentence encoder to turn place descriptions and preference text into lists of numbers called **embeddings**. Similar meanings tend to have similar number patterns, even when they use different words. The recommender compares these patterns to estimate semantic fit.

The service caches text vectors in memory and encodes missing texts together in batches of up to 64. Batching avoids repeatedly starting the encoder for every individual place. The encoder and saved enjoyment model are loaded at service startup so the first recommendation request does not need to do that work. If semantic encoding is disabled or cannot load, the service uses a TF-IDF text matching fallback. TF-IDF gives more weight to words that help distinguish one description from another.

## Feedback, machine learning, and data science

The normal recommendation score works before the app has learned from any outings. It uses place details, member preferences, and clear scoring rules. A separate optional model can learn to estimate enjoyment from real feedback after the group has tried activities.

### What gets learned

After a completed outing, members can rate enjoyment and whether they would repeat it. They can also rate adventure, social atmosphere, value for money, and difficulty. The app saves that feedback with a snapshot of the place and the prediction/model version, if one was used. The snapshot matters because a place record or model may change later; the saved snapshot shows what was known at the time.

The training code in `ml-service/app/model.py` waits for at least 30 feature-linked ratings from at least 5 separate outings. It builds features from known place and feedback details, then compares a simple average predictor, Ridge regression, and a random forest. These are small statistical models:

- The **mean baseline** always predicts the average rating. It is the simple score a more advanced model should try to beat.
- **Ridge regression** learns how input details tend to move a rating up or down, while limiting overly large effects.
- A **random forest** combines many decision trees so it can learn more complicated combinations of details.

The service checks candidate models with GroupKFold validation grouped by outing. Keeping one outing's feedback together helps prevent ratings from the same event leaking into both learning and checking data. It reports mean absolute error (MAE), which is the average size of the prediction mistake in rating points. The selected model is only useful if its measured results are better enough than the baseline; a prediction is never a guarantee of enjoyment.

Training saves the model locally under `ml-service/data/` and reloads it after training. Until a model is trained, recommendations still work using the preference and content scoring rules. Analytics summarize submitted feedback and model evaluation; observed later prediction errors and held-out validation results are shown as different things.

### What the app does not claim

The popularity score is a small ranking heuristic, not a measured count of visitors. A place being nearby does not mean it is open now or reachable by a particular route. An embedding measures text similarity, not a person's feelings. The enjoyment model learns from the ratings that have actually been submitted and can be uncertain, especially with little data. Recommendation explanations come from score signals, not generated text.

## Groups and invitations

An owner can create an invitation link from a group's page. The link contains a secret token. The database stores a hash of the token, and the invite expires after seven days and can be used once. Opening it takes the invitee to the app; they sign in or create an account if needed, then the app joins them to the group.

The link can be copied or shared with the device's share menu. **Email invite** opens the person's email application with a message already filled in. The app does not send email itself. Group-only routes check membership before returning private group information.

## Information the database keeps

The Prisma schema is in `backend/prisma/schema.prisma`. In short, it stores:

- **Users, sessions, and preferences:** account details, hashed session tokens, interests, limits, accessibility/dietary needs, and optional written preferences. Passwords are bcrypt-hashed; sessions are delivered in HTTP-only cookies.
- **Groups, memberships, and invitations:** who belongs to a group, its shared limits, and hashed, expiring invite tokens.
- **Experiences:** place descriptions, categories, tags, source links, coordinates, and any known price, duration, setting, or intensity. Unknown values stay empty instead of being guessed.
- **Tried history, shortlists, and votes:** what members have tried, saved, and voted yes/maybe/no on.
- **Outings and feedback:** completed plans, member ratings, and the feature/model snapshot for later analysis.
- **Recommendation runs and model evaluations:** saved inputs/results and measured training scores for analytics and debugging.

## Local setup

### Requirements

- Node.js 22 or newer and npm
- Python 3.11 or newer
- Docker Desktop with Compose, or a PostgreSQL 16 database
- A Geoapify API key for live place search

### Start the services

From PowerShell in the repository folder:

```powershell
Copy-Item .env.example .env
# Set ML_SERVICE_TOKEN to a new random secret in .env.
Copy-Item .env backend\.env
docker compose up -d postgres
npm install
npm run db:generate --workspace backend
npm run db:migrate --workspace backend
```

Set `GEOAPIFY_API_KEY` in `backend\.env` to enable place search. Keep secrets private and do not commit `.env` files.

Open three terminals in the repository folder and start each service:

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

The website runs at `http://localhost:5173`, the backend at `http://localhost:4000`, and the ML service at `http://localhost:8000`.

To run the packaged app stack with Docker instead, configure `.env`, then use:

```powershell
docker compose --profile app up --build -d
docker compose ps
```

The API container applies database migrations when it starts. Stop the containers with `docker compose --profile app down`. Adding `-v` also deletes local database and saved-model volumes.

## Main code locations

```text
frontend/                         Website pages, components, and API hooks
  src/pages/DiscoverPage.tsx      Place search, nearby results, and group picks
  src/components/ExperienceCard.tsx Place details, votes, and unverified badge
backend/                          Express API and database access
  src/services/places.service.ts  Geoapify search, caching, place ranking, and saving
  src/routes/groups.routes.ts     Group, invite, shortlist, vote, and recommendation routes
  prisma/schema.prisma            Database record definitions
  prisma/migrations/              Versioned database changes
ml-service/                       Python recommendation and learning service
  app/recommender.py              Text matching, group filters, and ranking
  app/model.py                    Enjoyment model training and prediction
  app/main.py                     ML API and startup model loading
docker-compose.yml                Local database and optional full app stack
render.yaml                       Render demo service setup
```

## API map

The backend health check is `GET /health`. Main API areas are:

- `/api/auth`: register, log in, log out, and check the current session.
- `/api/profile/me`: read or update the current person's preferences.
- `/api/groups`: create and view groups, update group settings, create or use invitation links, request recommendations, and manage shortlists and votes.
- `/api/experiences`: browse saved experiences and update tried history.
- `/api/places/search`: search Geoapify and save returned places in the catalog.
- `/api/groups/:groupId/outings`: create an outing for a group.
- `/api/outings/:outingId/complete` and `/api/outings/:outingId/feedback`: finish an outing and submit member feedback.
- `/api/analytics`: view feedback and model evaluation summaries.

The ML service has `GET /health`, `POST /recommendations`, and `POST /models/train`. Backend-to-ML requests can use `ML_SERVICE_TOKEN` for service authentication. Exact input rules are validated by Zod in the backend and Pydantic in the ML service.

## Request and account safety

The backend checks incoming data with Zod, limits JSON request size, applies request rate limits, and sets common security headers with Helmet. Browser requests are limited to the configured frontend origin, with cookies enabled for signed-in requests. Passwords and invitation/session tokens are not stored as plain text. Private group routes require a signed-in member. These protections reduce common risks, but a public production service still needs its secrets, allowed website origins, database access, backups, and hosting settings configured carefully.

## Checks

Run the checks from the repository root when changing code:

```powershell
npm run build
npm test
npm run lint
Set-Location ml-service
pytest
```

The repository includes frontend and backend tests, plus ML tests. Database-backed flows such as account creation, invitations, and feedback need a test database for full integration coverage.

## Demo deployment

The root `render.yaml` describes a Render demo with a static frontend, API, ML service, and managed PostgreSQL database. Connect the repository to Render and create a Blueprint from the `main` branch. The Blueprint wires service URLs and creates an internal ML token. The free demo selects TF-IDF so it can stay within the ML service memory limit; semantic embeddings are disabled there. Add a Geoapify key to the backend service to enable live searches.

Wait for the database and services to report healthy before opening the frontend URL. The API applies Prisma migrations on startup. Free web services can sleep after 15 minutes without traffic, and the free database expires after 30 days. This setup is for trying the app, not storing important data. A real deployment still needs its settings, data retention, model storage, and service health checked in the provider dashboard.

## Small glossary

- **Candidate:** a place that might become a recommendation.
- **Retrieve then rank:** first find possible places, then sort them by how well they fit.
- **Popularity score:** points for public listing details, reduced by distance. It is not a visitor count.
- **Embedding:** numbers that represent the meaning of a piece of text.
- **TF-IDF:** a simpler way to compare text by giving useful words more weight.
- **Missing field:** a detail the listing does not tell us. It is unverified, not automatically bad.
- **MAE:** the average distance between a model's predicted rating and the real rating.
