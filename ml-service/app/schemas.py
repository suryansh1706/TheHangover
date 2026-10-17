from typing import Literal

from pydantic import BaseModel, Field


class MemberPreference(BaseModel):
    userId: str
    preferredTypes: list[str] = Field(default_factory=list)
    dislikedTypes: list[str] = Field(default_factory=list)
    preferredTags: list[str] = Field(default_factory=list)
    dislikedTags: list[str] = Field(default_factory=list)
    budgetPerPerson: int | None = Field(default=None, ge=0)
    maxDurationMins: int | None = Field(default=None, ge=1, le=1440)
    maxDistanceKm: float | None = Field(default=None, ge=0, le=5000)
    homeLatitude: float | None = Field(default=None, ge=-90, le=90)
    homeLongitude: float | None = Field(default=None, ge=-180, le=180)
    accessibility: list[str] = Field(default_factory=list)
    dietaryNeeds: list[str] = Field(default_factory=list)
    maxIntensity: Literal["LOW", "MODERATE", "HIGH"] = "HIGH"
    setting: Literal["INDOOR", "OUTDOOR", "EITHER"] = "EITHER"
    naturalLanguage: str | None = None
    triedIds: list[str] = Field(default_factory=list)


class Activity(BaseModel):
    id: str
    name: str
    description: str
    category: str
    tags: list[str] = Field(default_factory=list)
    priceMax: int | None = None
    setting: Literal["INDOOR", "OUTDOOR", "EITHER"] | None = "EITHER"
    intensity: Literal["LOW", "MODERATE", "HIGH"] | None = "MODERATE"
    adventureLevel: int | None = None
    socialLevel: int | None = None
    currency: str | None = "INR"
    durationMins: int | None = None
    minGroupSize: int = 1
    maxGroupSize: int | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    accessibilityFeatures: list[str] = Field(default_factory=list)
    dietaryOptions: list[str] = Field(default_factory=list)
    isSample: bool = True


class GroupConstraints(BaseModel):
    budgetPerPerson: int | None = Field(default=None, ge=0)
    maxDurationMins: int | None = Field(default=None, ge=1, le=1440)
    maxDistanceKm: float | None = Field(default=None, ge=0, le=5000)
    homeLatitude: float | None = Field(default=None, ge=-90, le=90)
    homeLongitude: float | None = Field(default=None, ge=-180, le=180)
    setting: Literal["INDOOR", "OUTDOOR", "EITHER"] = "EITHER"
    maxIntensity: Literal["LOW", "MODERATE", "HIGH"] = "HIGH"


class RecommendationRequest(BaseModel):
    groupId: str
    members: list[MemberPreference] = Field(min_length=1)
    groupConstraints: GroupConstraints = Field(default_factory=lambda: GroupConstraints())
    activities: list[Activity]
    limit: int = Field(default=10, ge=1, le=50)
    modelVersion: str = "content-v1"


class Recommendation(BaseModel):
    activityId: str
    score: float
    memberScores: dict[str, float]
    memberFeatures: dict[str, dict[str, float]]
    predictedEnjoyment: dict[str, float] = Field(default_factory=dict)
    breakdown: dict[str, float | bool]
    reasons: list[str]


class RecommendationResponse(BaseModel):
    modelVersion: str
    textMethod: str
    recommendations: list[Recommendation]
    enjoymentModelVersion: str | None = None


class TrainingRow(BaseModel):
    outingId: str
    userId: str
    enjoyment: int = Field(ge=1, le=5)
    features: dict[str, float]


class TrainingRequest(BaseModel):
    rows: list[TrainingRow]


class PreferenceDraft(BaseModel):
    budgetPerPerson: int | None = Field(default=None, ge=0, le=1_000_000)
    maxDistanceKm: float | None = Field(default=None, ge=0, le=5000)
    maxDurationMins: int | None = Field(default=None, ge=1, le=1440)
    preferredTypes: list[str] = Field(default_factory=list)
    dislikedTypes: list[str] = Field(default_factory=list)
    preferredTags: list[str] = Field(default_factory=list)
    dislikedTags: list[str] = Field(default_factory=list)
    accessibility: list[str] = Field(default_factory=list)
    dietaryNeeds: list[str] = Field(default_factory=list)
    setting: Literal["INDOOR", "OUTDOOR", "EITHER"] = "EITHER"
    maxIntensity: Literal["LOW", "MODERATE", "HIGH"] = "HIGH"


class PreferenceParseRequest(BaseModel):
    text: str = Field(min_length=3, max_length=1000)


class PreferenceParseResponse(BaseModel):
    draft: PreferenceDraft
    method: str
    needsReview: bool = True
