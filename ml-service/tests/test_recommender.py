import numpy as np

from app import recommender
from app.schemas import Activity, GroupConstraints, MemberPreference, RecommendationRequest


def test_group_novelty_breaks_ties(monkeypatch) -> None:
    members = [MemberPreference(userId="a"), MemberPreference(userId="b", triedIds=["old"])]
    activities = [
        Activity(id="old", name="Old", description="similar", category="Games"),
        Activity(id="new", name="New", description="similar", category="Creative"),
    ]
    monkeypatch.setattr(recommender, "_similarities", lambda _: (np.array([[0.7, 0.7], [0.7, 0.7]]), "test"))

    result = recommender.recommend(RecommendationRequest(groupId="g", members=members, activities=activities))

    assert result["recommendations"][0]["activityId"] == "new"
    assert result["recommendations"][0]["breakdown"]["novelty"] == 1


def test_one_member_hard_dislike_excludes_activity(monkeypatch) -> None:
    members = [MemberPreference(userId="a"), MemberPreference(userId="b", dislikedTypes=["Adventure"])]
    activities = [Activity(id="kart", name="Karting", description="race", category="Adventure")]
    monkeypatch.setattr(recommender, "_similarities", lambda _: (np.array([[0.9], [0.9]]), "test"))

    result = recommender.recommend(RecommendationRequest(groupId="g", members=members, activities=activities))

    assert result["recommendations"] == []


def test_price_and_intensity_are_hard_constraints(monkeypatch) -> None:
    member = MemberPreference(userId="a", budgetPerPerson=1000, maxIntensity="LOW")
    activities = [
        Activity(id="price", name="Pricey", description="", category="Creative", priceMax=1200, intensity="LOW"),
        Activity(id="effort", name="Hard", description="", category="Outdoors", priceMax=500, intensity="HIGH"),
    ]
    monkeypatch.setattr(recommender, "_similarities", lambda _: (np.array([[0.8, 0.8]]), "test"))

    result = recommender.recommend(RecommendationRequest(groupId="g", members=[member], activities=activities))

    assert result["recommendations"] == []


def test_group_budget_and_duration_are_hard_constraints(monkeypatch) -> None:
    activities = [
        Activity(id="cheap", name="Cheap", description="", category="Creative", priceMax=500, durationMins=60),
        Activity(id="pricey", name="Pricey", description="", category="Creative", priceMax=1500, durationMins=60),
        Activity(id="long", name="Long", description="", category="Creative", priceMax=500, durationMins=180),
    ]
    monkeypatch.setattr(recommender, "_similarities", lambda _: (np.array([[0.8, 0.8, 0.8]]), "test"))

    result = recommender.recommend(RecommendationRequest(
        groupId="g",
        members=[MemberPreference(userId="a")],
        groupConstraints=GroupConstraints(budgetPerPerson=1000, maxDurationMins=90),
        activities=activities,
    ))

    assert [item["activityId"] for item in result["recommendations"]] == ["cheap"]


def test_group_distance_requires_known_coordinates_and_enforces_radius(monkeypatch) -> None:
    activities = [
        Activity(id="near", name="Near", description="", category="Creative", latitude=12.9716, longitude=77.5946),
        Activity(id="far", name="Far", description="", category="Creative", latitude=19.0760, longitude=72.8777),
        Activity(id="unknown", name="Unknown", description="", category="Creative"),
    ]
    monkeypatch.setattr(recommender, "_similarities", lambda _: (np.array([[0.8, 0.8, 0.8]]), "test"))

    result = recommender.recommend(RecommendationRequest(
        groupId="g",
        members=[MemberPreference(userId="a")],
        groupConstraints=GroupConstraints(maxDistanceKm=25, homeLatitude=12.9716, homeLongitude=77.5946),
        activities=activities,
    ))

    assert [item["activityId"] for item in result["recommendations"]] == ["near"]
