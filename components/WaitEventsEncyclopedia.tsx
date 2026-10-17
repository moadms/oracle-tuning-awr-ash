'use client';

import React, { useState } from 'react';
import { 
  Activity, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  Copy, 
  Check, 
  Database,
  ArrowRight
} from 'lucide-react';
import { TOP_WAIT_EVENTS, WaitEventInfo } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

export default function WaitEventsEncyclopedia() {
  const [selectedEvent, setSelectedEvent] = useState<WaitEventInfo>(TOP_WAIT_EVENTS[0]);
  const [filterClass, setFilterClass] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const filteredEvents = TOP_WAIT_EVENTS.filter(e => {
    const matchesFilter = filterClass === 'all' || e.category === filterClass;
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleCopySQL = (sql: string) => {
    navigator.clipboard.writeText(sql);
    sounds.playClick();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Encyclopédie des Top Wait Events Oracle & Solutions SQL
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Comprendre la cause racine de chaque goulot d&apos;étranglement AWR/ASH et appliquer le script correctif.
          </p>
        </div>

        {/* Filter and Search */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {['all', 'User I/O', 'Commit', 'Concurrency', 'Application'].map((cat) => (
              <button
                key={cat}
                onClick={() => { setFilterClass(cat); sounds.playClick(); }}
                className={`px-2.5 py-1 rounded-lg font-medium transition ${
                  filterClass === cat
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'all' ? 'Tous' : cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un évènement..."
              className="bg-slate-950 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Events List + Detailed Diagnostic Dossier */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Event List (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-2.5">
          {filteredEvents.map((ev) => {
            const isSelected = selectedEvent.name === ev.name;
            return (
              <div
                key={ev.name}
                onClick={() => { setSelectedEvent(ev); sounds.playClick(); }}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col gap-1.5 ${
                  isSelected
                    ? 'bg-slate-850 border-cyan-500/60 shadow-lg ring-1 ring-cyan-500/30'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-white'}`}>
                    {ev.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-800 text-slate-300">
                    {ev.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {ev.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Right Column: In-depth Technical Dossier (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl p-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <span className="px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {selectedEvent.category}
              </span>
              <h3 className="text-xl font-bold font-mono text-white mt-2">
                {selectedEvent.name}
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Wait Event Profiler
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {/* Description */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Description du Mécanisme Interne
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {selectedEvent.description}
              </p>
            </div>

            {/* Root Cause & Symptoms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block mb-1">
                  Cause Racine
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedEvent.rootCause}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block mb-1">
                  Symptôme Observé
                </span>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedEvent.symptom}
                </p>
              </div>
            </div>

            {/* Detection in AWR vs ASH */}
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/30 to-pink-950/30 border border-slate-800 space-y-2">
              <div className="text-xs">
                <strong className="text-cyan-400">Détection dans AWR :</strong>{' '}
                <span className="text-slate-300">{selectedEvent.awrIndicator}</span>
              </div>
              <div className="text-xs">
                <strong className="text-pink-400">Détection dans ASH :</strong>{' '}
                <span className="text-slate-300">{selectedEvent.ashIndicator}</span>
              </div>
            </div>

            {/* Remediation & SQL Script */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4" /> Script SQL Correctif Recommandé
                </h4>
                <button
                  onClick={() => handleCopySQL(selectedEvent.typicalFixSQL)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copié !' : 'Copier SQL'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 overflow-x-auto leading-relaxed">
                {selectedEvent.typicalFixSQL}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
