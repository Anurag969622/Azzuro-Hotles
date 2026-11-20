"""
AI Worker Evaluation & Model Verification Tests
Tests:
- Positive, Negative, Mixed, Neutral reviews
- Negation handling ("not clean")
- Multiple operational topics & topic-specific sentiment
- Multilingual reviews (FR, DE, JA)
- Empty text, short text, ambiguous text
- Precision, recall, and F1 calculations on labelled test data
"""

import pytest
from httpx import AsyncClient, ASGITransport
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from services.analyzer import analysis_engine
from services.evaluation import evaluate_model_performance, EVALUATION_DATASET


def test_sentiment_and_topic_extraction():
    review = {
        "full_text": "The location was excellent, but the bathroom was dirty and the receptionist was rude."
    }
    result = analysis_engine.analyze_review(review)

    assert result["overall_sentiment"] == "mixed"
    assert result["sentiment_confidence"] >= 0.70

    topic_map = {t["topic_name"]: t["topic_sentiment"] for t in result["topics"]}
    assert "Location" in topic_map
    assert topic_map["Location"] == "positive"

    assert "Cleanliness" in topic_map or "Bathroom" in topic_map
    if "Cleanliness" in topic_map:
        assert topic_map["Cleanliness"] == "negative"

    assert "Receptionist Behaviour" in topic_map or "Staff Behaviour" in topic_map
    if "Receptionist Behaviour" in topic_map:
        assert topic_map["Receptionist Behaviour"] == "negative"


def test_negation_handling():
    # "not clean" should evaluate to negative sentiment for cleanliness
    review = {
        "full_text": "The room was not clean and the staff were never friendly."
    }
    result = analysis_engine.analyze_review(review)
    assert result["overall_sentiment"] == "negative"

    topic_map = {t["topic_name"]: t["topic_sentiment"] for t in result["topics"]}
    if "Cleanliness" in topic_map:
        assert topic_map["Cleanliness"] == "negative"


def test_multilingual_reviews():
    # French
    fr_res = analysis_engine.analyze_review({
        "full_text": "Emplacement idéal au coeur de Sydney. Mais chambre très bruyante la nuit."
    })
    assert fr_res["overall_sentiment"] == "mixed"
    assert fr_res["detected_language"] == "fr"

    # German
    de_res = analysis_engine.analyze_review({
        "full_text": "Sehr freundliches Personal und sauberes Zimmer. Wir kommen gerne wieder."
    })
    assert de_res["overall_sentiment"] == "positive"
    assert de_res["detected_language"] == "de"

    # Japanese
    ja_res = analysis_engine.analyze_review({
        "full_text": "立地がとても良く、スタッフも親切でした。ただ部屋は少し狭かったです。"
    })
    assert ja_res["overall_sentiment"] == "mixed"
    assert ja_res["detected_language"] == "ja"


def test_empty_and_short_text():
    # Empty
    empty_res = analysis_engine.analyze_review({"full_text": ""})
    assert empty_res["overall_sentiment"] == "neutral"
    assert empty_res["needs_manual_review"] is True

    # Short
    short_res = analysis_engine.analyze_review({"full_text": "OK."})
    assert short_res["overall_sentiment"] == "neutral"


def test_evaluation_metrics_precision_recall_f1():
    metrics = evaluate_model_performance(analysis_engine)
    print("\nModel Evaluation Metrics:", metrics)

    assert metrics["dataset_size"] == len(EVALUATION_DATASET)
    assert metrics["sentiment_accuracy"] >= 0.80, f"Expected accuracy >= 0.80, got {metrics['sentiment_accuracy']}"
    assert metrics["sentiment_macro_f1"] >= 0.75, f"Expected macro F1 >= 0.75, got {metrics['sentiment_macro_f1']}"
    assert metrics["topic_sentiment_accuracy"] >= 0.75


@pytest.mark.asyncio
async def test_api_batch_analysis():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "reviews": [
                {
                    "id": "rev-1",
                    "full_text": "Fantastic service and delicious breakfast!"
                },
                {
                    "id": "rev-2",
                    "full_text": "Broken shower and loud street noise all night."
                }
            ]
        }
        res = await client.post("/analyse/batch", json=payload)

    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["total_processed"] == 2
    assert len(data["results"]) == 2
    assert data["results"][0]["overall_sentiment"] == "positive"
    assert data["results"][1]["overall_sentiment"] == "negative"

