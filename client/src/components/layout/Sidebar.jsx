import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  MessageSquareText,
  Sparkles,
  Database,
  UploadCloud,
  Settings,
  Hotel,
  ShieldCheck,
  Cpu
} from 'lucide-react';

const navItems = [
  { to: '/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/properties', label: 'Properties', icon: Building2 },
  { to: '/reviews', label: 'Reviews', icon: MessageSquareText },
  { to: '/insights', label: 'AI Insights', icon: Sparkles },
  { to: '/collection', label: 'Collection Monitor', icon: Database },
  { to: '/import', label: 'Data Import', icon: UploadCloud },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function Sidebar() {
  return (
    <aside className="w-64 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col py-5 px-3 shrink-0 shadow-lg justify-between select-none">
      <div>
        {/* Logo and Brand */}
        <div className="px-3 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-azzurro-500 to-azzurro-700 flex items-center justify-center shadow-md shadow-azzurro-500/20">
              <Hotel size={22} className="text-white" />
            </div>
            <div>
              <span className="text-base font-bold text-white tracking-wide block leading-tight">
                AZZURRO
              </span>
              <span className="text-xs font-semibold text-azzurro-400 tracking-wider uppercase block">
                INSIGHTS
              </span>
            </div>
          </div>
          <div className="mt-3 px-2 py-1 bg-slate-800/80 rounded-md border border-slate-700/60 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Booking.com Engine
            </span>
            <span className="font-mono text-[10px] text-slate-500">v1.0</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-azzurro-600 text-white font-semibold shadow-md shadow-azzurro-600/30'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={isActive ? 'text-white' : 'text-slate-400'}
                  />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* System Status Indicators at Bottom */}
      <div className="pt-4 border-t border-slate-800/80 px-2 space-y-2">
        <div className="bg-slate-800/50 p-2.5 rounded-lg border border-slate-700/50 text-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="flex items-center gap-1.5 text-[11px]">
              <Cpu size={13} className="text-azzurro-400" />
              Local AI Worker
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-medium">
              ACTIVE
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="flex items-center gap-1.5 text-[11px]">
              <ShieldCheck size={13} className="text-emerald-400" />
              Supabase Pool
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 font-medium">
              READY
            </span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500 text-center">
          Sydney (AEST) • 4 Properties
        </p>
      </div>
    </aside>
  );
}

export default Sidebar;
