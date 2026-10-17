'use client';

import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  ShieldAlert, 
  Award, 
  RotateCcw, 
  CheckCircle2, 
  XCircle, 
  ArrowRight, 
  Activity, 
  Cpu, 
  Database, 
  Zap, 
  Flame,
  Clock
} from 'lucide-react';
import { GAME_SCENARIOS, ScenarioGame } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

export default function DbaHeroGame() {
  const [currentScenarioIndex, setCurrentScenarioIndex] = useState(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const scenario: ScenarioGame = GAME_SCENARIOS[currentScenarioIndex];

  const handleSelectOption = (id: string) => {
    if (hasSubmitted) return;
    sounds.playClick();
    setSelectedOptionId(id);
  };

  const handleSubmit = () => {
    if (!selectedOptionId || hasSubmitted) return;
    setHasSubmitted(true);

    const chosen = scenario.options.find(o => o.id === selectedOptionId);
    if (chosen?.isCorrect) {
      sounds.playSuccess();
      setScore(prev => prev + 20); // 5 questions * 20 = 100 points
    } else {
      sounds.playError();
    }
  };

  const handleNext = () => {
    sounds.playClick();
    if (currentScenarioIndex < GAME_SCENARIOS.length - 1) {
      setCurrentScenarioIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setHasSubmitted(false);
    } else {
      setGameOver(true);
      sounds.playSuccess();
      try {
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch {
        // Ignore if unavailable
      }
    }
  };

  const handleRestart = () => {
    sounds.playClick();
    setCurrentScenarioIndex(0);
    setSelectedOptionId(null);
    setHasSubmitted(false);
    setScore(0);
    setGameOver(false);
  };

  const chosenOption = scenario.options.find(o => o.id === selectedOptionId);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Game Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Jeu Interactif : Oracle DBA Hero - Sauvez la Production !
            </h3>
            <p className="text-xs text-slate-400">
              Résolvez les 5 urgences réelles à l&apos;aide des diagnostics croisés AWR & ASH.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800">
            <Award className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-400">Score :</span>
            <span className="text-sm font-bold font-mono text-amber-400">{score} / 100</span>
          </div>

          {!gameOver && (
            <div className="text-xs font-mono text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-xl">
              Incident {currentScenarioIndex + 1} / {GAME_SCENARIOS.length}
            </div>
          )}
        </div>
      </div>

      {gameOver ? (
        /* Victory Screen */
        <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/25">
            <Award className="w-8 h-8" />
          </div>

          <h3 className="text-2xl font-extrabold text-white">
            Mission Accomplie, Oracle Certified Master !
          </h3>
          <p className="text-sm text-slate-300 max-w-lg leading-relaxed">
            Vous avez sauvé la production grâce à la maîtrise conjointe du rapport macroscopique <strong className="text-cyan-400">AWR</strong> et du microscope temporel <strong className="text-pink-400">ASH</strong> !
          </p>

          <div className="text-3xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-cyan-400 my-2">
            Score Final : {score} / 100
          </div>

          <button
            onClick={handleRestart}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 flex items-center gap-2 hover:from-cyan-400 hover:to-blue-500 transition"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rejouer le simulateur</span>
          </button>
        </div>
      ) : (
        /* Active Scenario Card */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Context & Metrics (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 shadow-xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" /> Urgence {scenario.urgency}
                </span>
                <span className="text-xs font-mono text-cyan-400">{scenario.badge}</span>
              </div>

              <div>
                <h4 className="text-base font-bold text-white">
                  {scenario.title}
                </h4>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  {scenario.context}
                </p>
              </div>

              {/* AWR Indicator Box */}
              <div className="p-3.5 rounded-xl bg-blue-950/30 border border-blue-900/50 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-400" /> Constat Rapport AWR (Période 1 heure)
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>• Top Event : <span className="font-mono text-amber-300">{scenario.awrSummary.topEvent}</span></div>
                  <div>• Charge : <span className="text-slate-400">{scenario.awrSummary.loadProfileNote}</span></div>
                  <div>• Efficacité : <span className="text-slate-400">{scenario.awrSummary.efficiencyProblem}</span></div>
                </div>
              </div>

              {/* ASH Indicator Box */}
              <div className="p-3.5 rounded-xl bg-pink-950/30 border border-pink-900/50 flex flex-col gap-1.5">
                <div className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-pink-400" /> Révélation Rapport ASH (Microscope 1s)
                </div>
                <div className="text-xs text-slate-300 space-y-1">
                  <div>• Fenêtre : <span className="font-mono text-cyan-300">{scenario.ashSummary.timeframe}</span></div>
                  <div>• Pic sessions : <span className="font-mono font-bold text-rose-400">{scenario.ashSummary.activeSessionsPeak} actives</span></div>
                  <div>• Détail : <span className="text-slate-300">{scenario.ashSummary.culpritDetail}</span></div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Diagnostic Options (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-1">
              Quelle est votre décision de DBA Senior ?
            </span>

            <div className="space-y-3">
              {scenario.options.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                let borderClass = 'border-slate-800 hover:border-slate-700 bg-slate-900/80';

                if (hasSubmitted) {
                  if (opt.isCorrect) {
                    borderClass = 'border-emerald-500 bg-emerald-950/40 text-emerald-100 ring-2 ring-emerald-500/40';
                  } else if (isSelected && !opt.isCorrect) {
                    borderClass = 'border-rose-500 bg-rose-950/40 text-rose-100 ring-2 ring-rose-500/40';
                  } else {
                    borderClass = 'border-slate-800 bg-slate-950/40 opacity-50';
                  }
                } else if (isSelected) {
                  borderClass = 'border-cyan-500 bg-cyan-950/40 ring-2 ring-cyan-500/30';
                }

                return (
                  <div
                    key={opt.id}
                    onClick={() => handleSelectOption(opt.id)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${borderClass}`}
                  >
                    <span className={`w-7 h-7 rounded-lg text-xs font-bold font-mono flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {opt.id}
                    </span>

                    <div className="flex-1">
                      <h5 className="text-xs sm:text-sm font-bold text-white">
                        {opt.label}
                      </h5>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>

                    {hasSubmitted && opt.isCorrect && (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                    )}
                    {hasSubmitted && isSelected && !opt.isCorrect && (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation box after submit */}
            {hasSubmitted && chosenOption && (
              <div className={`p-4 rounded-2xl border ${
                chosenOption.isCorrect
                  ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-200'
                  : 'bg-rose-950/30 border-rose-800/60 text-rose-200'
              }`}>
                <div className="font-bold text-xs uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  {chosenOption.isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-rose-400" />}
                  {chosenOption.isCorrect ? 'Excellente analyse !' : 'Erreur de diagnostic !'}
                </div>
                <p className="text-xs leading-relaxed text-slate-200 font-sans">
                  {chosenOption.explanation}
                </p>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 mt-2">
              {!hasSubmitted ? (
                <button
                  onClick={handleSubmit}
                  disabled={!selectedOptionId}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Valider le Diagnostic
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/25 transition flex items-center gap-2 hover:brightness-110"
                >
                  <span>{currentScenarioIndex < GAME_SCENARIOS.length - 1 ? 'Incident Suivant' : 'Voir les Résultats'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
