'use client';

import React, { useState } from 'react';
import { 
  Database, 
  Clock, 
  Activity, 
  Terminal, 
  Award, 
  HelpCircle, 
  Layers, 
  Server, 
  Volume2, 
  VolumeX, 
  Menu,
  X,
  FileText,
  Boxes,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Sparkles
} from 'lucide-react';
import { sounds } from '@/lib/sounds';

export type TabType = 
  | 'presentation'
  | 'instance_3d'
  | 'report_explorer'
  | 'terminal_tp'
  | 'dba_game'
  | 'wait_events'
  | 'windows_inspector'
  | 'matrix_cheatsheet'
  | 'professor_qa';

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

interface NavSection {
  title: string;
  items: {
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
    badgeColor?: string;
  }[];
}

export default function Sidebar({
  activeTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse
}: SidebarProps) {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
    if (next) sounds.playClick();
  };

  const navSections: NavSection[] = [
    {
      title: 'Soutenance & Démo 3D',
      items: [
        { id: 'presentation', label: 'Soutenance 10 Min', icon: Clock, badge: 'Départ', badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
        { id: 'instance_3d', label: 'Architecture 3D & Flux', icon: Boxes, badge: '3D', badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
        { id: 'terminal_tp', label: 'TP Live SQL*Plus', icon: Terminal, badge: 'Live', badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
      ]
    },
    {
      title: 'Diagnostic AWR & ASH',
      items: [
        { id: 'report_explorer', label: 'Rapports AWR & ASH', icon: FileText },
        { id: 'wait_events', label: 'Wait Events & Solutions', icon: Activity },
        { id: 'matrix_cheatsheet', label: 'Matrice & Scripts SQL', icon: Layers },
      ]
    },
    {
      title: 'Simulation & Système',
      items: [
        { id: 'dba_game', label: 'Jeu DBA Hero (5 Crises)', icon: Award, badge: 'Jeu', badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
        { id: 'windows_inspector', label: 'Oracle sous Windows', icon: Server },
        { id: 'professor_qa', label: 'Questions Jury (Prof)', icon: HelpCircle, badge: 'Pièges', badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
      ]
    }
  ];

  const handleSelectTab = (tab: TabType) => {
    sounds.playClick();
    onTabChange(tab);
    setMobileDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile Floating Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2.5 rounded-xl bg-slate-900/90 text-cyan-300 border border-slate-800 shadow-2xl backdrop-blur flex items-center gap-2 hover:bg-slate-850"
        >
          <Menu className="w-5 h-5" />
          <span className="text-xs font-bold font-mono">Menu</span>
        </button>
      </div>

      {/* Mobile Backdrop & Drawer */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div 
            onClick={() => setMobileDrawerOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
          />
          <div className="relative w-72 max-w-[85vw] bg-slate-950 border-r border-slate-800 flex flex-col h-full z-10 p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white">
                  <Database className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-white">ORACLE TUNING</span>
              </div>
              <button 
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {navSections.map((sec, idx) => (
                <div key={idx} className="space-y-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-2 block font-mono">
                    {sec.title}
                  </span>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleSelectTab(item.id)}
                        className={`w-full p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                          isActive
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                            : 'text-slate-400 hover:text-white hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span>{item.label}</span>
                        </div>
                        {item.badge && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <button
                onClick={toggleSound}
                className="flex items-center gap-1.5 hover:text-white transition"
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
                <span>{soundEnabled ? 'Sons ON' : 'Muet'}</span>
              </button>
              <a
                href="https://github.com/moadms/oracle-tuning-awr-ash"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-white transition"
              >
                @moadms
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Fixed Side Menu */}
      <aside 
        className={`hidden lg:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-slate-950/95 border-r border-slate-800/80 backdrop-blur-xl transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-800/80">
          <div 
            onClick={() => handleSelectTab('presentation')}
            className="flex items-center gap-3 cursor-pointer overflow-hidden group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25 shrink-0 group-hover:scale-105 transition">
              <Database className="w-4 h-4" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col truncate">
                <span className="font-extrabold text-xs tracking-tight text-white group-hover:text-cyan-300 transition">
                  ORACLE TUNING
                </span>
                <span className="text-[10px] text-cyan-400 font-mono">
                  AWR &amp; ASH MASTER
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => {
              sounds.playClick();
              onToggleCollapse();
            }}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-900 transition"
            title={isCollapsed ? 'Agrandir le menu' : 'Réduire le menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links Scrollable Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500 px-3 block font-mono">
                  {sec.title}
                </span>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleSelectTab(item.id)}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full p-2.5 rounded-xl text-xs font-semibold flex items-center transition-all ${
                      isCollapsed ? 'justify-center' : 'justify-between'
                    } ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge && (
                      <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Utility Tray */}
        <div className="p-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 bg-slate-950">
          <button
            onClick={toggleSound}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white transition flex items-center gap-1.5"
            title={soundEnabled ? 'Désactiver les sons' : 'Activer les sons'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-cyan-400" /> : <VolumeX className="w-4 h-4" />}
            {!isCollapsed && <span className="text-[11px]">{soundEnabled ? 'Audio ON' : 'Muet'}</span>}
          </button>

          <a
            href="https://github.com/moadms/oracle-tuning-awr-ash"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-850 hover:text-white transition flex items-center gap-1.5"
            title="Dépôt GitHub"
          >
            <svg className="w-4 h-4 fill-current text-slate-400" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            {!isCollapsed && <span className="text-[11px] font-mono">@moadms</span>}
          </a>
        </div>
      </aside>
    </>
  );
}
