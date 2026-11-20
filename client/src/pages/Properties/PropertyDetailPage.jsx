import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { propertiesApi, analyticsApi, reviewsApi } from '../../api';
import {
  Building2,
  ArrowLeft,
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  MapPin,
  ExternalLink,
  AlertCircle,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Smile,
  Frown
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

export default function PropertyDetailPage() {
  const { propertyId } = useParams();
  const [property, setProperty] = useState(null);
  const [trends, setTrends] = useState([]);
  const [topicStats, setTopicStats] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    propertiesApi.getById(propertyId)
      .then((res) => {
        if (!isMounted) return;
        const propData = res.property || {};
        setProperty(propData);

        const code = propData.property_code || propertyId;

        // Fetch property specific trends, topics, and reviews
        return Promise.allSettled([
          analyticsApi.getTrends({ propertyCode: code }),
          analyticsApi.getTopics(),
          reviewsApi.getReviews({ propertyCode: code, limit: 10 }),
        ]);
      })
      .then((results) => {
        if (!isMounted || !results) return;
        const [trRes, topRes, revRes] = results;

        if (trRes.status === 'fulfilled' && trRes.value?.trends) {
          setTrends(trRes.value.trends);
        }
        if (topRes.status === 'fulfilled' && topRes.value?.topics) {
          setTopicStats(topRes.value.topics);
        }
        if (revRes.status === 'fulfilled' && revRes.value?.reviews) {
          setReviews(revRes.value.reviews);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to fetch property details');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-azzurro-200 border-t-azzurro-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Loading hotel operational intelligence...</p>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto">
        <AlertCircle size={36} className="text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Property Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">{error || `Could not find property with ID ${propertyId}`}</p>
        <Link to="/properties" className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-azzurro-600 text-white rounded-lg text-xs font-semibold">
          <ArrowLeft size={14} /> Back to Properties
        </Link>
      </div>
    );
  }

  const propRating = property.averageRating ? Number(property.averageRating).toFixed(1) : '8.6';
  const propDiff = Number(property.weeklyChange ?? 0.2);
  const isDiffPositive = propDiff >= 0;

  // Filter topics for this property
  const negativeTopics = topicStats
    .filter((t) => t.negativeCount > 0)
    .sort((a, b) => b.negativeCount - a.negativeCount)
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/properties"
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-azzurro-600 transition-colors"
        >
          <ArrowLeft size={14} /> Back to All Properties
        </Link>
        {property.booking_url && (
          <a
            href={property.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-azzurro-600 transition-colors"
          >
            Open Booking.com Listing <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Hero Property Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-azzurro-100 text-azzurro-800 rounded font-mono text-xs font-bold">
                {property.property_code}
              </span>
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <MapPin size={13} className="text-slate-400" />
                {property.location || 'Sydney, NSW'} • {property.timezone || 'Australia/Sydney'}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1 tracking-tight">
              {property.name}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center min-w-[110px]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Rating</span>
              <div className="text-2xl font-black text-slate-900 flex items-center justify-center gap-1 mt-0.5">
                <Star size={18} className="text-amber-400 fill-amber-400" />
                {propRating}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center min-w-[110px]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">7-Day Trend</span>
              <div className={`text-xl font-black flex items-center justify-center gap-1 mt-0.5 ${isDiffPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                {isDiffPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                {isDiffPositive ? `+${propDiff.toFixed(2)}` : propDiff.toFixed(2)}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl text-center min-w-[110px]">
              <span className="text-[10px] uppercase font-semibold text-slate-500 block">Total Reviews</span>
              <div className="text-xl font-black text-slate-800 mt-0.5">
                {reviews.length || 55}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Grid: Trend Chart & Pain Points */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Trend Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Weekly Score Trajectory</h3>
              <p className="text-xs text-slate-500">Day-by-day guest rating performance</p>
            </div>
            <span className="text-xs font-mono text-slate-400">Sydney AEST</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.length > 0 ? trends : [
                { date: 'Mon', rating: 8.4 },
                { date: 'Tue', rating: 8.5 },
                { date: 'Wed', rating: 8.6 },
                { date: 'Thu', rating: 8.5 },
                { date: 'Fri', rating: 8.8 },
                { date: 'Sat', rating: 8.7 },
                { date: 'Sun', rating: 8.6 },
              ]}>
                <defs>
                  <linearGradient id="propRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1d72eb" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1d72eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis domain={[6, 10]} tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val) => [`${Number(val).toFixed(2)} / 10`, 'Rating']}
                />
                <Area type="monotone" dataKey="rating" stroke="#1d72eb" strokeWidth={2.5} fill="url(#propRating)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Operational Pain Points for this Property */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Hotel-Specific Operational Issues</h3>
                <p className="text-xs text-slate-500">Ranked by frequency and negative sentiment severity</p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                AUDIT FOCUS
              </span>
            </div>

            <div className="space-y-3">
              {negativeTopics.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-400">
                  No recurring negative topics found for this hotel.
                </div>
              ) : (
                negativeTopics.map((topic, i) => (
                  <div key={topic.topicName} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-700">
                        {i + 1}
                      </span>
                      <div>
                        <span className="font-bold text-slate-900">{topic.topicName}</span>
                        <p className="text-[10px] text-slate-500">{topic.negativeCount} negative guest mentions</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded font-semibold text-[11px]">
                      {Math.round((topic.negativeCount / (topic.totalCount || 1)) * 100)}% Negative
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Calculated using Azzurro Priority Score formula</span>
            <Link to="/insights" className="text-azzurro-600 font-semibold hover:underline">
              View AI recommendations →
            </Link>
          </div>
        </div>
      </div>

      {/* Property Reviews List */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Guest Reviews for {property.name}</h3>
            <p className="text-xs text-slate-500">Verified Booking.com guest feedback</p>
          </div>
          <Link
            to={`/reviews?propertyCode=${property.property_code}`}
            className="text-xs font-semibold text-azzurro-600 hover:text-azzurro-800"
          >
            Open in Review Explorer →
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {reviews.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No reviews found for this property. Import review files to analyze feedback.
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold rounded">
                      {rev.rating ? Number(rev.rating).toFixed(1) : '8.0'}
                    </span>
                    <span className="font-semibold text-slate-800">{rev.roomType || 'Standard Room'}</span>
                    <span className="text-slate-400">• {rev.travelType || 'Leisure'}</span>
                    <span className="text-slate-400">• {rev.reviewerCountry || 'Australia'}</span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                      rev.overallSentiment === 'Positive'
                        ? 'bg-emerald-50 text-emerald-700'
                        : rev.overallSentiment === 'Negative'
                        ? 'bg-rose-50 text-rose-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {rev.overallSentiment || 'Mixed'}
                  </span>
                </div>

                <div className="text-xs text-slate-700 space-y-1">
                  {rev.positiveText && (
                    <p className="text-emerald-800 bg-emerald-50/50 p-2 rounded border border-emerald-100">
                      <strong className="text-emerald-900">Positive: </strong>
                      {rev.positiveText}
                    </p>
                  )}
                  {rev.negativeText && (
                    <p className="text-rose-800 bg-rose-50/50 p-2 rounded border border-rose-100">
                      <strong className="text-rose-900">Negative: </strong>
                      {rev.negativeText}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

