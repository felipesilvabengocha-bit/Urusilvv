import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Bolt,
  Building2,
  CalendarClock,
  Copy,
  DollarSign,
  Download,
  Flag,
  Globe2,
  Home,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  Lock,
  Map as MapIcon,
  Megaphone,
  Save,
  Send,
  Sparkles,
  TrendingUp,
  Volume2,
  VolumeX,
  Vote,
  Wallet,
  X,
} from 'lucide-react';
import { ACHIEVEMENTS, MONTH_NAMES } from '../data/uruguayData';
import { ambientAudio } from '../engine/audioEngine';
import { getPlayerCapabilities } from '../engine/capabilitiesEngine';
import { visitDepartmentInCampaign } from '../engine/eventsAndAiEngine';
import { multiplayerClient, MultiplayerRoomSnapshot } from '../engine/multiplayerClient';
import { syncProgression } from '../engine/progressionEngine';
import { advanceOneMonth, startNextCareerCycle } from '../engine/simulationEngine';
import { encodeGameToCode, saveGame } from '../engine/storageEngine';
import { DepartmentId, GameState, OfficeId } from '../types/game';
import { CreditsFooter } from './CreditsFooter';
import { NarrativeMomentModal } from './NarrativeMomentModal';
import { TermEndModal } from './TermEndModal';
import { UruguayMap } from './UruguayMap';
import { CampaignAndElectionsView } from './views/CampaignAndElectionsView';
import { CareerProgressionView } from './views/CareerProgressionView';
import {
  DiplomacyView,
  EventsAndOpsView,
  HistoricalLogView,
} from './views/DiplomacyEventsAndLogView';
import { EconomyAndBudgetView } from './views/EconomyAndBudgetView';
import { EcosystemView } from './views/EcosystemView';
import { GovernmentAndCabinetView, GovSectionId } from './views/GovernmentAndCabinetView';
import { OppositionView } from './views/OppositionView';
import { ParliamentView } from './views/ParliamentView';
import { ResourcesAndActionsView } from './views/ResourcesAndActionsView';
import { NationalSummaryView, PartySpaceView } from './views/SummaryAndPartyView';

interface GameWorkspaceProps {
  gameState: GameState;
  isMultiplayer?: boolean;
  onUpdateState: (next: GameState) => void;
  onExitHome: () => void;
}

type NavTab =
  | 'pais'
  | 'ecosistema'
  | 'territorio'
  | 'partido'
  | 'campana'
  | 'recursos'
  | 'gobierno'
  | 'politicas'
  | 'parlamento'
  | 'economia'
  | 'gabinete'
  | 'diplomacia'
  | 'oposicion'
  | 'acontecimientos'
  | 'carrera';

interface NavItemDef {
  id: NavTab;
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_GROUPS: Array<{ title: string; items: NavItemDef[] }> = [
  {
    title: 'Despacho y Coyuntura',
    items: [
      { id: 'pais', label: 'Despacho Nacional', shortLabel: 'Despacho', icon: LayoutDashboard },
      { id: 'ecosistema', label: 'Ecosistema Político', shortLabel: 'Ecosistema', icon: LayoutGrid },
      { id: 'acontecimientos', label: 'Crisis y Archivo', shortLabel: 'Crisis', icon: AlertTriangle },
      { id: 'oposicion', label: 'Opinión y Oposición', shortLabel: 'Oposición', icon: Megaphone },
    ],
  },
  {
    title: 'Política y Elecciones',
    items: [
      { id: 'campana', label: 'Campaña y Elecciones', shortLabel: 'Campaña', icon: Vote },
      { id: 'partido', label: 'Partido y Alianzas', shortLabel: 'Partido', icon: Flag },
      { id: 'territorio', label: 'Mapa Territorial', shortLabel: 'Mapa', icon: MapIcon },
    ],
  },
  {
    title: 'Estado y Gobierno',
    items: [
      { id: 'gobierno', label: 'Gobierno y Gabinete', shortLabel: 'Gobierno', icon: Building2 },
      { id: 'parlamento', label: 'Parlamento y Juntas', shortLabel: 'Parlam.', icon: Landmark },
      { id: 'economia', label: 'Economía y Presupuesto', shortLabel: 'Economía', icon: DollarSign },
      { id: 'politicas', label: 'Políticas Públicas IA', shortLabel: 'Polít. IA', icon: Sparkles },
      { id: 'diplomacia', label: 'Relaciones Exteriores', shortLabel: 'Diplom.', icon: Globe2 },
    ],
  },
  {
    title: 'Trayectoria y Recursos',
    items: [
      { id: 'carrera', label: 'Trayectoria y Logros', shortLabel: 'Trayect.', icon: Award },
      { id: 'recursos', label: 'Maniobras y Fondos', shortLabel: 'Recursos', icon: Wallet },
    ],
  },
];

const NAV_ITEMS: NavItemDef[] = NAV_GROUPS.flatMap((g) => g.items);

export const GameWorkspace: React.FC<GameWorkspaceProps> = ({
  gameState,
  isMultiplayer = false,
  onUpdateState,
  onExitHome,
}) => {
  const [activeTab, setActiveTab] = useState<NavTab>(
    gameState.careerPhase === 'campana' ? 'campana' : 'pais'
  );
  const [govSection, setGovSection] = useState<GovSectionId>('conduccion');
  const [eventsSubTab, setEventsSubTab] = useState<'eventos' | 'archivo'>('eventos');
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [audioOn, setAudioOn] = useState(() => ambientAudio.getEnabled());
  const [mpRoom, setMpRoom] = useState<MultiplayerRoomSnapshot | null>(
    isMultiplayer ? multiplayerClient.currentRoom : null
  );
  const [mpChatOpen, setMpChatOpen] = useState(false);
  const [mpChatInput, setMpChatInput] = useState('');

  const playerParty = gameState.parties.find((p) => p.id === gameState.player.partyId)!;
  const unresolvedEvents = gameState.events.filter((e) => !e.resolved).length;
  const caps = getPlayerCapabilities(gameState);

  const isTabRestricted = (tabId: NavTab): boolean => {
    if (tabId === 'gobierno' || tabId === 'gabinete') {
      return !caps.canAppointNationalMinisters && !caps.canAdministerDepartamentalBudget && !caps.canExecuteDepartamentalWorks;
    }
    if (tabId === 'economia') return !caps.canEditNationalBudgetAndFiscal;
    if (tabId === 'parlamento') return !caps.canVoteOrSubmitInParliament && !caps.canSubmitToJunta;
    if (tabId === 'diplomacia') return !caps.canDirectForeignPolicyExecutive;
    return false;
  };

  useEffect(() => {
    if (!isMultiplayer) return;
    const unsub = multiplayerClient.subscribe((ev) => {
      if (ev.type === 'room:sync' || ev.type === 'room:started') {
        setMpRoom(ev.room);
        if (ev.room.sharedState) {
          onUpdateState(ev.room.sharedState);
        }
      } else if (ev.type === 'room:error') {
        setToastMsg(`Sala Online: ${ev.message}`);
      }
    });
    return unsub;
  }, [isMultiplayer, onUpdateState]);

  const commitState = (
    nextRaw: GameState,
    skipSync = false,
    broadcastKind: 'action' | 'advance' = 'action'
  ) => {
    const prevAchCount = gameState.progression.unlockedAchievements.length;
    const prevObjCount = gameState.progression.completedObjectivesCount;
    const synced = skipSync ? nextRaw : syncProgression(gameState, nextRaw);

    saveGame(synced);

    const newAchCount = synced.progression.unlockedAchievements.length;
    if (newAchCount > prevAchCount) {
      const latestAchId = synced.progression.unlockedAchievements[newAchCount - 1]?.id;
      const achTitle = ACHIEVEMENTS.find((a) => a.id === latestAchId)?.title ?? 'Nuevo logro';
      setToastMsg(`Logro desbloqueado: ${achTitle} (+6 CP)`);
      ambientAudio.playChime('achievement');
    } else if (synced.progression.completedObjectivesCount > prevObjCount) {
      const objEntry = synced.history.find((h) => h.title.startsWith('Objetivo cumplido'));
      setToastMsg(objEntry ? `${objEntry.title}: ${objEntry.detail}` : '¡Objetivo cumplido! Recibiste Capital Político y fondos.');
      ambientAudio.playChime('xp');
    }

    if (isMultiplayer && multiplayerClient.currentRoom) {
      try {
        if (broadcastKind === 'advance') {
          multiplayerClient.send({ type: 'room:advance_month', sharedState: synced });
        } else {
          const latestAction = synced.history[0]?.title;
          multiplayerClient.send({
            type: 'room:player_action',
            sharedState: synced,
            actionSummary: latestAction,
          });
        }
      } catch {
        // Ignorar si el socket se cerró momentáneamente
      }
    }

    onUpdateState(synced);
  };

  const handleAdvanceMonth = () => {
    const next = advanceOneMonth(gameState);
    commitState(next, true, 'advance');
    setToastMsg(`Mes avanzado: +2 CP y fondos actualizados. ${next.lastMacroReasons[0]?.deltaLabel ?? ''}`);
  };

  const handleDismissMoment = () => {
    if (!gameState.progression.pendingMoment) return;
    commitState(
      {
        ...gameState,
        progression: {
          ...gameState.progression,
          pendingMoment: undefined,
        },
      },
      true
    );
  };

  const handleSaveManual = () => {
    saveGame(gameState);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleExportCode = async () => {
    const code = encodeGameToCode(gameState);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2400);
    } catch {
      setToastMsg(`Código de partida: ${code.slice(0, 36)}...`);
    }
  };

  const handleNegotiateParty = (partyId: string) => {
    if (gameState.player.politicalCapital < 4) {
      setToastMsg('Capital político insuficiente (se requieren 4 puntos).');
      return;
    }
    const target = gameState.parties.find((p) => p.id === partyId);
    const nextRelations = gameState.player.relations.map((r) =>
      r.partyId === partyId ? { ...r, affinity: Math.min(100, r.affinity + 6) } : r
    );
    commitState({
      ...gameState,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
        relations: nextRelations,
      },
      history: [
        {
          id: `rel_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Diálogo político con ${target?.name ?? partyId}`,
          detail: 'Acercamiento programático incrementó en +6 puntos la afinidad bilateral.',
        },
        ...gameState.history,
      ],
    });
    setToastMsg(`Diálogo bilateral con ${target?.name} (+6 afinidad).`);
  };

  const handleRequestSupport = (partyId: string) => {
    if (gameState.player.politicalCapital < 3) {
      setToastMsg('Capital político insuficiente (se requieren 3 puntos).');
      return;
    }
    const target = gameState.parties.find((p) => p.id === partyId);
    const nextRelations = gameState.player.relations.map((r) =>
      r.partyId === partyId ? { ...r, affinity: Math.min(100, r.affinity + 2) } : r
    );
    const nextBills = gameState.bills.map((b) => {
      if (b.status !== 'en_negociacion') return b;
      const prev = b.negotiatedPartySupport[partyId] ?? 0;
      return {
        ...b,
        negotiatedPartySupport: { ...b.negotiatedPartySupport, [partyId]: Math.min(0.45, prev + 0.15) },
      };
    });
    commitState({
      ...gameState,
      bills: nextBills,
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 3,
        relations: nextRelations,
      },
      history: [
        {
          id: `sup_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'gobierno',
          title: `Pedido de apoyo a ${target?.name ?? partyId}`,
          detail: 'Se solicitó respaldo parlamentario para iniciativas en trámite (+0.15 por proyecto).',
        },
        ...gameState.history,
      ],
    });
    setToastMsg(`Pedido de apoyo a ${target?.name} registrado (-3 CP).`);
  };

  const handleRequestElectoralSupport = (partyId: string) => {
    if (gameState.player.politicalCapital < 4) {
      setToastMsg('Capital político insuficiente (se requieren 4 puntos).');
      return;
    }
    const target = gameState.parties.find((p) => p.id === partyId);
    if (!target || target.id === gameState.player.partyId) return;
    if ((gameState.electoralSupporters ?? []).includes(partyId)) {
      setToastMsg(`${target.name} ya te está apoyando.`);
      return;
    }
    const rel = gameState.player.relations.find((r) => r.partyId === partyId);
    const affinity = rel?.affinity ?? 0;
    const rng = Math.random();
    const guaranteed = affinity > 75;
    const success = guaranteed ? true : rng < (affinity / 100) * 0.7;
    if (!success) {
      setToastMsg(`${target.name} rechazó apoyarte (afinidad ${affinity}%).`);
      return;
    }
    const supporterShare = target.currentPollShare;
    const nextParties = gameState.parties.map((p) => {
      if (p.id === partyId) return { ...p, currentPollShare: 0, baseNationalShare: 0 };
      if (p.id === gameState.player.partyId) return { ...p, currentPollShare: Number((p.currentPollShare + supporterShare).toFixed(2)) };
      return p;
    });
    commitState({
      ...gameState,
      parties: nextParties,
      electoralSupporters: [...(gameState.electoralSupporters ?? []), partyId],
      player: {
        ...gameState.player,
        politicalCapital: gameState.player.politicalCapital - 4,
      },
      history: [
        {
          id: `sup_el_${Date.now()}`,
          dateLabel: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
          category: 'campana',
          title: `Apoyo electoral de ${target.name}`,
          detail: `${target.name} se retira y transfiere ${supporterShare.toFixed(1)}% de intención de voto a tu lema.`,
        },
        ...gameState.history,
      ],
    });
    setToastMsg(`${target.name} te apoya: sus votos se suman a tu lema (-4 CP).`);
  };

  const handleVisitDepartment = (deptId: DepartmentId) => {
    const res = visitDepartmentInCampaign(gameState, deptId);
    commitState(res.nextState);
    setToastMsg(res.message);
  };

  const handleContinueCareer = (nextOffice: OfficeId, nextDepartment: DepartmentId) => {
    const next = startNextCareerCycle(gameState, nextOffice, nextDepartment);
    commitState(next, true);
    setActiveTab('campana');
  };

  const stageLabel =
    gameState.careerPhase === 'campana'
      ? `Campaña · ${gameState.electoralStage.replace('_', ' ')}`
      : caps.isInNationalOpposition
      ? 'En oposición'
      : 'Oficialismo';

  // Pestañas rápidas adaptadas al rol activo en iPhone (ergonomía pulgar)
  const mobileQuickTabs: NavTab[] =
    gameState.careerPhase === 'campana'
      ? ['pais', 'campana', 'partido', 'territorio']
      : caps.isInNationalOpposition
      ? ['pais', 'oposicion', 'parlamento', 'territorio']
      : ['pais', 'gobierno', 'parlamento', 'economia'];

  const selectWorkspaceTab = (tabId: NavTab) => {
    if (tabId === 'politicas') {
      setGovSection('politicas');
      setActiveTab('gobierno');
      return;
    }
    if (tabId === 'gabinete') {
      setGovSection('gabinete');
      setActiveTab('gobierno');
      return;
    }
    if (tabId === 'gobierno' && activeTab !== 'gobierno') {
      setGovSection('conduccion');
    }
    setActiveTab(tabId);
  };

  const effectiveTab: NavTab =
    activeTab === 'gabinete' || activeTab === 'politicas' ? 'gobierno' : activeTab;
  const activeNavMeta =
    effectiveTab === 'gobierno' && govSection === 'politicas'
      ? NAV_ITEMS.find((n) => n.id === 'politicas')
      : NAV_ITEMS.find((n) => n.id === effectiveTab);

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#0F1415] text-[#DFE3E4]">
      {/* Sidebar Desktop — Sala de Mando Obsidian "El Despacho Republicano" */}
      <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-[#574239]/40 bg-[#171C1D] text-[#DFE3E4] lg:flex">
        <div className="border-b border-[#574239]/40 bg-[#1B2021] p-4">
          <div className="font-mono-data text-[10px] font-semibold uppercase tracking-[0.14em] text-[#FFB691]">
            El Despacho Republicano
          </div>
          <div className="mt-2.5 flex items-center gap-2.5">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-mono-data text-xs font-extrabold text-white shadow-inner"
              style={{ backgroundColor: playerParty.color }}
            >
              {playerParty.acronym}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-semibold text-[#DFE3E4]">
                {gameState.player.name}
              </div>
              <div className="truncate font-mono-data text-[11px] font-semibold text-[#FFB691]">
                {caps.currentOffice ? caps.currentOfficeTitle : 'Candidato (sin cargo)'}
              </div>
              {caps.isCampaigning && (
                <div className="truncate font-mono-data text-[10px] text-[#CDC6B8]">
                  Meta: {caps.targetOfficeTitle}
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between font-mono-data text-[11px] text-[#CDC6B8]">
            <span>Ciclo #{gameState.cycleNumber} · {playerParty.currentPollShare.toFixed(1)}% voto</span>
            <span className="font-bold text-[#ACCEBF]">
              {gameState.progression.unlockedAchievements.length}/{ACHIEVEMENTS.length} logros
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#0A0F10]">
            <div
              className="h-full rounded-full bg-[#E87532]"
              style={{ width: `${Math.min(100, gameState.player.politicalCapital)}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between font-mono-data text-[10px] text-[#DEC1B4]">
            <span className="capitalize">{stageLabel}</span>
            <span>{gameState.player.politicalCapital} CP</span>
          </div>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto p-2.5">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-2.5 pb-1 pt-0.5 font-mono-data text-[9px] font-bold uppercase tracking-[0.14em] text-[#8B9491]">
                {group.title}
              </div>
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.id === 'politicas'
                    ? effectiveTab === 'gobierno' && govSection === 'politicas'
                    : item.id === 'gobierno'
                    ? effectiveTab === 'gobierno' && govSection !== 'politicas'
                    : effectiveTab === item.id;
                const restricted = isTabRestricted(item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => selectWorkspaceTab(item.id)}
                    className={`flex min-h-[36px] w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition ${
                      isActive
                        ? 'bg-[#E87532] text-[#511E00] shadow-sm'
                        : 'text-[#DEC1B4] hover:bg-[#262B2C] hover:text-[#DFE3E4]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {restricted && (
                        <Lock
                          className={`h-3 w-3 shrink-0 ${isActive ? 'text-[#511E00]/80' : 'text-[#8B9491]'}`}
                          aria-label="Atribuciones restringidas por cargo actual"
                        />
                      )}
                      {item.id === 'acontecimientos' && unresolvedEvents > 0 && (
                        <span
                          className={`font-mono-data text-[11px] font-bold ${
                            isActive ? 'text-[#511E00]' : 'text-[#FFB691]'
                          }`}
                        >
                          {unresolvedEvents}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-1.5 border-t border-[#574239]/40 bg-[#1B2021] p-3">
          <button
            onClick={() => setAudioOn(ambientAudio.toggle())}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-3 text-xs font-semibold text-[#CDC6B8] hover:border-[#E87532] hover:text-white"
          >
            {audioOn ? <Volume2 className="h-3.5 w-3.5 text-[#FFB691]" /> : <VolumeX className="h-3.5 w-3.5 text-[#8B9491]" />}
            {audioOn ? 'Audio activo' : 'Audio ambiental'}
          </button>
          <button
            onClick={handleSaveManual}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-3 text-xs font-semibold text-[#CDC6B8] hover:border-[#E87532] hover:text-white"
          >
            <Save className="h-3.5 w-3.5 text-[#FFB691]" />
            {savedNotice ? 'Partida guardada' : 'Guardar partida'}
          </button>
          <button
            onClick={handleExportCode}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-3 text-xs font-semibold text-[#CDC6B8] hover:border-[#ACCEBF] hover:text-white"
          >
            {copiedCode ? (
              <Copy className="h-3.5 w-3.5 text-[#ACCEBF]" />
            ) : (
              <Download className="h-3.5 w-3.5 text-[#ACCEBF]" />
            )}
            {copiedCode ? 'Código copiado' : 'Exportar código'}
          </button>
          <button
            onClick={onExitHome}
            className="flex min-h-[36px] w-full items-center gap-2 rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-3 text-xs font-semibold text-[#9CA3A5] hover:text-white"
          >
            <Home className="h-3.5 w-3.5" />
            Menú principal
          </button>
        </div>
      </aside>

      {/* Área principal War Room + Barra Superior Fija + Dock iPhone */}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        {/* Topbar Fija HUD Stitch */}
        <header className="safe-top sticky top-0 z-30 shrink-0 border-b border-[#574239]/35 bg-[#171C1D]/95 px-3.5 py-2 shadow-[0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:px-6">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#E87532]" />
                <span className="truncate font-mono-data text-[10px] font-medium uppercase tracking-wider text-[#DEC1B4]">
                  {MONTH_NAMES[gameState.currentMonth - 1]} {gameState.currentYear}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-display text-base italic leading-none text-[#CDC6B8] sm:text-lg">
                  {activeNavMeta?.label}
                </span>

                {/* Botón Avanzar Mes Desktop */}
                <button
                  onClick={handleAdvanceMonth}
                  disabled={gameState.careerPhase === 'fin_mandato'}
                  className="game-border-amber hidden min-h-[36px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#E87532] px-3.5 py-1.5 font-mono-data text-xs font-bold text-[#511E00] transition hover:brightness-110 disabled:opacity-45 lg:inline-flex"
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  Avanzar mes
                </button>

                {/* Acciones rápidas iPhone */}
                <div className="flex items-center gap-1 lg:hidden">
                  <button
                    onClick={handleSaveManual}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#262B2C] text-[#DEC1B4]"
                    aria-label="Guardar partida"
                    title={savedNotice ? 'Partida guardada' : 'Guardar partida'}
                  >
                    <Save className={`h-3.5 w-3.5 ${savedNotice ? 'text-[#ACCEBF]' : 'text-[#FFB691]'}`} />
                  </button>
                  <button
                    onClick={() => setAudioOn(ambientAudio.toggle())}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#262B2C] text-[#DEC1B4]"
                    aria-label="Audio ambiental"
                  >
                    {audioOn ? <Volume2 className="h-3.5 w-3.5 text-[#FFB691]" /> : <VolumeX className="h-3.5 w-3.5 text-[#8B9491]" />}
                  </button>
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono-data text-[10px] font-bold text-white"
                    style={{ backgroundColor: playerParty.color }}
                  >
                    {playerParty.acronym}
                  </span>
                </div>
              </div>
            </div>

            {/* Cinta de Telemetría Compacta (CP / POP / Fondos & PIB) */}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-[#262B2C]/85 px-2.5 py-1">
              <button
                onClick={() => setActiveTab('recursos')}
                className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition hover:bg-[#313637]"
                title="Ir a Recursos para conseguir Capital Político"
              >
                <Bolt className="h-3.5 w-3.5 shrink-0 text-[#E87532]" />
                <span className="font-mono-data text-[11px] font-semibold text-[#DFE3E4]">
                  {gameState.player.politicalCapital}{' '}
                  <span className="font-normal text-[#FFB691]">CP +</span>
                </span>
              </button>
              <div className="flex min-w-0 items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5 shrink-0 text-[#ACCEBF]" />
                <span className="font-mono-data text-[11px] font-semibold text-[#DFE3E4]">
                  {Math.round(gameState.player.attributes.popularity)}%{' '}
                  <span className="font-normal text-[#DEC1B4]">POP</span>
                </span>
              </div>
              <button
                onClick={() => setActiveTab('recursos')}
                className="flex min-w-0 items-center gap-1 rounded px-1 py-0.5 transition hover:bg-[#313637]"
                title="Ir a Recursos para recaudar fondos"
              >
                <Landmark className="h-3.5 w-3.5 shrink-0 text-[#CDC6B8]" />
                <span className="truncate font-mono-data text-[11px] font-semibold text-[#DFE3E4]">
                  ${(gameState.player.campaignFundsUYU / 1000000).toFixed(1)}M{' '}
                  <span className="font-normal text-[#ACCEBF]">UYU +</span>
                </span>
              </button>
              <div className="hidden items-center gap-1 md:flex">
                <span className="font-mono-data text-[11px] text-[#DEC1B4]">
                  PIB <strong className="text-[#ACCEBF]">{gameState.macro.gdpGrowthPct >= 0 ? '+' : ''}{gameState.macro.gdpGrowthPct.toFixed(1)}%</strong>
                </span>
              </div>
            </div>

            {/* Barra de mando móvil trasladada a la parte superior */}
            <nav
              aria-label="Barra de mando móvil"
              className="mt-0.5 border-t border-[#574239]/35 pt-1.5 lg:hidden"
            >
              <div className="mx-auto flex max-w-xl items-stretch gap-1">
                {mobileQuickTabs.map((tabId) => {
                  const meta = NAV_ITEMS.find((n) => n.id === tabId)!;
                  const Icon = meta.icon;
                  const active = effectiveTab === tabId;
                  return (
                    <button
                      key={tabId}
                      onClick={() => selectWorkspaceTab(tabId)}
                      className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 font-mono-data text-[10px] tracking-tight transition ${
                        active
                          ? 'bg-[#262B2C]/90 font-semibold text-[#E87532]'
                          : 'text-[#DEC1B4] hover:text-[#DFE3E4]'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate">{meta.shortLabel}</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setMobileSheetOpen(true)}
                  className={`relative flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 font-mono-data text-[10px] tracking-tight transition ${
                    !mobileQuickTabs.includes(effectiveTab) || mobileSheetOpen
                      ? 'bg-[#262B2C]/90 font-semibold text-[#E87532]'
                      : 'text-[#DEC1B4] hover:text-[#DFE3E4]'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span>Áreas</span>
                  {unresolvedEvents > 0 && (
                    <span className="absolute right-1.5 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E87532] px-1 font-mono-data text-[9px] font-bold text-[#511E00]">
                      {unresolvedEvents}
                    </span>
                  )}
                </button>

                <button
                  onClick={handleAdvanceMonth}
                  disabled={gameState.careerPhase === 'fin_mandato'}
                  className="game-border-amber flex min-h-[44px] shrink-0 items-center gap-1 rounded-lg bg-[#E87532] px-3 py-1.5 font-mono-data text-[11px] font-bold text-[#511E00] transition active:scale-[0.98] disabled:opacity-45"
                >
                  <CalendarClock className="h-4 w-4" />
                  <span>Mes +1</span>
                </button>
              </div>
            </nav>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-6xl space-y-4 p-3.5 pb-6 sm:p-6">
          {isMultiplayer && mpRoom && (
            <div className="rounded-xl border border-[#ACCEBF]/45 bg-[#171C1D] px-3.5 py-2.5 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-[#ACCEBF]" />
                  <span className="font-mono-data font-bold text-[#ACCEBF]">
                    SALA ONLINE {mpRoom.code}
                  </span>
                  <span className="text-[#CDC6B8]">
                    · {mpRoom.players.filter((p) => p.connected).length} conectados
                  </span>
                </div>
                <button
                  onClick={() => setMpChatOpen((v) => !v)}
                  className="rounded border border-[#574239]/60 bg-[#262B2C] px-2.5 py-1 font-mono-data text-[11px] font-semibold text-[#FFB691] hover:border-[#E87532]"
                >
                  {mpChatOpen ? 'Ocultar chat' : `Chat sala (${mpRoom.chat.length})`}
                </button>
              </div>
              {mpChatOpen && (
                <div className="mt-2.5 space-y-2 border-t border-[#574239]/35 pt-2.5">
                  <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-[#0A0F10] p-2 text-[11px]">
                    {mpRoom.chat.slice(-12).map((c) => (
                      <div key={c.id}>
                        <span className="font-mono-data font-bold text-[#FFB691]">[{c.partyAcronym}] {c.senderName}: </span>
                        <span className="text-[#DFE3E4]">{c.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      value={mpChatInput}
                      onChange={(e) => setMpChatInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && mpChatInput.trim()) {
                          multiplayerClient.send({ type: 'room:chat', text: mpChatInput });
                          setMpChatInput('');
                        }
                      }}
                      placeholder="Mensaje a la sala..."
                      className="flex-1 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-1.5 text-xs text-[#DFE3E4]"
                    />
                    <button
                      onClick={() => {
                        if (!mpChatInput.trim()) return;
                        multiplayerClient.send({ type: 'room:chat', text: mpChatInput });
                        setMpChatInput('');
                      }}
                      className="rounded-lg bg-[#E87532] px-3 py-1.5 text-xs font-bold text-[#511E00]"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {toastMsg && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E87532]/65 bg-[#1B2021] px-4 py-2.5 text-xs font-semibold text-[#DFE3E4] shadow-lg">
              <span>{toastMsg}</span>
              <button
                onClick={() => setToastMsg(null)}
                className="inline-flex h-7 w-7 items-center justify-center rounded text-[#CDC6B8] hover:bg-[#262B2C] hover:text-white"
                aria-label="Cerrar aviso"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}


          {effectiveTab === 'pais' && (
            <NationalSummaryView
              gameState={gameState}
              onUpdateState={(next) => commitState(next)}
              onNavigateTab={(tab) => selectWorkspaceTab(tab)}
            />
          )}
          {effectiveTab === 'territorio' && (
            <UruguayMap gameState={gameState} onVisitDepartment={handleVisitDepartment} />
          )}
          {effectiveTab === 'ecosistema' && (
            <EcosystemView gameState={gameState} onUpdateState={(next) => commitState(next)} />
          )}
          {effectiveTab === 'partido' && (
            <PartySpaceView
              gameState={gameState}
              onNegotiateWithParty={handleNegotiateParty}
              onRequestSupport={handleRequestSupport}
              onRequestElectoralSupport={handleRequestElectoralSupport}
              onUpdateState={(next) => commitState(next)}
            />
          )}
          {effectiveTab === 'campana' && (
            <CampaignAndElectionsView gameState={gameState} onUpdateState={(next) => commitState(next)} />
          )}
          {effectiveTab === 'recursos' && (
            <ResourcesAndActionsView
              gameState={gameState}
              onUpdateState={(next) => commitState(next)}
              onOpenCareer={() => selectWorkspaceTab('carrera')}
            />
          )}
          {effectiveTab === 'gobierno' && (
            <GovernmentAndCabinetView
              gameState={gameState}
              onUpdateState={(next) => commitState(next)}
              sectionMode="all"
              activeSection={govSection}
              onSelectSection={setGovSection}
            />
          )}
          {effectiveTab === 'parlamento' && (
            <ParliamentView gameState={gameState} onUpdateState={(next) => commitState(next)} />
          )}
          {effectiveTab === 'economia' && (
            <EconomyAndBudgetView
              gameState={gameState}
              onUpdateState={(next) => commitState(next)}
              onOpenPolicyLab={() => selectWorkspaceTab('politicas')}
            />
          )}
          {effectiveTab === 'diplomacia' && (
            <DiplomacyView gameState={gameState} onUpdateState={(next) => commitState(next)} />
          )}
          {effectiveTab === 'oposicion' && (
            <OppositionView gameState={gameState} onUpdateState={(next) => commitState(next)} />
          )}
          {activeTab === 'acontecimientos' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 border-b border-[#574239]/35 pb-2">
                <button
                  onClick={() => setEventsSubTab('eventos')}
                  className={`min-h-[40px] rounded-full px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                    eventsSubTab === 'eventos'
                      ? 'bg-[#E87532] text-[#511E00]'
                      : 'bg-[#262B2C] text-[#DEC1B4]'
                  }`}
                >
                  Acontecimientos y Operación ({unresolvedEvents})
                </button>
                <button
                  onClick={() => setEventsSubTab('archivo')}
                  className={`min-h-[40px] rounded-full px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
                    eventsSubTab === 'archivo'
                      ? 'bg-[#E87532] text-[#511E00]'
                      : 'bg-[#262B2C] text-[#DEC1B4]'
                  }`}
                >
                  Registro Histórico ({gameState.history.length})
                </button>
              </div>
              {eventsSubTab === 'eventos' ? (
                <EventsAndOpsView gameState={gameState} onUpdateState={(next) => commitState(next)} />
              ) : (
                <HistoricalLogView gameState={gameState} />
              )}
            </div>
          )}
          {activeTab === 'carrera' && <CareerProgressionView gameState={gameState} />}


          <div className="pt-2 lg:hidden">
            <CreditsFooter variant="dark" compact />
          </div>
          </div>
        </main>

        <div className="hidden shrink-0 lg:block">
          <CreditsFooter variant="dark" compact />
        </div>
      </div>

      {/* Sheet de 14 Áreas para iPhone */}
      {mobileSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-[#0A0F10]/85 backdrop-blur-xs lg:hidden">
          <div className="flex-1" onClick={() => setMobileSheetOpen(false)} />
          <div className="animate-editorial-in safe-bottom max-h-[84dvh] w-full overflow-y-auto rounded-t-2xl border-t-2 border-[#E87532]/50 bg-[#171C1D] p-4 text-[#DFE3E4] shadow-2xl">
            <div className="mb-3 flex justify-center">
              <span className="h-1 w-10 rounded-full bg-[#CDC6B8]/30" />
            </div>

            <div className="flex items-center justify-between border-b border-[#574239]/40 pb-3">
              <div>
                <div className="font-mono-data text-[10px] uppercase tracking-widest text-[#FFB691]">
                  El Despacho Republicano · Áreas Institucionales
                </div>
                <div className="font-display text-base font-semibold text-[#DFE3E4]">
                  {gameState.player.name} ({playerParty.acronym})
                </div>
                <div className="font-mono-data text-[11px] text-[#CDC6B8]">
                  {caps.currentOffice ? caps.currentOfficeTitle : `Candidato · ${caps.targetOfficeTitle}`} · Ciclo #{gameState.cycleNumber}
                </div>
              </div>
              <button
                onClick={() => setMobileSheetOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#574239]/50 bg-[#262B2C] text-[#DEC1B4]"
                aria-label="Cerrar despacho"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {NAV_GROUPS.map((group) => (
                <div key={group.title}>
                  <div className="mb-1.5 font-mono-data text-[9px] font-bold uppercase tracking-[0.14em] text-[#8B9491]">
                    {group.title}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active =
                        item.id === 'politicas'
                          ? effectiveTab === 'gobierno' && govSection === 'politicas'
                          : item.id === 'gobierno'
                          ? effectiveTab === 'gobierno' && govSection !== 'politicas'
                          : effectiveTab === item.id;
                      const restricted = isTabRestricted(item.id);
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            selectWorkspaceTab(item.id);
                            setMobileSheetOpen(false);
                          }}
                          className={`flex min-h-[44px] items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-semibold transition ${
                            active
                              ? 'border-[#E87532] bg-[#E87532] text-[#511E00]'
                              : 'border-[#574239]/45 bg-[#1B2021] text-[#DEC1B4] hover:border-[#E87532]/50'
                          }`}
                        >
                          <span className="flex items-center gap-2 truncate">
                            <Icon className="h-4 w-4 shrink-0" />
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            {restricted && <Lock className="h-3 w-3 shrink-0 opacity-70" />}
                            {item.id === 'acontecimientos' && unresolvedEvents > 0 && (
                              <span className="font-mono-data text-[11px] font-bold text-[#FFB691]">
                                {unresolvedEvents}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#574239]/40 pt-3">
              <button
                onClick={() => {
                  handleSaveManual();
                  setMobileSheetOpen(false);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[#574239]/45 bg-[#262B2C] px-2 text-xs font-semibold text-white"
              >
                <Save className="h-3.5 w-3.5 text-[#FFB691]" />
                Guardar
              </button>
              <button
                onClick={() => {
                  handleExportCode();
                  setMobileSheetOpen(false);
                }}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[#574239]/45 bg-[#262B2C] px-2 text-xs font-semibold text-white"
              >
                <Download className="h-3.5 w-3.5 text-[#ACCEBF]" />
                {copiedCode ? 'Copiado' : 'Código'}
              </button>
              <button
                onClick={onExitHome}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-[#574239]/45 bg-[#262B2C] px-2 text-xs font-semibold text-[#DEC1B4]"
              >
                <Home className="h-3.5 w-3.5" />
                Inicio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Portada / Momento Narrativo */}
      {gameState.progression.pendingMoment && (
        <NarrativeMomentModal
          moment={gameState.progression.pendingMoment}
          onDismiss={handleDismissMoment}
        />
      )}

      {/* Modal de Fin de Mandato y Continuidad de Carrera */}
      {gameState.careerPhase === 'fin_mandato' && (
        <TermEndModal
          gameState={gameState}
          onContinueCareer={handleContinueCareer}
          onExitHome={onExitHome}
        />
      )}
    </div>
  );
};
