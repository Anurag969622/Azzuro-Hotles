import { useQuery } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { healthApi } from '../../api/health.api';

const STATUS_ICON = {
  ok:       <CheckCircle size={16} className="text-green-500" />,
  degraded: <AlertCircle size={16} className="text-yellow-500" />,
  error:    <XCircle    size={16} className="text-red-500" />,
};

function CheckRow({ label, check }) {
  const icon = STATUS_ICON[check?.status] ?? STATUS_ICON.error;
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon}
        {label}
      </div>
      <div className="text-right">
        <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${
          check?.status === 'ok'
            ? 'bg-green-100 text-green-700'
            : check?.status === 'degraded'
            ? 'bg-yellow-100 text-yellow-700'
            : 'bg-red-100 text-red-700'
        }`}>
          {check?.status ?? 'unknown'}
        </span>
        {check?.note && <p className="text-xs text-gray-400 mt-0.5">{check.note}</p>}
        {check?.error && <p className="text-xs text-red-400 mt-0.5">{check.error}</p>}
      </div>
    </div>
  );
}

function SystemStatusPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['health'],
    queryFn: healthApi.getHealth,
    refetchInterval: 30_000, // auto-refresh every 30 s
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
          <p className="text-sm text-gray-500 mt-1">Backend connectivity and service health</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 btn-primary text-sm"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {isLoading && (
        <div className="card flex items-center justify-center py-12 gap-3 text-gray-500">
          <Loader2 size={20} className="animate-spin" />
          Checking services…
        </div>
      )}

      {isError && (
        <div className="card border-red-200 bg-red-50">
          <div className="flex items-center gap-2 text-red-700 font-semibold mb-1">
            <XCircle size={18} />
            Cannot reach the backend server
          </div>
          <p className="text-sm text-red-600">{error?.message}</p>
          <p className="text-xs text-red-400 mt-2">
            Make sure the Express server is running: <code className="bg-red-100 px-1 rounded">npm run dev:server</code>
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800">Service Checks</h2>
              <span className="text-xs text-gray-400">
                Updated {new Date(data.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <CheckRow label="Express Server"    check={data.checks?.server} />
            <CheckRow label="Supabase Database" check={data.checks?.database} />
            <CheckRow label="AI Worker (Python)" check={data.checks?.ai_worker} />
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Server Details</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                ['Environment',  data.environment],
                ['Node.js',      data.system?.node_version],
                ['Uptime',       `${Math.floor(data.uptime_seconds / 60)} min`],
                ['Memory',       `${data.system?.memory_mb} MB`],
                ['Response',     `${data.response_ms} ms`],
                ['Version',      data.version],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-medium text-gray-800">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
          </div>
        </>
      )}
    </div>
  );
}

export default SystemStatusPage;

