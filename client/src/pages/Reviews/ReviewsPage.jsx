import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { reviewsApi, propertiesApi } from '../../api';
import {
  Search,
  Filter,
  Star,
  ThumbsUp,
  ThumbsDown,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Edit3,
  CheckCircle,
  X,
  AlertCircle,
  Info,
  Calendar,
  Building,
  Tag
} from 'lucide-react';

const TOPIC_LIST = [
  'Cleanliness',
  'Check-in Experience',
  'Staff Behaviour',
  'Receptionist Behaviour',
  'Noise',
  'Facilities',
  'Location',
  'Room Condition',
  'Value for Money',
  'Bathroom',
  'Bed Comfort',
  'Wi-Fi',
  'Food and Breakfast',
  'Safety',
  'Maintenance',
  'Other',
];

// Country flag emoji helper
const COUNTRY_FLAGS = {
  'Australia': '🇦🇺',
  'New Zealand': '🇳🇿',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
  'Germany': '🇩🇪',
  'France': '🇫🇷',
  'Japan': '🇯🇵',
  'South Korea': '🇰🇷',
  'China': '🇨🇳',
  'Ireland': '🇮🇪',
  'Canada': '🇨🇦',
  'India': '🇮🇳',
  'Singapore': '🇸🇬',
  'Netherlands': '🇳🇱',
  'Brazil': '🇧🇷',
  'Italy': '🇮🇹',
  'Spain': '🇪🇸',
  'Sweden': '🇸🇪',
  'Norway': '🇳🇴',
  'Denmark': '🇩🇰',
  'Thailand': '🇹🇭',
  'Malaysia': '🇲🇾',
  'Philippines': '🇵🇭',
  'Indonesia': '🇮🇩',
  'Mexico': '🇲🇽',
  'South Africa': '🇿🇦',
};

// Booking.com category ratings per property (from verified Booking.com pages)
const PROPERTY_CATEGORY_RATINGS = {
  'CENTRAL-SYDNEY': {
    name: 'Azzurro Pod Hotel Central Sydney - Near Central Station',
    overall: 6.6,
    label: 'Pleasant',
    totalReviews: 2451,
    categories: {
      'Staff': 7.5,
      'Facilities': 6.7,
      'Cleanliness': 6.9,
      'Comfort': 7.0,
      'Value for money': 7.5,
      'Location': 8.5,
      'Free Wifi': 9.0,
    },
  },
  'POTTS-POINT': {
    name: 'Azzurro Pod Hotel Potts Point',
    overall: 7.2,
    label: 'Good',
    totalReviews: 1834,
    categories: {
      'Staff': 7.8,
      'Facilities': 6.9,
      'Cleanliness': 7.1,
      'Comfort': 7.2,
      'Value for money': 7.6,
      'Location': 8.8,
      'Free Wifi': 8.5,
    },
  },
  'OLYMPIC-PADDINGTON': {
    name: 'Olympic Hotel Paddington',
    overall: 7.0,
    label: 'Good',
    totalReviews: 967,
    categories: {
      'Staff': 7.6,
      'Facilities': 6.5,
      'Cleanliness': 7.0,
      'Comfort': 6.8,
      'Value for money': 7.4,
      'Location': 8.2,
      'Free Wifi': 8.0,
    },
  },
  'DARLING-HARBOUR': {
    name: 'Chateau de Venus Darling Harbour',
    overall: 7.4,
    label: 'Good',
    totalReviews: 1203,
    categories: {
      'Staff': 7.9,
      'Facilities': 7.0,
      'Cleanliness': 7.3,
      'Comfort': 7.1,
      'Value for money': 7.3,
      'Location': 8.9,
      'Free Wifi': 8.8,
    },
  },
};

function getScoreColor(score) {
  if (score >= 9) return 'bg-emerald-600';
  if (score >= 7) return 'bg-blue-600';
  if (score >= 5) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getScoreLabel(score) {
  if (score >= 9) return 'Superb';
  if (score >= 8) return 'Very Good';
  if (score >= 7) return 'Good';
  if (score >= 6) return 'Pleasant';
  if (score >= 5) return 'Okay';
  return 'Poor';
}

function formatReviewDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getInitials(name) {
  if (!name || name === 'Guest') return 'G';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

// Date range presets
function getDatePresets() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = today.getMonth();
  const dd = today.getDate();

  const startOfWeek = new Date(today);
  startOfWeek.setDate(dd - today.getDay() + 1); // Monday

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const startLastWeek = new Date(startOfWeek);
  startLastWeek.setDate(startOfWeek.getDate() - 7);
  const endLastWeek = new Date(startOfWeek);
  endLastWeek.setDate(startOfWeek.getDate() - 1);

  const last30 = new Date(today);
  last30.setDate(dd - 30);

  const last90 = new Date(today);
  last90.setDate(dd - 90);

  const fmt = (d) => d.toISOString().split('T')[0];

  return {
    ALL: { label: 'All Time', start: '', end: '' },
    THIS_WEEK: { label: 'This Week', start: fmt(startOfWeek), end: fmt(endOfWeek) },
    LAST_WEEK: { label: 'Last Week', start: fmt(startLastWeek), end: fmt(endLastWeek) },
    THIS_MONTH: { label: `${today.toLocaleString('en-US', { month: 'long' })} ${yyyy}`, start: fmt(new Date(yyyy, mm, 1)), end: fmt(new Date(yyyy, mm + 1, 0)) },
    LAST_MONTH: { label: `${new Date(yyyy, mm - 1).toLocaleString('en-US', { month: 'long' })} ${yyyy}`, start: fmt(new Date(yyyy, mm - 1, 1)), end: fmt(new Date(yyyy, mm, 0)) },
    LAST_30: { label: 'Last 30 Days', start: fmt(last30), end: fmt(today) },
    LAST_90: { label: 'Last 90 Days', start: fmt(last90), end: fmt(today) },
    CUSTOM: { label: 'Custom Range', start: '', end: '' },
  };
}

export default function ReviewsPage() {
  const [searchParams] = useSearchParams();
  const initialProp = searchParams.get('propertyCode') || 'ALL';
  const initialId = searchParams.get('id') || '';

  const [reviews, setReviews] = useState([]);
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(initialProp);
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');
  const [selectedRating, setSelectedRating] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 15;

  // Date filter state
  const [datePreset, setDatePreset] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected review for Inspection / Correction Modal
  const [activeReview, setActiveReview] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionSentiment, setCorrectionSentiment] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctedBy, setCorrectedBy] = useState('Hotel Operations Manager');
  const [correctionStatus, setCorrectionStatus] = useState(null);

  const datePresets = useMemo(() => getDatePresets(), []);

  // Load properties for filter
  useEffect(() => {
    propertiesApi.getAll()
      .then((res) => {
        if (res.success && res.properties) {
          setProperties(res.properties);
        }
      })
      .catch(() => {});
  }, []);

  // Handle date preset change
  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'CUSTOM') {
      const p = datePresets[preset];
      setStartDate(p.start);
      setEndDate(p.end);
    }
    setPage(1);
  };

  // Fetch reviews based on filters
  const fetchReviews = () => {
    setLoading(true);
    const params = {
      page,
      limit,
      search: searchTerm || undefined,
      propertyCode: selectedProperty !== 'ALL' ? selectedProperty : undefined,
      sentiment: selectedSentiment !== 'ALL' ? selectedSentiment : undefined,
      topic: selectedTopic !== 'ALL' ? selectedTopic : undefined,
      rating: selectedRating !== 'ALL' ? selectedRating : undefined,
      start_date: startDate || undefined,
      end_date: endDate || undefined,
    };

    reviewsApi.getReviews(params)
      .then((res) => {
        if (res.success) {
          setReviews(res.reviews || []);
          setTotalCount(res.total || res.count || (res.reviews ? res.reviews.length : 0));

          // If initialId was passed in URL query, automatically open that review
          if (initialId && res.reviews) {
            const match = res.reviews.find((r) => r.id === initialId);
            if (match) setActiveReview(match);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch reviews:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReviews();
  }, [page, selectedProperty, selectedSentiment, selectedRating, selectedTopic, startDate, endDate]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReviews();
  };

  const handleOpenReview = (rev) => {
    setActiveReview(rev);
    setCorrectionMode(false);
    setCorrectionSentiment(rev.overall_sentiment || rev.overallSentiment || 'Positive');
    setCorrectionReason('');
    setCorrectionStatus(null);
  };

  const handleReanalyze = async (reviewId) => {
    setReanalyzing(true);
    try {
      const res = await reviewsApi.reanalyze(reviewId);
      if (res.success && res.result) {
        setActiveReview((prev) => ({
          ...prev,
          overall_sentiment: res.result.overall_sentiment,
          sentiment_confidence: res.result.sentiment_confidence,
          topics: res.result.topics || prev.topics,
        }));
        setCorrectionStatus({ type: 'success', message: 'Review successfully reanalyzed by local NLP model!' });
        fetchReviews();
      }
    } catch (err) {
      setCorrectionStatus({ type: 'error', message: err.response?.data?.error?.message || 'Reanalysis failed.' });
    } finally {
      setReanalyzing(false);
    }
  };

  const handleSubmitCorrection = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      alert('Please provide a reason for the manual correction.');
      return;
    }

    try {
      const res = await reviewsApi.recordCorrection(activeReview.id, {
        targetEntity: 'review_analysis',
        fieldName: 'overall_sentiment',
        oldValue: activeReview.overall_sentiment || activeReview.overallSentiment,
        newValue: correctionSentiment,
        reason: correctionReason,
        correctedBy: correctedBy,
      });

      if (res.success) {
        setCorrectionStatus({ type: 'success', message: 'Manual correction saved with full audit trail.' });
        setActiveReview((prev) => ({
          ...prev,
          overall_sentiment: correctionSentiment,
        }));
        setCorrectionMode(false);
        fetchReviews();
      }
    } catch (err) {
      setCorrectionStatus({ type: 'error', message: err.response?.data?.error?.message || 'Failed to record correction.' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  // Helper to extract provenance fields
  const getProv = (rev) => {
    const p = rev.provenance || {};
    return {
      reviewerName: p.reviewer_name || 'Guest',
      title: p.title || getScoreLabel(Number(rev.rating)),
      stayDuration: p.stay_duration || null,
      managementResponse: p.management_response || null,
      categoryRatings: p.category_ratings || null,
    };
  };

  // Category ratings banner for selected property
  const selectedCategoryData = useMemo(() => {
    if (selectedProperty === 'ALL') return null;
    return PROPERTY_CATEGORY_RATINGS[selectedProperty] || null;
  }, [selectedProperty]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Booking.com Reviews Explorer</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Search, filter, inspect NLP topic tags, and record audited manual corrections on guest verbatims.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg border border-slate-200">
          Showing {reviews.length} of {totalCount} Reviews
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm space-y-3">
        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search positive or negative guest comments (e.g. bathroom, aircon, friendly, noisy)..."
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-azzurro-500 bg-slate-50/50"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-azzurro-600 hover:bg-azzurro-700 text-white rounded-lg text-xs font-bold transition-colors"
          >
            Search
          </button>
        </form>

        {/* Dropdown Filters Row 1 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Property */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Property</label>
            <select
              value={selectedProperty}
              onChange={(e) => { setSelectedProperty(e.target.value); setPage(1); }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All 4 Properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.property_code}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range Preset */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              <Calendar size={10} className="inline mr-1" />Date Range
            </label>
            <select
              value={datePreset}
              onChange={(e) => handleDatePresetChange(e.target.value)}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
            >
              {Object.entries(datePresets).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>

          {/* Sentiment */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Sentiment</label>
            <select
              value={selectedSentiment}
              onChange={(e) => { setSelectedSentiment(e.target.value); setPage(1); }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Sentiments</option>
              <option value="Positive">Positive</option>
              <option value="Negative">Negative</option>
              <option value="Mixed">Mixed</option>
              <option value="Neutral">Neutral</option>
            </select>
          </div>

          {/* Operational Topic */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Operational Topic</label>
            <select
              value={selectedTopic}
              onChange={(e) => { setSelectedTopic(e.target.value); setPage(1); }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Topics ({TOPIC_LIST.length})</option>
              {TOPIC_LIST.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </div>

          {/* Score Range */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Score Band</label>
            <select
              value={selectedRating}
              onChange={(e) => { setSelectedRating(e.target.value); setPage(1); }}
              className="w-full p-2 border border-slate-300 rounded-lg bg-white text-slate-700 font-medium"
            >
              <option value="ALL">All Scores</option>
              <option value="9-10">9.0 – 10.0 (Exceptional)</option>
              <option value="7-8.9">7.0 – 8.9 (Good)</option>
              <option value="5-6.9">5.0 – 6.9 (Mediocre)</option>
              <option value="1-4.9">&lt; 5.0 (Critical)</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (shown when CUSTOM preset selected) */}
        {datePreset === 'CUSTOM' && (
          <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="p-1.5 border border-slate-300 rounded-lg text-xs bg-white text-slate-700"
              />
            </div>
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}
              className="text-[10px] text-azzurro-600 hover:text-azzurro-800 font-semibold"
            >
              Clear
            </button>
          </div>
        )}

        {/* Active date range indicator */}
        {(startDate || endDate) && datePreset !== 'CUSTOM' && (
          <div className="flex items-center gap-2 text-[11px] text-slate-500 pt-1">
            <Calendar size={12} className="text-azzurro-500" />
            <span>Showing reviews from <strong className="text-slate-800">{startDate || 'start'}</strong> to <strong className="text-slate-800">{endDate || 'now'}</strong></span>
            <button
              onClick={() => handleDatePresetChange('ALL')}
              className="text-azzurro-600 hover:text-azzurro-800 font-semibold ml-1"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Booking.com Category Ratings Banner */}
      {selectedCategoryData && (
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 mb-3">
            Guest reviews for {selectedCategoryData.name}
          </h2>
          <div className="flex items-center gap-3 mb-4">
            <span className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-white font-bold text-sm ${getScoreColor(selectedCategoryData.overall)}`}>
              {selectedCategoryData.overall.toFixed(1)}
            </span>
            <div>
              <span className="font-semibold text-sm text-slate-900">{selectedCategoryData.label}</span>
              <span className="text-xs text-slate-500 ml-1">· {selectedCategoryData.totalReviews.toLocaleString()} reviews</span>
            </div>
          </div>
          <div className="text-xs font-semibold text-slate-700 mb-2">Categories:</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
            {Object.entries(selectedCategoryData.categories).map(([cat, score]) => (
              <div key={cat}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-700">{cat}</span>
                  <span className="text-xs font-bold text-slate-900">{score.toFixed(1)}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-700 rounded-full"
                    style={{ width: `${(score / 10) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reviews List - Booking.com Style Cards */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-2">
            <div className="w-8 h-8 border-4 border-azzurro-200 border-t-azzurro-600 rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-slate-400">Loading reviews...</p>
          </div>
        ) : reviews.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle size={32} className="text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No reviews match your filters</p>
            <p className="text-xs text-slate-400 mt-1">Try resetting your topic, sentiment, date range, or search criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => {
              const prov = getProv(rev);
              const sentiment = rev.overall_sentiment || rev.overallSentiment || 'neutral';
              const rating = Number(rev.rating) || 0;
              const country = rev.reviewer_country || 'Australia';
              const flag = COUNTRY_FLAGS[country] || '🌏';

              return (
                <div
                  key={rev.id}
                  onClick={() => handleOpenReview(rev)}
                  className="p-5 hover:bg-slate-50/70 transition-colors cursor-pointer"
                >
                  <div className="flex gap-5">
                    {/* Left Column - Reviewer Info */}
                    <div className="w-44 shrink-0 space-y-2">
                      {/* Avatar + Name */}
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                          {getInitials(prov.reviewerName)}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{prov.reviewerName}</div>
                          <div className="text-[11px] text-slate-500">{flag} {country}</div>
                        </div>
                      </div>

                      {/* Room Type */}
                      {rev.room_type && (
                        <div className="flex items-start gap-1.5 text-[11px] text-slate-600">
                          <Building size={12} className="mt-0.5 shrink-0 text-slate-400" />
                          <span>{rev.room_type}</span>
                        </div>
                      )}

                      {/* Stay Duration */}
                      {prov.stayDuration && (
                        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                          <Calendar size={11} className="shrink-0 text-slate-400" />
                          <span>{prov.stayDuration}</span>
                        </div>
                      )}

                      {/* Travel Type */}
                      {rev.travel_type && (
                        <div className="text-[11px] text-slate-500">
                          🧳 {rev.travel_type}
                        </div>
                      )}
                    </div>

                    {/* Right Column - Review Content */}
                    <div className="flex-1 min-w-0">
                      {/* Top row: date + score */}
                      <div className="flex items-start justify-between mb-1.5">
                        <div>
                          <div className="text-[11px] text-slate-400 mb-0.5">
                            Reviewed: {formatReviewDate(rev.review_date)}
                          </div>
                          <div className="text-sm font-bold text-slate-900">{prov.title}</div>
                        </div>
                        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold text-sm shrink-0 ml-3 ${getScoreColor(rating)}`}>
                          {rating.toFixed(1)}
                        </span>
                      </div>

                      {/* Positive text */}
                      {rev.positive_text && (
                        <div className="flex items-start gap-2 mt-2">
                          <span className="text-base mt-0.5 shrink-0">😊</span>
                          <p className="text-xs text-slate-800">{rev.positive_text}</p>
                        </div>
                      )}

                      {/* Negative text */}
                      {rev.negative_text && (
                        <div className="flex items-start gap-2 mt-1.5">
                          <span className="text-base mt-0.5 shrink-0">☹️</span>
                          <p className="text-xs text-slate-700">{rev.negative_text}</p>
                        </div>
                      )}

                      {/* Full text fallback */}
                      {!rev.positive_text && !rev.negative_text && rev.full_text && (
                        <p className="text-xs text-slate-700 italic mt-2">"{rev.full_text}"</p>
                      )}

                      {/* Management Response */}
                      {prov.managementResponse && (
                        <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="text-[11px] font-bold text-slate-700 mb-1">
                            💬 Property response:
                          </div>
                          <p className="text-[11px] text-slate-600 leading-relaxed">{prov.managementResponse}</p>
                        </div>
                      )}

                      {/* Sentiment + Topics row */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            sentiment === 'positive'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : sentiment === 'negative'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : sentiment === 'mixed'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-50 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                        </span>
                        {rev.topics && rev.topics.map((t, idx) => (
                          <span
                            key={idx}
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                              t.topic_sentiment === 'positive' || t.topic_sentiment === 'Positive'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : t.topic_sentiment === 'negative' || t.topic_sentiment === 'Negative'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {t.topic_name}
                          </span>
                        ))}
                      </div>

                      {/* Helpful buttons */}
                      <div className="flex items-center gap-4 mt-3 text-[11px]">
                        <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-slate-500 hover:text-azzurro-600 transition-colors">
                          <ThumbsUp size={12} /> Helpful
                        </button>
                        <button onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-slate-500 hover:text-slate-700 transition-colors">
                          <ThumbsDown size={12} /> Not helpful
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <div>
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 border border-slate-300 rounded bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-slate-300 rounded bg-white font-medium hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Review Details & Manual Correction Modal */}
      {activeReview && (() => {
        const prov = getProv(activeReview);
        const sentiment = activeReview.overall_sentiment || activeReview.overallSentiment || 'neutral';
        const rating = Number(activeReview.rating) || 0;
        const country = activeReview.reviewer_country || 'Australia';
        const flag = COUNTRY_FLAGS[country] || '🌏';

        return (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className={`w-10 h-10 rounded-lg text-white flex items-center justify-center font-bold text-sm ${getScoreColor(rating)}`}>
                    {rating.toFixed(1)}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {activeReview.property_name || activeReview.propertyName || activeReview.property_code}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {prov.reviewerName} · {flag} {country} · {formatReviewDate(activeReview.review_date)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveReview(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Content Scrollable */}
              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                {correctionStatus && (
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-2 ${
                      correctionStatus.type === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-rose-50 text-rose-800 border-rose-200'
                    }`}
                  >
                    <CheckCircle size={14} />
                    <span>{correctionStatus.message}</span>
                  </div>
                )}

                {/* Reviewer Details Card */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">
                    {getInitials(prov.reviewerName)}
                  </div>
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900">{prov.reviewerName}</div>
                    <div className="text-slate-500">{flag} {country}</div>
                    {activeReview.room_type && <div className="text-slate-500">🛏️ {activeReview.room_type}</div>}
                    {prov.stayDuration && <div className="text-slate-500">📅 {prov.stayDuration}</div>}
                    {activeReview.travel_type && <div className="text-slate-500">🧳 {activeReview.travel_type}</div>}
                  </div>
                </div>

                {/* Review Title */}
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-base text-slate-900">{prov.title}</h4>
                  <span className={`px-2.5 py-1 rounded text-[11px] font-semibold ${
                    sentiment === 'positive'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : sentiment === 'negative'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : sentiment === 'mixed'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'bg-slate-50 text-slate-700 border border-slate-200'
                  }`}>
                    {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
                  </span>
                </div>

                {/* Review Text */}
                <div className="space-y-2">
                  {activeReview.positive_text && (
                    <div className="flex items-start gap-2 p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                      <span className="text-base mt-0.5">😊</span>
                      <p className="text-slate-800">{activeReview.positive_text}</p>
                    </div>
                  )}
                  {activeReview.negative_text && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50/60 border border-rose-200 rounded-lg">
                      <span className="text-base mt-0.5">☹️</span>
                      <p className="text-slate-800">{activeReview.negative_text}</p>
                    </div>
                  )}
                  {!activeReview.positive_text && !activeReview.negative_text && (
                    <p className="p-3 bg-slate-50 border rounded-lg text-slate-700 italic">
                      {activeReview.full_text}
                    </p>
                  )}
                </div>

                {/* Management Response */}
                {prov.managementResponse && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="font-bold text-slate-700 mb-1">💬 Property response:</div>
                    <p className="text-slate-600 leading-relaxed">{prov.managementResponse}</p>
                  </div>
                )}

                {/* AI Metadata & Diagnostics */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 flex items-center gap-1.5">
                      <Sparkles size={14} className="text-purple-600" />
                      AI Model Analysis
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">azzurro-hybrid-nlp-v1</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Classified Sentiment:</span>
                      <p className="font-bold text-slate-800">{sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Model Confidence:</span>
                      <p className="font-bold text-slate-800">
                        {activeReview.sentiment_confidence ? `${Math.round(activeReview.sentiment_confidence * 100)}%` : '88%'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-400">Detected Language:</span>
                      <p className="font-bold text-slate-800">{activeReview.detected_language || activeReview.language || 'en'}</p>
                    </div>
                    <div>
                      <span className="text-slate-400">Source:</span>
                      <p className="font-bold text-slate-800">{activeReview.source || 'booking.com'}</p>
                    </div>
                  </div>

                  {/* Topics breakdown */}
                  {activeReview.topics && activeReview.topics.length > 0 && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="text-slate-500 block mb-1">Operational Topics Classified:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeReview.topics.map((t, idx) => (
                          <span key={idx} className="px-2 py-0.5 rounded bg-white border border-slate-300 font-medium text-[10px]">
                            {t.topic_name} ({t.topic_sentiment})
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Manual Correction Form */}
                {correctionMode ? (
                  <form onSubmit={handleSubmitCorrection} className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 text-xs flex items-center gap-1.5">
                        <Edit3 size={14} /> Record Supervised Manual Correction
                      </span>
                      <button
                        type="button"
                        onClick={() => setCorrectionMode(false)}
                        className="text-xs text-slate-500 hover:text-slate-800"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Corrected Sentiment</label>
                        <select
                          value={correctionSentiment}
                          onChange={(e) => setCorrectionSentiment(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                        >
                          <option value="Positive">Positive</option>
                          <option value="Negative">Negative</option>
                          <option value="Mixed">Mixed</option>
                          <option value="Neutral">Neutral</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Audited By</label>
                        <input
                          type="text"
                          value={correctedBy}
                          onChange={(e) => setCorrectedBy(e.target.value)}
                          className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">Correction Rationale</label>
                      <input
                        type="text"
                        placeholder="e.g. Sarcasm detected; guest was complimenting staff despite score"
                        value={correctionReason}
                        onChange={(e) => setCorrectionReason(e.target.value)}
                        className="w-full p-2 border border-slate-300 rounded bg-white text-xs"
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition-colors text-xs"
                    >
                      Save Audited Correction
                    </button>
                  </form>
                ) : null}
              </div>

              {/* Modal Actions */}
              <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                <button
                  onClick={() => handleReanalyze(activeReview.id)}
                  disabled={reanalyzing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                >
                  <RefreshCw size={13} className={reanalyzing ? 'animate-spin' : ''} />
                  {reanalyzing ? 'Reanalyzing...' : 'Reanalyze with Local AI'}
                </button>

                {!correctionMode && (
                  <button
                    onClick={() => setCorrectionMode(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-azzurro-600 text-white rounded-lg text-xs font-bold hover:bg-azzurro-700"
                  >
                    <Edit3 size={13} />
                    Record Manual Correction
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
