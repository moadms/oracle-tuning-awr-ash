'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Activity, 
  Search, 
  HelpCircle, 
  AlertCircle, 
  TrendingUp, 
  Cpu, 
  Database, 
  Clock, 
  Layers,
  ArrowRight
} from 'lucide-react';
import { MOCK_AWR_DATA, MOCK_ASH_DATA } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

interface ReportExplorerProps {
  initialReport?: 'awr' | 'ash';
}

export default function ReportExplorer({ initialReport = 'awr' }: ReportExplorerProps) {
  const [reportType, setReportType] = useState<'awr' | 'ash'>(initialReport);
  const [activeAwrTab, setActiveAwrTab] = useState<'summary' | 'top_events' | 'load_profile' | 'top_sql' | 'efficiency'>('top_events');
  const [selectedAnnotation, setSelectedAnnotation] = useState<{
    title: string;
    description: string;
    value: string;
    status: 'good' | 'warning' | 'critical';
    advice: string;
  } | null>({
    title: 'Top Event : db file scattered read (49.3% du DB Time)',
    description: 'La base passe presque la moitié de tout son temps à faire des Full Table Scans sur disque en lisant plusieurs blocs à la fois.',
    value: '49.3% DB Time | 248,900 waits',
    status: 'critical',
    advice: 'Créer un index sur la table ORDERS (colonnes de filtre WHERE) pour remplacer le balayage de table par un index scan ciblé.'
  });

  const handleSelectAwrRow = (
    title: string,
    description: string,
    value: string,
    status: 'good' | 'warning' | 'critical',
    advice: string
  ) => {
    sounds.playClick();
    setSelectedAnnotation({ title, description, value, status, advice });
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Selector & Switcher */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setReportType('awr');
              sounds.playClick();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md ${
              reportType === 'awr'
                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-blue-500/25 ring-2 ring-cyan-400/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Rapport AWR Réel (Snapshot 1h)</span>
          </button>

          <button
            onClick={() => {
              setReportType('ash');
              sounds.playClick();
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md ${
              reportType === 'ash'
                ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-pink-500/25 ring-2 ring-pink-400/40'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Rapport ASH Réel (Fenêtre 60s)</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Oracle 19c Enterprise Edition • PROD_ORCL</span>
        </div>
      </div>

      {/* Main Report Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Main Column: Real Report Styled View (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {reportType === 'awr' ? (
            /* AWR REPORT VIEWER */
            <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
              {/* Report Header Bar */}
              <div className="p-4 bg-gradient-to-r from-blue-950/80 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    WORKLOAD REPOSITORY REPORT (awrrpt_1_4520_4521.html)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Instance: {MOCK_AWR_DATA.header.instance} | DB: {MOCK_AWR_DATA.header.dbName} | Snapshots: {MOCK_AWR_DATA.header.beginSnap} -&gt; {MOCK_AWR_DATA.header.endSnap}
                  </p>
                </div>

                {/* Sub-tabs for AWR */}
                <div className="flex gap-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800 text-xs">
                  <button
                    onClick={() => { setActiveAwrTab('top_events'); sounds.playClick(); }}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      activeAwrTab === 'top_events' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Top Events
                  </button>
                  <button
                    onClick={() => { setActiveAwrTab('load_profile'); sounds.playClick(); }}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      activeAwrTab === 'load_profile' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Load Profile
                  </button>
                  <button
                    onClick={() => { setActiveAwrTab('efficiency'); sounds.playClick(); }}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      activeAwrTab === 'efficiency' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Efficacité %
                  </button>
                  <button
                    onClick={() => { setActiveAwrTab('top_sql'); sounds.playClick(); }}
                    className={`px-2.5 py-1 rounded-lg font-medium transition ${
                      activeAwrTab === 'top_sql' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Top SQL
                  </button>
                </div>
              </div>

              {/* Report Body */}
              <div className="p-5 font-mono text-xs overflow-x-auto">
                {/* 1. TOP EVENTS TABLE */}
                {activeAwrTab === 'top_events' && (
                  <div className="space-y-4">
                    <div className="text-slate-300 font-sans text-xs pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-white">Top 10 Foreground Events by Total Wait Time</span>
                      <span className="text-[11px] text-cyan-400">Cliquez sur une ligne pour l&apos;analyser</span>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="py-2 px-2">Évènement d&apos;Attente</th>
                          <th className="py-2 px-2">Waits</th>
                          <th className="py-2 px-2">Total Time (s)</th>
                          <th className="py-2 px-2">Avg Wait (ms)</th>
                          <th className="py-2 px-2 text-right">% DB Time</th>
                          <th className="py-2 px-2">Wait Class</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {MOCK_AWR_DATA.topEvents.map((row, i) => (
                          <tr
                            key={i}
                            onClick={() => handleSelectAwrRow(
                              row.event,
                              row.diagnosis,
                              `${row.pctDBTime}% du DB Time (Temps total : ${row.totalWaitTimeSec}s)`,
                              parseFloat(row.pctDBTime) > 30 ? 'critical' : parseFloat(row.pctDBTime) > 10 ? 'warning' : 'good',
                              `Classe : ${row.waitClass}. ${row.diagnosis}.`
                            )}
                            className="hover:bg-cyan-950/30 cursor-pointer transition text-slate-200"
                          >
                            <td className="py-2.5 px-2 font-bold text-cyan-300 flex items-center gap-1.5">
                              {i === 0 && <span className="w-2 h-2 rounded-full bg-rose-500" />}
                              {row.event}
                            </td>
                            <td className="py-2.5 px-2 text-slate-300">{row.waits}</td>
                            <td className="py-2.5 px-2 text-slate-300">{row.totalWaitTimeSec}</td>
                            <td className="py-2.5 px-2 text-slate-300">{row.avgWaitMs}</td>
                            <td className="py-2.5 px-2 text-right font-bold text-amber-400">{row.pctDBTime}%</td>
                            <td className="py-2.5 px-2 text-slate-400">{row.waitClass}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 2. LOAD PROFILE */}
                {activeAwrTab === 'load_profile' && (
                  <div className="space-y-4">
                    <div className="text-slate-300 font-sans text-xs pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-white">Load Profile (Métriques par seconde & transaction)</span>
                      <span className="text-[11px] text-cyan-400">Cliquez pour voir les seuils recommandés</span>
                    </div>

                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                          <th className="py-2 px-2">Métrique</th>
                          <th className="py-2 px-2 text-right">Par Seconde</th>
                          <th className="py-2 px-2 text-right">Par Transaction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {MOCK_AWR_DATA.loadProfile.map((row, i) => (
                          <tr
                            key={i}
                            onClick={() => handleSelectAwrRow(
                              `Métrique : ${row.metric}`,
                              `Valeur enregistrée pendant le snapshot : ${row.perSec}/sec et ${row.perTxn}/transaction.`,
                              `${row.perSec}/sec`,
                              row.metric.includes('Hard') && parseFloat(row.perSec) > 10 ? 'warning' : 'good',
                              'Mesure la fréquence des requêtes et l\'intensité de la charge I/O.'
                            )}
                            className="hover:bg-cyan-950/30 cursor-pointer transition text-slate-200"
                          >
                            <td className="py-2 px-2 font-medium text-slate-300">{row.metric}</td>
                            <td className="py-2 px-2 text-right font-bold text-cyan-300">{row.perSec}</td>
                            <td className="py-2 px-2 text-right text-slate-400">{row.perTxn}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. EFFICIENCY PERCENTAGES */}
                {activeAwrTab === 'efficiency' && (
                  <div className="space-y-4">
                    <div className="text-slate-300 font-sans text-xs pb-2 border-b border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-white">Instance Efficiency Percentages (Target 100%)</span>
                      <span className="text-[11px] text-cyan-400">Ratios clés d&apos;efficacité</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-sans">
                      {MOCK_AWR_DATA.efficiency.map((eff, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectAwrRow(
                            eff.name,
                            `Indicateur d'efficacité : ${eff.value}%. Seuil de référence : ${eff.benchmark}.`,
                            `${eff.value}%`,
                            parseFloat(eff.value) < 85 ? 'warning' : 'good',
                            'Un ratio bas indique une contention ou un re-parsing massif.'
                          )}
                          className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition flex items-center justify-between"
                        >
                          <span className="text-xs text-slate-300 font-medium">{eff.name}</span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-emerald-400 font-mono">{eff.value}%</span>
                            <span className="block text-[10px] text-slate-500 font-mono">cible: {eff.benchmark}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. TOP SQL */}
                {activeAwrTab === 'top_sql' && (
                  <div className="space-y-4">
                    <div className="text-slate-300 font-sans text-xs pb-2 border-b border-slate-800">
                      <span className="font-bold text-white">SQL ordered by Elapsed Time</span>
                    </div>

                    <div className="space-y-3 font-sans">
                      {MOCK_AWR_DATA.topSql.map((sql, i) => (
                        <div
                          key={i}
                          onClick={() => handleSelectAwrRow(
                            `SQL_ID : ${sql.sqlId} (${sql.pctDBTime}% du DB Time)`,
                            `Temps total écoulé : ${sql.elapsedTimeSec}s pour ${sql.executions} exécutions (${sql.elapPerExecSec}s par exécution).`,
                            `${sql.elapsedTimeSec}s`,
                            parseFloat(sql.pctDBTime) > 30 ? 'critical' : 'warning',
                            'Requête prioritaire à optimiser en ajoutant un plan d\'exécution ciblé ou un index.'
                          )}
                          className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition"
                        >
                          <div className="flex items-center justify-between text-xs mb-2">
                            <span className="font-mono font-bold text-cyan-400">SQL_ID: {sql.sqlId}</span>
                            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 font-mono font-bold">
                              {sql.pctDBTime}% DB Time
                            </span>
                          </div>
                          <code className="text-[11px] font-mono text-slate-300 block bg-slate-950 p-2 rounded border border-slate-800 truncate">
                            {sql.sqlText}
                          </code>
                          <div className="flex gap-4 mt-2 text-[11px] text-slate-400 font-mono">
                            <span>Temps écoulé : {sql.elapsedTimeSec}s</span>
                            <span>Exécutions : {sql.executions}</span>
                            <span>Moyenne : {sql.elapPerExecSec}s/exec</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ASH REPORT VIEWER */
            <div className="rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl">
              {/* ASH Header Bar */}
              <div className="p-4 bg-gradient-to-r from-pink-950/80 to-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-pink-400" />
                    ACTIVE SESSION HISTORY (ashrpt_1_1422.html)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Fenêtre temporelle : {MOCK_ASH_DATA.header.timeWindow} | Échantillons : {MOCK_ASH_DATA.header.sampleCount}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-pink-500/20 text-pink-300 border border-pink-500/30">
                  Pic : {MOCK_ASH_DATA.header.activeSessionsPeak} sessions actives
                </span>
              </div>

              <div className="p-5 flex flex-col gap-6">
                {/* Visual Timeline of the 60-second incident */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-pink-400" />
                      Évolution des Sessions Actives à la Seconde (Pic Invisible dans AWR !)
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">Échantillon 1s en mémoire SGA</span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 items-end h-28 p-3 rounded-xl bg-slate-900 border border-slate-800">
                    {MOCK_ASH_DATA.timelineSamples.map((sample, i) => {
                      const heightPercent = Math.min(100, (sample.activeSessions / 70) * 100);
                      const isPeak = sample.activeSessions > 40;
                      return (
                        <div
                          key={i}
                          onClick={() => handleSelectAwrRow(
                            `Échantillon ASH à ${sample.second}`,
                            `${sample.activeSessions} sessions actives simultanées. Évènement dominant : "${sample.topEvent}".`,
                            `${sample.activeSessions} sessions`,
                            isPeak ? 'critical' : 'good',
                            'Un verrou TX sur une table métier a bloqué toutes les transactions entrantes.'
                          )}
                          className="flex flex-col items-center gap-1 h-full justify-end cursor-pointer group"
                        >
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className={`w-full rounded-t transition-all ${
                              isPeak
                                ? 'bg-gradient-to-t from-pink-600 to-rose-400 group-hover:from-pink-500 group-hover:to-rose-300'
                                : 'bg-slate-700 group-hover:bg-cyan-500'
                            }`}
                          />
                          <span className="text-[9px] font-mono text-slate-400 truncate w-full text-center">
                            {sample.activeSessions}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Wait Events in Window */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                    Top Évènements dans la Fenêtre de 60s
                  </h4>
                  <div className="space-y-2">
                    {MOCK_ASH_DATA.topWaitEventsInWindow.map((ev, i) => (
                      <div
                        key={i}
                        onClick={() => handleSelectAwrRow(
                          ev.event,
                          `Total échantillons ASH : ${ev.count} (${ev.pctActivity} de toute l'activité sur la minute).`,
                          ev.pctActivity,
                          ev.event.includes('enq') ? 'critical' : 'good',
                          'Indique que la base est bloquée par un verrou de ligne exclusif.'
                        )}
                        className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-pink-500/40 cursor-pointer transition flex items-center justify-between"
                      >
                        <span className="text-xs font-mono font-bold text-pink-300">{ev.event}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-mono">{ev.count} échantillons</span>
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-pink-950 text-pink-300 font-mono">
                            {ev.pctActivity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Blocking Sessions (ASH Superpower) */}
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-400" />
                    Session Bloquante Identifiée par ASH (BLOCKING_SESSION)
                  </h4>
                  {MOCK_ASH_DATA.topBlockingSessions.map((blk, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectAwrRow(
                        `Session Coupable : SID ${blk.blockingSid}`,
                        `Programme : ${blk.program} | Requête : SQL_ID ${blk.sqlId}. Bloque 46 sessions utilisateur en cascade !`,
                        `SID ${blk.blockingSid}`,
                        'critical',
                        'Terminer la transaction non validée (COMMIT ou ROLLBACK) ou exécuter ALTER SYSTEM KILL SESSION \'142,38921\';'
                      )}
                      className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 hover:border-rose-500 cursor-pointer transition"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-rose-300 font-mono">
                          BLOCKING_SESSION = {blk.blockingSid} (Serial# {blk.serialNum})
                        </span>
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-900 text-rose-200">
                          {blk.blockedSessionsCount} sessions bloquées
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2">
                        {blk.actionRequired}
                      </p>
                      <div className="mt-2 text-[11px] font-mono text-cyan-300">
                        Programme : {blk.program} • SQL_ID : {blk.sqlId}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Doctor DBA Diagnostic Card (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="p-5 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl flex flex-col justify-between h-full">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-xs uppercase tracking-wider font-bold text-cyan-400 flex items-center gap-1.5">
                  <Database className="w-4 h-4" /> Diagnostic Expert DBA
                </span>
                {selectedAnnotation && (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedAnnotation.status === 'critical'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : selectedAnnotation.status === 'warning'
                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                        : 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  }`}>
                    {selectedAnnotation.status === 'critical' ? 'Critique' : selectedAnnotation.status === 'warning' ? 'Alerte' : 'Normal'}
                  </span>
                )}
              </div>

              {selectedAnnotation ? (
                <div className="mt-4 flex flex-col gap-4">
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      {selectedAnnotation.title}
                    </h4>
                    <span className="text-xs font-mono text-cyan-300 mt-1 block">
                      Valeur : {selectedAnnotation.value}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-[11px] text-slate-400 uppercase tracking-wider block font-semibold mb-1">
                      Signification
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {selectedAnnotation.description}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-800/60">
                    <span className="text-[11px] text-cyan-300 uppercase tracking-wider block font-semibold mb-1 flex items-center gap-1">
                      <ArrowRight className="w-3.5 h-3.5" /> Recommandation Technique
                    </span>
                    <p className="text-xs text-slate-200 leading-relaxed font-sans">
                      {selectedAnnotation.advice}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                  <HelpCircle className="w-6 h-6 text-slate-600" />
                  <span>Cliquez sur une ligne ou un graphique du rapport pour afficher son diagnostic.</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Oracle Diagnostic Pack</span>
              <span className="font-mono text-cyan-400">AWR / ASH Doctor</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
