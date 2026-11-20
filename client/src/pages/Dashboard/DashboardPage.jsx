import { Hotel, Star } from 'lucide-react';

const PROPERTIES = [
  { id: 'PROP-01', name: 'Olympic Hotel Paddington', suburb: 'Paddington' },
  { id: 'PROP-02', name: 'Venus Potts Point',        suburb: 'Potts Point' },
  { id: 'PROP-03', name: 'Venus Central Sydney',     suburb: 'Surry Hills' },
  { id: 'PROP-04', name: 'Château de Venus',         suburb: 'Darling Harbour' },
];

function PropertyCard({ property }) {
  return (
    <div className="card flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-azzurro-100 flex items-center justify-center shrink-0">
        <Hotel size={18} className="text-azzurro-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{property.name}</p>
        <p className="text-sm text-gray-500">{property.suburb}, Sydney</p>
        <div className="flex items-center gap-1 mt-2">
          <Star size={12} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-gray-400">No data yet — connect Supabase to begin</span>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Portfolio Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Overview of all Azzurro Hotels properties
        </p>
      </div>

      {/* Setup Banner */}
      <div className="card border-azzurro-200 bg-azzurro-50">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-azzurro-100 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-azzurro-700 text-xs font-bold">i</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-azzurro-800">Foundation Phase Active</p>
            <p className="text-sm text-azzurro-700 mt-0.5">
              Connect Supabase in <code className="bg-azzurro-100 px-1 rounded text-xs">server/.env</code> and
              run database migrations (Phase 3) to populate live data.
            </p>
          </div>
        </div>
      </div>

      {/* Property Cards */}
      <div>
        <h2 className="text-base font-semibold text-gray-700 mb-3">Properties</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROPERTIES.map((p) => (
            <PropertyCard key={p.id} property={p} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;

