from __future__ import annotations

from functools import lru_cache
import os
from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from app.schemas import Activity, GroupConstraints, MemberPreference, RecommendationRequest
from app.model import feature_vector, predict_enjoyment

INTENSITY = {"LOW": 1, "MODERATE": 2, "HIGH": 3}


@lru_cache(maxsize=1)
def _load_encoder() -> Any:
    from sentence_transformers import SentenceTransformer

    return SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")


_TEXT_VECTOR_CACHE: dict[str, np.ndarray] = {}


def _cached_text_vectors(texts: list[str]) -> np.ndarray:
    missing = list(dict.fromkeys(text for text in texts if text not in _TEXT_VECTOR_CACHE))
    if missing:
        vectors = _load_encoder().encode(missing, batch_size=64, normalize_embeddings=True)
        for text, vector in zip(missing, vectors):
            _TEXT_VECTOR_CACHE[text] = np.asarray(vector, dtype=float)
    if not texts:
        return np.empty((0, 0), dtype=float)
    return np.asarray([_TEXT_VECTOR_CACHE[text] for text in texts])


def preload_encoder() -> None:
    _load_encoder()


def _texts(request: RecommendationRequest) -> tuple[list[str], list[str]]:
    activity_text = [f"{x.name}. {x.description}. {x.category}. {' '.join(x.tags)}" for x in request.activities]
    member_text = [" ".join([*(m.preferredTypes), *(m.preferredTags), m.naturalLanguage or ""]) for m in request.members]
    return activity_text, member_text


def _similarities(request: RecommendationRequest) -> tuple[np.ndarray, str]:
    if not request.activities:
        return np.zeros((len(request.members), 0)), "none"
    activity_text, member_text = _texts(request)
    if os.getenv("USE_SEMANTIC_ENCODER", "true").casefold() in {"0", "false", "no"}:
        return _tfidf_similarities(activity_text, member_text)
    try:
        vectors = _cached_text_vectors(activity_text + member_text)
        activity_vectors = vectors[:len(activity_text)]
        member_vectors = vectors[len(activity_text):]
        return member_vectors @ activity_vectors.T, "all-MiniLM-L6-v2"
    except Exception:
        return _tfidf_similarities(activity_text, member_text)


def _tfidf_similarities(activity_text: list[str], member_text: list[str]) -> tuple[np.ndarray, str]:
    corpus = activity_text + member_text
    matrix = TfidfVectorizer(ngram_range=(1, 2), strip_accents="unicode").fit_transform(corpus)
    member_matrix = matrix[len(activity_text):]
    activity_matrix = matrix[:len(activity_text)]
    return cosine_similarity(member_matrix, activity_matrix), "tfidf-fallback"


def _blocked(activity: Activity, member: MemberPreference) -> bool:
    category = activity.category.casefold()
    tags = {tag.casefold() for tag in activity.tags}
    dislikes = {item.casefold() for item in [*member.dislikedTypes, *member.dislikedTags]}
    if category in dislikes or tags.intersection(dislikes):
        return True
    if member.budgetPerPerson is not None and (activity.currency != "INR" or activity.priceMax is None or activity.priceMax > member.budgetPerPerson):
        return True
    if member.maxDurationMins is not None and (activity.durationMins is None or activity.durationMins > member.maxDurationMins):
        return True
    if activity.intensity is None and member.maxIntensity != "HIGH":
        return True
    if activity.intensity is not None and INTENSITY[activity.intensity] > INTENSITY[member.maxIntensity]:
        return True
    if member.setting != "EITHER" and activity.setting not in (member.setting, "EITHER"):
        return True
    if member.accessibility and not {value.casefold() for value in member.accessibility}.issubset({value.casefold() for value in activity.accessibilityFeatures}):
        return True
    if member.dietaryNeeds and not {value.casefold() for value in member.dietaryNeeds}.issubset({value.casefold() for value in activity.dietaryOptions}):
        return True
    if member.maxDistanceKm is not None:
        if member.homeLatitude is None or member.homeLongitude is None or activity.latitude is None or activity.longitude is None:
            return True
        if _distance_km(member.homeLatitude, member.homeLongitude, activity.latitude, activity.longitude) > member.maxDistanceKm:
            return True
    return False


def _distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    lat1, lat2 = np.radians([lat1, lat2])
    dlat = lat2 - lat1
    dlon = np.radians(lon2 - lon1)
    haversine = np.sin(dlat / 2) ** 2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon / 2) ** 2
    return float(6371.0 * 2 * np.arcsin(np.sqrt(haversine)))


def _blocked_by_group(activity: Activity, constraints: GroupConstraints) -> bool:
    if constraints.budgetPerPerson is not None and (activity.currency != "INR" or activity.priceMax is None or activity.priceMax > constraints.budgetPerPerson):
        return True
    if constraints.maxDurationMins is not None and (activity.durationMins is None or activity.durationMins > constraints.maxDurationMins):
        return True
    if constraints.maxIntensity != "HIGH":
        if activity.intensity is None or INTENSITY[activity.intensity] > INTENSITY[constraints.maxIntensity]:
            return True
    if constraints.setting != "EITHER" and activity.setting not in (constraints.setting, "EITHER"):
        return True
    if constraints.maxDistanceKm is not None:
        if constraints.homeLatitude is None or constraints.homeLongitude is None or activity.latitude is None or activity.longitude is None:
            return True
        if _distance_km(constraints.homeLatitude, constraints.homeLongitude, activity.latitude, activity.longitude) > constraints.maxDistanceKm:
            return True
    return False


def _structured(activity: Activity, member: MemberPreference) -> float:
    preferences = {x.casefold() for x in [*member.preferredTypes, *member.preferredTags]}
    if not preferences:
        return 0.5
    features = {activity.category.casefold(), *(x.casefold() for x in activity.tags)}
    return len(features.intersection(preferences)) / max(1, len(preferences))


def recommend(request: RecommendationRequest) -> dict[str, Any]:
    if not request.members:
        return {"modelVersion": request.modelVersion, "textMethod": "none", "enjoymentModelVersion": None, "recommendations": []}
    similarities, text_method = _similarities(request)
    enjoyment_model_version: str | None = None
    candidates: list[dict[str, Any]] = []
    for activity_index, activity in enumerate(request.activities):
        if _blocked_by_group(activity, request.groupConstraints) or any(_blocked(activity, member) for member in request.members):
            continue
        if len(request.members) < activity.minGroupSize or (activity.maxGroupSize is not None and len(request.members) > activity.maxGroupSize):
            continue
        per_member: dict[str, float] = {}
        member_features: dict[str, dict[str, float]] = {}
        structured_scores: list[float] = []
        for member_index, member in enumerate(request.members):
            cosine = float(similarities[member_index, activity_index])
            semantic = float(np.clip((cosine + 1) / 2, 0, 1))
            structured = _structured(activity, member)
            structured_scores.append(structured)
            per_member[member.userId] = round(0.65 * semantic + 0.35 * structured, 4)
            member_features[member.userId] = feature_vector(member, activity)
        predicted_values, current_model = predict_enjoyment([member_features[member.userId] for member in request.members])
        if predicted_values is not None:
            enjoyment_model_version = current_model
            for member_index, member in enumerate(request.members):
                rating = predicted_values[member_index]
                per_member[member.userId] = round(0.4 * per_member[member.userId] + 0.6 * ((rating - 1) / 4), 4)
        predicted_ratings = {member.userId: round(predicted_values[index], 2) for index, member in enumerate(request.members)} if predicted_values is not None else {}
        mean_score = float(np.mean(list(per_member.values())))
        lowest_member = min(per_member.values())
        tried_count = sum(activity.id in member.triedIds for member in request.members)
        novelty = 1 - tried_count / len(request.members)
        group_score = 0.55 * lowest_member + 0.25 * mean_score + 0.20 * novelty
        candidates.append({
            "activity": activity,
            "score": group_score,
            "memberScores": per_member,
            "memberFeatures": member_features,
            "predictedEnjoyment": predicted_ratings,
            "mean": mean_score,
            "lowest": lowest_member,
            "novelty": novelty,
            "triedCount": tried_count,
            "structured": float(np.mean(structured_scores)),
        })

    candidates.sort(key=lambda item: item["score"], reverse=True)
    chosen: list[dict[str, Any]] = []
    seen_categories: dict[str, int] = {}
    while candidates and len(chosen) < request.limit:
        best_index = max(
            range(len(candidates)),
            key=lambda index: candidates[index]["score"] - 0.08 * seen_categories.get(candidates[index]["activity"].category, 0),
        )
        item = candidates.pop(best_index)
        activity = item["activity"]
        seen_categories[activity.category] = seen_categories.get(activity.category, 0) + 1
        reasons = []
        if item["triedCount"] == 0:
            reasons.append("Nobody in the group has tried this activity.")
        elif item["novelty"] > 0:
            reasons.append(f"It is new to {len(request.members) - item['triedCount']} of {len(request.members)} group members.")
        if item["structured"] >= 0.5:
            reasons.append("It matches one or more stated group interests.")
        if item["lowest"] >= 0.55:
            reasons.append("Its preference fit is reasonably balanced across members.")
        chosen.append({
            "activityId": activity.id,
            "score": round(item["score"], 4),
            "memberScores": item["memberScores"],
            "memberFeatures": item["memberFeatures"],
            "predictedEnjoyment": item["predictedEnjoyment"],
            "breakdown": {
                "meanPreferenceFit": round(item["mean"], 4),
                "lowestMemberFit": round(item["lowest"], 4),
                "novelty": round(item["novelty"], 4),
                "triedByCount": item["triedCount"],
                "meetsHardConstraints": True,
            },
            "reasons": reasons,
        })
    return {"modelVersion": request.modelVersion, "textMethod": text_method, "enjoymentModelVersion": enjoyment_model_version, "recommendations": chosen}
