CREATE TYPE "GroupRole" AS ENUM ('OWNER', 'MEMBER');
CREATE TYPE "Setting" AS ENUM ('INDOOR', 'OUTDOOR', 'EITHER');
CREATE TYPE "Intensity" AS ENUM ('LOW', 'MODERATE', 'HIGH');
CREATE TYPE "GroupStatus" AS ENUM ('PLANNING', 'COMPLETED', 'CANCELLED');
CREATE TYPE "VoteChoice" AS ENUM ('YES', 'MAYBE', 'NO');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Preference" (
    "userId" TEXT NOT NULL,
    "budgetPerPerson" INTEGER,
    "maxDistanceKm" DOUBLE PRECISION,
    "homeLatitude" DOUBLE PRECISION,
    "homeLongitude" DOUBLE PRECISION,
    "maxDurationMins" INTEGER,
    "preferredTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dislikedTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "preferredTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dislikedTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "setting" "Setting" NOT NULL DEFAULT 'EITHER',
    "maxIntensity" "Intensity" NOT NULL DEFAULT 'HIGH',
    "accessibility" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dietaryNeeds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "naturalLanguage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Preference_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroupPreference" (
    "groupId" TEXT NOT NULL,
    "budgetPerPerson" INTEGER,
    "maxDistanceKm" DOUBLE PRECISION,
    "homeLatitude" DOUBLE PRECISION,
    "homeLongitude" DOUBLE PRECISION,
    "maxDurationMins" INTEGER,
    "setting" "Setting" NOT NULL DEFAULT 'EITHER',
    "maxIntensity" "Intensity" NOT NULL DEFAULT 'HIGH',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupPreference_pkey" PRIMARY KEY ("groupId")
);

CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "priceMin" INTEGER,
    "priceMax" INTEGER,
    "currency" TEXT DEFAULT 'INR',
    "locationName" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "durationMins" INTEGER,
    "setting" "Setting" DEFAULT 'EITHER',
    "intensity" "Intensity" DEFAULT 'MODERATE',
    "socialLevel" INTEGER,
    "adventureLevel" INTEGER,
    "minGroupSize" INTEGER NOT NULL DEFAULT 1,
    "maxGroupSize" INTEGER,
    "accessibilityFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "dietaryOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "source" TEXT NOT NULL DEFAULT 'sample',
    "sourceUrl" TEXT,
    "eventStartsAt" TIMESTAMP(3),
    "eventLocalDate" TEXT,
    "eventLocalTime" TEXT,
    "eventTimeZone" TEXT,
    "bookingUrl" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "isSample" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserExperience" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "triedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserExperience_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Shortlist" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Shortlist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShortlistItem" (
    "id" TEXT NOT NULL,
    "shortlistId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShortlistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "choice" "VoteChoice" NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Outing" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "status" "GroupStatus" NOT NULL DEFAULT 'PLANNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Outing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "outingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "enjoyment" INTEGER NOT NULL,
    "wouldRepeat" BOOLEAN NOT NULL,
    "adventure" INTEGER,
    "socialAtmosphere" INTEGER,
    "valueForMoney" INTEGER,
    "difficulty" INTEGER,
    "comments" TEXT,
    "predictionAtTime" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "featureSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RecommendationRun" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputSnapshot" JSONB NOT NULL,
    "resultSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModelEvaluation" (
    "id" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "selectedModel" TEXT NOT NULL,
    "ratings" INTEGER NOT NULL,
    "outings" INTEGER NOT NULL,
    "mae" DOUBLE PRECISION NOT NULL,
    "baselineMae" DOUBLE PRECISION NOT NULL,
    "candidateMae" JSONB NOT NULL,
    "validationMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModelEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId", "expiresAt");
CREATE UNIQUE INDEX "Membership_groupId_userId_key" ON "Membership"("groupId", "userId");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");
CREATE INDEX "Invitation_groupId_expiresAt_idx" ON "Invitation"("groupId", "expiresAt");
CREATE UNIQUE INDEX "Experience_slug_key" ON "Experience"("slug");
CREATE INDEX "Experience_category_active_idx" ON "Experience"("category", "active");
CREATE INDEX "Experience_priceMin_priceMax_idx" ON "Experience"("priceMin", "priceMax");
CREATE UNIQUE INDEX "UserExperience_userId_experienceId_key" ON "UserExperience"("userId", "experienceId");
CREATE UNIQUE INDEX "Shortlist_groupId_key" ON "Shortlist"("groupId");
CREATE UNIQUE INDEX "ShortlistItem_shortlistId_experienceId_key" ON "ShortlistItem"("shortlistId", "experienceId");
CREATE UNIQUE INDEX "Vote_userId_experienceId_groupId_key" ON "Vote"("userId", "experienceId", "groupId");
CREATE UNIQUE INDEX "Feedback_outingId_userId_key" ON "Feedback"("outingId", "userId");
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE INDEX "RecommendationRun_groupId_createdAt_idx" ON "RecommendationRun"("groupId", "createdAt");
CREATE UNIQUE INDEX "ModelEvaluation_modelVersion_key" ON "ModelEvaluation"("modelVersion");
CREATE INDEX "ModelEvaluation_createdAt_idx" ON "ModelEvaluation"("createdAt");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserExperience" ADD CONSTRAINT "UserExperience_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserExperience" ADD CONSTRAINT "UserExperience_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Shortlist" ADD CONSTRAINT "Shortlist_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_shortlistId_fkey" FOREIGN KEY ("shortlistId") REFERENCES "Shortlist"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShortlistItem" ADD CONSTRAINT "ShortlistItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Outing" ADD CONSTRAINT "Outing_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_outingId_fkey" FOREIGN KEY ("outingId") REFERENCES "Outing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecommendationRun" ADD CONSTRAINT "RecommendationRun_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Preference" ADD CONSTRAINT "Preference_budgetPerPerson_nonnegative" CHECK ("budgetPerPerson" IS NULL OR "budgetPerPerson" >= 0);
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_distance_nonnegative" CHECK ("maxDistanceKm" IS NULL OR "maxDistanceKm" >= 0);
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_home_coordinates_together" CHECK (("homeLatitude" IS NULL) = ("homeLongitude" IS NULL));
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_home_latitude_range" CHECK ("homeLatitude" IS NULL OR "homeLatitude" BETWEEN -90 AND 90);
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_home_longitude_range" CHECK ("homeLongitude" IS NULL OR "homeLongitude" BETWEEN -180 AND 180);
ALTER TABLE "Preference" ADD CONSTRAINT "Preference_duration_positive" CHECK ("maxDurationMins" IS NULL OR "maxDurationMins" > 0);
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_budget_nonnegative" CHECK ("budgetPerPerson" IS NULL OR "budgetPerPerson" >= 0);
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_distance_nonnegative" CHECK ("maxDistanceKm" IS NULL OR "maxDistanceKm" >= 0);
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_home_coordinates_together" CHECK (("homeLatitude" IS NULL) = ("homeLongitude" IS NULL));
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_home_latitude_range" CHECK ("homeLatitude" IS NULL OR "homeLatitude" BETWEEN -90 AND 90);
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_home_longitude_range" CHECK ("homeLongitude" IS NULL OR "homeLongitude" BETWEEN -180 AND 180);
ALTER TABLE "GroupPreference" ADD CONSTRAINT "GroupPreference_duration_positive" CHECK ("maxDurationMins" IS NULL OR "maxDurationMins" > 0);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_price_nonnegative" CHECK (("priceMin" IS NULL OR "priceMin" >= 0) AND ("priceMax" IS NULL OR "priceMax" >= 0));
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_price_order" CHECK ("priceMin" IS NULL OR "priceMax" IS NULL OR "priceMin" <= "priceMax");
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_coordinates_range" CHECK (("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90) AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180));
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_coordinates_together" CHECK (("latitude" IS NULL) = ("longitude" IS NULL));
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_duration_positive" CHECK ("durationMins" IS NULL OR "durationMins" > 0);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_social_level_range" CHECK ("socialLevel" IS NULL OR "socialLevel" BETWEEN 1 AND 5);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_adventure_level_range" CHECK ("adventureLevel" IS NULL OR "adventureLevel" BETWEEN 1 AND 5);
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_group_size_range" CHECK ("minGroupSize" > 0 AND ("maxGroupSize" IS NULL OR "maxGroupSize" >= "minGroupSize"));
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_rating_range" CHECK ("enjoyment" BETWEEN 1 AND 5 AND ("adventure" IS NULL OR "adventure" BETWEEN 1 AND 5) AND ("socialAtmosphere" IS NULL OR "socialAtmosphere" BETWEEN 1 AND 5) AND ("valueForMoney" IS NULL OR "valueForMoney" BETWEEN 1 AND 5) AND ("difficulty" IS NULL OR "difficulty" BETWEEN 1 AND 5) AND ("predictionAtTime" IS NULL OR "predictionAtTime" BETWEEN 1 AND 5));
