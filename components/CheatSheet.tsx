'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Activity, 
  Copy, 
  Check, 
  Layers, 
  CheckCircle2, 
  Database, 
  Terminal 
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

const COMPARISON_ROWS = [
  {
    feature: 'Acronyme & Nom',
    awr: 'Automatic Workload Repository',
    ash: 'Active Session History'
  },
  {
    feature: 'Rôle & Métaphore',
    awr: 'La Boîte Noire globale (Photo satellite macroscopique)',
    ash: 'Le Microscope temporel (Caméra haute vitesse à la seconde)'
  },
  {
    feature: 'Processus Responsable',
    awr: 'MMON (Manageability Monitor) + process esclave m000',
    ash: 'MMNL (Manageability Monitor Light) + Session direct write'
  },
  {
    feature: 'Fréquence de Capture',
    awr: 'Toutes les 60 minutes par défaut (Paramétrable de 10m à 1j)',
    ash: 'Chaque 1 SECONDE pour les sessions actives (WAITING ou CPU)'
  },
  {
    feature: 'Emplacement de Stockage',
    awr: 'Disque physique : Tablespace SYSAUX (tables WRH$*)',
    ash: '1. Mémoire SGA (Buffer circulaire 2 Mo/CPU) puis 2. Disque SYSAUX'
  },
  {
    feature: 'Rétention des Données',
    awr: '8 jours par défaut (Modifiable via DBMS_WORKLOAD_REPOSITORY)',
    ash: 'Mémoire : quelques heures | Disque : aligné sur AWR (1 échantillon/10)'
  },
  {
    feature: 'Impact sur la Base (Overhead)',
    awr: 'Très faible ponctuel lors de la prise du snapshot horaire',
    ash: 'Négligeable (< 1% CPU), lecture SGA sans verrous lourds'
  },
  {
    feature: 'Script Oracle Officiel',
    awr: '@?/rdbms/admin/awrrpt.sql (ou awrrpti.sql en RAC)',
    ash: '@?/rdbms/admin/ashrpt.sql (ou ashrpti.sql en RAC)'
  },
  {
    feature: 'Vues Clés du Dictionnaire',
    awr: 'DBA_HIST_SNAPSHOT, DBA_HIST_SYSSTAT, DBA_HIST_SQLSTAT',
    ash: 'V$ACTIVE_SESSION_HISTORY (Mémoire), DBA_HIST_ACTIVE_SESS_HISTORY (Disque)'
  },
  {
    feature: 'Cas d\'Usage Idéal',
    awr: 'Analyse de tendance hebdomadaire, planification de capacité, bilan journalier',
    ash: 'Diagnostic d\'un pic soudain de 30 secondes, blocage de sessions, verrou TX'
  }
];

const USEFUL_SCRIPTS = [
  {
    title: 'Modifier la Fréquence & Rétention AWR (ex: 30 min, 14 jours)',
    sql: `BEGIN
  DBMS_WORKLOAD_REPOSITORY.MODIFY_SNAPSHOT_SETTINGS(
    retention => 14 * 24 * 60, -- 14 jours en minutes (20160)
    interval  => 30            -- Snapshot toutes les 30 minutes
  );
END;
/`
  },
  {
    title: 'Top 5 des Requêtes Consommatrices de DB Time dans ASH sur les 15 dernières minutes',
    sql: `SELECT 
    sql_id,
    count(*) as active_samples,
    ROUND(count(*) * 100 / sum(count(*)) over (), 2) as pct_db_time
FROM v$active_session_history
WHERE sample_time > sysdate - interval '15' minute
  AND sql_id IS NOT NULL
GROUP BY sql_id
ORDER BY count(*) DESC
FETCH FIRST 5 ROWS ONLY;`
  },
  {
    title: 'Identifier les Sessions Bloquantes avec ASH',
    sql: `SELECT 
    session_id as waiting_sid,
    blocking_session as locker_sid,
    sql_id,
    event,
    count(*) as wait_seconds
FROM v$active_session_history
WHERE event = 'enq: TX - row lock contention'
  AND sample_time > sysdate - interval '30' minute
GROUP BY session_id, blocking_session, sql_id, event
ORDER BY count(*) DESC;`
  }
];

export default function CheatSheet() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const handleCopy = (sql: string, idx: number) => {
    navigator.clipboard.writeText(sql);
    sounds.playClick();
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Matrice Comparative AWR vs ASH & Scripts Indispensables
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Tableau synthétique pour comparer en un coup d&apos;œil les deux piliers du Diagnostic Pack Oracle.
          </p>
        </div>
      </div>

      {/* Comparison Table Card */}
      <div className="rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-800 text-xs text-slate-300">
                <th className="py-3 px-4 font-bold text-slate-400 w-1/4">Critère de Comparaison</th>
                <th className="py-3 px-4 font-bold text-cyan-300 w-3/8 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-400" /> AWR (Workload Repository)
                </th>
                <th className="py-3 px-4 font-bold text-pink-300 w-3/8">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-pink-400" /> ASH (Active Session History)
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs">
              {COMPARISON_ROWS.map((row, i) => (
                <tr key={i} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-semibold text-slate-300 font-sans">
                    {row.feature}
                  </td>
                  <td className="py-3 px-4 text-cyan-200/90 font-mono text-[11px] leading-relaxed">
                    {row.awr}
                  </td>
                  <td className="py-3 px-4 text-pink-200/90 font-mono text-[11px] leading-relaxed">
                    {row.ash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Must-Have DBA SQL Scripts */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm uppercase tracking-wider font-bold text-slate-400 flex items-center gap-2 px-1">
          <Terminal className="w-4 h-4 text-cyan-400" />
          Scripts SQL Quotidiens pour le DBA Oracle
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {USEFUL_SCRIPTS.map((script, idx) => (
            <div
              key={idx}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                  <h4 className="text-xs font-bold text-white leading-snug">
                    {script.title}
                  </h4>
                  <button
                    onClick={() => handleCopy(script.sql, idx)}
                    className="text-slate-400 hover:text-cyan-300 transition text-[11px] flex items-center gap-1 shrink-0 ml-2"
                  >
                    {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === idx ? 'Copié' : 'Copier'}</span>
                  </button>
                </div>
                <pre className="mt-3 p-3 rounded-xl bg-slate-900/90 text-cyan-300 font-mono text-[11px] overflow-x-auto leading-relaxed border border-slate-800">
                  {script.sql}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
