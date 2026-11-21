import React, { useState } from 'react';
import {
  Building2,
  ChevronRight,
  Coins,
  Gauge,
  Landmark,
  LayoutGrid,
  Lock,
  Users,
  X,
} from 'lucide-react';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import { dispatchEcosystemAction } from '../../engine/ecosystemActions';
import { createInitialEcosystemState } from '../../engine/ecosystemFactory';
import type { EcosystemAction } from '../../types/expansion';
import type { GameState } from '../../types/game';
import { DebatesSection, AdvisorsSection, MediaSection } from './EcosystemMediaSections';
import {
  CabinetCrisisSection,
  FactionsSection,
  NegotiationsSection,
  SocialActorsSection,
} from './EcosystemPartySections';
import {
  ForeignSection,
  IntendenciesSection,
  PlansSection,
  TransparencySection,
} from './EcosystemPlansTerritorySections';
import {
  ControlsSection,
  EvaluationsSection,
  OpinionSection,
} from './EcosystemSocietyStateSections';
import { EC, Pill } from './ecosystemUi';

interface EcosystemViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

type EcoSection = 'partido' | 'equipo' | 'sociedad' | 'estado' | 'territorio';

const SECTIONS: Array<{ id: EcoSection; label: string; icon: React.ReactNode }> = [
  { id: 'partido', label: 'Partido', icon: <Users className="h-3.5 w-3.5" /> },
  { id: 'equipo', label: 'Equipo y prensa', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { id: 'sociedad', label: 'Sociedad', icon: <Gauge className="h-3.5 w-3.5" /> },
  { id: 'estado', label: 'Estado', icon: <Landmark className="h-3.5 w-3.5" /> },
  { id: 'territorio', label: 'Territorio y exterior', icon: <Building2 className="h-3.5 w-3.5" /> },
];

export const EcosystemView: React.FC<EcosystemViewProps> = ({ gameState, onUpdateState }) => {
  const [section, setSection] = useState<EcoSection>('partido');
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const caps = getPlayerCapabilities(gameState);
  const eco = gameState.expansion ?? createInitialEcosystemState(gameState);

  const run = (action: EcosystemAction) => {
    let blocked: string | null = null;
    if (action.type === 'resolve_cabinet_crisis' && !caps.canAppointNationalMinisters) {
      blocked = caps.lockReasons.executiveNational;
    } else if (
      (action.type === 'foreign_negotiation' || action.type === 'mercosur_summit') &&
      !caps.canDirectForeignPolicyExecutive
    ) {
      blocked = caps.lockReasons.foreignPolicy;
    } else if (action.type === 'respond_institutional_control' && !caps.canDirectMinistriesAndStateAgencies) {
      blocked = caps.lockReasons.executiveNational;
    } else if (action.type === 'create_national_plan' && !caps.canDirectMinistriesAndStateAgencies) {
      blocked = caps.lockReasons.executiveNational;
    } else if (
      (action.type === 'intendency_agreement' || action.type === 'transfer_to_intendency') &&
      !caps.canDirectMinistriesAndStateAgencies &&
      !caps.canAdministerDepartamentalBudget
    ) {
      blocked = caps.lockReasons.executiveNational;
    } else if (
      action.type === 'intendency_agreement' &&
      caps.canAdministerDepartamentalBudget &&
      action.departmentId !== gameState.player.targetDepartment
    ) {
      blocked = 'Como Intendente solo podés firmar convenios con tu propio departamento.';
    }
    if (blocked) {
      setFailed(true);
      setMessage(blocked);
      return;
    }
    const result = dispatchEcosystemAction(gameState, action);
    setFailed(!result.ok);
    setMessage(result.message);
    if (result.ok) onUpdateState(result.nextState);
  };

  const props = { gameState, eco, run };
  const openCrises = eco.cabinetCrises.filter((c) => c.status === 'abierta').length;
  const openControls = eco.institutionalControls.filter((c) => c.status === 'abierto').length;
  const openTransparency = eco.transparencyCases.filter((c) => c.status !== 'cerrado').length;
  const openChallenges = eco.challenges.filter((c) => c.status === 'abierta').length;

  return (
    <div className="space-y-4 animate-editorial-in">
      <section className="warroom-surface rounded-xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#574239]/40 pb-3">
          <div>
            <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
              Ecosistema político · 14 subsistemas
            </div>
            <h2 className="mt-0.5 font-display text-xl font-bold text-[#DFE3E4]">
              Poder real, no decorado
            </h2>
            <p className="mt-0.5 text-[11px] text-[#CDC6B8]">
              Cada decisión mueve lealtades, opinión, riesgos institucionales y relaciones.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="accent">CP {gameState.player.politicalCapital}</Pill>
            <Pill tone="neutral">
              <Coins className="h-3 w-3" /> ${(gameState.player.campaignFundsUYU / 1000000).toFixed(1)}M
            </Pill>
            <Pill tone="good">Aprob. {gameState.politicalIndicators.governmentApproval.toFixed(0)}%</Pill>
            {openCrises > 0 && <Pill tone="bad">{openCrises} crisis</Pill>}
            {openControls + openTransparency + openChallenges > 0 && (
              <Pill tone="warn">{openControls + openTransparency + openChallenges} frentes abiertos</Pill>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex gap-1 overflow-x-auto pb-1">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition active:scale-[0.98] ${
                section === item.id
                  ? 'bg-[#E87532] text-[#511E00]'
                  : 'bg-[#262B2C] text-[#CDC6B8] hover:bg-[#2E3435] hover:text-[#DFE3E4]'
              }`}
            >
              {item.icon}
              {item.label}
              <ChevronRight className="h-3 w-3 opacity-50" />
            </button>
          ))}
        </div>

        {eco.lastMonthlyNotes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {eco.lastMonthlyNotes.slice(0, 4).map((note, index) => (
              <span
                key={`${note}_${index}`}
                className="rounded-md border border-[#574239]/50 bg-[#1B2021] px-1.5 py-0.5 text-[10px] text-[#CDC6B8]"
              >
                {note}
              </span>
            ))}
          </div>
        )}

        {message && (
          <div
            className={`mt-2 flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] font-medium ${
              failed
                ? 'border-[#C25A4E]/55 bg-[#C25A4E]/12 text-[#F08A7E]'
                : 'border-[#557568]/50 bg-[#557568]/18 text-[#ACCEBF]'
            }`}
          >
            <span className="flex items-start gap-1.5">
              {failed && <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              {message}
            </span>
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="shrink-0 rounded p-0.5 hover:bg-white/10"
              aria-label="Cerrar mensaje"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {!gameState.expansion && (
          <button
            type="button"
            onClick={() => onUpdateState({ ...gameState, expansion: eco })}
            className={`mt-2 w-full rounded-lg border border-dashed ${EC.border} px-3 py-2 text-[11px] font-bold text-[#FFB691] transition hover:border-[#E87532]/60`}
          >
            Activar ecosistema en esta partida guardada
          </button>
        )}
      </section>

      {section === 'partido' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <FactionsSection {...props} />
          <NegotiationsSection {...props} />
        </div>
      )}

      {section === 'equipo' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <AdvisorsSection {...props} />
          <div className="space-y-3">
            <MediaSection {...props} />
            <DebatesSection {...props} />
          </div>
        </div>
      )}

      {section === 'sociedad' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <SocialActorsSection {...props} />
          <OpinionSection {...props} />
        </div>
      )}

      {section === 'estado' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <ControlsSection {...props} />
          <EvaluationsSection {...props} />
          <PlansSection {...props} />
          <TransparencySection {...props} />
          <CabinetCrisisSection {...props} />
        </div>
      )}

      {section === 'territorio' && (
        <div className="grid gap-3 xl:grid-cols-2">
          <IntendenciesSection {...props} />
          <ForeignSection {...props} />
        </div>
      )}
    </div>
  );
};
