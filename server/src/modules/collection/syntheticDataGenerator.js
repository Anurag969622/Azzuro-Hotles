'use strict';

/**
 * Generates varied, realistic synthetic hotel reviews for Azzurro Hotels.
 * All records are explicitly flagged with `synthetic: true` in metadata and provenance.
 * None of this data is collected from Booking.com.
 */

const PROPERTIES = [
  { code: 'OLYMPIC-PADDINGTON', name: 'Olympic Hotel Paddington' },
  { code: 'POTTS-POINT',        name: 'Venus Potts Point' },
  { code: 'CENTRAL-SYDNEY',     name: 'Venus Central Sydney' },
  { code: 'DARLING-HARBOUR',    name: 'Château de Venus' },
];

const COUNTRIES = ['Australia', 'United Kingdom', 'New Zealand', 'United States', 'Germany', 'Singapore', 'Japan', 'France', 'Canada'];
const ROOM_TYPES = ['Standard Queen Room', 'Deluxe King Studio', 'Superior Double Room', 'Executive Suite', 'Compact Single Room'];
const TRAVEL_TYPES = ['Solo traveller', 'Couple', 'Family with children', 'Group of friends', 'Business traveller'];

const POSITIVE_TEMPLATES = [
  'Fantastic central location close to restaurants and transport.',
  'The staff were extraordinarily polite and helpful throughout our stay.',
  'Spotlessly clean bathroom and very comfortable bed.',
  'Great value for money considering the prime Sydney location.',
  'Super fast Wi-Fi and quiet room facing the courtyard.',
  'Check-in was seamless and reception accommodated our early arrival.',
  'The bed was like sleeping on a cloud. Excellent shower pressure.',
];

const NEGATIVE_TEMPLATES = [
  'Street noise was audible late into the evening.',
  'The room was smaller than depicted in photos.',
  'Wi-Fi was intermittently dropping out during peak hours.',
  'Bathroom tiles showed slight wear and could use modern refurbishment.',
  'Air conditioning was a little noisy at night.',
  'No elevator to the second floor, had to carry heavy luggage.',
  'Check-out was crowded and had a slight delay.',
];

const NON_ENGLISH_REVIEWS = [
  {
    lang: 'fr',
    pos: 'Emplacement idéal au coeur de Sydney. Chambre propre et personnel accueillant.',
    neg: 'Un peu bruyant le samedi soir à cause des bars à proximité.',
    full: 'Très bon séjour dans l ensemble. Le lit était confortable et la situation géographique parfaite.',
  },
  {
    lang: 'de',
    pos: 'Sehr freundliches Personal und sauberes Zimmer.',
    neg: 'Das Zimmer war etwas klein, aber für ein Wochenende völlig ausreichend.',
    full: 'Gutes Preis-Leistungs-Verhältnis für Sydney. Die Lage ist unschlagbar.',
  },
  {
    lang: 'ja',
    pos: '立地がとても良く、スタッフも親切でした。',
    neg: '部屋は少し狭かったですが、清潔でした。',
    full: 'シドニー観光には最適なロケーションです。ベッドも快適でした。',
  },
];

/**
 * Pseudo-random generator with seed for deterministic reproducibility.
 */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates an array of synthetic review objects.
 * @param {number} count - Total reviews to generate (default: 200)
 * @param {number} seed - Random seed
 * @returns {Object[]}
 */
function generateSyntheticReviews(count = 200, seed = 42) {
  const rand = seededRandom(seed);
  const reviews = [];

  for (let i = 0; i < count; i++) {
    const prop = PROPERTIES[i % PROPERTIES.length];
    const country = COUNTRIES[Math.floor(rand() * COUNTRIES.length)];
    const room = ROOM_TYPES[Math.floor(rand() * ROOM_TYPES.length)];
    const travel = TRAVEL_TYPES[Math.floor(rand() * TRAVEL_TYPES.length)];

    // Dates spread across the past 12 months
    const dateOffsetDays = Math.floor(rand() * 365);
    const d = new Date(Date.UTC(2026, 10, 20)); // based on current time
    d.setUTCDate(d.getUTCDate() - dateOffsetDays);
    const reviewDate = d.toISOString().split('T')[0];

    // Distribute sentiments: 60% positive (7.5-10), 20% mixed (5.5-7.4), 15% negative (1.0-5.4), 5% non-english
    const styleRoll = rand();
    let rating, posText, negText, fullText, lang = 'en';

    if (styleRoll < 0.05 && i < 20) {
      // Non-English
      const nonEn = NON_ENGLISH_REVIEWS[i % NON_ENGLISH_REVIEWS.length];
      lang = nonEn.lang;
      posText = nonEn.pos;
      negText = nonEn.neg;
      fullText = nonEn.full;
      rating = Math.round((7.0 + rand() * 2.5) * 10) / 10;
    } else if (styleRoll < 0.65) {
      // Positive
      rating = Math.round((8.0 + rand() * 2.0) * 10) / 10;
      posText = POSITIVE_TEMPLATES[Math.floor(rand() * POSITIVE_TEMPLATES.length)];
      negText = rand() > 0.6 ? NEGATIVE_TEMPLATES[Math.floor(rand() * NEGATIVE_TEMPLATES.length)] : '';
      fullText = `Had a wonderful stay at ${prop.name}. ${posText} ${negText}`.trim();
    } else if (styleRoll < 0.85) {
      // Mixed
      rating = Math.round((5.5 + rand() * 2.4) * 10) / 10;
      posText = POSITIVE_TEMPLATES[Math.floor(rand() * POSITIVE_TEMPLATES.length)];
      negText = NEGATIVE_TEMPLATES[Math.floor(rand() * NEGATIVE_TEMPLATES.length)];
      fullText = `Mixed experience at ${prop.name}. On the positive side: ${posText}. However: ${negText}`;
    } else {
      // Negative
      rating = Math.round((2.0 + rand() * 3.4) * 10) / 10;
      posText = rand() > 0.7 ? POSITIVE_TEMPLATES[Math.floor(rand() * POSITIVE_TEMPLATES.length)] : '';
      negText = NEGATIVE_TEMPLATES[Math.floor(rand() * NEGATIVE_TEMPLATES.length)];
      fullText = `Disappointed with our stay. ${negText} Would likely not return.`;
    }

    reviews.push({
      source_review_id: `SYNTH-${prop.code.substring(0, 4)}-${String(i + 1).padStart(4, '0')}`,
      property: prop.name,
      property_code: prop.code,
      rating,
      review_date: reviewDate,
      positive_text: posText || null,
      negative_text: negText || null,
      full_text: fullText,
      reviewer_country: country,
      language: lang,
      room_type: room,
      travel_type: travel,
      synthetic: true,
      provenance: {
        synthetic: true,
        disclaimer: 'SYNTHETIC TEST DATA - Not collected from Booking.com',
        generator_version: '1.0.0',
      },
    });
  }

  return reviews;
}

module.exports = {
  generateSyntheticReviews,
  PROPERTIES,
};

