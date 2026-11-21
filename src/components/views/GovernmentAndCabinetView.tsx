import React, { useEffect, useState } from 'react';
import {
  Briefcase,
  Building,
  Building2,
  CheckCircle2,
  Factory,
  Handshake,
  Lock,
  Megaphone,
  RefreshCw,
  ScrollText,
  Shield,
  SlidersHorizontal,
  Sparkles,
  UserMinus,
  Users,
} from 'lucide-react';
import { MONTH_NAMES } from '../../data/uruguayData';
import { VISUAL_ASSETS } from '../../data/visualAssets';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import { rebalanceDepartamentalBudget } from '../../engine/economyEngine';
import {
  adjustEnterpriseInvestment,
  adjustEnterpriseTariff,
  emitGovernmentAnnouncement,
  issueArticle197Observation,
  negotiateWithSocialActor,
  nominateEnterpriseDirector,
} from '../../engine/publicEnterprisesAndActorsEngine';
import { startDepartmentWorkOrder } from '../../engine/territorialEngine';
import {
  DepartamentalBudgetCategory,
  DepartamentalDirectorCandidate,
  GameState,
  GovernmentAnnouncement,
  MinisterCandidate,
  PublicEnterpriseId,
  SocialActorId,
} from '../../types/game';
import { MinisterAvatar } from '../MinisterAvatar';
import { UnifiedPoliciesView } from './UnifiedPoliciesView';

export type GovSectionId = 'conduccion' | 'politicas' | 'gabinete' | 'territorial';

interface GovCabinetViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
  sectionMode?: 'gobierno' | 'gabinete' | 'all';
  activeSection?: GovSectionId;
  onSelectSection?: (sec: GovSectionId) => void;
}

export const GovernmentAndCabinetView: React.FC<GovCabinetViewProps> = ({
  gameState,
  onUpdateState,
  sectionMode = 'all',
  activeSection,
  onSelectSection,
}) => {
  const caps = getPlayerCapabilities(gameState);
  const isLocalRole =
    caps.currentOffice === 'intendente' ||
    caps.currentOffice === 'alcalde' ||
    caps.currentOffice === 'edil' ||
    caps.targetOffice === 'intendente' ||
    caps.targetOffice === 'alcalde' ||
    caps.targetOffice === 'edil';
  const [internalSection, setInternalSection] = useState<GovSectionId>(
    sectionMode === 'gabinete' ? 'gabinete' : isLocalRole ? 'territorial' : 'conduccion'
  );
  const currentSection: GovSectionId = activeSection ?? internalSection;
  const selectSection = (sec: GovSectionId) => {
    if (onSelectSection) onSelectSection(sec);
    else setInternalSection(sec);
  };

  useEffect(() => {
    if (activeSection) setInternalSection(activeSection);
  }, [activeSection]);

  const [replacingMinistryId, setReplacingMinistryId] = useState<string | null>(null);
  const [candidatePartyFilter, setCandidatePartyFilter] = useState<string>('all');
  const [replacingDirId, setReplacingDirId] = useState<string | null>(null);
  const [govMessage, setGovMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState(false);

  // Estado Etapa 5: Anuncios oficiales y nominaciones Art. 187
  const [annKind, setAnnKind] = useState<GovernmentAnnouncement['kind']>('conferencia');
  const [annTitle, setAnnTitle] = useState('');
  const [annSummary, setAnnSummary] = useState('');
  const [veniaEntId, setVeniaEntId] = useState<PublicEnterpriseId | null>(null);
  const [veniaNominee, setVeniaNominee] = useState('');

  const targetDept = gameState.departments.find((d) => d.id === gameState.player.targetDepartment)!;

  const handleAppointMinister = (ministryId: string, candidate: MinisterCandidate) => {
    if (!caps.canAppointNationalMinisters) {
      setGovMessage(caps.lockReasons.executiveNational);
      return;
    }
    const targetMin = gameState.cabinet.find((m) => m.id === ministryId);
    if (!targetMin) return;
    if (gameState.player.politicalCapital < 4) {
      setGovMessage('Capital político insuficiente para reestructurar el gabinete (4 requeridos).');
      return;
    }

    const nextCabinet = gameState.cabinet.map((m) =>
      m.id === ministryId
        ? {
            ...m,
            holderName: candidate.name,
            partyId: candidate.partyId,
            sectorName: candidate.sectorName,
            management: candidate.management,
            popularity: candidate.popularity,
            experience: candidate.experience,
            affinity: candidate.affinity,
            loyalty: candidate.loyalty,
            age: candidate.age,
            ideology: candidate.ideology,
            trajectory: candidate.trajectory,
            strengths: candidate.strengths,
            weaknesses: candidate.weaknesses,
            avatarSeed: candidate.avatarSeed ?? candidate.name,
            isVacant: false,
          }
        : m
    );

    const stats = gameState.progression.careerStats ?? {
      lawsPassed: gameState.player.legislativeWins,
      policiesEnacted: gameState.activePolicies?.length ?? 0,
      electionsWon: 0,
      electionsLost: 0,
      coalitionsFormed: gameState.electoralAlliances?.length ?? 0,
      partiesMerged: gameState.partyMergers?.length ?? 0,
      ministersAppointed: 0,
      controlsExecuted: gameState.opposition.parliamentaryControlsExecuted,
    };

    const msg = `Designaste a ${candidate.name} (${candidate.sectorName}) al frente de ${targetMin.ministryName}.`;
    setGovMessage(msg);
    setReplacingMinistryId(null);

    onUpdateState({
      ...gameState,
      cabinet: nextCabinet,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
      },
      progression: {
        ...gameState.progression,
        careerStats: {
          ...stats,
          ministersAppointed: stats.ministersAppointed + 1,
        },
      },
      history: [
        {
          id: `cab_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Designación en ${targetMin.ministryCode}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleDismissMinister = (ministryId: string) => {
    if (!caps.canAppointNationalMinisters) {
      setGovMessage(caps.lockReasons.executiveNational);
      return;
    }
    const targetMin = gameState.cabinet.find((m) => m.id === ministryId);
    if (!targetMin || targetMin.isVacant) return;
    if (gameState.player.politicalCapital < 2) {
      setGovMessage('Necesitás 2 CP para cesar formalmente a un ministro.');
      return;
    }

    const prevHolder = targetMin.holderName;
    const nextCabinet = gameState.cabinet.map((m) =>
      m.id === ministryId
        ? {
            ...m,
            holderName: 'Cartera Vacante',
            partyId: 'ind',
            sectorName: 'Sin titular designado',
            management: 38,
            loyalty: 40,
            isVacant: true,
            trajectory: 'Ministerio acéfalo hasta nueva designación.',
            strengths: [],
            weaknesses: ['Acefalía ejecutiva reduce tracción de gestión y políticas del área'],
          }
        : m
    );

    const msg = `Cesaste a ${prevHolder}. ${targetMin.ministryCode} queda vacante (penaliza gestión y ejecución hasta designar reemplazo).`;
    setGovMessage(msg);

    onUpdateState({
      ...gameState,
      cabinet: nextCabinet,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        coalitionStability: Math.max(20, gameState.politicalIndicators.coalitionStability - 2),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 2,
      },
      history: [
        {
          id: `cab_vac_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Cese ministerial en ${targetMin.ministryCode}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleCabinetCouncilSession = () => {
    if (!caps.canDirectCabinetCouncil) {
      setGovMessage(caps.lockReasons.executiveNational);
      return;
    }
    if (gameState.player.politicalCapital < 5) {
      setGovMessage('Capital político insuficiente para convocar Consejo de Ministros (5 requeridos).');
      return;
    }

    const nextBudget = gameState.nationalBudget.map((b) => ({
      ...b,
      executionEfficiency: Math.min(98, b.executionEfficiency + 2),
    }));
    const msg =
      'Consejo de Ministros en Torre Ejecutiva: coordinaste prioridades intersectoriales (+2% eficiencia de ejecución y +3 estabilidad).';
    setGovMessage(msg);

    onUpdateState({
      ...gameState,
      nationalBudget: nextBudget,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        coalitionStability: Math.min(98, gameState.politicalIndicators.coalitionStability + 3),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 5,
      },
      history: [
        {
          id: `cm_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: 'Consejo de Ministros',
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleAppointDeptDirector = (dirId: string, candidate: DepartamentalDirectorCandidate) => {
    if (!caps.canAppointDepartamentalTeam) {
      setGovMessage(caps.lockReasons.departamentalExecutive);
      return;
    }
    if (gameState.player.politicalCapital < 3) {
      setGovMessage('Necesitás 3 de capital político para designar directores departamentales.');
      return;
    }
    const targetDir = gameState.departamentalTeam.find((d) => d.id === dirId);
    if (!targetDir) return;

    const nextTeam = gameState.departamentalTeam.map((d) =>
      d.id === dirId
        ? {
            ...d,
            holderName: candidate.name,
            sectorName: candidate.sectorName,
            management: candidate.management,
            popularity: candidate.popularity,
            loyalty: candidate.loyalty,
          }
        : d
    );
    const msg = `Designaste a ${candidate.name} en la Dirección de ${targetDir.areaName} de ${targetDept.name}.`;
    setGovMessage(msg);
    setReplacingDirId(null);

    onUpdateState({
      ...gameState,
      departamentalTeam: nextTeam,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
      },
      history: [
        {
          id: `depdir_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Equipo de Intendencia (${targetDir.areaCode})`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleUpdateDeptBudget = (cat: DepartamentalBudgetCategory, nextVal: number) => {
    if (!caps.canAdministerDepartamentalBudget) {
      setGovMessage(caps.lockReasons.departamentalExecutive);
      return;
    }
    const updated = rebalanceDepartamentalBudget(
      gameState.departamentalBudget,
      cat,
      nextVal,
      targetDept.annualBudgetMillionsUYU
    );
    onUpdateState({
      ...gameState,
      departamentalBudget: updated,
    });
  };

  const handleDepartamentalPublicWork = () => {
    if (!caps.canExecuteDepartamentalWorks) {
      setGovMessage(caps.lockReasons.departamentalExecutive);
      return;
    }
    if (gameState.player.politicalCapital < 5) {
      setGovMessage('Capital político insuficiente para ejecutar programa de obras.');
      return;
    }
    const nextDepts = gameState.departments.map((d) =>
      d.id === targetDept.id
        ? {
            ...d,
            localServiceQuality: Math.min(98, d.localServiceQuality + 4),
            unemploymentRate: Number(Math.max(4.0, d.unemploymentRate - 0.25).toFixed(1)),
          }
        : d
    );
    const scopeText =
      caps.currentOffice === 'alcalde'
        ? `en el municipio ${gameState.player.targetMunicipality ?? targetDept.sampleMunicipalities[0]} (${targetDept.name})`
        : `en ${targetDept.name}`;
    const msg = `Plan de obras, alumbrado y limpieza ejecutado ${scopeText} (+4 calidad de servicios locales).`;
    setGovMessage(msg);
    onUpdateState({
      ...gameState,
      departments: nextDepts,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 5,
        attributes: {
          ...gameState.player.attributes,
          popularity: Math.min(98, gameState.player.attributes.popularity + 2.2),
        },
      },
      history: [
        {
          id: `depwork_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Obras y servicios ${scopeText}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const handleCoordinateMunicipalities = () => {
    if (!caps.canCoordinateMunicipalities) {
      setGovMessage(caps.lockReasons.departamentalExecutive);
      return;
    }
    if (gameState.player.politicalCapital < 4) {
      setGovMessage('Capital político insuficiente para coordinar con alcaldías (4 requeridos).');
      return;
    }
    const nextDepts = gameState.departments.map((d) =>
      d.id === targetDept.id
        ? { ...d, localServiceQuality: Math.min(98, d.localServiceQuality + 3) }
        : d
    );
    const msg = `Mesa de coordinación entre Intendencia de ${targetDept.name} y sus ${targetDept.municipalitiesCount} municipios: descentralización de partidas y caminería (+3 servicios locales).`;
    setGovMessage(msg);
    onUpdateState({
      ...gameState,
      departments: nextDepts,
      politicalIndicators: {
        ...gameState.politicalIndicators,
        partyStrength: Math.min(100, gameState.politicalIndicators.partyStrength + 2),
      },
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
      },
      history: [
        {
          id: `muncoord_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Coordinación con municipios de ${targetDept.name}`,
          detail: msg,
        },
        ...gameState.history,
      ],
    });
  };

  const showConduccion = currentSection === 'conduccion';
  const showPoliticas = currentSection === 'politicas';
  const showGabinete = currentSection === 'gabinete';
  const showTerritorial = currentSection === 'territorial';

  const activePoliciesCount = (gameState.activePolicies ?? []).filter(
    (p) => p.status !== 'derogada' && p.status !== 'finalizada'
  ).length;

  return (
    <div className="space-y-5">
      {/* Cabecera visual institucional */}
      <section className="warroom-surface overflow-hidden rounded-xl">
        <div className="relative h-28 w-full bg-[#0A0F10] sm:h-36">
          {!bannerError && (
            <img
              src={VISUAL_ASSETS.presidentialDesk}
              alt="Despacho presidencial en Torre Ejecutiva"
              referrerPolicy="no-referrer"
              onError={() => setBannerError(true)}
              className="h-full w-full object-cover opacity-55"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0A0F10]/95 via-[#171C1D]/75 to-transparent" />
          <div className="absolute inset-0 flex flex-wrap items-end justify-between gap-2 p-5 text-[#DFE3E4]">
            <div>
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-[0.14em] text-[#FFB691]">
                Torre Ejecutiva, Entes Autónomos e Intendencias
              </div>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#DFE3E4]">
                {showPoliticas
                  ? 'Gobierno · POLÍTICAS Públicas'
                  : showGabinete
                  ? 'Gabinete Ministerial y Empresas Públicas'
                  : showTerritorial
                  ? `Gobiernos Departamentales y Municipios · ${targetDept.name}`
                  : 'Conducción Ejecutiva y Plan de Gobierno'}
              </h2>
            </div>
            <span className="font-mono-data text-xs text-[#DEC1B4]">
              Ciclo #{gameState.cycleNumber} · {MONTH_NAMES[gameState.currentMonth - 1]} {gameState.currentYear}
            </span>
          </div>
        </div>

        <div className="space-y-3 p-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#CDC6B8]">
              Cargo institucional efectivo: <strong className="text-[#FFB691]">{caps.roleSummaryLabel}</strong> · Presidencia nacional:{' '}
              <strong className="text-[#DFE3E4]">{gameState.nationalPresidentName}</strong>
            </p>
          </div>

          {/* Subnavegación unificada de Gobierno */}
          <div className="flex flex-wrap gap-1.5 rounded-xl border border-[#574239]/50 bg-[#0A0F10] p-1.5">
            <button
              onClick={() => selectSection('conduccion')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                showConduccion ? 'bg-[#E87532] text-[#511E00]' : 'text-[#DEC1B4] hover:bg-[#1B2021] hover:text-white'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Conducción y Plan
            </button>
            <button
              onClick={() => selectSection('politicas')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                showPoliticas ? 'bg-[#E87532] text-[#511E00]' : 'text-[#DEC1B4] hover:bg-[#1B2021] hover:text-white'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              POLÍTICAS ({activePoliciesCount})
            </button>
            <button
              onClick={() => selectSection('gabinete')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                showGabinete ? 'bg-[#E87532] text-[#511E00]' : 'text-[#DEC1B4] hover:bg-[#1B2021] hover:text-white'
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Gabinete, Entes y Actores
            </button>
            <button
              onClick={() => selectSection('territorial')}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                showTerritorial ? 'bg-[#E87532] text-[#511E00]' : 'text-[#DEC1B4] hover:bg-[#1B2021] hover:text-white'
              }`}
            >
              <Building className="h-3.5 w-3.5" />
              Intendencias ({targetDept.name})
            </button>
          </div>

          {govMessage && (
            <div className="rounded-lg border border-[#557568]/55 bg-[#557568]/18 p-3 text-xs font-medium text-[#ACCEBF]">
              {govMessage}
            </div>
          )}
        </div>
      </section>

      {/* SECCIÓN POLÍTICAS UNIFICADA (Laboratorio OPP/MEF + Espacio Catálogo A-J) */}
      {showPoliticas && (
        <div className="space-y-4">
          <div className="warroom-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 text-xs">
            <div className="flex items-start gap-2.5">
              <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-[#E87532]" />
              <div>
                <div className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#FFB691]">
                  Centro Unificado de Políticas Públicas (OPP / MEF + Catálogo Normativo A–J)
                </div>
                <p className="mt-0.5 text-[#CDC6B8]">
                  Diseñá medidas a medida con el equipo técnico OPP/MEF y monitoreá su impacto estimado vs. observado en tiempo real. Toda política con rango de Ley se remite automáticamente al Parlamento.
                </p>
              </div>
            </div>
          </div>
          <UnifiedPoliciesView gameState={gameState} onUpdateState={onUpdateState} />
        </div>
      )}

      {/* Sección Conducción Ejecutiva */}
      {showConduccion && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <Building2 className="h-4 w-4 text-[#E87532]" />
                Conducción Ejecutiva Nacional
              </h3>
              <p className="text-xs text-[#CDC6B8]">
                {caps.canDirectCabinetCouncil
                  ? 'Convocá el Consejo de Ministros para coordinar carteras, mejorar eficiencia presupuestal y consolidar estabilidad.'
                  : 'Vista informativa de la conducción ejecutiva nacional. Requiere ejercer la Presidencia de la República.'}
              </p>
            </div>
            <button
              disabled={!caps.canDirectCabinetCouncil}
              onClick={handleCabinetCouncilSession}
              className="executive-action-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Building2 className="h-3.5 w-3.5" />
              Consejo de Ministros (-5 cap.)
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
              <div className="text-[11px] text-[#CDC6B8]">Aprobación del Ejecutivo</div>
              <div className="mt-1 font-mono-data text-lg font-bold text-[#DFE3E4]">
                {gameState.politicalIndicators.governmentApproval.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
              <div className="text-[11px] text-[#CDC6B8]">Estabilidad de coalición</div>
              <div className="mt-1 font-mono-data text-lg font-bold text-[#ACCEBF]">
                {gameState.politicalIndicators.coalitionStability.toFixed(0)} / 100
              </div>
            </div>
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
              <div className="text-[11px] text-[#CDC6B8]">Gestión promedio de gabinete</div>
              <div className="mt-1 font-mono-data text-lg font-bold text-[#FFB691]">
                {Math.round(gameState.cabinet.reduce((s, c) => s + c.management, 0) / gameState.cabinet.length)} / 100
              </div>
            </div>
          </div>

          {!caps.canAppointNationalMinisters && (
            <div className="flex items-start gap-2 rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-3 text-xs text-[#DFE3E4]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
              <div>
                <strong className="text-[#FFB691]">Atribuciones presidenciales restringidas:</strong> {caps.lockReasons.executiveNational}
              </div>
            </div>
          )}

          <div className="grid gap-3 border-t border-[#574239]/40 pt-4 md:grid-cols-2">
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#FFB691]">
                Prioridades y Promesas Verificables de Gobierno
              </div>
              <ul className="mt-2 space-y-1 text-[#DFE3E4]">
                {gameState.governmentPriorities.map((prio, idx) => (
                  <li key={idx}>• {prio}</li>
                ))}
              </ul>
              <div className="mt-3 space-y-1.5 border-t border-[#574239]/40 pt-2.5">
                {gameState.opposition.governmentPromises.map((prom) => {
                  const actual = gameState.macro[prom.metric] ?? 0;
                  const met = prom.comparator === 'lte' ? actual <= prom.targetValue : actual >= prom.targetValue;
                  return (
                    <div key={prom.id} className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="text-[#CDC6B8]">{prom.title}</span>
                      <span
                        className={`shrink-0 rounded px-1.5 py-0.5 font-mono-data text-[10px] font-bold ${
                          met ? 'bg-emerald-950/60 text-emerald-300' : 'bg-amber-950/60 text-amber-300'
                        }`}
                      >
                        {actual.toFixed(1)} / {prom.targetLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Comunicación Oficial desde Torre Ejecutiva */}
            <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#ACCEBF]">
                  <Megaphone className="h-3.5 w-3.5" /> Comunicación Presidencial
                </span>
                <span className="font-mono-data text-[10px] text-[#DEC1B4]">-4 CP</span>
              </div>
              <div className="mt-2 space-y-2">
                <select
                  value={annKind}
                  disabled={!caps.canDirectCabinetCouncil}
                  onChange={(e) => setAnnKind(e.target.value as GovernmentAnnouncement['kind'])}
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4] disabled:opacity-45"
                >
                  <option value="conferencia">Conferencia en Torre Ejecutiva</option>
                  <option value="anuncio_medida">Anuncio de medida económica/social</option>
                  <option value="informe_gestion">Informe público de gestión</option>
                  <option value="rendicion">Presentación de Rendición de Cuentas</option>
                </select>
                <input
                  value={annTitle}
                  disabled={!caps.canDirectCabinetCouncil}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Titular oficial (ej: Plan de estabilización y empleo)"
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4] disabled:opacity-45"
                />
                <textarea
                  rows={2}
                  value={annSummary}
                  disabled={!caps.canDirectCabinetCouncil}
                  onChange={(e) => setAnnSummary(e.target.value)}
                  placeholder="Mensaje central a la ciudadanía..."
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4] disabled:opacity-45"
                />
                <button
                  disabled={!caps.canDirectCabinetCouncil || !annTitle.trim() || !annSummary.trim()}
                  onClick={() => {
                    const res = emitGovernmentAnnouncement(gameState, annKind, annTitle, annSummary);
                    setGovMessage(res.message);
                    if (res.ok) {
                      onUpdateState(res.nextState);
                      setAnnTitle('');
                      setAnnSummary('');
                    }
                  }}
                  className="executive-action-btn inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-45"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Emitir Anuncio Oficial (-4 CP)
                </button>
              </div>

              {(gameState.governmentAnnouncements ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5 border-t border-[#574239]/40 pt-2">
                  {(gameState.governmentAnnouncements ?? []).slice(0, 3).map((a) => (
                    <div key={a.id} className="rounded bg-[#0A0F10] px-2.5 py-1.5 text-[11px]">
                      <div className="flex items-center justify-between font-mono-data text-[10px] text-[#FFB691]">
                        <span>{a.dateLabel}</span>
                        <span>{a.approvalEffect >= 0 ? '+' : ''}{a.approvalEffect}% aprob.</span>
                      </div>
                      <div className="font-semibold text-[#DFE3E4]">{a.title}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Modo Gobierno Departamental y Municipios */}
      {showTerritorial && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <Building className="h-4 w-4 text-[#E87532]" />
                Gobierno Departamental — {targetDept.name}
              </h3>
              <p className="text-xs text-[#CDC6B8]">
                Intendencia vigente: {targetDept.currentIntendenteName} · Presupuesto: $ {targetDept.annualBudgetMillionsUYU.toLocaleString('es-UY')}M UYU · Servicios: {targetDept.localServiceQuality}/100 · {targetDept.municipalitiesCount} municipios
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={!caps.canExecuteDepartamentalWorks}
                onClick={handleDepartamentalPublicWork}
                className="executive-action-btn min-h-[40px] rounded-lg px-3.5 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Ejecutar Plan de Obras (-5 cap.)
              </button>
              <button
                disabled={!caps.canCoordinateMunicipalities}
                onClick={handleCoordinateMunicipalities}
                className="min-h-[40px] rounded-lg border border-[#574239]/60 bg-[#1B2021] px-3.5 py-2 text-xs font-bold text-[#DFE3E4] transition hover:border-[#E87532] disabled:cursor-not-allowed disabled:opacity-45"
              >
                Coordinar Municipios (-4 cap.)
              </button>
            </div>
          </div>

          {!caps.canAdministerDepartamentalBudget && (
            <div className="flex items-start gap-2 rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-3 text-xs text-[#DFE3E4]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
              <div>
                <strong className="text-[#FFB691]">Facultades departamentales restringidas:</strong> {caps.lockReasons.departamentalExecutive}
              </div>
            </div>
          )}

          <div>
            <div className="mb-2 text-xs font-bold text-[#DFE3E4]">Presupuesto Departamental (9 áreas)</div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {gameState.departamentalBudget.map((item) => (
                <div key={item.category} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#DFE3E4]">{item.label}</span>
                    <span className="font-mono-data font-bold text-[#FFB691]">{item.sharePct}%</span>
                  </div>
                  <input
                    type="range"
                    min={2}
                    max={45}
                    disabled={!caps.canAdministerDepartamentalBudget}
                    value={item.sharePct}
                    onChange={(e) => handleUpdateDeptBudget(item.category, Number(e.target.value))}
                    className="mt-2 w-full accent-[#E87532] disabled:opacity-50"
                  />
                  <div className="mt-1 font-mono-data text-[11px] text-[#DEC1B4]">
                    $ {item.annualMillionsUYU.toLocaleString('es-UY')}M UYU / año
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Obras públicas con ciclo de ejecución (costo, plazo, resultado medible) */}
          <div className="border-t border-[#574239]/40 pt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-bold text-[#DFE3E4]">Obras Públicas en Ejecución — {targetDept.name}</div>
              <button
                disabled={!caps.canExecuteDepartamentalWorks}
                onClick={() => {
                  const r = startDepartmentWorkOrder(
                    gameState,
                    targetDept.id,
                    `Plan de infraestructura y servicios — ${targetDept.name}`,
                    caps.currentOffice === 'alcalde' ? 'municipio' : 'intendencia',
                    2,
                    6,
                    'Mejora de infraestructura, servicios y empleo territorial.'
                  );
                  setGovMessage(r.message);
                  if (r.ok) onUpdateState(r.nextState);
                }}
                className="executive-action-btn min-h-[36px] rounded-lg px-3 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45"
              >
                Iniciar Obra (-4 CP, $2M, 6 meses)
              </button>
            </div>
            {(gameState.publicWorksOrders ?? []).filter((w) => w.departmentId === targetDept.id).length === 0 ? (
              <p className="text-[11px] text-[#CDC6B8]">Sin obras registradas. Iniciá una obra para ver su avance mensual y su impacto en los indicadores del departamento.</p>
            ) : (
              <div className="space-y-2">
                {(gameState.publicWorksOrders ?? [])
                  .filter((w) => w.departmentId === targetDept.id)
                  .map((w) => (
                    <div key={w.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#DFE3E4]">{w.title}</span>
                        <span className={`font-mono-data text-[10px] font-bold ${w.status === 'completada' ? 'text-[#ACCEBF]' : 'text-[#FFB691]'}`}>
                          {w.status === 'completada' ? 'Completada' : `${w.remainingMonths}/${w.totalMonths} meses`}
                        </span>
                      </div>
                      <div className="mt-1 font-mono-data text-[10px] text-[#DEC1B4]">
                        {w.authorityLevel} · $ {w.costMillionsUYU}M UYU · {w.effectSummary}
                      </div>
                      {w.status !== 'completada' && (
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
                          <div
                            className="h-full rounded-full bg-[#E87532]"
                            style={{ width: `${((w.totalMonths - w.remainingMonths) / w.totalMonths) * 100}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Equipo Departamental en sección Territorial */}
      {showTerritorial && (
        <section className="warroom-surface rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 font-display text-base font-bold text-[#DFE3E4]">
              <Users className="h-4 w-4 text-[#E87532]" />
              Equipo de Gobierno Departamental — {targetDept.name}
            </h4>
            {!caps.canAppointDepartamentalTeam && (
              <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">Solo Intendente electo</span>
            )}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gameState.departamentalTeam.map((dir) => (
              <div key={dir.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono-data font-bold text-[#FFB691]">{dir.areaCode}</span>
                  <span className="font-mono-data text-[#DEC1B4]">Gest {dir.management}</span>
                </div>
                <div className="mt-0.5 text-xs font-semibold text-[#CDC6B8]">{dir.areaName}</div>
                <div className="mt-1 text-sm font-bold text-[#DFE3E4]">{dir.holderName}</div>
                <div className="text-[11px] text-[#DEC1B4]">{dir.sectorName}</div>

                {caps.canAppointDepartamentalTeam && (
                  <button
                    onClick={() => setReplacingDirId(replacingDirId === dir.id ? null : dir.id)}
                    className="mt-2.5 inline-flex min-h-[34px] w-full items-center justify-center gap-1.5 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
                  >
                    <RefreshCw className="h-3 w-3" /> Nombrar director/a
                  </button>
                )}

                {replacingDirId === dir.id && (
                  <div className="mt-2 space-y-1.5 border-t border-[#574239]/40 pt-2">
                    {gameState.departamentalCandidates.map((cand) => (
                      <button
                        key={cand.id}
                        onClick={() => handleAppointDeptDirector(dir.id, cand)}
                        className="flex w-full items-center justify-between rounded-lg border border-[#574239]/50 bg-[#0A0F10] px-2 py-1.5 text-left text-[11px] transition hover:border-[#E87532]"
                      >
                        <span className="font-semibold text-[#DFE3E4]">{cand.name}</span>
                        <span className="font-mono-data font-bold text-[#FFB691]">Gest {cand.management}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Empresas Públicas y Actores en Gabinete */}
      {showGabinete && (gameState.publicEnterprises ?? []).length > 0 && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <Factory className="h-4 w-4 text-[#E87532]" />
                Empresas Públicas y Servicios Descentralizados (Arts. 185–205)
              </h3>
              <p className="text-xs text-[#CDC6B8]">
                Gestión de tarifas, planes de inversión, contralor Art. 197 y designación de directorios con venia del Senado (Art. 187).
              </p>
            </div>
            <span className="inline-flex items-center gap-1 font-mono-data text-[11px] text-[#ACCEBF]">
              <Handshake className="h-3.5 w-3.5" /> Autonomía Institucional Activa
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(gameState.publicEnterprises ?? []).map((ente) => {
              const pendingVenia = (gameState.pendingVenias ?? []).find(
                (v) => v.enterpriseId === ente.id && v.status === 'pendiente'
              );
              return (
                <div key={ente.id} className="flex flex-col justify-between rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono-data text-xs font-bold text-[#FFB691]">{ente.id.toUpperCase()}</span>
                      <span className="font-mono-data text-[10px] text-[#ACCEBF]">
                        Tarifa {ente.tariffIndex} · Cal. {ente.serviceQualityScore}/100
                      </span>
                    </div>
                    <div className="mt-1 font-semibold text-[#DFE3E4]">{ente.name}</div>
                    <div className="text-[11px] text-[#DEC1B4]">
                      {ente.directorName}{' '}
                      {pendingVenia ? (
                        <span className="ml-1 rounded bg-amber-950/70 px-1.5 py-0.5 font-mono-data text-[9px] text-amber-300">
                          Venia pendiente ({pendingVenia.nomineeName})
                        </span>
                      ) : (
                        <CheckCircle2 className="ml-1 inline h-3 w-3 text-[#ACCEBF]" />
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-2 gap-1.5 rounded-lg bg-[#0A0F10] p-2 font-mono-data text-[10px]">
                      <div>
                        <span className="text-[#CDC6B8]">Resultado op.:</span>
                        <div className={ente.operatingBalanceBillionsUYU >= 0 ? 'font-bold text-[#ACCEBF]' : 'font-bold text-rose-300'}>
                          {ente.operatingBalanceBillionsUYU >= 0 ? '+' : ''}
                          {ente.operatingBalanceBillionsUYU.toFixed(1)}B UYU
                        </div>
                      </div>
                      <div>
                        <span className="text-[#CDC6B8]">Inv. / Deuda:</span>
                        <div className="font-bold text-[#DFE3E4]">
                          {ente.investmentPlanBillionsUYU.toFixed(1)}B / ${ente.ownDebtBillionsUSD.toFixed(2)}B
                        </div>
                      </div>
                    </div>
                  </div>

                  {caps.canDirectMinistriesAndStateAgencies ? (
                    <div className="mt-3 space-y-1.5 border-t border-[#574239]/35 pt-2.5">
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          onClick={() => {
                            const r = adjustEnterpriseTariff(gameState, ente.id, -3);
                            setGovMessage(r.message);
                            if (r.ok) onUpdateState(r.nextState);
                          }}
                          className="rounded border border-[#574239]/60 bg-[#0A0F10] py-1 font-mono-data text-[10px] font-bold text-[#ACCEBF] hover:border-[#E87532]"
                        >
                          -3% Tarifa (-3 CP)
                        </button>
                        <button
                          onClick={() => {
                            const r = adjustEnterpriseTariff(gameState, ente.id, 3);
                            setGovMessage(r.message);
                            if (r.ok) onUpdateState(r.nextState);
                          }}
                          className="rounded border border-[#574239]/60 bg-[#0A0F10] py-1 font-mono-data text-[10px] font-bold text-[#FFB691] hover:border-[#E87532]"
                        >
                          +3% Tarifa (-3 CP)
                        </button>
                        <button
                          onClick={() => {
                            const r = adjustEnterpriseInvestment(gameState, ente.id, 1.0);
                            setGovMessage(r.message);
                            if (r.ok) onUpdateState(r.nextState);
                          }}
                          className="rounded border border-[#574239]/60 bg-[#0A0F10] py-1 font-mono-data text-[10px] text-[#DFE3E4] hover:border-[#E87532]"
                        >
                          +1B Inv. (-3 CP)
                        </button>
                        <button
                          onClick={() => {
                            const r = issueArticle197Observation(gameState, ente.id);
                            setGovMessage(r.message);
                            if (r.ok) onUpdateState(r.nextState);
                          }}
                          className="rounded border border-[#574239]/60 bg-[#0A0F10] py-1 font-mono-data text-[10px] text-[#DEC1B4] hover:border-[#E87532]"
                        >
                          Obs. Art. 197 (-4 CP)
                        </button>
                      </div>

                      <button
                        onClick={() => {
                          setVeniaEntId(veniaEntId === ente.id ? null : ente.id);
                          setVeniaNominee('');
                        }}
                        className="w-full rounded border border-[#557568]/55 bg-[#557568]/18 py-1 font-mono-data text-[10px] font-bold text-[#ACCEBF] hover:bg-[#557568]/30"
                      >
                        Nominar Directorio / Venia Art. 187 (-4 CP)
                      </button>

                      {veniaEntId === ente.id && (
                        <div className="flex gap-1.5 pt-1">
                          <input
                            value={veniaNominee}
                            onChange={(e) => setVeniaNominee(e.target.value)}
                            placeholder="Nombre candidato/a..."
                            className="min-w-0 flex-1 rounded border border-[#574239]/60 bg-[#0A0F10] px-2 py-1 text-[11px] text-[#DFE3E4]"
                          />
                          <button
                            onClick={() => {
                              const r = nominateEnterpriseDirector(gameState, ente.id, veniaNominee);
                              setGovMessage(r.message);
                              if (r.ok) {
                                onUpdateState(r.nextState);
                                setVeniaEntId(null);
                                setVeniaNominee('');
                              }
                            }}
                            className="rounded bg-[#E87532] px-2 py-1 text-[10px] font-bold text-[#511E00]"
                          >
                            Enviar
                          </button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Actores Sociales y Consejos de Salarios */}
          {(gameState.socialActors ?? []).length > 0 && (
            <div className="border-t border-[#574239]/40 pt-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-display text-base font-bold text-[#DFE3E4]">
                    Actores Sociales, Consejos de Salarios y Gremiales
                  </h4>
                  <p className="text-[11px] text-[#CDC6B8]">
                    La conflictividad sindical, empresarial y agropecuaria responde a inflación, salarios, tarifas y acuerdos firmados.
                  </p>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {(gameState.socialActors ?? []).map((actor) => {
                  const canNegotiate =
                    caps.canDirectMinistriesAndStateAgencies ||
                    (actor.id === 'congreso_intendentes' && caps.canAdministerDepartamentalBudget);
                  return (
                    <div key={actor.id} className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-3.5 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-[#DFE3E4]">{actor.name}</div>
                          <div className="mt-0.5 text-[11px] text-[#CDC6B8]">
                            Agenda: {actor.interests.slice(0, 3).join(' · ')}
                          </div>
                        </div>
                        <span className="font-mono-data text-[10px] text-[#FFB691]">
                          Presión {actor.pressureCapacity}
                        </span>
                      </div>

                      <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono-data text-[10px]">
                        <div className="rounded bg-[#0A0F10] px-2 py-1.5">
                          <span className="text-[#CDC6B8]">Confianza: </span>
                          <strong className="text-[#ACCEBF]">{actor.governmentTrust}/100</strong>
                        </div>
                        <div className="rounded bg-[#0A0F10] px-2 py-1.5">
                          <span className="text-[#CDC6B8]">Conflictividad: </span>
                          <strong className={actor.conflictLevel >= 65 ? 'text-rose-300' : 'text-[#FFB691]'}>
                            {actor.conflictLevel}/100
                          </strong>
                        </div>
                      </div>

                      {actor.negotiationHistory.length > 0 && (
                        <div className="mt-2 text-[10px] text-[#DEC1B4]">
                          Último acuerdo ({actor.negotiationHistory[0].dateLabel}): {actor.negotiationHistory[0].topic}
                        </div>
                      )}

                      {canNegotiate && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          <button
                            onClick={() => {
                              const r = negotiateWithSocialActor(gameState, actor.id as SocialActorId, 'consenso');
                              setGovMessage(r.message);
                              if (r.ok) onUpdateState(r.nextState);
                            }}
                            className="flex-1 rounded border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-[11px] font-semibold text-[#DFE3E4] hover:border-[#E87532]"
                          >
                            Mesa de Diálogo (-4 CP)
                          </button>
                          <button
                            onClick={() => {
                              const r = negotiateWithSocialActor(gameState, actor.id as SocialActorId, 'concesion');
                              setGovMessage(r.message);
                              if (r.ok) onUpdateState(r.nextState);
                            }}
                            className="flex-1 rounded border border-[#557568]/60 bg-[#557568]/20 px-2.5 py-1.5 text-[11px] font-semibold text-[#ACCEBF] hover:bg-[#557568]/35"
                          >
                            Acuerdo / Pauta (-5 CP)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Consejo de Ministros (12 carteras) en Gabinete */}
      {showGabinete && (
        <section className="warroom-surface rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <Briefcase className="h-4 w-4 text-[#E87532]" />
                Consejo de Ministros Nacional (12 Carteras)
              </h3>
              <p className="mt-0.5 text-xs text-[#CDC6B8]">
                {caps.canAppointNationalMinisters
                  ? 'Como Presidente en ejercicio podés dirigir el Consejo de Ministros y designar o remover titulares (costo: 4 capital político).'
                  : 'Solo el Presidente de la República en ejercicio designa ministros. Vista informativa del gabinete actual.'}
              </p>
            </div>
            <div className="flex items-center gap-2 font-mono-data text-xs font-semibold text-[#CDC6B8]">
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#E87532]" />
              Gestión promedio:{' '}
              <strong className="text-[#DFE3E4]">
                {Math.round(gameState.cabinet.reduce((s, c) => s + c.management, 0) / gameState.cabinet.length)}/100
              </strong>
            </div>
          </div>

          {!caps.canAppointNationalMinisters && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 p-3 text-xs text-[#DFE3E4]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
              <div>
                <strong className="text-[#FFB691]">Gabinete nacional bloqueado:</strong> {caps.lockReasons.executiveNational}
              </div>
            </div>
          )}

          {/* Compromisos de Ministerios en Coalición */}
          {Object.keys(gameState.coalitionPromisedMinistries ?? {}).length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#574239]/50 bg-[#0A0F10] p-3 text-xs">
              <span className="font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">
                Cuota de Coalición:
              </span>
              {Object.entries(gameState.coalitionPromisedMinistries ?? {}).map(([pid, promised]) => {
                const party = gameState.parties.find((p) => p.id === pid);
                const actual = gameState.cabinet.filter((m) => !m.isVacant && m.partyId === pid).length;
                const ok = actual >= promised;
                return (
                  <span
                    key={pid}
                    className={`rounded px-2 py-0.5 font-mono-data text-[11px] font-bold ${
                      ok ? 'bg-[#557568]/30 text-[#ACCEBF]' : 'bg-[#93000A]/40 text-[#FFB4AB]'
                    }`}
                  >
                    {party?.acronym ?? pid}: {actual}/{promised} carteras
                  </span>
                );
              })}
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {gameState.cabinet.map((min) => {
              const p = gameState.parties.find((x) => x.id === min.partyId);
              const filteredCands = gameState.ministerCandidates.filter((c) => {
                if (candidatePartyFilter === 'all') return true;
                if (candidatePartyFilter === 'mine') return c.partyId === gameState.player.partyId;
                return c.partyId === candidatePartyFilter;
              });

              return (
                <div
                  key={min.id}
                  className={`rounded-lg border p-3.5 ${
                    min.isVacant
                      ? 'border-dashed border-[#E87532]/65 bg-[#1B2021]/80'
                      : 'border-[#574239]/40 bg-[#1B2021]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-data text-xs font-bold text-[#FFB691]">{min.ministryCode}</span>
                    <span
                      className="font-mono-data text-[11px] font-bold"
                      style={{ color: min.isVacant ? '#FFB4AB' : p?.color ?? '#DFE3E4' }}
                    >
                      {min.isVacant ? 'VACANTE' : p?.acronym ?? 'IND'}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-[#CDC6B8]">{min.ministryName}</div>

                  <div className="mt-2 flex items-start gap-2.5">
                    <MinisterAvatar
                      seed={min.avatarSeed ?? min.holderName}
                      partyColor={p?.color}
                      vacant={Boolean(min.isVacant)}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-[#DFE3E4]">
                        {min.holderName}
                        {min.age && !min.isVacant ? (
                          <span className="ml-1 font-mono-data text-[11px] font-normal text-[#CDC6B8]">
                            ({min.age})
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-[11px] text-[#DEC1B4]">{min.sectorName}</div>
                      {min.trajectory && (
                        <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[#CDC6B8]">
                          {min.trajectory}
                        </div>
                      )}
                    </div>
                  </div>

                  {(min.strengths?.length || min.weaknesses?.length) && (
                    <div className="mt-2 flex flex-wrap gap-1 text-[10px]">
                      {min.strengths?.slice(0, 1).map((s, i) => (
                        <span key={i} className="rounded bg-[#557568]/25 px-1.5 py-0.5 text-[#ACCEBF]">
                          +{s}
                        </span>
                      ))}
                      {min.weaknesses?.slice(0, 1).map((w, i) => (
                        <span key={i} className="rounded bg-[#93000A]/25 px-1.5 py-0.5 text-[#FFB4AB]">
                          -{w}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-[#574239]/40 pt-2 font-mono-data text-[11px]">
                    <div>
                      <span className="block text-[10px] text-[#CDC6B8]">Gestión</span>
                      <span className="font-bold text-[#DFE3E4]">{min.management}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#CDC6B8]">Pop.</span>
                      <span className="font-bold text-[#DFE3E4]">{min.popularity}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] text-[#CDC6B8]">Lealtad</span>
                      <span className="font-bold text-[#DFE3E4]">{min.loyalty}</span>
                    </div>
                  </div>

                  {caps.canAppointNationalMinisters ? (
                    <div className="mt-3 flex gap-1.5">
                      <button
                        onClick={() =>
                          setReplacingMinistryId(replacingMinistryId === min.id ? null : min.id)
                        }
                        className="inline-flex min-h-[34px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 text-xs font-semibold text-[#DFE3E4] transition hover:border-[#E87532]"
                      >
                        <RefreshCw className="h-3 w-3" />
                        {min.isVacant ? 'Designar (-4 CP)' : 'Reemplazar'}
                      </button>
                      {!min.isVacant && (
                        <button
                          onClick={() => handleDismissMinister(min.id)}
                          title="Destituir ministro (-2 CP)"
                          className="inline-flex min-h-[34px] items-center justify-center gap-1 rounded-lg border border-[#93000A]/60 bg-[#93000A]/20 px-2.5 text-xs font-semibold text-[#FFB4AB] hover:bg-[#93000A]/45"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-[#574239]/40 bg-[#0A0F10] py-1.5 text-[11px] text-[#CDC6B8]">
                      <Lock className="h-3 w-3" /> Solo Presidente en ejercicio
                    </div>
                  )}

                  {replacingMinistryId === min.id && caps.canAppointNationalMinisters && (
                    <div className="mt-2.5 space-y-2 border-t border-[#574239]/40 pt-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-[#FFB691]">Postulantes (-4 CP):</span>
                        <select
                          value={candidatePartyFilter}
                          onChange={(e) => setCandidatePartyFilter(e.target.value)}
                          className="rounded border border-[#574239]/60 bg-[#0A0F10] px-1.5 py-0.5 text-[10px] text-[#DFE3E4]"
                        >
                          <option value="all">Todos los partidos</option>
                          <option value="mine">Tu partido</option>
                          {gameState.parties.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.acronym}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                        {filteredCands.slice(0, 8).map((cand) => {
                          const cp = gameState.parties.find((x) => x.id === cand.partyId);
                          return (
                            <button
                              key={cand.id}
                              onClick={() => handleAppointMinister(min.id, cand)}
                              className="flex w-full items-center gap-2 rounded-lg border border-[#574239]/50 bg-[#0A0F10] p-2 text-left text-[11px] transition hover:border-[#E87532]"
                            >
                              <MinisterAvatar
                                seed={cand.avatarSeed ?? cand.name}
                                partyColor={cp?.color}
                                size="sm"
                              />
                              <div className="min-w-0 flex-1">
                                <div className="truncate font-semibold text-[#DFE3E4]">
                                  {cand.name} <span className="text-[#FFB691]">({cp?.acronym ?? 'IND'})</span>
                                </div>
                                <div className="truncate text-[10px] text-[#CDC6B8]">
                                  {cand.sectorName} · Gest {cand.management} · Lealtad {cand.loyalty}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!caps.canAppointNationalMinisters && !caps.canAdministerDepartamentalBudget && (
        <section className="warroom-surface rounded-xl p-5 text-xs text-[#CDC6B8]">
          <div className="flex items-center gap-2 font-bold text-[#DFE3E4]">
            <Shield className="h-4 w-4 text-[#ACCEBF]" />
            Atribuciones activas de tu rol ({caps.roleSummaryLabel})
          </div>
          <p className="mt-1.5 leading-relaxed">
            {caps.isCampaigning
              ? 'Durante la campaña podés construir tu programa de gobierno, participar en debates, recorrer departamentos y buscar acuerdos en Campaña y Partido.'
              : caps.canCastLegislativeVote
              ? 'Como legislador podés presentar leyes, trabajar en comisiones, negociar votos, votar proyectos y controlar políticamente al Poder Ejecutivo desde Parlamento.'
              : 'Podés conducir la estrategia partidaria, construir alianzas y preparar el próximo ciclo electoral desde Partido y Oposición.'}
          </p>
        </section>
      )}
    </div>
  );
};
