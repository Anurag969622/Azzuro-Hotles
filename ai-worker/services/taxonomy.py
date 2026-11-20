"""
Azzurro Insights — Hotel Topic Taxonomy
Defines 16 operational hotel review topics, aliases, and detection patterns.
"""

TOPIC_TAXONOMY = {
    "Cleanliness": {
        "keywords": [
            "clean", "dirty", "filthy", "spotless", "stain", "stains", "dust", "dusty", 
            "hair", "mould", "mold", "smell", "odour", "odor", "hygiene", "sanitary",
            "propre", "sauber", "schmutzig", "poussière", "dreckig", "清潔", "汚れ"
        ],
        "aspect_terms": ["cleanliness", "housekeeping", "maid", "sheets", "linen", "room cleaning"]
    },
    "Check-in Experience": {
        "keywords": [
            "check-in", "checkin", "check in", "checking in", "check-out", "checkout", 
            "check out", "arrival", "departure", "early check-in", "late check-out",
            "key card", "keycard", "registration", "queue at reception", "wait at desk"
        ],
        "aspect_terms": ["check-in process", "front desk queue", "arrival experience"]
    },
    "Staff Behaviour": {
        "keywords": [
            "staff", "team", "personnel", "service", "employee", "employees", "helpful", 
            "friendly", "rude", "polite", "unfriendly", "welcoming", "attitude", "courteous",
            "accommodating", "sympathique", "freundlich", "unhöflich", "親切", "スタッフ"
        ],
        "aspect_terms": ["hotel staff", "guest service", "hospitality team"]
    },
    "Receptionist Behaviour": {
        "keywords": [
            "receptionist", "reception staff", "front desk clerk", "desk clerk", 
            "concierge", "reception desk person", "receptionniste", "Empfangsdame"
        ],
        "aspect_terms": ["receptionist", "front desk agent"]
    },
    "Noise": {
        "keywords": [
            "noise", "noisy", "loud", "quiet", "soundproof", "soundproofing", "street noise",
            "traffic", "neighbours", "neighbors", "thin walls", "earplugs", "construction noise",
            "bar noise", "bruyant", "calme", "lärm", "laut", "騒音", "静か"
        ],
        "aspect_terms": ["noise level", "acoustic insulation", "sound isolation"]
    },
    "Facilities": {
        "keywords": [
            "facilities", "gym", "fitness", "pool", "swimming pool", "spa", "sauna", 
            "terrace", "lounge", "parking", "car park", "business centre", "amenities",
            "équipement", "Einrichtungen", "施設"
        ],
        "aspect_terms": ["hotel facilities", "shared amenities"]
    },
    "Location": {
        "keywords": [
            "location", "central", "suburb", "station", "train", "metro", "bus", "walk",
            "walking distance", "near", "close to", "harbour", "beach", "city centre", 
            "restaurants nearby", "safe area", "convenient", "emplacement", "Lage", "立地", "場所"
        ],
        "aspect_terms": ["hotel location", "accessibility", "surrounding neighbourhood"]
    },
    "Room Condition": {
        "keywords": [
            "room", "space", "spacious", "small", "cramped", "tiny", "window", "lighting", 
            "view", "decor", "dated", "modern", "renovated", "carpet", "furniture", "wardrobe",
            "chambre", "Zimmer", "部屋", "広さ"
        ],
        "aspect_terms": ["room size", "room ambiance", "room interior"]
    },
    "Value for Money": {
        "keywords": [
            "price", "value", "cost", "expensive", "cheap", "overpriced", "affordable", 
            "worth it", "rip off", "bargain", "rate", "prix", "Preis", "kosten", "コスパ", "価格"
        ],
        "aspect_terms": ["value for money", "price quality ratio"]
    },
    "Bathroom": {
        "keywords": [
            "bathroom", "shower", "toilet", "bath", "bathtub", "towels", "towel", "water pressure",
            "hot water", "sink", "drain", "shampoo", "salle de bain", "Badezimmer", "Dusche", "バスルーム", "シャワー"
        ],
        "aspect_terms": ["bathroom condition", "shower pressure", "toilet hygiene"]
    },
    "Bed Comfort": {
        "keywords": [
            "bed", "mattress", "pillow", "pillows", "sleep", "slept", "comfortable bed", 
            "uncomfortable bed", "hard bed", "soft bed", "duvet", "blanket", "lit", "Bett", "Kissen", "ベッド", "寝心地"
        ],
        "aspect_terms": ["bed comfort", "mattress quality", "sleep quality"]
    },
    "Wi-Fi": {
        "keywords": [
            "wifi", "wi-fi", "internet", "connection", "broadband", "network", "speed", 
            "streaming", "signal", "disconnection", "wlan", "ネット", "ワイファイ"
        ],
        "aspect_terms": ["internet connectivity", "wifi speed"]
    },
    "Food and Breakfast": {
        "keywords": [
            "breakfast", "food", "dining", "restaurant", "buffet", "coffee", "tea", "croissant",
            "egg", "eggs", "meal", "tasty", "delicious", "petit-déjeuner", "Frühstück", "Essen", "朝食", "食事"
        ],
        "aspect_terms": ["breakfast buffet", "food quality", "dining service"]
    },
    "Safety": {
        "keywords": [
            "safe", "safety", "secure", "security", "lock", "keycard access", "safe deposit",
            "unsafe", "suspicious", "well lit", "sécurité", "Sicherheit", "安全"
        ],
        "aspect_terms": ["guest security", "hotel safety"]
    },
    "Maintenance": {
        "keywords": [
            "broken", "repair", "not working", "faulty", "maintenance", "air conditioning", 
            "aircon", "ac", "heater", "heating", "leak", "leaking", "tap", "lightbulb", 
            "elevator", "lift", "climatisation", "Aufzug", "エアコン", "故障"
        ],
        "aspect_terms": ["maintenance standards", "appliance functioning"]
    },
    "Other": {
        "keywords": ["general", "overall", "experience", "stay", "hotel", "recommend"],
        "aspect_terms": ["general stay experience"]
    }
}

