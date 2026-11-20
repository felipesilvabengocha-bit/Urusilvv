import React, { useState } from 'react';
import {
  BookOpenCheck,
  CalendarClock,
  CheckCircle2,
  Coins,
  Landmark,
  Lock,
  Play,
  Plus,
  ShieldCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { DIFFICULTIES, MONTH_NAMES, OFFICES } from '../../data/uruguayData';
import { VISUAL_ASSETS } from '../../data/visualAssets';
import { getCandidacyEligibility, getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import {
  runDepartamentalElections,
  runInternalElections,
  runNationalElections,
  runRunoffElection,
  seededRandom,
} from '../../engine/electoralEngine';
import { CAMPAIGN_ACTIONS, CampaignActionDef } from '../../engine/eventsAndAiEngine';
import { enterGovernmentPhase } from '../../engine/simulationEngine';
import { recordAchievementAndMeta } from '../../engine/storageEngine';
import { DepartmentId, GameState, OfficeId, ProgramProposal } from '../../types/game';

interface CampaignViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

function monthsUntil(currentYear: number, currentMonth: number, targetYear: number, targetMonth: number): number {
  return Math.max(0, (targetYear - currentYear) * 12 + (targetMonth - currentMonth));
}

export const CampaignAndElectionsView: React.FC<CampaignViewProps> = ({
  gameState,
  onUpdateState,
}) => {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<'todo' | 'comando' | 'calendario' | 'programa' | 'resultados'>('todo');
  const [customPropTitle, setCustomPropTitle] = useState('');
  const [customPropArea, setCustomPropArea] = useState('Economía y Producción');
  const [customPropSummary, setCustomPropSummary] = useState('');
  const [bannerError, setBannerError] = useState(false);

  const difficulty = DIFFICULTIES.find((d) => d.id === gameState.difficultyId)!;
  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const caps = getPlayerCapabilities(gameState);

  const cycleY = gameState.cycleStartYear;
  const canRunInternasByDate =
    (gameState.currentYear === cycleY && gameState.currentMonth >= 6) ||
    gameState.currentYear > cycleY;
  const canRunOctubreByDate =
    (gameState.currentYear === cycleY && gameState.currentMonth >= 10) ||
    gameState.currentYear > cycleY;
  const canRunBalotajeByDate =
    (gameState.currentYear === cycleY && gameState.currentMonth >= 11) ||
    gameState.currentYear > cycleY;
  const canRunDepartamentalesByDate =
    gameState.currentYear > cycleY &&
    (gameState.currentYear > cycleY + 1 || gameState.currentMonth >= 5);

  const monthsToInternas = monthsUntil(gameState.currentYear, gameState.currentMonth, cycleY, 6);
  const monthsToOctubre = monthsUntil(gameState.currentYear, gameState.currentMonth, cycleY, 10);
  const monthsToBalotaje = monthsUntil(gameState.currentYear, gameState.currentMonth, cycleY, 11);
  const monthsToDepartamentales = monthsUntil(gameState.currentYear, gameState.currentMonth, cycleY + 1, 5);

  const selectedDeptObj =
    gameState.departments.find((d) => d.id === gameState.player.targetDepartment) ?? gameState.departments[0];

  const handleSelectCandidacy = (officeId: OfficeId, deptId?: DepartmentId, mun?: string) => {
    const check = getCandidacyEligibility(gameState, officeId);
    if (!check.allowed) {
      setFeedback(check.reason ?? 'Postulación no habilitada en esta instancia.');
      return;
    }
    const nextDept = deptId ?? gameState.player.targetDepartment;
    const deptData = gameState.departments.find((d) => d.id === nextDept) ?? gameState.departments[0];
    const nextMun =
      officeId === 'alcalde'
        ? mun ??
          (deptData.sampleMunicipalities.includes(gameState.player.targetMunicipality ?? '')
            ? gameState.player.targetMunicipality
            : deptData.sampleMunicipalities[0])
        : gameState.player.targetMunicipality;

    const officeTitle = OFFICES.find((o) => o.id === officeId)?.name ?? officeId;
    setFeedback(`Postulación definida: ${officeTitle} (${deptData.name}).`);

    onUpdateState({
      ...gameState,
      player: {
        ...gameState.player,
        targetOffice: officeId,
        targetDepartment: nextDept,
        targetMunicipality: nextMun,
      },
      history: [
        {
          id: `cand_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: `Definición de postulación: ${officeTitle}`,
          detail: `Tu candidatura para la próxima instancia electoral queda registrada por ${deptData.name}.`,
        },
        ...gameState.history,
      ],
    });
  };

  const executeCampaignAction = (act: CampaignActionDef) => {
    if (!caps.canCampaign) {
      setFeedback(caps.lockReasons.campaignActions);
      return;
    }
    if (gameState.monthsExecutedInTurn >= 2) {
      setFeedback('Ya realizaste 2 acciones mayores este mes. Usá «Avanzar mes» para continuar.');
      return;
    }
    if (gameState.player.campaignFundsUYU < act.moneyCostUYU) {
      setFeedback('Fondos de campaña insuficientes. Podés recaudar más en la pestaña Recursos.');
      return;
    }
    if (gameState.player.politicalCapital < act.politicalCapitalCost) {
      setFeedback('Capital político insuficiente. Podés generar CP en la pestaña Recursos.');
      return;
    }

    const rng = seededRandom(`${gameState.id}-act-${act.id}-${gameState.currentMonth}-${gameState.monthsExecutedInTurn}`);
    const skillBonus =
      (gameState.player.attributes.charisma + gameState.player.attributes.negotiation - 100) * 0.25;
    const effectiveRisk = Math.max(4, act.riskPct - skillBonus);
    const success = rng() * 100 >= effectiveRisk;

    const popDelta = success ? act.popularityDelta : -1.1;
    const momDelta = success ? act.momentumDelta : -0.8;
    const strDelta = success ? act.partyStrengthDelta : 0;

    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            campaignMomentum: Number(Math.max(-12, Math.min(15, p.campaignMomentum + momDelta)).toFixed(2)),
            partyStrength: Math.min(100, p.partyStrength + strDelta),
            currentPollShare: Number(Math.max(0.5, Math.min(60, p.currentPollShare + momDelta * 0.35)).toFixed(2)),
          }
        : p
    );

    const msg = success
      ? `${act.label}: resultado favorable (+${popDelta.toFixed(1)} popularidad, +${momDelta.toFixed(1)} impulso).`
      : `${act.label}: tropiezo mediático o baja convocatoria (${popDelta.toFixed(1)} popularidad).`;
    setFeedback(msg);

    onUpdateState({
      ...gameState,
      monthsExecutedInTurn: gameState.monthsExecutedInTurn + 1,
      parties: nextParties,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        partyStrength: Math.min(100, gameState.politicalIndicators.partyStrength + strDelta),
      },
      player: {
        ...gameState.player,
        campaignFundsUYU: gameState.player.campaignFundsUYU - act.moneyCostUYU,
        politicalCapital: gameState.player.politicalCapital - act.politicalCapitalCost,
        attributes: {
          ...gameState.player.attributes,
          popularity: Number(Math.max(12, Math.min(98, gameState.player.attributes.popularity + popDelta)).toFixed(1)),
        },
      },
      history: [
        {
          id: `camp_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: act.label,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleAdoptProposal = (prop: ProgramProposal) => {
    if (prop.adopted) return;
    if (gameState.player.politicalCapital < 2) {
      setFeedback('Necesitás 2 de capital político para incorporar una propuesta al programa.');
      return;
    }

    const nextProposals = gameState.programProposals.map((p) =>
      p.id === prop.id ? { ...p, adopted: true } : p
    );
    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            campaignMomentum: Number(Math.min(15, p.campaignMomentum + prop.momentumImpact).toFixed(2)),
            currentPollShare: Number(Math.min(60, p.currentPollShare + prop.momentumImpact * 0.25).toFixed(2)),
          }
        : p
    );

    const msg = `Incorporaste «${prop.title}» a tu programa de gobierno (+${prop.popularityImpact} pop., +${prop.momentumImpact} impulso).`;
    setFeedback(msg);

    onUpdateState({
      ...gameState,
      programProposals: nextProposals,
      parties: nextParties,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 2,
        attributes: {
          ...gameState.player.attributes,
          popularity: Number(Math.min(98, gameState.player.attributes.popularity + prop.popularityImpact).toFixed(1)),
        },
      },
      history: [
        {
          id: `prop_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: `Propuesta programática: ${prop.title}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleAddCustomProposal = (e: React.FormEvent) => {
    e.preventDefault();
    const title = customPropTitle.trim();
    const summary = customPropSummary.trim();
    if (!title || !summary) {
      setFeedback('Completá título y contenido de la propuesta programática.');
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setFeedback('Necesitás 3 de capital político para presentar una propuesta programática propia.');
      return;
    }

    const newProp: ProgramProposal = {
      id: `prop_custom_${Date.now()}`,
      title,
      area: customPropArea,
      summary,
      adopted: true,
      popularityImpact: 1.8,
      momentumImpact: 1.5,
    };

    const nextParties = gameState.parties.map((p) =>
      p.id === playerParty.id
        ? {
            ...p,
            campaignMomentum: Number(Math.min(15, p.campaignMomentum + newProp.momentumImpact).toFixed(2)),
            currentPollShare: Number(Math.min(60, p.currentPollShare + 0.4).toFixed(2)),
          }
        : p
    );

    setCustomPropTitle('');
    setCustomPropSummary('');
    setFeedback(`Presentaste públicamente tu propuesta «${title}» en el eje ${customPropArea}.`);

    onUpdateState({
      ...gameState,
      programProposals: [newProp, ...gameState.programProposals],
      parties: nextParties,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        attributes: {
          ...gameState.player.attributes,
          popularity: Number(Math.min(98, gameState.player.attributes.popularity + 1.8).toFixed(1)),
        },
      },
      history: [
        {
          id: `prop_c_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: `Propuesta propia: ${title}`,
          detail: `${customPropArea}: ${summary}`,
        },
        ...gameState.history,
      ],
    });
  };

  const handleRunInternas = () => {
    if (!canRunInternasByDate) {
      setFeedback(`Las Elecciones Internas se celebran en Junio de ${cycleY}.`);
      return;
    }
    const internalResult = runInternalElections(gameState, difficulty);
    if (internalResult.playerWonPrimary) {
      recordAchievementAndMeta(gameState, ['primera_interna']);
    }
    const lostPresidentialPrimary =
      !internalResult.playerWonPrimary &&
      (gameState.player.targetOffice === 'presidente' || gameState.player.targetOffice === 'vicepresidente');
    if (lostPresidentialPrimary) {
      setFeedback('No ganaste la candidatura presidencial en la interna. Elegí tu postulación para Octubre (Senado, Diputados o Departamental) abajo.');
    }

    onUpdateState({
      ...gameState,
      electoralStage: 'internas_completadas',
      internalResult,
      history: [
        {
          id: `int_${Date.now()}`,
          dateLabel: internalResult.dateLabel,
          category: 'eleccion',
          title: 'Elecciones Internas celebradas',
          detail: internalResult.explanation[2] ?? 'Definición de candidaturas únicas.',
        },
        ...gameState.history,
      ],
    });
  };

  const handleRunOctubre = () => {
    if (!canRunOctubreByDate) {
      setFeedback(`Las Elecciones Nacionales se celebran en Octubre de ${cycleY}.`);
      return;
    }
    const nationalResult = runNationalElections(gameState, difficulty);
    const pStats = nationalResult.partyTotals.find((p) => p.partyId === playerParty.id)!;
    const ach: string[] = [];
    if (
      (gameState.player.targetOffice === 'senador' && pStats.senateSeats > 0) ||
      (gameState.player.targetOffice === 'diputado' && pStats.deputySeats > 0)
    ) {
      ach.push('banca_parlamentaria');
      if (playerParty.isCustom) ach.push('partido_nuevo_banca');
    }
    if (
      !nationalResult.requiresRunoff &&
      nationalResult.directWinnerPartyId === playerParty.id &&
      gameState.internalResult?.playerWonPrimary
    ) {
      ach.push('primera_vuelta_historica');
    }
    if (ach.length > 0) recordAchievementAndMeta(gameState, ach);

    onUpdateState({
      ...gameState,
      electoralStage: nationalResult.requiresRunoff ? 'nacionales_completadas' : 'balotaje_completado',
      nationalResult,
      history: [
        {
          id: `oct_${Date.now()}`,
          dateLabel: nationalResult.dateLabel,
          category: 'eleccion',
          title: 'Elecciones Nacionales y Plebiscitos',
          detail: nationalResult.explanation[0],
        },
        ...gameState.history,
      ],
    });
  };

  const handleRunBalotaje = () => {
    if (!canRunBalotajeByDate) {
      setFeedback(`El Balotaje Presidencial se disputa en Noviembre de ${cycleY}.`);
      return;
    }
    const runoffResult = runRunoffElection(gameState, difficulty);
    if (
      runoffResult.winnerPartyId === playerParty.id &&
      (gameState.player.targetOffice === 'presidente' || gameState.player.targetOffice === 'vicepresidente') &&
      gameState.internalResult?.playerWonPrimary
    ) {
      recordAchievementAndMeta(gameState, ['rey_del_balotaje']);
    }
    onUpdateState({
      ...gameState,
      electoralStage: 'balotaje_completado',
      runoffResult,
      history: [
        {
          id: `bal_${Date.now()}`,
          dateLabel: runoffResult.dateLabel,
          category: 'eleccion',
          title: 'Balotaje Presidencial',
          detail: runoffResult.explanation[2],
        },
        ...gameState.history,
      ],
    });
  };

  const handleRunDepartamentales = () => {
    if (!canRunDepartamentalesByDate) {
      setFeedback(`Las Elecciones Departamentales se celebran en Mayo de ${cycleY + 1}.`);
      return;
    }
    const departamentalResult = runDepartamentalElections(gameState, difficulty);

    const ach: string[] = [];
    let govDept: DepartmentId | undefined;
    if (gameState.player.targetOffice === 'intendente' && departamentalResult.playerWonDepartamentalOffice) {
      ach.push('jefe_comunal');
      govDept = gameState.player.targetDepartment;
    }
    recordAchievementAndMeta(gameState, ach, govDept, departamentalResult.playerDepartamentalOutcomeLabel);

    const nextState = enterGovernmentPhase({
      ...gameState,
      electoralStage: 'departamentales_completadas',
      departamentalResult,
    });
    onUpdateState(nextState);
  };

  const isTargetNational =
    gameState.player.targetOffice === 'presidente' ||
    gameState.player.targetOffice === 'vicepresidente' ||
    gameState.player.targetOffice === 'senador' ||
    gameState.player.targetOffice === 'diputado' ||
    gameState.player.targetOffice === 'dirigente_partidario';

  const canSelectCandidacyNow =
    gameState.careerPhase === 'campana' &&
    (gameState.electoralStage === 'pre_internas' ||
      gameState.electoralStage === 'internas_completadas' ||
      gameState.electoralStage === 'balotaje_completado');

  return (
    <div className="space-y-5 animate-editorial-in">
      {/* Cabecera visual de Campaña */}
      <section className="warroom-surface overflow-hidden rounded-xl">
        <div className="relative h-32 w-full bg-[#0A0F10] sm:h-40">
          {!bannerError && (
            <img
              src={VISUAL_ASSETS.campaignRally}
              alt="Acto político en Uruguay"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="h-full w-full object-cover opacity-50"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F10]/95 via-[#171C1D]/75 to-transparent" />
          <div className="absolute inset-0 flex flex-wrap items-end justify-between gap-3 p-5 text-[#DFE3E4]">
            <div>
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFB691]">
                Calendario Constitucional · Ciclo #{gameState.cycleNumber}
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#DFE3E4]">
                Comando de Campaña Electoral
              </h2>
            </div>
            <div className="flex flex-wrap gap-4 font-mono-data text-xs">
              <span className="flex items-center gap-1.5 rounded border border-[#574239]/50 bg-[#0A0F10]/85 px-2.5 py-1 text-[#ACCEBF]">
                <Coins className="h-4 w-4 text-[#E87532]" />$ {gameState.player.campaignFundsUYU.toLocaleString('es-UY')}
              </span>
              <span className="flex items-center gap-1.5 rounded border border-[#574239]/50 bg-[#0A0F10]/85 px-2.5 py-1 text-[#FFB691]">
                <Zap className="h-4 w-4 text-[#E87532]" />
                {gameState.player.politicalCapital} CP
              </span>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-[#CDC6B8]">
              Situación actual: <strong className="text-[#DFE3E4]">{caps.roleSummaryLabel}</strong> · Postulación:{' '}
              <strong className="text-[#FFB691]">{caps.targetOfficeTitle}</strong>
            </span>
            <span className="font-mono-data font-semibold text-[#ACCEBF]">
              {caps.canCampaign
                ? `${2 - gameState.monthsExecutedInTurn} acciones mayores disponibles este mes`
                : 'Campaña pausada en esta etapa'}
            </span>
          </div>

          {!caps.isIncumbentPresident && caps.isCampaigning && (
            <details className="mt-3 rounded-lg border border-[#E87532]/45 bg-[#E87532]/10 p-3 text-xs text-[#E9E2D4]">
              <summary className="flex cursor-pointer items-center gap-2 font-bold text-[#FFB691]">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                Modo campaña: actos y alianzas activos · poder estatal bloqueado hasta asumir
              </summary>
              <p className="mt-1.5 text-[11px] text-[#CDC6B8]">
                Podés hacer actos, debatir, presentar propuestas, negociar alianzas y recorrer departamentos. No ejercés cargos públicos hasta ganar la elección correspondiente.
              </p>
            </details>
          )}

          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#574239]/35 pt-3">
            {(
              [
                { id: 'todo', label: 'Vista Integral' },
                { id: 'comando', label: 'Actos y Boleta' },
                { id: 'calendario', label: 'Calendario Electoral' },
                { id: 'programa', label: 'Programa de Gobierno' },
                { id: 'resultados', label: 'Escrutinios' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSectionFilter(tab.id)}
                className={`min-h-[34px] rounded-full px-3 py-1 font-mono-data text-[11px] font-bold transition ${
                  sectionFilter === tab.id
                    ? 'bg-[#E87532] text-[#511E00]'
                    : 'border border-[#574239]/50 bg-[#1B2021] text-[#DEC1B4] hover:border-[#E87532]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {feedback && (
            <div className="mt-3 rounded-lg border border-[#ACCEBF]/50 bg-[#557568]/20 p-3 text-xs font-medium text-[#ACCEBF]">
              {feedback}
            </div>
          )}

          {(sectionFilter === 'todo' || sectionFilter === 'comando') && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CAMPAIGN_ACTIONS.map((act) => (
              <button
                key={act.id}
                disabled={!caps.canCampaign || gameState.monthsExecutedInTurn >= 2}
                onClick={() => executeCampaignAction(act)}
                className="warroom-card flex flex-col justify-between rounded-xl p-3.5 text-left transition hover:border-[#E87532]/70 disabled:cursor-not-allowed disabled:opacity-45"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#DFE3E4]">{act.label}</span>
                    <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">
                      ${(act.moneyCostUYU / 1000).toFixed(0)}k
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#CDC6B8]">{act.description}</p>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 font-mono-data text-[11px] text-[#DEC1B4]">
                  <span>-{act.politicalCapitalCost} CP</span>
                  <span>Riesgo: {act.riskPct}%</span>
                  <span className="font-bold text-[#ACCEBF]">+{act.popularityDelta} pop.</span>
                </div>
              </button>
            ))}
            </div>
          )}
        </div>
      </section>

      {/* Selector de Postulación para la Elección en Curso */}
      {canSelectCandidacyNow && (sectionFilter === 'todo' || sectionFilter === 'comando') && (
        <section className="warroom-surface rounded-xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#574239]/35 pb-3">
            <div>
              <div className="flex items-center gap-2 font-mono-data text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFB691]">
                <UserCheck className="h-4 w-4 text-[#E87532]" />
                Boleta y Candidatura Activa
              </div>
              <h3 className="mt-1 font-display text-lg font-bold text-[#DFE3E4]">
                Elegí a qué cargo postularte en esta instancia electoral
              </h3>
              <p className="mt-0.5 text-xs text-[#CDC6B8]">
                {gameState.electoralStage === 'pre_internas' &&
                  'Antes de las Internas de junio podés definir o ajustar tu aspiración principal para el ciclo.'}
                {gameState.electoralStage === 'internas_completadas' &&
                  (gameState.internalResult?.playerWonPrimary
                    ? 'Ganaste la interna partidaria: mantenés tu candidatura presidencial o podés optar por banca parlamentaria / departamental.'
                    : 'No ganaste la candidatura presidencial en la interna. Elegí competir por Senado, Diputados, Dirigente o esperar a Departamentales.')}
                {gameState.electoralStage === 'balotaje_completado' &&
                  'Rumbo a las Elecciones Departamentales de mayo: podés postularte a Intendente, Edil Departamental o Alcalde en el territorio elegido.'}
              </p>
            </div>
            <span className="rounded border border-[#E87532]/50 bg-[#E87532]/15 px-2.5 py-1 font-mono-data text-[11px] font-bold text-[#FFB691]">
              Actual: {caps.targetOfficeTitle}
            </span>
          </div>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {OFFICES.map((office) => {
              const eligibility = getCandidacyEligibility(gameState, office.id);
              const disabled = !eligibility.allowed;
              const reason = eligibility.reason;
              const selected = gameState.player.targetOffice === office.id;
              return (
                <button
                  key={office.id}
                  disabled={disabled}
                  onClick={() => handleSelectCandidacy(office.id)}
                  title={reason}
                  className={`flex flex-col justify-between rounded-xl border p-3 text-left transition ${
                    selected
                      ? 'border-[#E87532] bg-[#E87532]/20'
                      : disabled
                      ? 'border-[#574239]/25 bg-[#0A0F10]/60 opacity-55'
                      : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#E87532]/65'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-bold text-[#DFE3E4]">{office.name}</span>
                      {selected ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#FFB691]" />
                      ) : disabled ? (
                        <Lock className="h-3.5 w-3.5 shrink-0 text-[#FFB4AB]" />
                      ) : null}
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-[#CDC6B8]">{office.description}</p>
                    {disabled && reason && (
                      <p className="mt-1.5 rounded bg-[#93000A]/30 px-1.5 py-1 text-[10px] leading-tight text-[#FFB4AB]">
                        {reason}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 font-mono-data text-[9px] uppercase tracking-wider text-[#ACCEBF]">
                    {office.scopeSummary}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
                Departamento de postulación / base territorial
              </label>
              <select
                value={gameState.player.targetDepartment}
                onChange={(e) =>
                  handleSelectCandidacy(gameState.player.targetOffice, e.target.value as DepartmentId)
                }
                className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
              >
                {gameState.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.baselineDeputies} dip.)
                  </option>
                ))}
              </select>
            </div>

            {gameState.player.targetOffice === 'alcalde' && (
              <div>
                <label className="block font-mono-data text-[10px] uppercase tracking-wider text-[#DEC1B4]">
                  Municipio objetivo (Alcaldía)
                </label>
                <select
                  value={gameState.player.targetMunicipality ?? selectedDeptObj.sampleMunicipalities[0]}
                  onChange={(e) =>
                    handleSelectCandidacy('alcalde', gameState.player.targetDepartment, e.target.value)
                  }
                  className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                >
                  {selectedDeptObj.sampleMunicipalities.map((m) => (
                    <option key={m} value={m}>
                      Municipio de {m}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Calendario Electoral Constitucional */}
      {(sectionFilter === 'todo' || sectionFilter === 'calendario') && (
        <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-[#DFE3E4]">Calendario Electoral Constitucional</h3>
            <p className="mt-0.5 text-xs text-[#CDC6B8]">
              Cada instancia electoral se desbloquea únicamente al llegar a su mes constitucional. Avanzá mes a mes mientras construís campaña.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono-data text-xs font-bold text-[#FFB691]">
            <CalendarClock className="h-4 w-4" />
            Hoy: {MONTH_NAMES[gameState.currentMonth - 1]} {gameState.currentYear}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Internas Junio */}
          <div className="warroom-card rounded-xl p-3.5">
            <div className="font-mono-data text-[11px] font-bold text-[#FFB691]">1. JUNIO {cycleY}</div>
            <div className="mt-0.5 text-sm font-bold text-[#DFE3E4]">Internas Partidarias</div>
            <p className="mt-1 text-[11px] text-[#CDC6B8]">Define fórmula única del lema y convenciones.</p>
            {gameState.electoralStage === 'pre_internas' ? (
              canRunInternasByDate ? (
                <button
                  onClick={handleRunInternas}
                  className="executive-action-btn mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                >
                  <Play className="h-3.5 w-3.5" /> Celebrar Internas
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#0A0F10] p-2 text-[11px] text-[#DEC1B4]">
                  Bloqueado hasta Junio {cycleY} (faltan {monthsToInternas}{' '}
                  {monthsToInternas === 1 ? 'mes' : 'meses'}).
                </div>
              )
            ) : (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ACCEBF]">
                <CheckCircle2 className="h-4 w-4" /> Realizadas
              </div>
            )}
          </div>

          {/* 2. Octubre */}
          <div className="warroom-card rounded-xl p-3.5">
            <div className="font-mono-data text-[11px] font-bold text-[#FFB691]">2. OCTUBRE {cycleY}</div>
            <div className="mt-0.5 text-sm font-bold text-[#DFE3E4]">Primera Vuelta + Parlamento</div>
            <p className="mt-1 text-[11px] text-[#CDC6B8]">30 Senadores, 99 Diputados y Plebiscitos.</p>
            {gameState.electoralStage === 'internas_completadas' ? (
              canRunOctubreByDate ? (
                <button
                  onClick={handleRunOctubre}
                  className="executive-action-btn mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                >
                  <Play className="h-3.5 w-3.5" /> Celebrar Octubre
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#0A0F10] p-2 text-[11px] text-[#DEC1B4]">
                  Bloqueado hasta Octubre {cycleY} (faltan {monthsToOctubre}{' '}
                  {monthsToOctubre === 1 ? 'mes' : 'meses'}).
                </div>
              )
            ) : gameState.nationalResult ? (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ACCEBF]">
                <CheckCircle2 className="h-4 w-4" /> Realizadas
              </div>
            ) : (
              <div className="mt-3 text-xs text-[#8B9491]">Requiere Internas previas</div>
            )}
          </div>

          {/* 3. Noviembre */}
          <div className="warroom-card rounded-xl p-3.5">
            <div className="font-mono-data text-[11px] font-bold text-[#FFB691]">3. NOVIEMBRE {cycleY}</div>
            <div className="mt-0.5 text-sm font-bold text-[#DFE3E4]">Balotaje Presidencial</div>
            <p className="mt-1 text-[11px] text-[#CDC6B8]">Segunda vuelta si ninguna fórmula supera 50%.</p>
            {gameState.electoralStage === 'nacionales_completadas' && gameState.nationalResult?.requiresRunoff ? (
              canRunBalotajeByDate ? (
                <button
                  onClick={handleRunBalotaje}
                  className="executive-action-btn mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold"
                >
                  <Play className="h-3.5 w-3.5" /> Disputar Balotaje
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#0A0F10] p-2 text-[11px] text-[#DEC1B4]">
                  Bloqueado hasta Noviembre {cycleY} (falta {monthsToBalotaje}{' '}
                  {monthsToBalotaje === 1 ? 'mes' : 'meses'}).
                </div>
              )
            ) : gameState.runoffResult ? (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ACCEBF]">
                <CheckCircle2 className="h-4 w-4" /> Realizado
              </div>
            ) : gameState.nationalResult && !gameState.nationalResult.requiresRunoff ? (
              <div className="mt-3 text-xs font-bold text-[#ACCEBF]">Ganador en 1.ª vuelta</div>
            ) : (
              <div className="mt-3 text-xs text-[#8B9491]">Pendiente de octubre</div>
            )}
          </div>

          {/* 4. Marzo Nacional + Mayo Departamentales */}
          <div className="warroom-card rounded-xl p-3.5">
            <div className="font-mono-data text-[11px] font-bold text-[#FFB691]">4. MARZO / MAYO {cycleY + 1}</div>
            <div className="mt-0.5 text-sm font-bold text-[#DFE3E4]">Asunción y Departamentales</div>
            <p className="mt-1 text-[11px] text-[#CDC6B8]">
              {isTargetNational
                ? `Los cargos nacionales asumen el 1.º de marzo de ${cycleY + 1}. En mayo votan los 19 deptos.`
                : `En marzo asume el gobierno nacional y en mayo de ${cycleY + 1} se eligen Intendencias, Juntas y Alcaldías.`}
            </p>
            {gameState.electoralStage === 'balotaje_completado' ? (
              canRunDepartamentalesByDate ? (
                <button
                  onClick={handleRunDepartamentales}
                  className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#ACCEBF]/45 bg-[#557568] px-3 py-2 text-xs font-bold text-white hover:bg-[#3D584D]"
                >
                  <Landmark className="h-3.5 w-3.5" /> Celebrar Departamentales
                </button>
              ) : (
                <div className="mt-3 rounded-lg border border-[#574239]/40 bg-[#0A0F10] p-2 text-[11px] text-[#DEC1B4]">
                  {!gameState.nationalInauguratedInCycle && isTargetNational
                    ? `Avanzá a Marzo ${cycleY + 1} para asumir tu cargo nacional; Departamentales en Mayo ${cycleY + 1} (${monthsToDepartamentales}m).`
                    : `Departamentales en Mayo ${cycleY + 1} (faltan ${monthsToDepartamentales} meses).`}
                </div>
              )
            ) : gameState.departamentalResult ? (
              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ACCEBF]">
                <CheckCircle2 className="h-4 w-4" /> Ciclo electoral cerrado
              </div>
            ) : (
              <div className="mt-3 text-xs text-[#8B9491]">Requiere elección nacional</div>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Programa de Gobierno y Propuestas */}
      {(sectionFilter === 'todo' || sectionFilter === 'programa') && (
        <section className="warroom-surface rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
              <BookOpenCheck className="h-4 w-4 text-[#E87532]" />
              Programa de Gobierno y Propuestas Públicas
            </h3>
            <p className="mt-0.5 text-xs text-[#CDC6B8]">
              Como candidato o dirigente podés presentar propuestas y construir tu programa de gobierno sin ejercer facultades estatales aún.
            </p>
          </div>
          <span className="font-mono-data text-xs font-bold text-[#ACCEBF]">
            Adoptadas: {gameState.programProposals.filter((p) => p.adopted).length}/{gameState.programProposals.length}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gameState.programProposals.map((prop) => (
            <div
              key={prop.id}
              className={`flex flex-col justify-between rounded-xl border p-3.5 ${
                prop.adopted
                  ? 'border-[#ACCEBF]/50 bg-[#557568]/20'
                  : 'border-[#574239]/40 bg-[#1B2021]'
              }`}
            >
              <div>
                <div className="font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">{prop.area}</div>
                <div className="mt-0.5 text-sm font-bold text-[#DFE3E4]">{prop.title}</div>
                <p className="mt-1 text-[11px] text-[#CDC6B8]">{prop.summary}</p>
              </div>
              {prop.adopted ? (
                <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#ACCEBF]">
                  <CheckCircle2 className="h-4 w-4" /> En tu programa oficial
                </div>
              ) : (
                <button
                  onClick={() => handleAdoptProposal(prop)}
                  className="mt-3 min-h-[36px] w-full rounded-lg border border-[#574239]/60 bg-[#262B2C] px-3 py-1.5 text-xs font-bold text-[#DFE3E4] hover:border-[#E87532] hover:text-[#FFB691]"
                >
                  Presentar propuesta (-2 CP)
                </button>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleAddCustomProposal} className="mt-4 rounded-xl border border-[#574239]/45 bg-[#1B2021] p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#DFE3E4]">
            <Plus className="h-4 w-4 text-[#E87532]" />
            Redactar propuesta programática propia (-3 CP)
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={customPropTitle}
              onChange={(e) => setCustomPropTitle(e.target.value)}
              placeholder="Título de la propuesta"
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/40 focus:border-[#E87532] focus:outline-none"
            />
            <select
              value={customPropArea}
              onChange={(e) => setCustomPropArea(e.target.value)}
              className="rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
            >
              <option value="Economía y Producción">Economía y Producción</option>
              <option value="Seguridad y Justicia">Seguridad y Justicia</option>
              <option value="Educación e Innovación">Educación e Innovación</option>
              <option value="Salud y Protección Social">Salud y Protección Social</option>
              <option value="Interior y Descentralización">Interior y Descentralización</option>
            </select>
            <div className="flex gap-2">
              <input
                value={customPropSummary}
                onChange={(e) => setCustomPropSummary(e.target.value)}
                placeholder="Resumen breve de la medida"
                className="flex-1 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/40 focus:border-[#E87532] focus:outline-none"
              />
              <button
                type="submit"
                className="executive-action-btn min-h-[38px] shrink-0 rounded-lg px-3.5 text-xs font-bold"
              >
                Lanzar
              </button>
            </div>
          </div>
        </form>
      </section>
      )}

      {/* Resultados detallados si ya se celebraron */}
      {(sectionFilter === 'todo' || sectionFilter === 'resultados') && gameState.internalResult && (
        <section className="warroom-surface rounded-xl p-5">
          <h3 className="font-display text-base font-bold text-[#DFE3E4]">
            Resultado de Elecciones Internas ({gameState.internalResult.dateLabel})
          </h3>
          <p className="mt-1 text-xs text-[#CDC6B8]">{gameState.internalResult.explanation.join(' ')}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gameState.internalResult.partyResults.slice(0, 6).map((pr) => (
              <div key={pr.partyId} className="warroom-card rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between font-bold text-[#DFE3E4]">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: pr.partyColor }} />
                    {pr.partyName}
                  </span>
                  <span className="font-mono-data text-[#DEC1B4]">{pr.totalVotes.toLocaleString('es-UY')}</span>
                </div>
                <div className="mt-1 font-semibold text-[#FFB691]">Candidato único: {pr.winnerCandidate}</div>
                <div className="mt-1 text-[11px] text-[#CDC6B8]">
                  Unidad interna: {pr.unityScore}% {pr.decidedByConvention ? '· Definido en Convención' : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(sectionFilter === 'todo' || sectionFilter === 'resultados') && gameState.nationalResult && (
        <section className="warroom-surface rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-base font-bold text-[#DFE3E4]">
              Resultado Nacional ({gameState.nationalResult.dateLabel})
            </h3>
            <span className="text-xs font-bold text-[#FFB691]">
              {gameState.nationalResult.playerElectedOffice}
            </span>
          </div>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#574239]/45 text-[#DEC1B4]">
                  <th className="py-2 pr-3">Lema</th>
                  <th className="py-2 pr-3 text-right">Votos</th>
                  <th className="py-2 pr-3 text-right">% Emitidos</th>
                  <th className="py-2 pr-3 text-right">% Válidos</th>
                  <th className="py-2 pr-3 text-right">Senado</th>
                  <th className="py-2 text-right">Diputados</th>
                </tr>
              </thead>
              <tbody>
                {gameState.nationalResult.partyTotals.map((row) => (
                  <tr key={row.partyId} className="border-b border-[#574239]/25">
                    <td className="py-2 pr-3 font-semibold text-[#DFE3E4]">
                      <span className="mr-2 inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.color }} />
                      {row.partyName}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono-data text-[#CDC6B8]">
                      {row.votes.toLocaleString('es-UY')}
                    </td>
                    <td className="py-2 pr-3 text-right font-mono-data text-[#DFE3E4]">{row.pctOfEmitted}%</td>
                    <td className="py-2 pr-3 text-right font-mono-data font-semibold text-[#FFB691]">{row.pctOfValid}%</td>
                    <td className="py-2 pr-3 text-right font-mono-data font-bold text-[#DFE3E4]">{row.senateSeats}</td>
                    <td className="py-2 text-right font-mono-data font-bold text-[#DFE3E4]">{row.deputySeats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {gameState.nationalResult.plebiscites.map((pl) => (
              <div key={pl.id} className="warroom-card rounded-xl p-3 text-xs">
                <div className="font-bold text-[#DFE3E4]">{pl.title}</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="font-mono-data text-[#CDC6B8]">{pl.yesPctOfEmitted}% s/emitidos</span>
                  <span className={pl.approved ? 'font-bold text-[#ACCEBF]' : 'font-semibold text-[#8B9491]'}>
                    {pl.approved ? 'APROBADO (>50%)' : 'NO ALCANZÓ 50%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(sectionFilter === 'todo' || sectionFilter === 'resultados') && gameState.runoffResult && (
        <section className="warroom-surface rounded-xl p-5">
          <h3 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
            <ShieldCheck className="h-4 w-4 text-[#E87532]" />
            Balotaje Presidencial ({gameState.runoffResult.dateLabel})
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[gameState.runoffResult.candidateA, gameState.runoffResult.candidateB].map((cand) => {
              const won = gameState.runoffResult!.winnerPartyId === cand.partyId;
              return (
                <div
                  key={cand.partyId}
                  className={`rounded-xl border p-4 ${
                    won ? 'border-[#ACCEBF]/55 bg-[#557568]/20' : 'border-[#574239]/40 bg-[#1B2021]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#DFE3E4]">{cand.partyName}</span>
                    <span className="font-mono-data text-lg font-extrabold text-[#DFE3E4]">{cand.pctOfValid}%</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-[#ACCEBF]">{cand.formula}</div>
                  <div className="mt-1 font-mono-data text-[11px] text-[#CDC6B8]">
                    {cand.votes.toLocaleString('es-UY')} votos ({cand.pctOfEmitted}% emitidos) · {won ? 'FÓRMULA ELECTA' : 'Segundo lugar'}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
