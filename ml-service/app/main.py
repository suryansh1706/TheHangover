import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException

from app.recommender import recommend
from app.schemas import RecommendationRequest
from app.schemas import TrainingRequest
from app.model import train

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

app = FastAPI(title="The Hangover ML Service", version="0.2.0")


def check_internal_token(x_ml_service_token: str | None = Header(default=None)) -> None:
    expected = os.getenv("ML_SERVICE_TOKEN")
    if expected and x_ml_service_token != expected:
        raise HTTPException(status_code=401, detail="Unauthorized service request")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ml-service"}


@app.post("/recommendations", dependencies=[Depends(check_internal_token)])
def recommendations(payload: RecommendationRequest) -> dict:
    return recommend(payload)


@app.post("/models/train", dependencies=[Depends(check_internal_token)])
def train_model(payload: TrainingRequest) -> dict:
    return train([row.model_dump() for row in payload.rows])
