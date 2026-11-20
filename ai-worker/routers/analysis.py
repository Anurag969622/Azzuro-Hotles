"""
FastAPI router for review sentiment & topic analysis endpoints.
"""

from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

from services.analyzer import analysis_engine

router = APIRouter(prefix="/analyse", tags=["analysis"])


class ReviewInput(BaseModel):
    id: Optional[str] = None
    rating: Optional[float] = None
    positive_text: Optional[str] = None
    negative_text: Optional[str] = None
    full_text: Optional[str] = None
    language: Optional[str] = "en"


class TopicResult(BaseModel):
    topic_name: str
    topic_sentiment: str
    confidence: float


class AnalysisOutput(BaseModel):
    review_id: Optional[str] = None
    overall_sentiment: str
    sentiment_confidence: float
    detected_language: str
    model_name: str
    model_version: str
    analysis_status: str
    manually_verified: bool
    needs_manual_review: bool
    topics: List[TopicResult]


class BatchReviewRequest(BaseModel):
    reviews: List[ReviewInput]


class BatchAnalysisResponse(BaseModel):
    success: bool
    total_processed: int
    results: List[AnalysisOutput]


@router.post("/single", response_model=AnalysisOutput, summary="Analyze a single review")
async def analyze_single(review: ReviewInput):
    """
    Analyzes review text for overall sentiment and multi-label operational topics.
    """
    try:
        res = analysis_engine.analyze_review(review.model_dump())
        res["review_id"] = review.id
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.post("/batch", response_model=BatchAnalysisResponse, summary="Analyze a batch of reviews")
async def analyze_batch(payload: BatchReviewRequest):
    """
    Analyzes multiple reviews in a single batch request.
    """
    results = []
    for item in payload.reviews:
        try:
            res = analysis_engine.analyze_review(item.model_dump())
            res["review_id"] = item.id
            results.append(res)
        except Exception as e:
            # Gracefully handle single item error within batch
            results.append({
                "review_id": item.id,
                "overall_sentiment": "neutral",
                "sentiment_confidence": 0.5,
                "detected_language": item.language or "en",
                "model_name": analysis_engine.model_name,
                "model_version": analysis_engine.model_version,
                "analysis_status": "failed",
                "manually_verified": False,
                "needs_manual_review": True,
                "topics": []
            })

    return {
        "success": True,
        "total_processed": len(results),
        "results": results
    }

