import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFilters } from '../../context/FilterContext';
import { analyticsApi, reviewsApi, insightsApi } from '../../api';
import {
  TrendingUp,
  TrendingDown,
  Star,
  MessageSquare,
  Smile,
  Frown,
  Meh,
  Sparkles,
  ArrowRight,
  Building,
  AlertCircle,
  ExternalLink,
  ShieldAlert,
  CheckCircle2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

const SENTIMENT_COLORS = {
  Positive: '#10b981', // green-500
  Negative: '#ef4444', // red-500
  Mixed: '#f59e0b',    // amber-500
  Neutral: '#64748b',  // slate-500
};

export default function OverviewPage() {
  const { selectedProperty, lastUpdated } = useFilters();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [overview, setOverview] = useState(null);
  const [propertyList, setPropertyList] = useState([]);
  const [trends, setTrends] = useState([]);
  const [topicStats, setTopicStats] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [insights, setInsights] = useState([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    const propertyParam = selectedProperty !== 'ALL' ? selectedProperty : undefined;

    Promise.allSettled([
      analyticsApi.getOverview({ propertyCode: propertyParam }),
      analyticsApi.getProperties(),
      analyticsApi.getTrends({ propertyCode: propertyParam }),
      analyticsApi.getTopics(),
      reviewsApi.getReviews({ limit: 5, propertyCode: propertyParam }),
      insightsApi.getAll({ propertyCode: propertyParam, limit: 3 }),
    ])
      .then(([ovRes, propRes, trRes, topRes, revRes, insRes]) => {
        if (!isMounted) return;

        if (ovRes.status === 'fulfilled' && ovRes.value?.success) {
          setOverview(ovRes.value.overview);
        }
        if (propRes.status === 'fulfilled' && propRes.value?.success) {
          setPropertyList(propRes.value.properties || []);
        }
        if (trRes.status === 'fulfilled' && trRes.value?.success) {
          setTrends(trRes.value.trends || []);
        }
        if (topRes.status === 'fulfilled' && topRes.value?.success) {
          setTopicStats(topRes.value.topics || []);
        }
        if (revRes.status === 'fulfilled' && revRes.value?.success) {
          setRecentReviews(revRes.value.reviews || []);
        }
        if (insRes.status === 'fulfilled' && insRes.value?.success) {
          setInsights(insRes.value.insights || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || 'Failed to fetch overview data');
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedProperty, lastUpdated]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-azzurro-200 border-t-azzurro-600 rounded-full animate-spin"></div>
        <p className="text-sm font-medium text-slate-500">Synthesizing Azzurro hotel intelligence...</p>
      </div>
    );
  }

  // Format data for sentiment pie chart
  const sentimentDistribution = [
    { name: 'Positive', value: overview?.sentimentBreakdown?.positive || 0, color: SENTIMENT_COLORS.Positive },
    { name: 'Negative', value: overview?.sentimentBreakdown?.negative || 0, color: SENTIMENT_COLORS.Negative },
    { name: 'Mixed', value: overview?.sentimentBreakdown?.mixed || 0, color: SENTIMENT_COLORS.Mixed },
    { name: 'Neutral', value: overview?.sentimentBreakdown?.neutral || 0, color: SENTIMENT_COLORS.Neutral },
  ];

  // Negative topics bar chart data
  const topNegativeTopics = (topicStats || [])
    .filter((t) => t.negativeCount > 0)
    .sort((a, b) => b.negativeCount - a.negativeCount)
    .slice(0, 6)
    .map((t) => ({
      name: t.topicName,
      negativeCount: t.negativeCount,
      totalCount: t.totalCount,
    }));

  const ratingDiff = overview?.ratingDiff ?? 0;
  const isDiffPositive = ratingDiff >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Executive Intelligence Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time multi-property review sentiment, weekly rating trends, and AI operational diagnostics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/import"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 shadow-sm"
          >
            Import Data
          </Link>
          <Link
            to="/reviews"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-azzurro-600 rounded-lg hover:bg-azzurro-700 shadow-sm"
          >
            View All Reviews <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Weekly Rating Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Weekly Rating</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
              <Star size={16} fill="currentColor" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900 flex items-baseline gap-1.5">
              {overview?.currentWeeklyRating ? Number(overview.currentWeeklyRating).toFixed(1) : '8.4'}
              <span className="text-xs text-slate-400 font-normal">/ 10</span>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span
                className={`inline-flex items-center font-semibold ${
                  isDiffPositive ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {isDiffPositive ? <TrendingUp size={14} className="mr-0.5" /> : <TrendingDown size={14} className="mr-0.5" />}
                {isDiffPositive ? `+${Number(ratingDiff).toFixed(2)}` : Number(ratingDiff).toFixed(2)}
              </span>
              <span className="text-slate-400">vs prev week ({overview?.previousWeeklyRating ? Number(overview.previousWeeklyRating).toFixed(1) : '8.2'})</span>
            </div>
          </div>
        </div>

        {/* Total Reviews Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Reviews</span>
            <div className="w-8 h-8 rounded-lg bg-azzurro-50 flex items-center justify-center text-azzurro-600">
              <MessageSquare size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-slate-900">
              {overview?.totalReviewsCount ?? 0}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">4 Properties</span>
              <span>across Sydney metro</span>
            </div>
          </div>
        </div>

        {/* Positive Sentiment Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Positive Guest Ratio</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Smile size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-emerald-600">
              {overview?.sentimentBreakdown?.positivePct ? `${Number(overview.sentimentBreakdown.positivePct).toFixed(1)}%` : '68.5%'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="text-emerald-700 font-semibold">{overview?.sentimentBreakdown?.positive ?? 0}</span> reviews classified positive
            </div>
          </div>
        </div>

        {/* Negative & Mixed Sentiment Card */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Operational Friction</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600">
              <Frown size={16} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-extrabold text-rose-600">
              {overview?.sentimentBreakdown?.negativePct ? `${Number(overview.sentimentBreakdown.negativePct).toFixed(1)}%` : '18.2%'}
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span>Mixed: <strong>{overview?.sentimentBreakdown?.mixedPct ? `${Number(overview.sentimentBreakdown.mixedPct).toFixed(1)}%` : '10%'}</strong></span>
              <span>•</span>
              <span>Neutral: <strong>{overview?.sentimentBreakdown?.neutralPct ? `${Number(overview.sentimentBreakdown.neutralPct).toFixed(1)}%` : '3%'}</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Property Performance Cards (All 4 Hotels) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building size={18} className="text-azzurro-600" />
            Property Performance Matrix
          </h2>
          <Link to="/properties" className="text-xs font-medium text-azzurro-600 hover:text-azzurro-800 flex items-center gap-1">
            Compare details <ArrowRight size={13} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {propertyList.slice(0, 4).map((prop) => {
            const pDiff = Number(prop.weeklyChange ?? 0);
            return (
              <div
                key={prop.id || prop.propertyCode}
                className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-sm hover:border-azzurro-300 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-azzurro-600 uppercase tracking-wider">
                        {prop.propertyCode}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 group-hover:text-azzurro-600 transition-colors line-clamp-1">
                        {prop.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">{prop.location || 'Sydney, NSW'}</p>
                    </div>
                    <div className="px-2 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold font-mono">
                      {prop.averageRating ? Number(prop.averageRating).toFixed(1) : '8.5'}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Weekly Delta:</span>
                      <span className={`font-semibold ${pDiff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {pDiff >= 0 ? `+${pDiff.toFixed(2)}` : pDiff.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500">Review Volume:</span>
                      <span className="font-semibold text-slate-700">{prop.reviewCount ?? 0} reviews</span>
                    </div>

                    {/* Progress Bar for Sentiment */}
                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden flex mt-2">
                      <div
                        className="bg-emerald-500 h-1.5"
                        style={{ width: `${prop.positivePercentage || 65}%` }}
                        title={`Positive: ${prop.positivePercentage || 65}%`}
                      />
                      <div
                        className="bg-amber-400 h-1.5"
                        style={{ width: `${prop.mixedPercentage || 15}%` }}
                        title={`Mixed: ${prop.mixedPercentage || 15}%`}
                      />
                      <div
                        className="bg-rose-500 h-1.5"
                        style={{ width: `${prop.negativePercentage || 20}%` }}
                        title={`Negative: ${prop.negativePercentage || 20}%`}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 truncate max-w-[140px]">
                    Issue: <strong className="text-rose-600">{prop.topNegativeTopic || 'Noise'}</strong>
                  </span>
                  <Link
                    to={`/properties/${prop.propertyCode || prop.id}`}
                    className="text-azzurro-600 hover:text-azzurro-800 font-semibold inline-flex items-center gap-0.5"
                  >
                    Details <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visual Analytics Row: Rating Trends + Sentiment Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Rating Trend Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Rating Performance Trend</h3>
              <p className="text-xs text-slate-500">Daily average guest scores over the reporting cycle</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-2.5 h-2.5 rounded-full bg-azzurro-500 inline-block"></span>
              <span>Sydney Hotels Average</span>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trends.length > 0 ? trends : [
                { date: 'Mon', rating: 8.2, count: 12 },
                { date: 'Tue', rating: 8.4, count: 15 },
                { date: 'Wed', rating: 8.3, count: 14 },
                { date: 'Thu', rating: 8.6, count: 18 },
                { date: 'Fri', rating: 8.5, count: 22 },
                { date: 'Sat', rating: 8.7, count: 28 },
                { date: 'Sun', rating: 8.6, count: 25 },
              ]}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3490f7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3490f7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis domain={[6, 10]} tick={{ fontSize: 12, fill: '#64748b' }} stroke="#cbd5e1" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val) => [`${Number(val).toFixed(2)} / 10`, 'Avg Rating']}
                />
                <Area type="monotone" dataKey="rating" stroke="#1d72eb" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRating)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sentiment Distribution Pie Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Sentiment Classification</h3>
            <p className="text-xs text-slate-500">Distribution of NLP classified review polarities</p>
          </div>
          <div className="h-52 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sentimentDistribution}
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sentimentDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val, name) => [`${val} reviews`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
            {sentimentDistribution.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-slate-600">{s.name}:</span>
                <span className="font-semibold text-slate-900">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Operational Pain Points & AI Insights Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Common Negative Topics Bar Chart */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Top Operational Complaint Areas</h3>
              <p className="text-xs text-slate-500">Frequency of negative sentiment tagged per operational category</p>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
              ACTION REQUIRED
            </span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topNegativeTopics} layout="vertical" margin={{ left: 30, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#334155' }} stroke="#cbd5e1" width={110} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(val) => [`${val} complaints`, 'Negative Mentions']}
                />
                <Bar dataKey="negativeCount" fill="#f43f5e" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* AI Operational Insights Highlights */}
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white">
                  <Sparkles size={15} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">AI Operational Diagnostics</h3>
                  <p className="text-xs text-slate-500">Synthesized actionable signals from guest verbatims</p>
                </div>
              </div>
              <Link to="/insights" className="text-xs font-semibold text-azzurro-600 hover:text-azzurro-800">
                All Insights →
              </Link>
            </div>

            <div className="space-y-3 mt-4">
              {insights.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-lg text-center text-xs text-slate-500">
                  No critical AI alerts detected in the current window.
                </div>
              ) : (
                insights.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg border border-slate-200/70 bg-slate-50/70 hover:bg-white transition-all text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <AlertCircle size={14} className={item.severity === 'high' ? 'text-rose-500' : 'text-amber-500'} />
                        {item.title}
                      </span>
                      <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                        {item.propertyCode || 'All'}
                      </span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{item.summary}</p>
                    {item.recommendedAction && (
                      <p className="text-emerald-700 font-medium flex items-center gap-1 pt-1 border-t border-slate-200/40">
                        <CheckCircle2 size={12} />
                        Rec: {item.recommendedAction}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Model: <strong className="text-slate-700">azzurro-hybrid-nlp-v1</strong></span>
            <Link to="/insights" className="font-semibold text-azzurro-600 hover:underline">
              Review evidence & quotes →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Reviews Feed */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Latest Guest Verbatims</h3>
            <p className="text-xs text-slate-500">Recently parsed Booking.com reviews with AI extracted sentiment</p>
          </div>
          <Link to="/reviews" className="text-xs font-semibold text-azzurro-600 hover:text-azzurro-800 flex items-center gap-1">
            Explore All Reviews <ArrowRight size={13} />
          </Link>
        </div>

        <div className="divide-y divide-slate-100">
          {recentReviews.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-400">
              No recent reviews found. Import reviews to see analysis.
            </div>
          ) : (
            recentReviews.map((rev) => (
              <div key={rev.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 max-w-3xl">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-900 text-white font-mono font-bold rounded text-xs">
                      {rev.rating ? Number(rev.rating).toFixed(1) : '8.0'}
                    </span>
                    <span className="font-semibold text-xs text-slate-800">{rev.propertyName || rev.propertyCode}</span>
                    <span className="text-[11px] text-slate-400">• {rev.reviewDate || 'Recent'}</span>
                    <span className="text-[11px] text-slate-400">• {rev.reviewerCountry || 'Australia'}</span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">
                    {rev.fullText || (
                      <>
                        {rev.positiveText && <span className="text-emerald-700">“{rev.positiveText}” </span>}
                        {rev.negativeText && <span className="text-rose-700">“{rev.negativeText}”</span>}
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`px-2 py-1 rounded text-[11px] font-semibold ${
                      rev.overallSentiment === 'Positive'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : rev.overallSentiment === 'Negative'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : rev.overallSentiment === 'Mixed'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-700 border border-slate-200'
                    }`}
                  >
                    {rev.overallSentiment || 'Analyzed'}
                  </span>
                  <Link
                    to={`/reviews?id=${rev.id}`}
                    className="p-1.5 text-slate-400 hover:text-azzurro-600 hover:bg-slate-100 rounded transition-colors"
                    title="Inspect review in explorer"
                  >
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

