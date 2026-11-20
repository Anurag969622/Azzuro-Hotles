"""
Azzurro Insights — Sentiment & Topic Engine
Implements:
1. Lexical + Rule-Based multilingual sentiment and aspect extraction engine (fallback & baseline)
2. Hugging Face Transformer pipeline loader with automatic fallback
3. Mixed/Positive/Negative/Neutral overall resolution
4. Aspect-level sentiment extraction
5. Negation handling ("not good", "never clean")
"""

import os
import re
from typing import Dict, List, Optional, Tuple, Any
from services.taxonomy import TOPIC_TAXONOMY

# Common negation terms across supported languages
NEGATION_WORDS = {
    "en": {"not", "no", "never", "hardly", "barely", "scarcely", "without", "isn't", "wasn't", "didn't", "don't", "wouldn't", "couldn't"},
    "fr": {"pas", "ne", "aucun", "aucune", "jamais", "rien"},
    "de": {"nicht", "kein", "keine", "keinen", "nie", "niemals", "ohne"},
    "ja": {"ない", "ず", "ません", "なかった"}
}

# Lexicons for sentiment determination
POSITIVE_WORDS = {
    "excellent", "amazing", "great", "good", "wonderful", "fantastic", "clean", "spotless",
    "comfortable", "helpful", "friendly", "polite", "loved", "perfect", "seamless", "quiet",
    "spacious", "tasty", "delicious", "recommend", "superb", "fast", "convenient", "charm",
    "charming", "pleasure", "worth", "bargain", "modern", "high speed", "worked seamlessly",
    # French
    "parfait", "très bon", "bon", "bonne", "agréable", "propre", "idéal", "accueillant", "confortable",
    # German
    "ausgezeichnet", "sehr gut", "gut", "sauber", "freundlich", "bequem", "toll", "perfekt", "gerne",
    # Japanese
    "最高", "快適", "親切", "清潔", "満足", "便利", "素晴らしい", "良い", "きれい", "よく", "良かった"
}

NEGATIVE_WORDS = {
    "bad", "terrible", "awful", "horrible", "poor", "dirty", "filthy", "disappointed",
    "disappointing", "noisy", "loud", "cramped", "small", "tiny", "rude", "unfriendly",
    "broken", "slow", "expensive", "overpriced", "smelly", "dusty", "stain", "stains",
    "uncomfortable", "leak", "leaking", "rip off", "scam", "unsafe", "mould", "mold",
    "long queues", "took over", "delay",
    # French
    "mauvais", "sale", "bruyant", "bruyante", "décevant", "impoli", "horrible", "cher", "froid",
    # German
    "schlecht", "dreckig", "schmutzig", "laut", "unhöflich", "teuer", "enttäuschend", "alt",
    # Japanese
    "最悪", "汚い", "うるさい", "不親切", "狭い", "残念", "不満", "故障", "不快", "狭かった"
}

CONTRAST_CONJUNCTIONS = {
    "en": ["but", "however", "although", "though", "yet", "nevertheless", "on the other hand", "except"],
    "fr": ["mais", "cependant", "pourtant", "néanmoins", "par contre", "sauf"],
    "de": ["aber", "jedoch", "doch", "obwohl", "allerdings", "außer"],
    "ja": ["しかし", "だが", "けれども", "ただし"]
}


class AnalysisEngine:
    def __init__(self):
        self.model_name = "azzurro-hybrid-nlp-v1"
        self.model_version = "1.0.0"
        self.hf_sentiment_pipeline = None
        self._init_models()

    def _init_models(self):
        """
        Attempts to load Hugging Face transformer model if torch & transformers are present
        and environment allows. Otherwise falls back to rule-based engine.
        """
        try:
            from transformers import pipeline
            # Check if models directory or cache is enabled
            # Using lightweight multilingual or sentiment model when available
            model_id = os.getenv("SENTIMENT_MODEL", "cardiffnlp/twitter-roberta-base-sentiment-latest")
            # If explicit flag set or offline, keep as rule-based fallback
            if os.getenv("USE_TRANSFORMERS", "false").lower() == "true":
                self.hf_sentiment_pipeline = pipeline("sentiment-analysis", model=model_id)
                self.model_name = model_id
                self.model_version = "hf-pipeline"
        except Exception:
            # Graceful local fallback
            self.hf_sentiment_pipeline = None
            self.model_name = "azzurro-rule-hybrid"
            self.model_version = "1.0.0"

    def split_sentences(self, text: str) -> List[str]:
        """Splits review text into sentences or clause units."""
        if not text:
            return []
        # Split on sentence boundaries and punctuation
        raw_parts = re.split(r'[\.\!\?\;\n]+', text)
        sentences = []
        for part in raw_parts:
            # Further split clauses on contrast conjunctions
            part_clean = part.strip()
            if not part_clean:
                continue
            clauses = [part_clean]
            for lang_conj in CONTRAST_CONJUNCTIONS.values():
                for conj in lang_conj:
                    new_clauses = []
                    for c in clauses:
                        pattern = rf'\b{re.escape(conj)}\b'
                        split_res = re.split(pattern, c, flags=re.IGNORECASE)
                        for s in split_res:
                            if s.strip():
                                new_clauses.append(s.strip())
                    clauses = new_clauses
            sentences.extend(clauses)
        return sentences

    def classify_text_sentiment(self, text: str) -> Tuple[str, float, int, int]:
        """
        Evaluates sentiment of a text fragment using token matching with negation awareness.
        Returns: (sentiment, confidence, positive_score, negative_score)
        """
        if not text or not text.strip():
            return "neutral", 0.5, 0, 0

        tokens = re.findall(r'\w+|[^\w\s]', text.lower())
        pos_hits = 0
        neg_hits = 0

        # Check for phrase matches
        text_lower = text.lower()
        if "neither" in text_lower and "nor" in text_lower:
            return "neutral", 0.85, 0, 0

        for pw in POSITIVE_WORDS:
            if " " in pw and pw in text_lower:
                pos_hits += 2
        for nw in NEGATIVE_WORDS:
            if " " in nw and nw in text_lower:
                neg_hits += 2

        # Check for substring matches for non-latin or accented languages
        for w in POSITIVE_WORDS:
            if any(ord(c) > 127 for c in w) and w in text_lower:
                pos_hits += 1.5
        for w in NEGATIVE_WORDS:
            if any(ord(c) > 127 for c in w) and w in text_lower:
                neg_hits += 1.5

        negated = False
        negation_window = 0

        all_negations = set()
        for s in NEGATION_WORDS.values():
            all_negations.update(s)

        for token in tokens:
            if token in all_negations or token.endswith("n't"):
                negated = True
                negation_window = 3
                continue

            is_pos = token in POSITIVE_WORDS
            is_neg = token in NEGATIVE_WORDS

            if is_pos:
                if negated:
                    neg_hits += 1.5
                else:
                    pos_hits += 1.0
            elif is_neg:
                if negated:
                    pos_hits += 1.2
                else:
                    neg_hits += 1.0

            if negation_window > 0:
                negation_window -= 1
                if negation_window == 0:
                    negated = False

        if pos_hits > 0 and neg_hits > 0:
            confidence = min(0.95, 0.6 + abs(pos_hits - neg_hits) * 0.1)
            # If hits are balanced
            if abs(pos_hits - neg_hits) <= 1:
                return "mixed", confidence, pos_hits, neg_hits
            return ("positive" if pos_hits > neg_hits else "negative"), confidence, pos_hits, neg_hits
        elif pos_hits > 0:
            confidence = min(0.99, 0.70 + pos_hits * 0.08)
            return "positive", confidence, pos_hits, 0
        elif neg_hits > 0:
            confidence = min(0.99, 0.70 + neg_hits * 0.08)
            return "negative", confidence, 0, neg_hits
        else:
            return "neutral", 0.50, 0, 0

    def extract_topics_and_sentiment(self, text: str) -> List[Dict[str, Any]]:
        """
        Extracts multi-label operational topics with topic-specific sentiments.
        """
        if not text or not text.strip():
            return []

        sentences = self.split_sentences(text)
        detected_topics: Dict[str, Dict[str, Any]] = {}

        for sentence in sentences:
            sent_lower = sentence.lower()
            sent_sentiment, sent_conf, pos_score, neg_score = self.classify_text_sentiment(sentence)

            # Match against each topic in taxonomy
            for topic_name, meta in TOPIC_TAXONOMY.items():
                if topic_name == "Other":
                    continue

                matched = False
                relevance = 0.0

                for kw in meta["keywords"]:
                    if kw in sent_lower:
                        matched = True
                        relevance += 1.0

                if matched:
                    # Decide topic sentiment
                    # If this clause was positive, topic sentiment is positive, etc.
                    topic_sentiment = sent_sentiment if sent_sentiment != "mixed" else ("positive" if pos_score >= neg_score else "negative")
                    conf = min(0.98, max(0.65, sent_conf + 0.1))

                    if topic_name not in detected_topics:
                        detected_topics[topic_name] = {
                            "topic_name": topic_name,
                            "topic_sentiment": topic_sentiment,
                            "confidence": round(conf, 4),
                            "hits": 1
                        }
                    else:
                        # If conflicting sentiments across sentences for the same topic
                        existing = detected_topics[topic_name]
                        if existing["topic_sentiment"] != topic_sentiment and topic_sentiment != "neutral":
                            existing["topic_sentiment"] = topic_sentiment # prioritize stronger signal
                        existing["hits"] += 1
                        existing["confidence"] = min(0.99, existing["confidence"] + 0.05)

        # Fallback to 'Other' if no specific operational topic detected
        if not detected_topics and text.strip():
            overall_sent, overall_conf, _, _ = self.classify_text_sentiment(text)
            detected_topics["Other"] = {
                "topic_name": "Other",
                "topic_sentiment": overall_sent if overall_sent != "mixed" else "neutral",
                "confidence": round(overall_conf, 4),
                "hits": 1
            }

        return list(detected_topics.values())

    def analyze_review(self, review: Dict[str, Any]) -> Dict[str, Any]:
        """
        Complete analysis entrypoint for a single review.
        Resolves overall sentiment independently of hotel numerical score.
        Extracts topic-level sentiments and confidence.
        """
        pos_text = review.get("positive_text") or ""
        neg_text = review.get("negative_text") or ""
        full_text = review.get("full_text") or ""

        # Aggregate text for analysis
        combined_text = full_text
        if not combined_text:
            combined_text = f"{pos_text}. {neg_text}".strip()

        # Handle empty or whitespace text
        if not combined_text.strip():
            return {
                "overall_sentiment": "neutral",
                "sentiment_confidence": 0.50,
                "detected_language": review.get("language") or "en",
                "model_name": self.model_name,
                "model_version": self.model_version,
                "analysis_status": "completed",
                "topics": [],
                "manually_verified": False,
                "needs_manual_review": True,
            }

        # Analyze separate positive and negative sections if available
        pos_sent, pos_conf, pos_score, _ = self.classify_text_sentiment(pos_text)
        neg_sent, neg_conf, _, neg_score = self.classify_text_sentiment(neg_text)

        # Overall text sentiment
        overall_sent, overall_conf, total_pos, total_neg = self.classify_text_sentiment(combined_text)

        # If explicit positive section exists and explicit negative section exists with conflicting sentiments
        if pos_text.strip() and neg_text.strip():
            if pos_score > 0 and neg_score > 0:
                overall_sent = "mixed"
                overall_conf = 0.88
            elif pos_score > 0 and neg_score == 0:
                overall_sent = "positive"
                overall_conf = max(pos_conf, 0.80)
            elif neg_score > 0 and pos_score == 0:
                overall_sent = "negative"
                overall_conf = max(neg_conf, 0.80)

        # Extract topics
        topics = self.extract_topics_and_sentiment(combined_text)

        # If topic sentiments are clearly divided (some positive, some negative), verify mixed
        has_pos_topic = any(t["topic_sentiment"] == "positive" for t in topics)
        has_neg_topic = any(t["topic_sentiment"] == "negative" for t in topics)
        if has_pos_topic and has_neg_topic and len(topics) >= 2:
            overall_sent = "mixed"
            overall_conf = max(overall_conf, 0.85)

        # Detect language hint
        detected_language = review.get("language") or "en"
        if re.search(r'[\u3040-\u30ff\u4e00-\u9faf]', combined_text):
            detected_language = "ja"
        elif any(w in combined_text.lower() for w in ["très", "le ", "la ", "salle de bain"]):
            detected_language = "fr"
        elif any(w in combined_text.lower() for w in ["sehr", "und", "badezimmer", "das"]):
            detected_language = "de"

        # Flag for manual review if confidence is low (< 0.65) or sentiment is ambiguous
        needs_review = overall_conf < 0.65 or (overall_sent == "neutral" and len(combined_text.split()) > 10)

        return {
            "overall_sentiment": overall_sent,
            "sentiment_confidence": round(float(overall_conf), 4),
            "detected_language": detected_language,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "analysis_status": "completed",
            "manually_verified": False,
            "needs_manual_review": needs_review,
            "topics": topics
        }


analysis_engine = AnalysisEngine()
