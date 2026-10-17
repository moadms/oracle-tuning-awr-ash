'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Play, 
  CheckCircle2, 
  FileCode, 
  ExternalLink, 
  Copy, 
  RotateCcw,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

interface LiveTerminalTPProps {
  onOpenReport?: (type: 'awr' | 'ash') => void;
}

interface ScriptStep {
  id: string;
  title: string;
  desc: string;
  command: string;
  outputs: string[];
  reportGenerated?: 'awr' | 'ash';
}

const TP_STEPS: ScriptStep[] = [
  {
    id: 'stats_level',
    title: 'Étape 1 : Vérifier le Prérequis STATISTICS_LEVEL',
    desc: 'AWR et ASH requièrent que le paramètre STATISTICS_LEVEL soit configuré à TYPICAL (par défaut) ou ALL.',
    command: 'SHOW PARAMETER STATISTICS_LEVEL;',
    outputs: [
      'SQL> SHOW PARAMETER STATISTICS_LEVEL;',
      '',
      'NAME                                 TYPE        VALUE',
      '------------------------------------ ----------- ------------------------------',
      'statistics_level                     string      TYPICAL',
      '',
      '-- DIAGNOSTIC : Valeur OK (TYPICAL permet la collecte automatique AWR/ASH sans impact excessif).'
    ]
  },
  {
    id: 'create_snap',
    title: 'Étape 2 : Déclencher un Snapshot AWR Manuel',
    desc: 'Créer immédiatement une nouvelle capture dans le tablespace SYSAUX avec le package DBMS_WORKLOAD_REPOSITORY.',
    command: 'EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT();',
    outputs: [
      'SQL> EXEC DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT();',
      '',
      'Procédure PL/SQL terminée avec succès.',
      'Snapshot #4521 créé dans SYSAUX par le worker MMON.'
    ]
  },
  {
    id: 'list_snaps',
    title: 'Étape 3 : Lister les Snapshots Disponibles',
    desc: 'Interroger la vue DBA_HIST_SNAPSHOT pour identifier les bornes de début et de fin d\'analyse.',
    command: `SELECT snap_id, begin_interval_time, end_interval_time 
FROM dba_hist_snapshot 
ORDER BY snap_id DESC 
FETCH FIRST 4 ROWS ONLY;`,
    outputs: [
      'SQL> SELECT snap_id, begin_interval_time, end_interval_time FROM dba_hist_snapshot ORDER BY snap_id DESC FETCH FIRST 4 ROWS ONLY;',
      '',
      '   SNAP_ID BEGIN_INTERVAL_TIME            END_INTERVAL_TIME',
      '---------- ------------------------------ ------------------------------',
      '      4521 17-OCT-26 02.00.00.000 PM      17-OCT-26 03.00.00.000 PM',
      '      4520 17-OCT-26 01.00.00.000 PM      17-OCT-26 02.00.00.000 PM',
      '      4519 17-OCT-26 12.00.00.000 PM      17-OCT-26 01.00.00.000 PM',
      '      4518 17-OCT-26 11.00.00.000 AM      17-OCT-26 12.00.00.000 PM'
    ]
  },
  {
    id: 'generate_awr',
    title: 'Étape 4 : Générer le Rapport AWR Officiel (awrrpt.sql)',
    desc: 'Exécuter le script standard Oracle pour produire le rapport HTML complet sur l\'heure d\'incident.',
    command: '@?/rdbms/admin/awrrpt.sql',
    outputs: [
      'SQL> @?/rdbms/admin/awrrpt.sql',
      '',
      'Specify the Report Type',
      '~~~~~~~~~~~~~~~~~~~~~~~',
      'Enter \'html\' for an HTML report, or \'text\' for plain text',
      'Enter value for report_type: html',
      '',
      'Specify the number of days of snapshots to choose from',
      'Enter value for num_days: 1',
      '',
      'Specify the Begin and End Snapshot Ids',
      'Enter value for begin_snap: 4520',
      'Enter value for end_snap:   4521',
      '',
      'Specify the Report Name',
      'Enter value for report_name: awrrpt_1_4520_4521.html',
      '',
      'Génération du rapport en cours via DBMS_WORKLOAD_REPOSITORY.AWR_REPORT_HTML...',
      'Rapport écrit avec succès dans : awrrpt_1_4520_4521.html'
    ],
    reportGenerated: 'awr'
  },
  {
    id: 'generate_ash',
    title: 'Étape 5 : Générer le Rapport ASH Haute Précision (ashrpt.sql)',
    desc: 'Cibler le pic critique de 15 minutes pour identifier le SID bloquant et le SQL_ID.',
    command: '@?/rdbms/admin/ashrpt.sql',
    outputs: [
      'SQL> @?/rdbms/admin/ashrpt.sql',
      '',
      'Specify the Report Type',
      'Enter value for report_type: html',
      '',
      'Enter begin time for reporting : -15 (Les 15 dernières minutes)',
      'Enter duration in minutes      : 15',
      '',
      'Specify the Report Name',
      'Enter value for report_name: ashrpt_1_1422.html',
      '',
      'Échantillonnage en cours depuis V$ACTIVE_SESSION_HISTORY...',
      'Rapport ASH généré avec succès dans : ashrpt_1_1422.html'
    ],
    reportGenerated: 'ash'
  },
  {
    id: 'query_live_ash',
    title: 'Étape 6 : Requête SQL Live sur V$ACTIVE_SESSION_HISTORY',
    desc: 'Interrogation directe en SQL sans générer de fichier pour un diagnostic éclair en 2 secondes.',
    command: `SELECT event, count(*) as wait_samples, 
       ROUND(count(*) * 100 / sum(count(*)) over (), 1) as pct_activity
FROM v$active_session_history
WHERE sample_time > sysdate - interval '15' minute
  AND wait_class != 'Idle'
GROUP BY event
ORDER BY count(*) DESC
FETCH FIRST 5 ROWS ONLY;`,
    outputs: [
      'SQL> SELECT event, count(*), ROUND(...) FROM v$active_session_history ... ;',
      '',
      'EVENT                                      WAIT_SAMPLES PCT_ACTIVITY',
      '---------------------------------------- -------------- ------------',
      'enq: TX - row lock contention                      1240        67.4%',
      'db file scattered read                              180         9.8%',
      'log file sync                                       100         5.4%',
      'latch: shared pool                                   64         3.5%',
      'db file sequential read                              42         2.3%',
      '',
      '-- DIAGNOSTIC LIVE : 67.4% de l\'activité est bloquée sur un verrou applicatif (TX) !'
    ]
  }
];

export default function LiveTerminalTP({ onOpenReport }: LiveTerminalTPProps) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [historyLines, setHistoryLines] = useState<string[]>([
    'Oracle Database 19c Enterprise Edition Release 19.3.0.0.0 - 64bit Production',
    'Version 19.3.0.0.0 sur Windows Server 2022',
    'Connecté à : Instance ORCL (SID=orcl1)',
    '',
    'Tapez une commande ou cliquez sur les étapes guidées ci-dessus pour simuler le TP.',
    '----------------------------------------------------------------------------------'
  ]);
  const [customInput, setCustomInput] = useState('');
  const [lastGeneratedReport, setLastGeneratedReport] = useState<'awr' | 'ash' | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const activeStep = TP_STEPS[activeStepIndex];

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [historyLines]);

  const runStep = (step: ScriptStep) => {
    sounds.playClick();
    setHistoryLines(prev => [
      ...prev,
      '',
      `[TP] Exécution guidée : ${step.title}`,
      ...step.outputs
    ]);

    if (step.reportGenerated) {
      sounds.playSuccess();
      setLastGeneratedReport(step.reportGenerated);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;

    sounds.playClick();
    const cmd = customInput.trim();
    setCustomInput('');

    // Check if input matches any predefined script
    const matched = TP_STEPS.find(s => s.command.toLowerCase().includes(cmd.toLowerCase()) || cmd.toLowerCase().includes('awr') || cmd.toLowerCase().includes('ash'));

    if (matched) {
      setHistoryLines(prev => [...prev, '', `SQL> ${cmd}`, ...matched.outputs.slice(1)]);
      if (matched.reportGenerated) {
        sounds.playSuccess();
        setLastGeneratedReport(matched.reportGenerated);
      }
    } else {
      setHistoryLines(prev => [
        ...prev,
        '',
        `SQL> ${cmd}`,
        'Commande simulée exécutée avec succès.',
        'Astuce : Utilisez les boutons des étapes 1 à 6 à gauche pour voir les sorties exactes de production.'
      ]);
    }
  };

  const clearTerminal = () => {
    sounds.playClick();
    setHistoryLines([
      'Terminal Oracle réinitialisé.',
      'Connecté en tant que SYSDBA sur l\'instance ORCL.'
    ]);
    setLastGeneratedReport(null);
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Info Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              Simulateur de TP SQL*Plus : Génération AWR & ASH en Direct
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Exécutez pas à pas les scripts officiels Oracle devant vos étudiants ou votre professeur.
          </p>
        </div>

        {lastGeneratedReport && onOpenReport && (
          <button
            onClick={() => onOpenReport(lastGeneratedReport)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition flex items-center gap-2 animate-bounce"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ouvrir le Rapport {lastGeneratedReport.toUpperCase()} Généré</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Main Grid: Steps on Left, Terminal on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: TP Guide Steps (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-1">
            Déroulement Chronologique du TP
          </span>

          <div className="space-y-2.5">
            {TP_STEPS.map((step, idx) => {
              const isActive = idx === activeStepIndex;
              return (
                <div
                  key={step.id}
                  onClick={() => setActiveStepIndex(idx)}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isActive
                      ? 'bg-slate-850 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </span>
                        <h4 className={`text-xs font-bold ${isActive ? 'text-cyan-300' : 'text-slate-200'}`}>
                          {step.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 leading-relaxed pl-7">
                        {step.desc}
                      </p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        runStep(step);
                      }}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-medium transition flex items-center gap-1 shrink-0"
                      title="Exécuter dans le terminal"
                    >
                      <Play className="w-3 h-3 text-cyan-400" />
                      <span>Exécuter</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Interactive Terminal Screen (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-[#0b0f19] border border-slate-800 shadow-2xl overflow-hidden h-[540px]">
          {/* Terminal Title Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="text-xs font-mono text-slate-400 ml-2">sqlplus sys as sysdba @ ORCL</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={clearTerminal}
                className="p-1 rounded text-slate-400 hover:text-white transition"
                title="Effacer l'écran"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Terminal Output Body */}
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 text-slate-300">
            {historyLines.map((line, idx) => (
              <div
                key={idx}
                className={`whitespace-pre-wrap leading-relaxed ${
                  line.startsWith('SQL>')
                    ? 'text-cyan-400 font-bold'
                    : line.startsWith('[TP]')
                      ? 'text-emerald-400 font-bold pt-2'
                      : line.startsWith('--')
                        ? 'text-amber-300/90 italic'
                        : 'text-slate-300'
                }`}
              >
                {line}
              </div>
            ))}
            <div ref={terminalEndRef} />
          </div>

          {/* Terminal Input Footer */}
          <form onSubmit={handleCustomSubmit} className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
            <span className="text-cyan-400 font-mono font-bold text-xs pl-2">SQL&gt;</span>
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Tapez une commande (ex: @?/rdbms/admin/awrrpt.sql ou cliquez à gauche)..."
              className="flex-1 bg-transparent text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition"
            >
              Envoyer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
