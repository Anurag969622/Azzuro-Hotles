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

  // Selected review for Inspection / Correction Modal
  const [activeReview, setActiveReview] = useState(null);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [correctionMode, setCorrectionMode] = useState(false);
  const [correctionSentiment, setCorrectionSentiment] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctedBy, setCorrectedBy] = useState('Hotel Operations Manager');
  const [correctionStatus, setCorrectionStatus] = useState(null);

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
  }, [page, selectedProperty, selectedSentiment, selectedRating, selectedTopic]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchReviews();
  };

  const handleOpenReview = (rev) => {
    setActiveReview(rev);
    setCorrectionMode(false);
    setCorrectionSentiment(rev.overallSentiment || 'Positive');
    setCorrectionReason('');
    setCorrectionStatus(null);
  };

  const handleReanalyze = async (reviewId) => {
    setReanalyzing(true);
    try {
      const res = await reviewsApi.reanalyze(reviewId);
      if (res.success && res.result) {
        // Update local review
        setActiveReview((prev) => ({
          ...prev,
          overallSentiment: res.result.overall_sentiment,
          sentimentConfidence: res.result.sentiment_confidence,
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
        oldValue: activeReview.overallSentiment,
        newValue: correctionSentiment,
        reason: correctionReason,
        correctedBy: correctedBy,
      });

      if (res.success) {
        setCorrectionStatus({ type: 'success', message: 'Manual correction saved with full audit trail.' });
        setActiveReview((prev) => ({
          ...prev,
          overallSentiment: correctionSentiment,
        }));
        setCorrectionMode(false);
        fetchReviews();
      }
    } catch (err) {
      setCorrectionStatus({ type: 'error', message: err.response?.data?.error?.message || 'Failed to record correction.' });
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

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

        {/* Dropdown Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
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
      </div>

      {/* Reviews Table / List */}
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
            <p className="text-xs text-slate-400 mt-1">Try resetting your topic, sentiment or search criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((rev) => (
              <div
                key={rev.id}
                onClick={() => handleOpenReview(rev)}
                className="p-5 hover:bg-slate-50/70 transition-colors cursor-pointer space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-slate-900 text-white font-mono font-bold rounded text-xs">
                      {rev.rating ? Number(rev.rating).toFixed(1) : '8.0'}
                    </span>
                    <span className="font-bold text-xs text-slate-900">
                      {rev.propertyName || rev.propertyCode}
                    </span>
                    <span className="text-[11px] text-slate-400">• {rev.reviewDate || 'Recent'}</span>
                    <span className="text-[11px] text-slate-400">• {rev.reviewerCountry || 'Australia'}</span>
                    <span className="text-[11px] text-slate-400 font-mono">[{rev.source || 'booking.com'}]</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        rev.overallSentiment === 'Positive'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : rev.overallSentiment === 'Negative'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : rev.overallSentiment === 'Mixed'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-slate-50 text-slate-700 border border-slate-200'
                      }`}
                    >
                      {rev.overallSentiment || 'Unclassified'}
                    </span>
                    {rev.sentimentConfidence && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        {Math.round(rev.sentimentConfidence * 100)}% conf
                      </span>
                    )}
                  </div>
                </div>

                {/* Review Body (Positive & Negative segments) */}
                <div className="text-xs space-y-1.5 text-slate-700">
                  {rev.positiveText && (
                    <div className="flex items-start gap-1.5">
                      <ThumbsUp size={13} className="text-emerald-600 mt-0.5 shrink-0" />
                      <p className="text-emerald-950 font-normal">
                        {rev.positiveText}
                      </p>
                    </div>
                  )}
                  {rev.negativeText && (
                    <div className="flex items-start gap-1.5">
                      <ThumbsDown size={13} className="text-rose-600 mt-0.5 shrink-0" />
                      <p className="text-rose-950 font-normal">
                        {rev.negativeText}
                      </p>
                    </div>
                  )}
                  {!rev.positiveText && !rev.negativeText && rev.fullText && (
                    <p className="text-slate-700 italic">“{rev.fullText}”</p>
                  )}
                </div>

                {/* Topics Pills */}
                {rev.topics && rev.topics.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {rev.topics.map((t, idx) => (
                      <span
                        key={idx}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                          t.topic_sentiment === 'Positive'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : t.topic_sentiment === 'Negative'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {t.topic_name}: {t.topic_sentiment}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
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
      {activeReview && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-azzurro-600 text-white flex items-center justify-center font-bold text-xs">
                  {Number(activeReview.rating).toFixed(1)}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeReview.propertyName || activeReview.propertyCode}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    ID: <code className="font-mono">{activeReview.sourceReviewId || activeReview.id}</code>
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

              {/* Review Text */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 uppercase text-[10px] tracking-wider">Guest Feedback</h4>
                {activeReview.positiveText && (
                  <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg">
                    <p className="font-semibold text-emerald-900 text-[11px] mb-0.5">Positive Verbatim:</p>
                    <p className="text-slate-800">{activeReview.positiveText}</p>
                  </div>
                )}
                {activeReview.negativeText && (
                  <div className="p-3 bg-rose-50/60 border border-rose-200 rounded-lg">
                    <p className="font-semibold text-rose-900 text-[11px] mb-0.5">Negative Verbatim:</p>
                    <p className="text-slate-800">{activeReview.negativeText}</p>
                  </div>
                )}
                {!activeReview.positiveText && !activeReview.negativeText && (
                  <p className="p-3 bg-slate-50 border rounded-lg text-slate-700 italic">
                    {activeReview.fullText}
                  </p>
                )}
              </div>

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
                    <p className="font-bold text-slate-800">{activeReview.overallSentiment || 'Mixed'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Model Confidence:</span>
                    <p className="font-bold text-slate-800">
                      {activeReview.sentimentConfidence ? `${Math.round(activeReview.sentimentConfidence * 100)}%` : '88%'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400">Detected Language:</span>
                    <p className="font-bold text-slate-800">{activeReview.language || 'en'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400">Fingerprint (SHA-256):</span>
                    <p className="font-mono text-[10px] text-slate-600 truncate">{activeReview.fingerprint || 'e3b0c44298fc1c149afb...'}</p>
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
      )}
    </div>
  );
}

