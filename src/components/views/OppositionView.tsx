import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Gavel,
  Handshake,
  Lock,
  Megaphone,
  Mic,
  SearchCheck,
  ShieldAlert,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import { MONTH_NAMES } from '../../data/uruguayData';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import {
  capitalizeOppositionOpportunity,
  evaluatePromiseStatus,
  isPlayerInNationalOpposition,
  OPPOSITION_STANCES,
} from '../../engine/oppositionEngine';
import { getActiveChambers } from '../../engine/parliamentEngine';
import { GameState, OppositionStance, ProgramProposal } from '../../types/game';

interface OppositionViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

export const OppositionView: React.FC<OppositionViewProps> = ({ gameState, onUpdateState }) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [altTitle, setAltTitle] = useState('');
  const [altArea, setAltArea] = useState('Economía y Empleo');
  const [altSummary, setAltSummary] = useState('');

  const caps = getPlayerCapabilities(gameState);
  const inOpposition = isPlayerInNationalOpposition(gameState);
  const chambers = getActiveChambers(gameState);
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const govParty =
    gameState.parties.find((p) => p.id === gameState.nationalPresidentPartyId) ?? gameState.parties[0];
  const oppState = gameState.opposition;
  const dateLabel = `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`;

  const handleSelectStance = (stance: OppositionStance) => {
    if (!inOpposition) {
      setFeedback('Tu partido integra el oficialismo nacional; esta estrategia aplica cuando estás en oposición.');
      return;
    }
    if (oppState.stance === stance) return;
    if (gameState.player.politicalCapital < 2) {
      setFeedback('Necesitás 2 de capital político para reorientar la estrategia opositora.');
      return;
    }
    const label = OPPOSITION_STANCES.find((s) => s.id === stance)?.label ?? stance;
    const msg = `Estrategia de oposición fijada en: ${label}. Impactará tus relaciones, credibilidad e intención de voto mes a mes.`;
    setFeedback(msg);
    onUpdateState({
      ...gameState,
      opposition: {
        ...oppState,
        stance,
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 2,
      },
      history: [
        {
          id: `opp_stance_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: `Nueva línea opositora: ${label}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handlePressConference = () => {
    if (!inOpposition) {
      setFeedback('Como parte del gobierno oficialista no podés lanzar conferencias de oposición contra tu propio Ejecutivo.');
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setFeedback('Necesitás 3 de capital político para convocar una conferencia de prensa.');
      return;
    }
    const govHit = oppState.stance === 'confrontativa' ? -1.8 : -1.1;
    const popGain = 1.4;
    const credGain = oppState.stance === 'propositiva' || oppState.stance === 'critica' ? 1.5 : 0.8;
    const msg = `Conferencia de prensa opositora realizada: cuestionaste la gestión de ${govParty.acronym} (+${popGain} pop., +${credGain} credibilidad).`;
    setFeedback(msg);
    const nextApproval = Math.max(15, Number((gameState.politicalIndicators.governmentApproval + govHit).toFixed(1)));
    onUpdateState({
      ...gameState,
      macro: {
        ...gameState.macro,
        governmentApprovalPct: nextApproval,
      },
      politicalIndicators: {
        ...gameState.politicalIndicators,
        governmentApproval: nextApproval,
      },
      opposition: {
        ...oppState,
        credibility: Math.min(98, Number((oppState.credibility + credGain).toFixed(1))),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, Number((gameState.player.attributes.popularity + popGain).toFixed(1))),
        },
      },
      history: [
        {
          id: `opp_press_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: 'Conferencia de prensa de la oposición',
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleTerritorialAct = () => {
    if (gameState.player.politicalCapital < 3) {
      setFeedback('Necesitás 3 de capital político para organizar un acto y recorrida territorial.');
      return;
    }
    if (gameState.player.campaignFundsUYU < 450000) {
      setFeedback('Fondos insuficientes ($450.000 UYU requeridos para logística del acto).');
      return;
    }
    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            partyStrength: Math.min(100, Number((p.partyStrength + 2.2).toFixed(1))),
            campaignMomentum: Math.min(15, Number((p.campaignMomentum + 1.5).toFixed(2))),
            currentPollShare: Math.min(60, Number((p.currentPollShare + 0.6).toFixed(2))),
          }
        : p
    );
    const msg = `Acto y recorrida territorial en el interior ejecutada: +2.2 fortaleza partidaria y +0.6% intención de voto para ${playerParty.acronym}.`;
    setFeedback(msg);
    const updatedStrength = nextParties.find((p) => p.id === playerParty.id)?.partyStrength ?? gameState.politicalIndicators.partyStrength;
    onUpdateState({
      ...gameState,
      parties: nextParties,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        partyStrength: updatedStrength,
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        campaignFundsUYU: gameState.player.campaignFundsUYU - 450000,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, Number((gameState.player.attributes.popularity + 1.1).toFixed(1))),
        },
      },
      history: [
        {
          id: `opp_act_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: `Acto territorial de ${playerParty.acronym}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleCompeteLeadership = () => {
    if (gameState.player.politicalCapital < 4) {
      setFeedback('Necesitás 4 de capital político para disputar espacios de conducción partidaria.');
      return;
    }
    const nextParties = gameState.parties.map((p) => {
      if (p.id !== playerParty.id) return p;
      return {
        ...p,
        sectors: p.sectors.map((s) =>
          s.id === gameState.player.sectorId
            ? { ...s, internalWeight: Math.min(75, Number((s.internalWeight + 2.5).toFixed(1))) }
            : s
        ),
      };
    });
    const nextLeadership = Math.min(100, Number((oppState.internalLeadership + 6).toFixed(1)));
    const msg = `Consolidaste conducción interna en ${playerParty.acronym}: liderazgo interno sube a ${nextLeadership}/100.`;
    setFeedback(msg);
    onUpdateState({
      ...gameState,
      parties: nextParties,
      opposition: {
        ...oppState,
        internalLeadership: nextLeadership,
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
      },
      history: [
        {
          id: `opp_lead_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: 'Disputa por la conducción interna',
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleRecruitLeader = () => {
    if (gameState.player.politicalCapital < 4) {
      setFeedback('Necesitás 4 de capital político para incorporar nuevos referentes.');
      return;
    }
    if (gameState.player.campaignFundsUYU < 300000) {
      setFeedback('Fondos insuficientes ($300.000 UYU requeridos para sumar equipos técnicos y territoriales).');
      return;
    }
    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? { ...p, partyStrength: Math.min(100, Number((p.partyStrength + 1.8).toFixed(1))) }
        : p
    );
    const msg = `Nuevo dirigente territorial y equipo técnico incorporado a ${playerParty.acronym}: +2 aparato territorial y +1.8 fortaleza partidaria.`;
    setFeedback(msg);
    const updatedStrength = nextParties.find((p) => p.id === playerParty.id)?.partyStrength ?? gameState.politicalIndicators.partyStrength;
    onUpdateState({
      ...gameState,
      parties: nextParties,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        partyStrength: updatedStrength,
      },
      opposition: {
        ...oppState,
        recruitedLeadersCount: oppState.recruitedLeadersCount + 1,
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
        campaignFundsUYU: gameState.player.campaignFundsUYU - 300000,
        attributes: {
          ...gameState.player.attributes,
          territorialMachine: Math.min(99, gameState.player.attributes.territorialMachine + 2),
          management: Math.min(99, gameState.player.attributes.management + 1),
        },
      },
      history: [
        {
          id: `opp_rec_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: 'Reclutamiento de nuevos dirigentes',
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleParliamentOversight = (kind: 'llamado_sala' | 'investigadora') => {
    if (!caps.canOversightGovernment) {
      setFeedback(caps.lockReasons.parliamentActions);
      return;
    }
    const cost = kind === 'investigadora' ? 7 : 6;
    if (gameState.player.politicalCapital < cost) {
      setFeedback(`Necesitás ${cost} de capital político para impulsar esta instancia parlamentaria.`);
      return;
    }
    const govHit = kind === 'investigadora' ? -2.8 : -2.2;
    const popGain = kind === 'investigadora' ? 2.4 : 1.9;
    const title =
      kind === 'investigadora'
        ? 'Comisión investigadora parlamentaria (Art. 120)'
        : 'Llamado a sala a ministros del Ejecutivo (Art. 119)';
    const msg =
      kind === 'investigadora'
        ? `Promoviste comisión investigadora en el Parlamento (+${popGain} pop., ${govHit}% aprobación del oficialismo).`
        : `Ejecutaste llamado a sala al gabinete ministerial (+${popGain} pop., ${govHit}% aprobación del oficialismo).`;
    setFeedback(msg);

    const nextApproval = Math.max(15, Number((gameState.politicalIndicators.governmentApproval + govHit).toFixed(1)));
    const nextControls = (oppState.parliamentaryControlsExecuted ?? 0) + 1;
    onUpdateState({
      ...gameState,
      macro: {
        ...gameState.macro,
        governmentApprovalPct: nextApproval,
      },
      politicalIndicators: {
        ...gameState.politicalIndicators,
        governmentApproval: nextApproval,
      },
      opposition: {
        ...oppState,
        credibility: Math.min(98, Number((oppState.credibility + 2).toFixed(1))),
        parliamentaryControlsExecuted: nextControls,
      },
      progression: gameState.progression.careerStats
        ? {
            ...gameState.progression,
            careerStats: {
              ...gameState.progression.careerStats,
              controlsExecuted: nextControls,
            },
          }
        : gameState.progression,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - cost,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, Number((gameState.player.attributes.popularity + popGain).toFixed(1))),
        },
      },
      history: [
        {
          id: `opp_parl_${Date.now()}`,
          dateLabel,
          category: 'parlamento',
          title,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleDenouncePromise = (promiseId: string) => {
    if (!inOpposition) {
      setFeedback('Solo la oposición controla y denuncia promesas incumplidas del gobierno.');
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setFeedback('Necesitás 3 de capital político para organizar la denuncia pública de incumplimiento.');
      return;
    }
    const target = oppState.governmentPromises.find((p) => p.id === promiseId);
    if (!target || target.denounced) return;

    const status = evaluatePromiseStatus(target, gameState.macro);
    if (status === 'cumplida') {
      setFeedback('Esa promesa se encuentra actualmente cumplida según los indicadores oficiales.');
      return;
    }

    const backlash = oppState.credibility < 35;
    const popDelta = backlash ? -0.8 : 1.6;
    const pollDelta = backlash ? 0 : 0.7;
    const govHit = backlash ? 0 : -2.0;

    const msg = backlash
      ? `Denunciaste «${target.title}», pero tu baja credibilidad redujo el impacto público (${popDelta} pop.).`
      : `Denuncia documentada de promesa incumplida («${target.title}»): +${pollDelta}% intención de voto y ${govHit}% aprobación oficialista.`;
    setFeedback(msg);

    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            currentPollShare: Math.min(60, Number((p.currentPollShare + pollDelta).toFixed(2))),
            campaignMomentum: Math.min(15, Number((p.campaignMomentum + (backlash ? 0 : 1.1)).toFixed(2))),
          }
        : p
    );

    const nextApproval = Math.max(15, Number((gameState.politicalIndicators.governmentApproval + govHit).toFixed(1)));
    onUpdateState({
      ...gameState,
      parties: nextParties,
      macro: {
        ...gameState.macro,
        governmentApprovalPct: nextApproval,
      },
      politicalIndicators: {
        ...gameState.politicalIndicators,
        governmentApproval: nextApproval,
      },
      opposition: {
        ...oppState,
        credibility: Math.min(98, Number((oppState.credibility + (backlash ? -1 : 1.8)).toFixed(1))),
        governmentPromises: oppState.governmentPromises.map((p) =>
          p.id === promiseId ? { ...p, denounced: true } : p
        ),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.max(12, Math.min(98, Number((gameState.player.attributes.popularity + popDelta).toFixed(1)))),
        },
      },
      history: [
        {
          id: `prom_den_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: `Control de promesas: ${target.title}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleCapitalizeOpportunity = (oppId: string, approach: 'denuncia_dura' | 'alternativa_tecnica') => {
    if (!inOpposition) {
      setFeedback('Tu partido integra la coalición oficialista nacional.');
      return;
    }
    const res = capitalizeOppositionOpportunity(gameState, oppId, approach);
    setFeedback(res.message);
    onUpdateState(res.nextState);
  };

  const handleToggleOppositionPact = (partnerPartyId: string) => {
    const partner = gameState.parties.find((p) => p.id === partnerPartyId);
    if (!partner) return;
    const isAlreadyInBloc = oppState.oppositionBlocPartyIds.includes(partnerPartyId);

    if (!isAlreadyInBloc) {
      if (gameState.player.politicalCapital < 5) {
        setFeedback('Necesitás 5 de capital político para sellar un acuerdo entre partidos opositores.');
        return;
      }
      const rel = gameState.player.relations.find((r) => r.partyId === partnerPartyId)?.affinity ?? 0;
      if (rel < -15) {
        setFeedback(`La afinidad con ${partner.name} (${rel}) es demasiado baja para acordar un bloque. Mejorá relación primero.`);
        return;
      }
      const msg = `Acuerdo de coordinación opositora sellado con ${partner.name}: sus bancas coordinarán posturas en proyectos clave.`;
      setFeedback(msg);
      onUpdateState({
        ...gameState,
        opposition: {
          ...oppState,
          oppositionBlocPartyIds: [...oppState.oppositionBlocPartyIds, partnerPartyId],
        },
        player: {
          ...gameState.player,
          politicalCapital: gameState.player.politicalCapital - 5,
          relations: gameState.player.relations.map((r) =>
            r.partyId === partnerPartyId ? { ...r, affinity: Math.min(100, r.affinity + 6) } : r
          ),
        },
        history: [
          {
            id: `opp_pact_${Date.now()}`,
            dateLabel,
            category: 'parlamento',
            title: `Acuerdo opositor con ${partner.acronym}`,
            detail: msg,
          },
          ...gameState.history,
        ],
      });
    } else {
      const msg = `Fin del acuerdo de coordinación parlamentaria con ${partner.name}.`;
      setFeedback(msg);
      onUpdateState({
        ...gameState,
        opposition: {
          ...oppState,
          oppositionBlocPartyIds: oppState.oppositionBlocPartyIds.filter((id) => id !== partnerPartyId),
        },
        player: {
          ...gameState.player,
          relations: gameState.player.relations.map((r) =>
            r.partyId === partnerPartyId ? { ...r, affinity: Math.max(-100, r.affinity - 5) } : r
          ),
        },
        history: [
          {
            id: `opp_unpact_${Date.now()}`,
            dateLabel,
            category: 'parlamento',
            title: `Fin de acuerdo opositor con ${partner.acronym}`,
            detail: msg,
          },
          ...gameState.history,
        ],
      });
    }
  };

  const handleSubmitAlternativeProgram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!altTitle.trim() || !altSummary.trim()) {
      setFeedback('Completá el título y el contenido de la propuesta alternativa.');
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setFeedback('Necesitás 3 de capital político para presentar y difundir una propuesta programática alternativa.');
      return;
    }
    const newProposal: ProgramProposal = {
      id: `alt_prog_${Date.now()}`,
      title: altTitle.trim(),
      area: altArea,
      summary: altSummary.trim(),
      adopted: true,
      popularityImpact: 1.5,
      momentumImpact: 1.4,
    };

    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            campaignMomentum: Math.min(15, Number((p.campaignMomentum + 1.4).toFixed(2))),
          }
        : p
    );

    const msg = `Presentaste la propuesta alternativa «${newProposal.title}» al programa de gobierno (+1.5 pop., +2 credibilidad).`;
    setAltTitle('');
    setAltSummary('');
    setFeedback(msg);

    onUpdateState({
      ...gameState,
      parties: nextParties,
      programProposals: [newProposal, ...gameState.programProposals],
      opposition: {
        ...oppState,
        credibility: Math.min(98, Number((oppState.credibility + 2).toFixed(1))),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, Number((gameState.player.attributes.popularity + 1.5).toFixed(1))),
        },
      },
      history: [
        {
          id: `alt_hist_${Date.now()}`,
          dateLabel,
          category: 'campana',
          title: `Propuesta alternativa: ${newProposal.title}`,
          detail: newProposal.summary,
        },
        ...gameState.history,
      ],
    });
  };

  const oppositionRivalParties = gameState.parties.filter(
    (p) => !gameState.coalitionPartyIds.includes(p.id) && p.id !== gameState.player.partyId
  );

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Encabezado de Situación Política */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#574239]/40 pb-4">
          <div>
            <div className="font-mono-data text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FFB691]">
              Estrategia Política y Contralor Institucional
            </div>
            <h2 className="mt-0.5 flex items-center gap-2 font-display text-xl font-bold text-[#DFE3E4]">
              <Megaphone className="h-5 w-5 text-[#E87532]" />
              {inOpposition
                ? 'Conducción Política de la Oposición'
                : 'Observatorio de la Oposición frente a tu Gobierno'}
            </h2>
            <p className="mt-1 text-xs text-[#CDC6B8]">
              Cargo actual: <strong className="text-[#DFE3E4]">{caps.roleSummaryLabel}</strong> · Gobierno nacional:{' '}
              <strong className="text-[#DFE3E4]">{gameState.nationalPresidentName}</strong> ({govParty.acronym})
            </p>
          </div>
          <span
            className={`rounded-lg border px-2.5 py-1 text-xs font-bold ${
              inOpposition
                ? 'border-[#E87532]/50 bg-[#E87532]/16 text-[#FFB691]'
                : 'border-[#557568]/50 bg-[#557568]/18 text-[#ACCEBF]'
            }`}
          >
            {inOpposition ? 'En Oposición Nacional' : 'Oficialismo Nacional'}
          </span>
        </div>

        {oppState.lastAIGovActionNote && inOpposition && (
          <div className="mt-3 rounded-lg border border-[#574239]/45 bg-[#1B2021] p-3 text-xs text-[#DFE3E4]">
            <span className="font-bold text-[#FFB691]">Última acción del Gobierno IA: </span>
            {oppState.lastAIGovActionNote}
          </div>
        )}

        {!inOpposition && (
          <details className="mt-3 rounded-lg border border-[#557568]/45 bg-[#557568]/15 p-3 text-xs text-[#DFE3E4]">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold text-[#ACCEBF]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Modo oficialismo activo · Ver alcance de la oposición
            </summary>
            <p className="mt-1.5 text-[11px] text-[#CDC6B8]">
              Actualmente pertenecés al bloque oficialista nacional. Si en próximas elecciones pasás a la oposición, desde aquí dirigirás la estrategia opositora, la fiscalización al Ejecutivo y el camino de retorno al poder.
            </p>
          </details>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="text-[11px] font-semibold text-[#CDC6B8]">Credibilidad partidaria</div>
            <div className="mt-1 font-mono-data text-lg font-bold text-[#FFB691]">
              {oppState.credibility.toFixed(0)}/100
            </div>
          </div>
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="text-[11px] font-semibold text-[#CDC6B8]">Liderazgo interno</div>
            <div className="mt-1 font-mono-data text-lg font-bold text-[#DFE3E4]">
              {oppState.internalLeadership.toFixed(0)}/100
            </div>
          </div>
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="text-[11px] font-semibold text-[#CDC6B8]">Intención voto {playerParty.acronym}</div>
            <div className="mt-1 font-mono-data text-lg font-bold text-[#ACCEBF]">
              {playerParty.currentPollShare.toFixed(1)}%
            </div>
          </div>
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="text-[11px] font-semibold text-[#CDC6B8]">Aprobación del Gobierno</div>
            <div className="mt-1 font-mono-data text-lg font-bold text-[#FFB691]">
              {gameState.politicalIndicators.governmentApproval.toFixed(0)}%
            </div>
          </div>
          <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
            <div className="text-[11px] font-semibold text-[#CDC6B8]">Dirigentes reclutados</div>
            <div className="mt-1 font-mono-data text-lg font-bold text-[#DFE3E4]">
              {oppState.recruitedLeadersCount}
            </div>
          </div>
        </div>

        {feedback && (
          <div className="mt-4 rounded-lg border border-[#557568]/50 bg-[#557568]/18 p-3 text-xs font-medium text-[#ACCEBF]">
            {feedback}
          </div>
        )}
      </section>

      {/* Estrategias de Oposición */}
      <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-sm font-bold text-[#DFE3E4]">
              Estrategia de Oposición (cambio: -2 cap. político)
            </h3>
            <p className="text-xs text-[#CDC6B8]">
              Define el tono de tu bancada y partido frente al gobierno de {govParty.name}.
            </p>
          </div>
          <span className="font-mono-data text-xs font-bold text-[#FFB691]">
            Capital disponible: {gameState.player.politicalCapital}
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {OPPOSITION_STANCES.map((s) => {
            const active = oppState.stance === s.id;
            return (
              <button
                key={s.id}
                onClick={() => handleSelectStance(s.id)}
                className={`flex flex-col justify-between rounded-lg border p-3 text-left transition ${
                  active
                    ? 'border-[#E87532] bg-[#E87532]/16'
                    : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                }`}
              >
                <div>
                  <div className={`text-xs font-bold ${active ? 'text-[#FFB691]' : 'text-[#DFE3E4]'}`}>
                    {s.label}
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#CDC6B8]">{s.summary}</p>
                </div>
                <div className="mt-2 border-t border-[#574239]/40 pt-2 text-[10px] font-medium text-[#DEC1B4]">
                  {s.effectsHint}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Funciones de Oposición y Preparación Electoral */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="warroom-surface space-y-3 rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
            <Gavel className="h-4 w-4 text-[#E87532]" />
            Acciones Políticas, Contralor y Reconstrucción
          </h3>

          {!caps.canOversightGovernment && (
            <details className="rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-2.5 text-[11px] text-[#DFE3E4]">
              <summary className="flex cursor-pointer items-center gap-2 font-bold text-[#FFB691]">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Interpelaciones restringidas sin banca parlamentaria (ver detalle)
              </summary>
              <p className="mt-1 text-[#CDC6B8]">
                {caps.lockReasons.parliamentActions} Podés igualmente hacer conferencias, actos, propuestas y acuerdos partidarios.
              </p>
            </details>
          )}

          <div className="grid gap-2.5 sm:grid-cols-2">
            <button
              onClick={handlePressConference}
              disabled={!inOpposition}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#574239]/50 bg-[#1B2021] px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532] disabled:opacity-45"
            >
              <span className="flex items-center gap-2">
                <Mic className="h-3.5 w-3.5 text-[#E87532]" />
                Conferencia de prensa
              </span>
              <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">-3 cap.</span>
            </button>

            <button
              onClick={handleTerritorialAct}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#574239]/50 bg-[#1B2021] px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:border-[#557568]"
            >
              <span className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-[#ACCEBF]" />
                Acto y recorrida
              </span>
              <span className="font-mono-data text-[11px] text-[#DEC1B4]">-3 cap · $450k</span>
            </button>

            <button
              onClick={handleCompeteLeadership}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#574239]/50 bg-[#1B2021] px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
            >
              <span className="flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-[#E87532]" />
                Disputar liderazgo interno
              </span>
              <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">-4 cap.</span>
            </button>

            <button
              onClick={handleRecruitLeader}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#574239]/50 bg-[#1B2021] px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:border-[#557568]"
            >
              <span className="flex items-center gap-2">
                <UserPlus className="h-3.5 w-3.5 text-[#ACCEBF]" />
                Reclutar dirigentes
              </span>
              <span className="font-mono-data text-[11px] text-[#DEC1B4]">-4 cap · $300k</span>
            </button>

            <button
              onClick={() => handleParliamentOversight('llamado_sala')}
              disabled={!caps.canOversightGovernment}
              title={!caps.canOversightGovernment ? caps.lockReasons.parliamentActions : ''}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#E87532]/50 bg-[#E87532]/14 px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:bg-[#E87532] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex items-center gap-2">
                {caps.canOversightGovernment ? (
                  <Gavel className="h-3.5 w-3.5 text-[#FFB691]" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-[#CDC6B8]" />
                )}
                Llamado a sala (ministros)
              </span>
              <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">-6 cap.</span>
            </button>

            <button
              onClick={() => handleParliamentOversight('investigadora')}
              disabled={!caps.canOversightGovernment}
              title={!caps.canOversightGovernment ? caps.lockReasons.parliamentActions : ''}
              className="flex min-h-[44px] items-center justify-between rounded-lg border border-[#93000A]/60 bg-[#93000A]/25 px-3 py-2 text-left text-xs font-semibold text-[#DFE3E4] transition hover:bg-[#93000A] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span className="flex items-center gap-2">
                {caps.canOversightGovernment ? (
                  <SearchCheck className="h-3.5 w-3.5 text-[#FFB4AB]" />
                ) : (
                  <Lock className="h-3.5 w-3.5 text-[#CDC6B8]" />
                )}
                Comisión investigadora
              </span>
              <span className="font-mono-data text-[11px] font-bold text-[#FFB4AB]">-7 cap.</span>
            </button>
          </div>
        </div>

        {/* Renovar programa y propuestas alternativas */}
        <form
          onSubmit={handleSubmitAlternativeProgram}
          className="warroom-surface space-y-3 rounded-xl p-5"
        >
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
            <FileText className="h-4 w-4 text-[#ACCEBF]" />
            Presentar Propuesta Alternativa y Renovar Programa (-3 cap.)
          </h3>
          <p className="text-xs text-[#CDC6B8]">
            Elaborá propuestas concretas para contrastar con el oficialismo y preparar el programa rumbo a la próxima elección.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={altTitle}
              onChange={(e) => setAltTitle(e.target.value)}
              placeholder="Ej.: Plan de Empleo Juvenil e Industrial"
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/55 focus:border-[#E87532] focus:outline-none"
            />
            <select
              value={altArea}
              onChange={(e) => setAltArea(e.target.value)}
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
            >
              <option value="Economía y Empleo">Economía y Empleo</option>
              <option value="Seguridad y Convivencia">Seguridad y Convivencia</option>
              <option value="Educación y Ciencia">Educación y Ciencia</option>
              <option value="Salud y Protección Social">Salud y Protección Social</option>
              <option value="Infraestructura e Interior">Infraestructura e Interior</option>
            </select>
          </div>
          <textarea
            value={altSummary}
            onChange={(e) => setAltSummary(e.target.value)}
            rows={2}
            placeholder="Fundamento técnico y medidas concretas frente al proyecto del gobierno..."
            className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/55 focus:border-[#E87532] focus:outline-none"
          />
          <button
            type="submit"
            className="inline-flex min-h-[38px] items-center gap-2 rounded-lg bg-[#557568] px-4 text-xs font-bold text-white transition hover:bg-[#3D584D]"
          >
            Publicar propuesta alternativa (-3 cap.)
          </button>
        </form>
      </section>

      {/* Coyunturas de Opinión Pública y Control de Promesas */}
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="warroom-surface space-y-3 rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
            <ShieldAlert className="h-4 w-4 text-[#E87532]" />
            Coyunturas de Gestión y Opinión Pública
          </h3>
          <p className="text-xs text-[#CDC6B8]">
            Errores, conflictos o desvíos del gobierno generan oportunidades políticas. Si actuás sin credibilidad o con el gobierno muy popular, podés sufrir rechazo ciudadano.
          </p>

          {oppState.opportunities.length === 0 ? (
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-4 text-xs text-[#CDC6B8]">
              No hay coyunturas abiertas este mes. Al avanzar el calendario, las decisiones del Ejecutivo generarán nuevos frentes políticos.
            </div>
          ) : (
            <div className="space-y-2.5">
              {oppState.opportunities.map((opp) => (
                <div
                  key={opp.id}
                  className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] text-[#FFB691]">
                    <span className="font-bold uppercase">{opp.category}</span>
                    <span className="font-mono-data text-[#DEC1B4]">{opp.dateLabel}</span>
                  </div>
                  <div className="mt-1 font-display text-xs font-bold text-[#DFE3E4]">{opp.title}</div>
                  <p className="mt-1 text-[11px] text-[#CDC6B8]">{opp.summary}</p>
                  {opp.capitalized ? (
                    <div className="mt-2 rounded-lg border border-[#557568]/40 bg-[#0A0F10] p-2 text-[11px] font-medium text-[#ACCEBF]">
                      {opp.outcomeNote}
                    </div>
                  ) : (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        onClick={() => handleCapitalizeOpportunity(opp.id, 'denuncia_dura')}
                        disabled={!inOpposition}
                        className="rounded-lg border border-[#E87532]/50 bg-[#E87532]/15 px-2.5 py-1.5 text-[11px] font-bold text-[#FFB691] transition hover:bg-[#E87532] hover:text-white disabled:opacity-45"
                      >
                        Denunciar y capitalizar (-4 cap.)
                      </button>
                      <button
                        onClick={() => handleCapitalizeOpportunity(opp.id, 'alternativa_tecnica')}
                        disabled={!inOpposition}
                        className="rounded-lg border border-[#557568]/50 bg-[#557568]/18 px-2.5 py-1.5 text-[11px] font-bold text-[#ACCEBF] transition hover:bg-[#557568] hover:text-white disabled:opacity-45"
                      >
                        Presentar salida técnica (-5 cap.)
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Control de Promesas Electorales del Gobierno */}
        <div className="warroom-surface space-y-3 rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
            <ClipboardCheck className="h-4 w-4 text-[#ACCEBF]" />
            Observatorio de Promesas del Gobierno ({govParty.acronym})
          </h3>
          <p className="text-xs text-[#CDC6B8]">
            Comparación en tiempo real entre los compromisos electorales del oficialismo y los indicadores macroeconómicos vigentes.
          </p>

          <div className="space-y-2.5">
            {oppState.governmentPromises.map((prom) => {
              const status = evaluatePromiseStatus(prom, gameState.macro);
              const actualValue = gameState.macro[prom.metric];
              const fulfilled = status === 'cumplida';
              return (
                <div
                  key={prom.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-[#DFE3E4]">{prom.title}</div>
                    <div className="mt-1 flex items-center gap-3 font-mono-data text-[11px] text-[#CDC6B8]">
                      <span>Meta: {prom.targetLabel}</span>
                      <span>Actual: {actualValue.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-bold ${
                        fulfilled
                          ? 'bg-[#557568]/25 text-[#ACCEBF]'
                          : 'bg-[#93000A]/35 text-[#FFB4AB]'
                      }`}
                    >
                      {fulfilled ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertCircle className="h-3 w-3" />
                      )}
                      {fulfilled ? 'Cumplida' : 'Incumplida'}
                    </span>
                    {!fulfilled && !prom.denounced && inOpposition && (
                      <button
                        onClick={() => handleDenouncePromise(prom.id)}
                        className="rounded-lg border border-[#93000A]/60 bg-[#93000A]/25 px-2.5 py-1 text-[11px] font-bold text-[#FFB4AB] transition hover:bg-[#93000A] hover:text-white"
                      >
                        Denunciar (-3 cap.)
                      </button>
                    )}
                    {prom.denounced && (
                      <span className="text-[11px] font-semibold text-[#CDC6B8]">Denunciada</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Acuerdos entre Partidos Opositores */}
      <section className="warroom-surface space-y-3 rounded-xl p-5">
        <div>
          <h3 className="flex items-center gap-2 font-display text-sm font-bold text-[#DFE3E4]">
            <Handshake className="h-4 w-4 text-[#E87532]" />
            Coordinación y Acuerdos entre Partidos Opositores
          </h3>
          <p className="text-xs text-[#CDC6B8]">
            Cada partido opositor tiene su propia estrategia frente al gobierno. Coordinar un bloque multiplica votos en proyectos propios y fortalece la presión parlamentaria.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {oppositionRivalParties.map((p) => {
            const rel = gameState.player.relations.find((r) => r.partyId === p.id)?.affinity ?? 0;
            const seatsDep = chambers.deputiesByParty[p.id] ?? 0;
            const seatsSen = chambers.senateByParty[p.id] ?? 0;
            const aiStance = oppState.partyOppositionStrategies[p.id] ?? 'critica';
            const inBloc = oppState.oppositionBlocPartyIds.includes(p.id);
            return (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: p.color }}
                      />
                      <span className="text-xs font-bold text-[#DFE3E4]">
                        {p.name} ({p.acronym})
                      </span>
                    </div>
                    <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">
                      {p.currentPollShare.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 font-mono-data text-[11px] text-[#CDC6B8]">
                    <span>Senado: {seatsSen}</span>
                    <span>Dip.: {seatsDep}</span>
                    <span>Afinidad: {rel > 0 ? `+${rel}` : rel}</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-[#CDC6B8]">
                    Línea actual: <span className="font-semibold capitalize text-[#FFB691]">{aiStance}</span>
                  </div>
                </div>

                {inOpposition && (
                  <button
                    onClick={() => handleToggleOppositionPact(p.id)}
                    className={`mt-3 min-h-[34px] w-full rounded-lg border px-3 text-xs font-bold transition ${
                      inBloc
                        ? 'border-[#557568]/60 bg-[#557568]/20 text-[#ACCEBF] hover:border-[#93000A]/60 hover:bg-[#93000A]/25 hover:text-[#FFB4AB]'
                        : 'border-[#574239]/60 bg-[#0A0F10] text-[#DFE3E4] hover:border-[#E87532] hover:text-[#FFB691]'
                    }`}
                  >
                    {inBloc ? 'En bloque opositor (deshacer)' : 'Acordar bloque opositor (-5 cap.)'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
