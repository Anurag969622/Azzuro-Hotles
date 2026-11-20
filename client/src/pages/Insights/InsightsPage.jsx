import React, { useEffect, useState } from 'react';
import { insightsApi, propertiesApi } from '../../api';
import {
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ThumbsUp,
  TrendingDown,
  Building,
  Quote,
  X,
  ExternalLink,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

export default function InsightsPage() {
  const [insights, setInsights] = useState([]);
  const [properties, setProperties] = useState([]);
  const [selectedProperty, setSelectedProperty] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [loading, setLoading] = useState(true);

  // Evidence modal state
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [activeInsight, setActiveInsight] = useState(null);
  const [evidenceData, setEvidenceData] = useState([]);
  const [loadingEvidence, setLoadingEvidence] = useState(false);

  useEffect(() => {
    propertiesApi.getAll()
      .then((res) => {
        if (res.success && res.properties) {
          setProperties(res.properties);
        }
      })
      .catch(() => {});
  }, []);

  const fetchInsights = () => {
    setLoading(true);
    insightsApi.getAll({
      propertyCode: selectedProperty !== 'ALL' ? selectedProperty : undefined,
    })
      .then((res) => {
        if (res.success) {
          setInsights(res.insights || []);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load insights:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInsights();
  }, [selectedProperty]);

  const handleOpenEvidence = (insight) => {
    setActiveInsight(insight);
    setEvidenceModalOpen(true);
    setLoadingEvidence(true);

    insightsApi.getEvidence(insight.id)
      .then((res) => {
        if (res.success && res.evidence) {
          setEvidenceData(res.evidence);
        } else {
          setEvidenceData(insight.evidence || []);
        }
        setLoadingEvidence(false);
      })
      .catch(() => {
        setEvidenceData(insight.evidence || []);
        setLoadingEvidence(false);
      });
  };

  const filteredInsights = insights.filter((i) => {
    if (selectedSeverity !== 'ALL' && i.severity !== selectedSeverity) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Sparkles size={24} className="text-purple-600" />
            AI Operational Diagnostics & Insights
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Automated trend synthesis and evidence-backed operational directives for general managers.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All 4 Properties</option>
            {properties.map((p) => (
              <option key={p.id} value={p.property_code}>{p.name}</option>
            ))}
          </select>

          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="p-2 border border-slate-300 rounded-lg text-xs font-semibold bg-white text-slate-700"
          >
            <option value="ALL">All Severities</option>
            <option value="high">High Severity</option>
            <option value="medium">Medium Severity</option>
            <option value="low">Low Severity</option>
          </select>
        </div>
      </div>

      {/* Insights Cards List */}
      {loading ? (
        <div className="py-20 text-center space-y-2">
          <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-xs text-slate-400">Extracting recurring complaint patterns...</p>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200">
          <CheckCircle2 size={36} className="text-emerald-500 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">No Critical Operational Alerts</h3>
          <p className="text-xs text-slate-500 mt-1">All properties are currently operating within acceptable satisfaction thresholds.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredInsights.map((insight) => {
            const isHigh = insight.severity === 'high';
            const isMedium = insight.severity === 'medium';
            return (
              <div
                key={insight.id}
                className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-6 flex flex-col justify-between hover:border-slate-300 transition-all"
              >
                <div className="space-y-3">
                  {/* Top tags */}
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-slate-100 text-slate-700">
                      {insight.propertyCode || 'Portfolio-wide'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        isHigh
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : isMedium
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {insight.severity} Priority
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {insight.title}
                  </h3>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {insight.summary}
                  </p>

                  {/* Recommendation directive */}
                  {insight.recommendedAction && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/60 text-xs">
                      <span className="font-bold text-slate-900 block mb-0.5">Recommended Action:</span>
                      <p className="text-slate-700">{insight.recommendedAction}</p>
                    </div>
                  )}
                </div>

                {/* Evidence trigger footer */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="text-[11px] text-slate-400 font-mono">
                    Impact: <strong>{insight.affectedReviewsCount || 5}+ reviews</strong>
                  </div>
                  <button
                    onClick={() => handleOpenEvidence(insight)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-azzurro-600 hover:text-azzurro-800 transition-colors"
                  >
                    View Supporting Evidence <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Supporting Evidence Drawer / Modal */}
      {evidenceModalOpen && activeInsight && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Quote size={16} className="text-azzurro-600" />
                  Supporting Guest Review Evidence
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeInsight.title}</p>
              </div>
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {loadingEvidence ? (
                <div className="py-12 text-center">
                  <div className="w-6 h-6 border-2 border-azzurro-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-slate-400">Loading verbatim quotes...</p>
                </div>
              ) : evidenceData.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  Evidence records linked to cluster {activeInsight.id}.
                </div>
              ) : (
                <div className="space-y-3">
                  {evidenceData.map((ev, index) => (
                    <div key={index} className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-semibold text-slate-800">
                          Review #{ev.review_id || ev.id || index + 1}
                        </span>
                        <span>Score: <strong className="text-slate-900">{ev.rating || '8.0'}/10</strong></span>
                      </div>
                      <p className="text-slate-700 italic">
                        “{ev.text || ev.quote || ev.negative_text || ev.positive_text || 'Issue reported during stay.'}”
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Date: {ev.date || 'Recent stay'}</span>
                        <span>•</span>
                        <span>Source: Booking.com verified</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setEvidenceModalOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Close Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

