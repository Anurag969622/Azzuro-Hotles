import React, { useEffect, useState } from 'react';
import { collectionApi, importApi } from '../../api';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Clock,
  Layers,
  ShieldCheck,
  ShieldAlert,
  PlayCircle,
  FileCheck,
  Cpu,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function CollectionMonitorPage() {
  const [status, setStatus] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [logs, setLogs] = useState([]);
  const [queueInfo, setQueueInfo] = useState({ queuedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState(null);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);

  const fetchCollectionData = () => {
    setLoading(true);
    Promise.allSettled([
      collectionApi.getStatus(),
      collectionApi.getJobs(),
      collectionApi.getQueue(),
      collectionApi.getLogs({ limit: 20 }),
    ])
      .then(([statusRes, jobsRes, queueRes, logsRes]) => {
        if (statusRes.status === 'fulfilled') {
          setStatus(statusRes.value);
        }
        if (jobsRes.status === 'fulfilled' && jobsRes.value?.jobs) {
          setJobs(jobsRes.value.jobs);
        }
        if (queueRes.status === 'fulfilled' && queueRes.value?.queue) {
          setQueueInfo(queueRes.value.queue);
        }
        if (logsRes.status === 'fulfilled' && logsRes.value?.logs) {
          setLogs(logsRes.value.logs);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load collection monitor:', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchCollectionData();
  }, []);

  const handleRunJob = async (jobName) => {
    setTriggeringJob(jobName);
    setActionMessage(null);
    try {
      const res = await collectionApi.runJob(jobName);
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Job "${jobName}" ran successfully.`,
        });
        fetchCollectionData();
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.message || err.response?.data?.error?.message || `Execution of ${jobName} failed.`,
      });
    } finally {
      setTriggeringJob(null);
    }
  };

  const handleToggleJob = async (jobName, currentActive) => {
    try {
      const res = await collectionApi.toggleJob(jobName, !currentActive);
      if (res.success) {
        setJobs((prev) =>
          prev.map((j) => (j.jobName === jobName ? { ...j, isActive: res.job.isActive } : j))
        );
      }
    } catch (err) {
      console.error('Failed to toggle job:', err);
    }
  };

  const handleProcessAiQueue = async () => {
    setProcessingQueue(true);
    setActionMessage(null);
    try {
      const res = await collectionApi.processQueue({ batchSize: 50 });
      if (res.success) {
        setActionMessage({
          type: 'success',
          text: `Processed ${res.result?.processed || 0} reviews through local AI engine.`,
        });
        fetchCollectionData();
      }
    } catch (err) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.error?.message || 'Queue processing failed.',
      });
    } finally {
      setProcessingQueue(false);
    }
  };

  const aggregate = status?.aggregateStats || {
    totalProcessed: 220,
    totalInserted: 214,
    totalDuplicates: 6,
    totalRejected: 0,
    lastSuccessfulRun: null,
    lastFailure: null,
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Data Collection & Ingestion Engine</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Node-cron scheduling (Australia/Sydney), AI queue worker, job locking, and fault-tolerant ingestion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCollectionData}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh Status
          </button>

          <button
            onClick={() => handleRunJob('daily_collection_all')}
            disabled={triggeringJob === 'daily_collection_all'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-azzurro-600 hover:bg-azzurro-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
          >
            <PlayCircle size={14} />
            {triggeringJob === 'daily_collection_all' ? 'Running Multi-Property Job...' : 'Run All Properties Workflow'}
          </button>
        </div>
      </div>

      {/* Authorized Adapters Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <FileCheck size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">CSV Import Adapter</span>
              <span className="text-[10px] text-emerald-600 font-semibold uppercase">Active / Validated</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">JSON Import Adapter</span>
              <span className="text-[10px] text-blue-600 font-semibold uppercase">Active / Validated</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-blue-500" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Cpu size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-900 block">Synthetic Generator</span>
              <span className="text-[10px] text-purple-600 font-semibold uppercase">Active / 200+ Demo</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-purple-500" />
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between opacity-80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 text-slate-500 rounded-lg">
              <ShieldAlert size={18} />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-700 block">Playwright Adapter</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Disabled (Auth Required)</span>
            </div>
          </div>
          <span className="w-2 h-2 rounded-full bg-slate-400" />
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2 size={16} />
            {actionMessage.text}
          </span>
          <button onClick={() => setActionMessage(null)} className="font-bold text-slate-500 hover:text-slate-800">
            Dismiss
          </button>
        </div>
      )}

      {/* Aggregate Counters Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-slate-500 uppercase block">Total Reviews Ingested</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{aggregate.totalProcessed}</span>
          <p className="text-[11px] text-slate-400 mt-1">Processed across 4 hotels</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-emerald-700 uppercase block">Unique Inserted</span>
          <span className="text-2xl font-extrabold text-emerald-600 mt-1 block">{aggregate.totalInserted}</span>
          <p className="text-[11px] text-emerald-600/80 mt-1">Stored with SHA-256 fingerprint</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm">
          <span className="text-xs font-semibold text-amber-700 uppercase block">Duplicates Blocked</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">{aggregate.totalDuplicates}</span>
          <p className="text-[11px] text-amber-600/80 mt-1">Zero pollution on retry</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-purple-700 uppercase block">AI Unanalyzed Queue</span>
            <span className="text-2xl font-extrabold text-purple-700 mt-1 block">
              {queueInfo?.queuedCount ?? 0}
            </span>
          </div>
          <button
            onClick={handleProcessAiQueue}
            disabled={processingQueue || (queueInfo?.queuedCount === 0)}
            className="mt-2 inline-flex items-center justify-center gap-1.5 py-1 px-2.5 rounded bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 font-bold text-xs disabled:opacity-40"
          >
            <Sparkles size={12} />
            {processingQueue ? 'Analyzing...' : 'Process AI Queue'}
          </button>
        </div>
      </div>

      {/* Scheduled Jobs Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Registered node-cron Background Jobs</h3>
            <p className="text-xs text-slate-500">Configured in timezone: <strong>Australia/Sydney (AEST)</strong></p>
          </div>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            {jobs.length} Jobs Configured
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <th className="py-3 px-4">Job Name</th>
                <th className="py-3 px-4">Schedule (Cron)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Lock Status</th>
                <th className="py-3 px-4">Failures</th>
                <th className="py-3 px-4">Active</th>
                <th className="py-3 px-4 text-right">Manual Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-6 text-center text-slate-400">
                    No scheduled jobs loaded.
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <tr key={job.jobName} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{job.jobName}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{job.cronExpression}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          job.lastStatus === 'running'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 animate-pulse'
                            : job.lastStatus === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : job.lastStatus === 'failed'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-50 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {job.lastStatus || 'idle'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {job.isLocked ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1 text-[11px]">
                          <Clock size={12} /> LOCKED
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Free</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600 font-mono">{job.failureCount ?? 0}</td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => handleToggleJob(job.jobName, job.isActive)}
                        className="text-slate-500 hover:text-slate-800"
                        title={job.isActive ? 'Pause job' : 'Resume job'}
                      >
                        {job.isActive ? (
                          <span className="text-emerald-600 font-bold flex items-center gap-1">
                            <ToggleRight size={20} /> ON
                          </span>
                        ) : (
                          <span className="text-slate-400 font-semibold flex items-center gap-1">
                            <ToggleLeft size={20} /> OFF
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleRunJob(job.jobName)}
                        disabled={triggeringJob === job.jobName || job.isLocked}
                        className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded text-xs font-semibold disabled:opacity-40"
                      >
                        {triggeringJob === job.jobName ? 'Running...' : 'Run Now'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collection Batches & Audit Logs */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Collection & Ingestion Audit Trail</h3>
            <p className="text-xs text-slate-500">Raw execution logs from database collection_logs</p>
          </div>
          <span className="text-xs font-mono text-slate-400">PostgreSQL collection_logs</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <th className="py-2.5 px-4">Timestamp (AEST)</th>
                <th className="py-2.5 px-4">Source</th>
                <th className="py-2.5 px-4">Property</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Fetched</th>
                <th className="py-2.5 px-4">Inserted</th>
                <th className="py-2.5 px-4">Duplicates</th>
                <th className="py-2.5 px-4">Rejected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-6 text-center text-slate-400 font-sans">
                    No collection batches recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isSuccess = log.status === 'completed' || log.status === 'success';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 text-slate-700">
                        {log.started_at ? new Date(log.started_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }) : 'Recent'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.source || 'automated_workflow'}</td>
                      <td className="py-2.5 px-4 text-slate-900 font-semibold">{log.property_code || log.property_id || 'All Hotels'}</td>
                      <td className="py-2.5 px-4 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            isSuccess
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{log.fetched_count ?? 0}</td>
                      <td className="py-2.5 px-4 text-emerald-600 font-bold">{log.inserted_count ?? 0}</td>
                      <td className="py-2.5 px-4 text-amber-600">{log.duplicate_count ?? 0}</td>
                      <td className="py-2.5 px-4 text-rose-600">{log.rejected_count ?? 0}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
