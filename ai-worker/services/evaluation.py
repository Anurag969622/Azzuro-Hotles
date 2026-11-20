"""
Manually labelled evaluation dataset containing varied real-world hotel review test cases:
- Positive, Negative, Mixed, Neutral
- Negation ("not clean", "was not friendly")
- Multiple operational topics with distinct topic-specific sentiments
- Multilingual reviews (French, German, Japanese)
- Very short text, empty text, and ambiguous language
"""

EVALUATION_DATASET = [
    {
        "id": "tc-01",
        "text": "The location was excellent, but the bathroom was dirty and the receptionist was rude.",
        "expected_sentiment": "mixed",
        "expected_topics": {
            "Location": "positive",
            "Cleanliness": "negative",
            "Receptionist Behaviour": "negative"
        }
    },
    {
        "id": "tc-02",
        "text": "Spotless room with extremely comfortable bed and quiet surroundings. Best sleep in months!",
        "expected_sentiment": "positive",
        "expected_topics": {
            "Cleanliness": "positive",
            "Bed Comfort": "positive",
            "Noise": "positive"
        }
    },
    {
        "id": "tc-03",
        "text": "The room was not clean, the sheets had stains, and the air conditioning was broken and leaking.",
        "expected_sentiment": "negative",
        "expected_topics": {
            "Cleanliness": "negative",
            "Maintenance": "negative"
        }
    },
    {
        "id": "tc-04",
        "text": "Check-in took over 45 minutes due to long queues. However, the breakfast buffet next morning was delicious.",
        "expected_sentiment": "mixed",
        "expected_topics": {
            "Check-in Experience": "negative",
            "Food and Breakfast": "positive"
        }
    },
    {
        "id": "tc-05",
        "text": "The staff were neither friendly nor rude. Standard stay.",
        "expected_sentiment": "neutral",
        "expected_topics": {
            "Staff Behaviour": "neutral"
        }
    },
    {
        "id": "tc-06",
        "text": "High speed wifi worked seamlessly for remote work and video conferencing.",
        "expected_sentiment": "positive",
        "expected_topics": {
            "Wi-Fi": "positive"
        }
    },
    {
        "id": "tc-07",
        "text": "Overpriced for what it offers. Very small room with dated decor.",
        "expected_sentiment": "negative",
        "expected_topics": {
            "Value for Money": "negative",
            "Room Condition": "negative"
        }
    },
    {
        "id": "tc-08",
        "text": "Emplacement idéal au coeur de Sydney. Mais chambre très bruyante la nuit.",
        "expected_sentiment": "mixed",
        "expected_topics": {
            "Location": "positive",
            "Noise": "negative"
        }
    },
    {
        "id": "tc-09",
        "text": "Sehr freundliches Personal und sauberes Zimmer. Wir kommen gerne wieder.",
        "expected_sentiment": "positive",
        "expected_topics": {
            "Staff Behaviour": "positive",
            "Cleanliness": "positive"
        }
    },
    {
        "id": "tc-10",
        "text": "立地がとても良く、スタッフも親切でした。ただ部屋は少し狭かったです。",
        "expected_sentiment": "mixed",
        "expected_topics": {
            "Location": "positive",
            "Staff Behaviour": "positive",
            "Room Condition": "negative"
        }
    },
    {
        "id": "tc-11",
        "text": "OK.",
        "expected_sentiment": "neutral",
        "expected_topics": {}
    },
    {
        "id": "tc-12",
        "text": "",
        "expected_sentiment": "neutral",
        "expected_topics": {}
    }
]


def evaluate_model_performance(analyzer):
    """
    Computes precision, recall, and macro F1 score on the evaluation dataset.
    Returns calculated metrics dictionary.
    """
    correct_sentiment = 0
    total = len(EVALUATION_DATASET)

    classes = ["positive", "negative", "mixed", "neutral"]
    tp = {c: 0 for c in classes}
    fp = {c: 0 for c in classes}
    fn = {c: 0 for c in classes}

    topic_matches = 0
    topic_total_expected = 0

    for item in EVALUATION_DATASET:
        res = analyzer.analyze_review({"full_text": item["text"]})
        pred_sent = res["overall_sentiment"]
        expected_sent = item["expected_sentiment"]

        if pred_sent == expected_sent:
            correct_sentiment += 1
            tp[pred_sent] += 1
        else:
            fp[pred_sent] += 1
            fn[expected_sent] += 1

        # Evaluate topic detections
        pred_topics = {t["topic_name"]: t["topic_sentiment"] for t in res["topics"]}
        for exp_topic, exp_sent in item["expected_topics"].items():
            topic_total_expected += 1
            if exp_topic in pred_topics and pred_topics[exp_topic] == exp_sent:
                topic_matches += 1

    accuracy = correct_sentiment / total if total > 0 else 0.0

    # Macro F1
    f1_scores = []
    for c in classes:
        p = tp[c] / (tp[c] + fp[c]) if (tp[c] + fp[c]) > 0 else 0.0
        r = tp[c] / (tp[c] + fn[c]) if (tp[c] + fn[c]) > 0 else 0.0
        f1 = (2 * p * r) / (p + r) if (p + r) > 0 else 0.0
        f1_scores.append(f1)

    macro_f1 = sum(f1_scores) / len(f1_scores)
    topic_accuracy = topic_matches / topic_total_expected if topic_total_expected > 0 else 1.0

    return {
        "dataset_size": total,
        "sentiment_accuracy": round(accuracy, 4),
        "sentiment_macro_f1": round(macro_f1, 4),
        "topic_sentiment_accuracy": round(topic_accuracy, 4),
        "classes_evaluated": classes,
    }

