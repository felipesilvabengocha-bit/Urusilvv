import React, { useState } from 'react';
import { Award, ArrowRight } from 'lucide-react';
import { DEPARTMENTS_DATA, OFFICES } from '../data/uruguayData';
import { DepartmentId, GameState, OfficeId } from '../types/game';

interface TermEndModalProps {
  gameState: GameState;
  onContinueCareer: (nextOffice: OfficeId, nextDepartment: DepartmentId) => void;
  onExitHome: () => void;
}

export const TermEndModal: React.FC<TermEndModalProps> = ({
  gameState,
  onContinueCareer,
  onExitHome,
}) => {
  const legacy = gameState.termLegacySummary;
  const [allowReelectionReform, setAllowReelectionReform] = useState(false);
  const [nextOffice, setNextOffice] = useState<OfficeId>(
    gameState.player.currentOffice === 'presidente' ? 'senador' : 'presidente'
  );
  const [nextDept, setNextDept] = useState<DepartmentId>(gameState.player.targetDepartment);

  if (!legacy) return null;

  const isImmediatePresReelectionBlocked = (off: OfficeId) =>
    (!allowReelectionReform && off === 'presidente' && gameState.player.currentOffice === 'presidente') ||
    (!allowReelectionReform && off === 'vicepresidente' && gameState.player.currentOffice === 'vicepresidente') ||
    (off === 'intendente' &&
      gameState.player.currentOffice === 'intendente' &&
      gameState.player.termsServedInCurrentOffice >= 2);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A0F10]/85 p-0 backdrop-blur-xs sm:items-center sm:p-4">
      <div className="animate-editorial-in safe-bottom max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#574239]/70 bg-[#171C1D] p-5 text-[#DFE3E4] shadow-2xl sm:rounded-xl sm:p-6">
        <div className="mb-3 flex justify-center sm:hidden">
          <span className="h-1 w-10 rounded-full bg-[#574239]" />
        </div>

        <div className="flex items-center gap-2 font-mono-data text-xs font-bold uppercase tracking-wider text-[#FFB691]">
          <Award className="h-4 w-4 text-[#E87532]" />
          Evaluación de Legado · Balance de Mandato
        </div>

        <h2 className="mt-2 font-display text-2xl font-semibold text-[#DFE3E4]">
          {legacy.headline} — Gestión: <span className="text-[#ACCEBF]">{legacy.grade}</span>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[#CDC6B8]">{legacy.summary}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {legacy.achievementsThisTerm.map((a, idx) => (
            <div key={idx} className="rounded-lg border border-[#574239]/45 bg-[#1B2021] p-3 text-xs font-medium text-[#DFE3E4]">
              {a}
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-[#574239]/45 pt-5">
          <h3 className="text-sm font-bold text-[#DFE3E4]">Continuar carrera política (Ciclo #{gameState.cycleNumber + 1})</h3>
          <p className="mt-1 text-xs text-[#CDC6B8]">
            Durante la campaña electoral conservarás únicamente las atribuciones de tu cargo actual hasta el cambio de mando constitucional.
          </p>

          {(gameState.player.currentOffice === 'presidente' ||
            gameState.player.currentOffice === 'vicepresidente') && (
            <label className="mt-3 flex min-h-[40px] items-center gap-2 text-xs font-medium text-[#FFB691]">
              <input
                type="checkbox"
                checked={allowReelectionReform}
                onChange={(e) => setAllowReelectionReform(e.target.checked)}
                className="h-4 w-4 accent-[#E87532]"
              />
              Habilitar escenario alternativo con reforma constitucional de reelección inmediata (Art. 152)
            </label>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#DFE3E4]">
              Próximo cargo a postularte
              <select
                value={nextOffice}
                onChange={(e) => setNextOffice(e.target.value as OfficeId)}
                className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                {OFFICES.map((o) => {
                  const blocked = isImmediatePresReelectionBlocked(o.id);
                  return (
                    <option key={o.id} value={o.id} disabled={blocked}>
                      {o.name} {blocked ? '(Inhabilitado por Constitución)' : ''}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="block text-xs font-semibold text-[#DFE3E4]">
              Departamento base
              <select
                value={nextDept}
                onChange={(e) => setNextDept(e.target.value as DepartmentId)}
                className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                {DEPARTMENTS_DATA.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-between">
            <button
              onClick={onExitHome}
              className="min-h-[46px] rounded-lg border border-[#574239]/60 bg-[#1B2021] px-4 py-2 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#FFB691]"
            >
              Cerrar y volver al inicio
            </button>
            <button
              onClick={() => onContinueCareer(nextOffice, nextDept)}
              className="executive-action-btn inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold"
            >
              Iniciar nuevo ciclo electoral
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
