'use client';

import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  ChevronRight, 
  ChevronLeft, 
  Mic, 
  Lightbulb, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  ArrowRight,
  Maximize2,
  BookOpen,
  Sparkles,
  X
} from 'lucide-react';
import { PRESENTATION_SLIDES } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

interface PresentationModeProps {
  onGoToLiveTP?: () => void;
  onGoTo3D?: () => void;
  onGoToReports?: () => void;
}

export default function PresentationMode({ 
  onGoToLiveTP,
  onGoTo3D,
  onGoToReports
}: PresentationModeProps) {
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes = 600 seconds
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showSpeakerPrompter, setShowSpeakerPrompter] = useState(true);
  const [showFullPlanModal, setShowFullPlanModal] = useState(false);

  const currentSlide = PRESENTATION_SLIDES[currentSlideIndex];

  // Timer countdown effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            sounds.playError();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, secondsRemaining]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && currentSlideIndex < PRESENTATION_SLIDES.length - 1) {
        goToSlide(currentSlideIndex + 1);
      } else if (e.key === 'ArrowLeft' && currentSlideIndex > 0) {
        goToSlide(currentSlideIndex - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlideIndex]);

  const goToSlide = (idx: number) => {
    setCurrentSlideIndex(idx);
    sounds.playClick();
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerColor = 
    secondsRemaining > 180 
      ? 'text-cyan-400 bg-cyan-950/40 border-cyan-800' 
      : secondsRemaining > 60 
        ? 'text-amber-400 bg-amber-950/40 border-amber-800' 
        : 'text-rose-400 bg-rose-950/40 border-rose-800 animate-pulse';

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Top Presentation Control Bar */}
      <div className="w-full p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md shadow-2xl flex flex-wrap items-center justify-between gap-4">
        {/* Slide Steps Indicator */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {PRESENTATION_SLIDES.map((slide, i) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(i)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 whitespace-nowrap ${
                i === currentSlideIndex
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/30'
                  : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${i === currentSlideIndex ? 'bg-white' : 'bg-slate-500'}`} />
              <span>{slide.minuteBadge}</span>
            </button>
          ))}
        </div>

        {/* 10-Minute Chrono Controller & Script Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowFullPlanModal(true);
              sounds.playClick();
            }}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 flex items-center gap-1.5 transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Script &amp; Plan d&apos;Attaque</span>
          </button>

          <div className={`px-4 py-1.5 rounded-xl border font-mono font-bold text-sm sm:text-base flex items-center gap-2 shadow-inner ${timerColor}`}>
            <Clock className="w-4 h-4" />
            <span>{formatTimer(secondsRemaining)}</span>
            <span className="text-[10px] text-slate-400 font-normal uppercase">/ 10:00</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setIsTimerRunning(!isTimerRunning);
                sounds.playClick();
              }}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
              title={isTimerRunning ? 'Mettre en pause' : 'Démarrer le chronomètre'}
            >
              {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={() => {
                setSecondsRemaining(600);
                setIsTimerRunning(false);
                sounds.playClick();
              }}
              className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition"
              title="Réinitialiser à 10 minutes"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowSpeakerPrompter(!showSpeakerPrompter);
                sounds.playClick();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition ${
                showSpeakerPrompter
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              Prompteur
            </button>
          </div>
        </div>
      </div>

      {/* Main Slide Card */}
      <div className="relative w-full rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 p-6 md:p-8 shadow-2xl overflow-hidden">
        {/* Glow Accent */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        {/* Slide Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {currentSlide.timeRange}
              </span>
              <span className="text-xs text-slate-400">Étape {currentSlideIndex + 1} sur {PRESENTATION_SLIDES.length}</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
              {currentSlide.title}
            </h2>
            <p className="text-sm md:text-base text-cyan-300/80 mt-1">
              {currentSlide.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToSlide(Math.max(0, currentSlideIndex - 1))}
              disabled={currentSlideIndex === 0}
              className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => goToSlide(Math.min(PRESENTATION_SLIDES.length - 1, currentSlideIndex + 1))}
              disabled={currentSlideIndex === PRESENTATION_SLIDES.length - 1}
              className="p-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20 transition flex items-center gap-1.5"
            >
              <span className="text-xs font-semibold hidden sm:inline">Suivant</span>
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Slide Body Content */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Key Bullet Points & Concept Chips (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            <div>
              <h3 className="text-sm uppercase tracking-wider font-bold text-slate-400 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                Arguments Clés à Présenter
              </h3>
              <ul className="space-y-3">
                {currentSlide.keyPoints.map((point, idx) => (
                  <li
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-850/60 border border-slate-800 text-sm text-slate-200 leading-relaxed flex items-start gap-3 hover:border-slate-700 transition"
                  >
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Oracle Concepts Grid */}
            <div>
              <h3 className="text-sm uppercase tracking-wider font-bold text-slate-400 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-purple-400" />
                Notions Fondamentales
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {currentSlide.oracleConcepts.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 hover:border-purple-500/40 transition flex flex-col"
                  >
                    <span className="text-xs font-bold text-purple-300 font-mono">
                      {c.label}
                    </span>
                    <span className="text-xs text-slate-400 mt-1 leading-snug">
                      {c.description}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fast Action Buttons Based on Slide */}
            <div className="flex flex-wrap gap-3 pt-2">
              {currentSlide.id === 1 && onGoTo3D && (
                <button
                  onClick={onGoTo3D}
                  className="px-4 py-2.5 rounded-xl bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/25 text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span>Montrer l&apos;Architecture 3D &amp; les Flèches</span>
                </button>
              )}

              {(currentSlide.id === 2 || currentSlide.id === 3) && onGoToReports && (
                <button
                  onClick={onGoToReports}
                  className="px-4 py-2.5 rounded-xl bg-pink-500/15 text-pink-300 border border-pink-500/40 hover:bg-pink-500/25 text-xs font-bold transition flex items-center gap-2 shadow-sm"
                >
                  <Layers className="w-4 h-4 text-pink-400" />
                  <span>Ouvrir les Rapports Réels AWR / ASH</span>
                </button>
              )}

              {currentSlide.id === 5 && onGoToLiveTP && (
                <button
                  onClick={onGoToLiveTP}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <span>Lancer la Démo TP Live SQL*Plus</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Right Column: Visual Diagram & Pro Callout (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            {/* Diagram / Infographic preview based on slide */}
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col gap-4">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                Visualisation Conceptuelle
              </span>

              {currentSlide.diagramType === 'architecture' && (
                <div className="flex flex-col gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/50 text-cyan-200">
                    <div className="font-bold text-sm mb-1 text-cyan-300">Formule Maîtresse d&apos;Oracle</div>
                    <code className="text-xs font-mono bg-slate-900 px-2 py-1 rounded block text-center text-cyan-400 my-1">
                      DB Time = CPU Time + Wait Time
                    </code>
                    <p className="text-[11px] text-slate-300 mt-1">
                      Si 4 sessions travaillent à 100% pendant 15 minutes, DB Time = 60 minutes d&apos;effort total cumulé.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="font-bold text-emerald-400 block mb-0.5">MMON</span>
                      Snapshot AWR toutes les 60 min vers SYSAUX.
                    </div>
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="font-bold text-amber-400 block mb-0.5">MMNL</span>
                      Tampon ASH échantillonné chaque 1 sec.
                    </div>
                  </div>
                </div>
              )}

              {currentSlide.diagramType === 'awr_vs_ash' && (
                <div className="flex flex-col gap-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-blue-950/40 border border-blue-800/50">
                    <div className="font-bold text-blue-300 mb-1 flex items-center justify-between">
                      <span>AWR : La Vue Macro (1h)</span>
                      <span className="text-[10px] bg-blue-900 px-2 py-0.5 rounded">Moyenne</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Capture globale. Idéal pour voir l&apos;évolution sur 7 jours ou la charge globale de la journée.
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-pink-950/40 border border-pink-800/50">
                    <div className="font-bold text-pink-300 mb-1 flex items-center justify-between">
                      <span>ASH : Le Zoom Micro (1s)</span>
                      <span className="text-[10px] bg-pink-900 px-2 py-0.5 rounded">Temps Réel</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      Chaque seconde. Indispensable pour trouver le pic de 30 secondes qui a fait geler l&apos;application.
                    </p>
                  </div>
                </div>
              )}

              {currentSlide.diagramType === 'wait_events' && (
                <div className="flex flex-col gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-900/40 flex justify-between items-center">
                    <span className="font-mono text-rose-300 font-bold">db file scattered read</span>
                    <span className="text-[11px] text-slate-300">Full Table Scan (Index manquant)</span>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-900/40 flex justify-between items-center">
                    <span className="font-mono text-amber-300 font-bold">log file sync</span>
                    <span className="text-[11px] text-slate-300">Commits en boucle dans le code</span>
                  </div>
                  <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-900/40 flex justify-between items-center">
                    <span className="font-mono text-purple-300 font-bold">latch: shared pool</span>
                    <span className="text-[11px] text-slate-300">Hard Parsing sans Bind Variables</span>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-950/30 border border-cyan-900/40 flex justify-between items-center">
                    <span className="font-mono text-cyan-300 font-bold">enq: TX contention</span>
                    <span className="text-[11px] text-slate-300">Ligne verrouillée par une autre session</span>
                  </div>
                </div>
              )}

              {currentSlide.diagramType === 'live_demo' && (
                <div className="flex flex-col gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg bg-slate-900 text-cyan-300 border border-slate-800">
                    $ sqlplus / as sysdba<br />
                    SQL&gt; @?/rdbms/admin/awrrpt.sql<br />
                    SQL&gt; @?/rdbms/admin/ashrpt.sql
                  </div>
                  <p className="text-[11px] font-sans text-slate-400">
                    Génère instantanément les rapports HTML d&apos;analyse officielle Oracle.
                  </p>
                </div>
              )}
            </div>

            {/* Strategic Callout Box */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
              currentSlide.callout.type === 'tip'
                ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                : currentSlide.callout.type === 'warning'
                  ? 'bg-amber-950/30 border-amber-800/50 text-amber-200'
                  : 'bg-cyan-950/30 border-cyan-800/50 text-cyan-200'
            }`}>
              {currentSlide.callout.type === 'tip' && <Lightbulb className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
              {currentSlide.callout.type === 'warning' && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
              {currentSlide.callout.type === 'key' && <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
              <div className="text-xs leading-relaxed">
                <span className="font-bold block mb-1">
                  {currentSlide.callout.type === 'tip' && 'Astuce d\'Expert :'}
                  {currentSlide.callout.type === 'warning' && 'Attention Piège Professeur :'}
                  {currentSlide.callout.type === 'key' && 'Règle d\'Or :'}
                </span>
                {currentSlide.callout.text}
              </div>
            </div>
          </div>
        </div>

        {/* Speaker Prompter Drawer */}
        {showSpeakerPrompter && (
          <div className="mt-8 p-5 rounded-2xl bg-cyan-950/40 border border-cyan-800/60 shadow-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Mic className="w-4 h-4 text-cyan-400" />
                Script Orateur (Ce qu&apos;il faut dire mot pour mot au professeur)
              </span>
              <span className="text-[11px] text-cyan-400/80 font-mono">
                Durée estimée : ~2 minutes pour cette diapositive
              </span>
            </div>
            <p className="text-sm md:text-base text-slate-100 font-serif italic leading-relaxed bg-slate-950/60 p-4 rounded-xl border border-cyan-900/50">
              {currentSlide.speakerNotes}
            </p>
          </div>
        )}
      </div>

      {/* Full Presentation Plan Modal (Le Guide Pas-à-Pas pour Démarrer) */}
      {showFullPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-950 border border-slate-800 rounded-2xl p-6 overflow-y-auto shadow-2xl flex flex-col gap-6">
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-mono text-cyan-400 font-bold uppercase tracking-wider block mb-1">
                  Guide Stratégique de Soutenance (10 Minutes)
                </span>
                <h3 className="text-xl font-extrabold text-white">
                  Où commencer &amp; Comment dérouler votre présentation pas à pas
                </h3>
              </div>
              <button
                onClick={() => setShowFullPlanModal(false)}
                className="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step-by-Step Script Walkthrough */}
            <div className="space-y-4 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {/* Etape 0 : L'Accroche */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/50">
                <h4 className="font-bold text-purple-300 text-base mb-1">
                  🎯 Étape 0 : L&apos;Accroche Choc (Minute 00:00 - 00:30)
                </h4>
                <p className="italic text-slate-200">
                  « Monsieur le Professeur, mes chers collègues. Imaginez qu&apos;un vendredi de pointe e-commerce, votre base de données Oracle gèle pendant 45 secondes. L&apos;AWR généré sur l&apos;heure affiche une charge moyenne normale de 0.8 sessions : il est complètement aveugle. Pourquoi ? Parce que le pic est dilué sur 3600 secondes ! C&apos;est exactement pour résoudre ce paradoxe que le Diagnostic Pack d&apos;Oracle combine deux outils complémentaires : <strong>AWR</strong>, la boîte noire macroscopique, et <strong>ASH</strong>, le microscope temporel à la seconde. »
                </p>
              </div>

              {/* Etape 1 : Architecture 3D */}
              <div className="p-4 rounded-xl bg-cyan-950/30 border border-cyan-800/50">
                <h4 className="font-bold text-cyan-300 text-base mb-1">
                  🧊 Étape 1 : Passer sur l&apos;Architecture 3D &amp; Montrer les Flèches (Minute 00:30 - 02:30)
                </h4>
                <p>
                  <strong>Action :</strong> Cliquez sur le menu de gauche <em>« Architecture 3D &amp; Flux »</em>.<br />
                  <strong>Ce que vous dites :</strong> « Tout commence dans la System Global Area (SGA). Regardez ce flux en 3D avec les flèches : quand une session envoie une requête, elle traverse d&apos;abord la Shared Pool pour le plan d&apos;exécution, puis le Buffer Cache. Si le bloc n&apos;est pas en mémoire, elle attend une I/O disque physique : c&apos;est le <em>db file sequential read</em>. Et regardez nos deux processus vedettes : en haut à gauche, <strong>MMON</strong> prend une photo horaire vers <strong>SYSAUX</strong> (AWR), tandis que <strong>MMNL</strong> échantillonne le tampon circulaire rose chaque seconde (ASH). »
                </p>
              </div>

              {/* Etape 2 : AWR & ASH Réels */}
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-800/50">
                <h4 className="font-bold text-blue-300 text-base mb-1">
                  📄 Étape 2 : Analyser le Rapport AWR &amp; Révéler le Pic avec ASH (Minute 02:30 - 06:30)
                </h4>
                <p>
                  <strong>Action :</strong> Cliquez sur <em>« Rapports AWR &amp; ASH »</em>.<br />
                  <strong>Ce que vous dites :</strong> « Dans l&apos;AWR, nous regardons 3 sections sacrées : le Load Profile (fréquence des transactions), les pourcentages d&apos;efficacité (Execute to Parse, Buffer Hit %), et le tableau des <em>Top 10 Foreground Events</em>. Mais quand nous basculons sur le rapport ASH, regardez ce graphique : le pic de 68 sessions actives apparaît instantanément, et ASH pointe la session bloquante avec son numéro précis : <code>BLOCKING_SESSION = 142</code> ! »
                </p>
              </div>

              {/* Etape 3 : Démo Live TP */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/50">
                <h4 className="font-bold text-emerald-300 text-base mb-1">
                  💻 Étape 3 : Le TP Live SQL*Plus en Direct devant le Professeur (Minute 06:30 - 08:30)
                </h4>
                <p>
                  <strong>Action :</strong> Cliquez sur <em>« TP Live SQL*Plus »</em>.<br />
                  <strong>Ce que vous dites :</strong> « Pour vous prouver que ce n&apos;est pas de la théorie, générons maintenant ces rapports ensemble en SQL*Plus. Étape 1 : vérification de <code>STATISTICS_LEVEL</code> (TYPICAL). Étape 2 : déclenchement du snapshot manuel avec <code>DBMS_WORKLOAD_REPOSITORY.CREATE_SNAPSHOT()</code>. Étape 3 : exécution d&apos;<code>awrrpt.sql</code> et d&apos;<code>ashrpt.sql</code>. En direct, le fichier HTML est écrit sur disque et prêt pour notre diagnostic ! »
                </p>
              </div>

              {/* Etape 4 : Windows & Conclusion */}
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800/50">
                <h4 className="font-bold text-amber-300 text-base mb-1">
                  🪟 Étape 4 : Oracle sous Windows &amp; Conclusion Impressionnante (Minute 08:30 - 10:00)
                </h4>
                <p>
                  <strong>Ce que vous dites :</strong> « Enfin, une spécificité souvent méconnue : sous Windows, Oracle ne fonctionne pas comme sous Linux. Tous les processus d&apos;arrière-plan ne sont pas des processus séparés, mais des <strong>threads natifs internes</strong> au sein de l&apos;unique exécutable <code>oracle.exe</code>. En combinant l&apos;Alert Log dans l&apos;ADR et les rapports AWR/ASH, le DBA dispose d&apos;une visibilité chirurgicale totale sur la santé de son système. Merci pour votre attention, nous sommes à votre disposition pour vos questions ! »
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowFullPlanModal(false)}
                className="px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition"
              >
                Compris, Fermer le Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
