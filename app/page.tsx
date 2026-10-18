'use client';

import React, { useState } from 'react';
import Navbar, { TabType } from '@/components/Navbar';
import PresentationMode from '@/components/PresentationMode';
import OracleInstance3D from '@/components/OracleInstance3D';
import ReportExplorer from '@/components/ReportExplorer';
import LiveTerminalTP from '@/components/LiveTerminalTP';
import DbaHeroGame from '@/components/DbaHeroGame';
import WaitEventsEncyclopedia from '@/components/WaitEventsEncyclopedia';
import WindowsOracleInspector from '@/components/WindowsOracleInspector';
import CheatSheet from '@/components/CheatSheet';
import ProfessorQA from '@/components/ProfessorQA';
import { 
  Database, 
  Activity, 
  Clock, 
  Award, 
  Terminal, 
  Cpu, 
  HardDrive
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('presentation');
  const [reportSubTab, setReportSubTab] = useState<'awr' | 'ash'>('awr');

  const handleOpenReportFromTP = (type: 'awr' | 'ash') => {
    setReportSubTab(type);
    setActiveTab('report_explorer');
    sounds.playSnapshot();
  };

  return (
    <div className="min-h-screen bg-[#060813] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Futuristic Glowing Banner Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[30%] right-[-15%] w-[45%] h-[45%] bg-purple-600/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-10%] left-[20%] w-[40%] h-[40%] bg-blue-600/10 rounded-full blur-[140px]" />
      </div>

      {/* Top Horizontal Navigation Bar avec Titres en 1 Mot */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Area */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col gap-8">
        {/* Global Quick Stats Banner */}
        <section className="w-full p-4 sm:p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md shadow-xl grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block font-mono">
                AWR (Workload)
              </span>
              <span className="text-sm font-bold text-white">
                Snapshots 60 Min
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center text-pink-400 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block font-mono">
                ASH (Session History)
              </span>
              <span className="text-sm font-bold text-white">
                Échantillon 1 Seconde
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block font-mono">
                Formule d&apos;Or
              </span>
              <span className="text-sm font-bold text-white">
                DB Time = CPU + Waits
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 block font-mono">
                Moteur Oracle
              </span>
              <span className="text-sm font-bold text-white">
                MMON &amp; MMNL
              </span>
            </div>
          </div>
        </section>

        {/* Dynamic Tab Views */}
        {activeTab === 'presentation' && (
          <PresentationMode 
            onGoToLiveTP={() => setActiveTab('terminal_tp')}
            onGoTo3D={() => setActiveTab('instance_3d')}
            onGoToReports={() => setActiveTab('report_explorer')}
          />
        )}

        {activeTab === 'instance_3d' && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Database className="w-5 h-5 text-cyan-400" />
                  Modélisation 3D Interactive &amp; Flèches de Flux
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Sélectionnez un scénario en haut pour voir les flèches 3D et les balises lumineuses montrer le trajet exact des données à chaque micro-seconde.
                </p>
              </div>
            </div>
            <OracleInstance3D />
          </div>
        )}

        {activeTab === 'report_explorer' && (
          <ReportExplorer initialReport={reportSubTab} />
        )}

        {activeTab === 'terminal_tp' && (
          <LiveTerminalTP onOpenReport={handleOpenReportFromTP} />
        )}

        {activeTab === 'dba_game' && (
          <DbaHeroGame />
        )}

        {activeTab === 'wait_events' && (
          <WaitEventsEncyclopedia />
        )}

        {activeTab === 'windows_inspector' && (
          <WindowsOracleInspector />
        )}

        {activeTab === 'matrix_cheatsheet' && (
          <CheatSheet />
        )}

        {activeTab === 'professor_qa' && (
          <ProfessorQA />
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-slate-800/80 bg-slate-950/80 backdrop-blur py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span className="text-slate-300 font-semibold">Plateforme d&apos;Optimisation Oracle Database 19c / 21c</span>
            <span>— Module Optimisation des Bases de Données</span>
          </div>
          <div className="font-mono text-[11px] text-slate-400">
            AWR &amp; ASH Deep-Dive • Présenté par Moad • GitHub @moadms
          </div>
        </div>
      </footer>
    </div>
  );
}
