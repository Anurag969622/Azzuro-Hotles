import React, { useEffect, useState } from 'react';
import { useFilters } from '../../context/FilterContext';
import { propertiesApi } from '../../api';
import {
  Calendar,
  Building,
  RefreshCw,
  Clock,
  Sparkles,
  ChevronDown
} from 'lucide-react';

function TopNav() {
  const {
    selectedProperty,
    setSelectedProperty,
    lastUpdated,
    refreshTimestamp,
  } = useFilters();

  const [properties, setProperties] = useState([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    propertiesApi.getAll()
      .then((res) => {
        if (res.success && res.properties) {
          setProperties(res.properties);
        }
      })
      .catch(() => {
        // Fallback default list if backend loading
        setProperties([
          { id: '1', property_code: 'OLYMPIC-PADDINGTON', name: 'Olympic Hotel Paddington' },
          { id: '2', property_code: 'POTTS-POINT', name: 'Potts Point' },
          { id: '3', property_code: 'CENTRAL-SYDNEY', name: 'Central Sydney' },
          { id: '4', property_code: 'DARLING-HARBOUR', name: 'Darling Harbour' },
        ]);
      });
  }, []);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    refreshTimestamp();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
      {/* Left: Property Selector & Reporting Period */}
      <div className="flex items-center gap-4">
        {/* Global Property Filter Dropdown */}
        <div className="relative flex items-center">
          <Building size={16} className="absolute left-3 text-gray-500 pointer-events-none" />
          <select
            value={selectedProperty}
            onChange={(e) => setSelectedProperty(e.target.value)}
            className="pl-9 pr-8 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-semibold text-gray-800 hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-azzurro-500 appearance-none cursor-pointer"
          >
            <option value="ALL">All 4 Azzurro Properties</option>
            {properties.map((prop) => (
              <option key={prop.id || prop.property_code} value={prop.property_code}>
                {prop.name}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 text-gray-500 pointer-events-none" />
        </div>

        {/* Reporting Period Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/70 border border-blue-200 text-blue-900 rounded-lg text-xs font-medium">
          <Calendar size={14} className="text-blue-600" />
          <span>Current Week (Mon – Sun, Sydney AEST)</span>
        </div>
      </div>

      {/* Right: Refresh button, timestamp, and profile */}
      <div className="flex items-center gap-4">
        {/* Last updated indicator */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Clock size={14} className="text-gray-400" />
          <span>Updated: <strong className="text-gray-700">{lastUpdated}</strong></span>
          <button
            onClick={handleManualRefresh}
            title="Refresh analytics data"
            className="p-1.5 text-gray-500 hover:text-azzurro-600 hover:bg-gray-100 rounded-md transition-colors"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-azzurro-600' : ''} />
          </button>
        </div>

        <div className="h-6 w-px bg-gray-200" />

        {/* User profile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-900 flex items-center justify-center text-white text-xs font-bold ring-2 ring-azzurro-500/20">
            AH
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-semibold text-gray-800 leading-none">Operations Team</p>
            <p className="text-[10px] text-gray-500 leading-none mt-1">Azzurro Hotels Sydney</p>
          </div>
        </div>
      </div>
    </header>
  );
}

export default TopNav;
