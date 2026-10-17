'use client';

import React, { useState } from 'react';
import { 
  FolderTree, 
  FileText, 
  Terminal, 
  HardDrive, 
  Cpu, 
  Search, 
  Copy, 
  Check, 
  AlertTriangle,
  Server,
  Layers
} from 'lucide-react';
import { WINDOWS_ORACLE_FILES } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

const MOCK_ALERT_LOG_LINES = [
  '2026-10-17T14:00:00.124567+02:00',
  'Starting ORACLE instance (normal) (OS id: 4892)',
  'CLI process 4892 running oracle.exe (SHAD)',
  'System parameters with non-default values:',
  '  spfile                   = "C:\\APP\\ORACLE\\PRODUCT\\19.3.0\\DBHOME_1\\DATABASE\\SPFILEORCL.ORA"',
  '  sga_target               = 16G',
  '  pga_aggregate_target     = 4G',
  '  db_name                  = "ORCL"',
  '  open_cursors             = 800',
  'PMON started with pid=2, OS id=5120 (Thread in oracle.exe)',
  'MMON started with pid=12, OS id=5144 (Thread in oracle.exe)',
  'MMNL started with pid=13, OS id=5148 (Thread in oracle.exe)',
  'LGWR started with pid=8, OS id=5132 (Thread in oracle.exe)',
  'DBW0 started with pid=7, OS id=5128 (Thread in oracle.exe)',
  'Completed: ALTER DATABASE OPEN',
  '2026-10-17T14:22:15.890123+02:00',
  'Thread 1 advanced to checkpoint sequence 1845 (LGWR)',
  '2026-10-17T14:22:45.012345+02:00',
  'WARNING: High concurrency detected on table INVENTORY (Session 142 holding row lock)',
  '2026-10-17T14:23:01.345678+02:00',
  'Archived Log entry 942 added for thread 1 rlc 1845 ID 0x1849204912'
];

export default function WindowsOracleInspector() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState(WINDOWS_ORACLE_FILES[0]);

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    sounds.playClick();
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const filteredLog = MOCK_ALERT_LOG_LINES.filter(line => 
    line.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Info */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            Inspection Système d&apos;Oracle Database sous Windows
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Architecture multi-threadée, services Windows, fichiers clés ADR et commandes d&apos;inspection.
          </p>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
          oracle.exe (Architecture Multi-Threadée Windows)
        </span>
      </div>

      {/* Windows Architecture Highlight Banner */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-slate-900 to-purple-950/40 border border-cyan-800/40 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
          <Cpu className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-white">Un Seul Processus : oracle.exe</h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Sous Windows, tous les processus d&apos;arrière-plan (MMON, MMNL, LGWR, DBWR) sont des <strong>threads natifs</strong> au sein d&apos;un seul exécutable <code className="text-cyan-300">oracle.exe</code>.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
          <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-white">Mapping Thread ID &lt;-&gt; V$PROCESS</h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              Le SPID dans Oracle correspond au Thread ID Windows (TID). On peut voir chaque thread dans Sysinternals Process Explorer !
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-3">
          <Server className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-white">Gestion par Services Windows</h4>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
              <code className="text-emerald-300">OracleServiceORCL</code> et <code className="text-emerald-300">OracleOraDB19Home1TNSListener</code> contrôlent le démarrage de la base sans session ouverte.
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Key Files Tree + Alert Log Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Files Tree (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-3">
          <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-1">
            Fichiers & Emplacements Clés sous Windows
          </span>

          <div className="space-y-2.5">
            {WINDOWS_ORACLE_FILES.map((file, idx) => {
              const isSelected = selectedFile.name === file.name;
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setSelectedFile(file);
                    sounds.playClick();
                  }}
                  className={`p-3.5 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'bg-slate-850 border-cyan-500/50 shadow-md ring-1 ring-cyan-500/30'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      {file.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(file.inspectionCmd, idx);
                      }}
                      className="text-slate-400 hover:text-cyan-300 transition text-[11px] flex items-center gap-1"
                      title="Copier la commande PowerShell"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">Copié</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>PowerShell</span>
                        </>
                      )}
                    </button>
                  </div>

                  <code className="text-[11px] font-mono text-cyan-300/80 block mt-1.5 break-all">
                    {file.path}
                  </code>

                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    {file.role}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Alert Log Viewer Simulator (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden h-[540px]">
          {/* Header Bar */}
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono font-bold text-white">
                Simulateur Alert Log (alert_orcl.log dans ADR)
              </span>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Filtrer (ex: ORA-, WARNING, MMON)..."
                className="bg-slate-950 text-xs pl-8 pr-3 py-1 rounded-lg border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>

          {/* Log Lines Container */}
          <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-1 bg-[#070b13]">
            {filteredLog.map((line, idx) => (
              <div
                key={idx}
                className={`leading-relaxed ${
                  line.includes('WARNING')
                    ? 'text-amber-400 font-bold bg-amber-950/20 px-1 rounded'
                    : line.includes('ORA-')
                      ? 'text-rose-400 font-bold bg-rose-950/30 px-1 rounded'
                      : line.includes('Completed') || line.includes('started')
                        ? 'text-emerald-400'
                        : 'text-slate-300'
                }`}
              >
                {line}
              </div>
            ))}
          </div>

          {/* PowerShell Inspection Script helper */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>PowerShell : <code className="text-cyan-300">Get-Process oracle | Select-Object -ExpandProperty Threads</code></span>
            <button
              onClick={() => handleCopy('Get-Process oracle | Select-Object -ExpandProperty Threads', 99)}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center gap-1 text-[11px]"
            >
              <Copy className="w-3 h-3" />
              Copier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
