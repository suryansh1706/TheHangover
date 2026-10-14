from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import joblib
import pandas as pd
from sklearn.dummy import DummyRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.feature_extraction import DictVectorizer
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import GroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.linear_model import Ridge

from app.schemas import Activity, MemberPreference

_MODEL_LOADED = False
_MODEL_STATE: tuple[Any | None, str | None] = (None, None)


def _model_path() -> Path:
    return Path(os.getenv("ENJOYMENT_MODEL_PATH", "./data/enjoyment.joblib"))


def feature_vector(member: MemberPreference, activity: Activity) -> dict[str, float]:
    features: dict[str, float] = {
        "price_max": float(activity.priceMax if activity.priceMax is not None else -1),
        "duration_mins": float(activity.durationMins if activity.durationMins is not None else -1),
        "adventure_level": float(activity.adventureLevel if activity.adventureLevel is not None else -1),
        "social_level": float(activity.socialLevel if activity.socialLevel is not None else -1),
        "member_budget": float(member.budgetPerPerson if member.budgetPerPerson is not None else -1),
        "member_max_duration": float(member.maxDurationMins if member.maxDurationMins is not None else -1),
        "structured_interest_overlap": float(_overlap(activity, member)),
        "group_novelty_for_member": float(activity.id not in member.triedIds),
    }
    if activity.currency:
        features[f"currency:{activity.currency.casefold()}"] = 1.0
    if activity.category:
        features[f"category:{activity.category.casefold()}"] = 1.0
    if activity.setting:
        features[f"setting:{activity.setting.casefold()}"] = 1.0
    if activity.intensity:
        features[f"intensity:{activity.intensity.casefold()}"] = 1.0
    for tag in activity.tags:
        features[f"activity_tag:{tag.casefold()}"] = 1.0
    for value in member.preferredTypes:
        features[f"member_pref_type:{value.casefold()}"] = 1.0
    for value in member.preferredTags:
        features[f"member_pref_tag:{value.casefold()}"] = 1.0
    for value in member.dislikedTypes:
        features[f"member_disliked_type:{value.casefold()}"] = 1.0
    for value in member.dislikedTags:
        features[f"member_disliked_tag:{value.casefold()}"] = 1.0
    return features


def _overlap(activity: Activity, member: MemberPreference) -> float:
    preferences = {item.casefold() for item in [*member.preferredTypes, *member.preferredTags]}
    if not preferences:
        return 0.5
    attributes = {activity.category.casefold(), *(tag.casefold() for tag in activity.tags)}
    return len(preferences.intersection(attributes)) / max(1, len(preferences))


def load_model() -> tuple[Any | None, str | None]:
    global _MODEL_LOADED, _MODEL_STATE
    if _MODEL_LOADED:
        return _MODEL_STATE
    path = _model_path()
    if not path.exists():
        _MODEL_LOADED = True
        return _MODEL_STATE
    stored = joblib.load(path)
    _MODEL_STATE = (stored["model"], stored["version"])
    _MODEL_LOADED = True
    return _MODEL_STATE


def predict_enjoyment(rows: list[dict[str, float]]) -> tuple[list[float] | None, str | None]:
    if not rows:
        return [], None
    model, version = load_model()
    if model is None:
        return None, None
    values = model.predict(rows)
    return [float(max(1, min(5, value))) for value in values], version


def train(rows: list[dict[str, Any]]) -> dict[str, Any]:
    global _MODEL_LOADED, _MODEL_STATE
    frame = pd.DataFrame(rows)
    if frame.empty:
        return {"trained": False, "reason": "No feedback with a logged feature snapshot is available."}
    if len(frame) < 30 or frame["outingId"].nunique() < 5:
        return {"trained": False, "reason": "Collect at least 30 feature-linked ratings across 5 separate outings before fitting a model.", "ratings": len(frame), "outings": int(frame["outingId"].nunique())}
    feature_rows = frame["features"].tolist()
    target = frame["enjoyment"].astype(float).to_numpy()
    groups = frame["outingId"].astype(str).to_numpy()
    folds = min(5, int(frame["outingId"].nunique()))
    path = _model_path()
    if path.exists():
        try:
            old = joblib.load(path)
            if len(frame) < int(old.get("sampleCount", 0)) + 10:
                return {"trained": False, "reason": "The saved model is current; at least 10 new feature-linked ratings are needed before retraining.", "ratings": len(frame), "modelVersion": old.get("version")}
        except Exception:
            pass
    splitter = GroupKFold(n_splits=folds)
    candidates: dict[str, Pipeline] = {
        "mean-baseline": Pipeline([("features", DictVectorizer()), ("model", DummyRegressor(strategy="mean"))]),
        "ridge-v1": Pipeline([("features", DictVectorizer()), ("model", Ridge(alpha=1.0))]),
        "random-forest-v1": Pipeline([("features", DictVectorizer()), ("model", RandomForestRegressor(n_estimators=200, min_samples_leaf=2, random_state=42, n_jobs=1))]),
    }
    results: dict[str, float] = {}
    for name, candidate in candidates.items():
        predicted = cross_val_predict(candidate, feature_rows, target, groups=groups, cv=splitter)
        results[name] = float(mean_absolute_error(target, predicted))
    winner_name = min(results, key=results.get)
    winner = candidates[winner_name].fit(feature_rows, target)
    version = f"{winner_name}-n{len(frame)}"
    path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": winner, "version": version, "sampleCount": len(frame)}, path)
    _MODEL_STATE = (winner, version)
    _MODEL_LOADED = True
    return {"trained": True, "modelVersion": version, "ratings": len(frame), "outings": int(frame["outingId"].nunique()), "mae": round(results[winner_name], 4), "baselineMae": round(results["mean-baseline"], 4), "candidateMae": {name: round(value, 4) for name, value in results.items()}, "selectedModel": winner_name, "validation": "GroupKFold grouped by outing ID"}
