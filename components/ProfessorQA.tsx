'use client';

import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  GraduationCap 
} from 'lucide-react';
import { PROFESSOR_QUESTIONS } from '@/lib/oracleData';
import { sounds } from '@/lib/sounds';

export default function ProfessorQA() {
  const [openIds, setOpenIds] = useState<number[]>([1]);

  const toggleQuestion = (id: number) => {
    sounds.playClick();
    setOpenIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              Questions Pièges du Professeur & Réponses d&apos;Expert
            </h3>
            <p className="text-xs text-slate-400">
              Anticipez les questions les plus pointues du jury pour faire sensation lors de votre soutenance.
            </p>
          </div>
        </div>

        <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
          Niveau Master / DBA Senior
        </span>
      </div>

      {/* Accordion Questions List */}
      <div className="space-y-3">
        {PROFESSOR_QUESTIONS.map((q) => {
          const isOpen = openIds.includes(q.id);
          return (
            <div
              key={q.id}
              className={`rounded-2xl border transition-all ${
                isOpen
                  ? 'bg-slate-900/90 border-cyan-500/40 shadow-xl'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
              }`}
            >
              <button
                onClick={() => toggleQuestion(q.id)}
                className="w-full p-4 sm:p-5 flex items-center justify-between text-left gap-3"
              >
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/10 text-cyan-400 text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                    Q{q.id}
                  </span>
                  <div>
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-purple-400 block mb-1">
                      {q.tag}
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {q.question}
                    </h4>
                  </div>
                </div>

                <div className="p-1 rounded-lg bg-slate-800 text-slate-400 shrink-0">
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-850 space-y-3">
                  {/* Trap Warning Box */}
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 flex items-start gap-2.5 text-xs text-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-amber-300 mb-0.5">Le Piège dans lequel tombent 90% des étudiants :</strong>
                      {q.trap}
                    </div>
                  </div>

                  {/* Master DBA Answer */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block text-emerald-400 mb-1 font-sans">Réponse Imparable à Donner au Professeur :</strong>
                      <p className="font-sans leading-relaxed text-slate-300">
                        {q.answer}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
