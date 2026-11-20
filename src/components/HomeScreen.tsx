import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Award,
  BookOpen,
  ChevronRight,
  Compass,
  FolderOpen,
  Globe2,
  History,
  KeyRound,
  Landmark,
  Play,
  PlusCircle,
  Scale,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Trash2,
  Trophy,
  Verified,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ACHIEVEMENTS, DEPARTMENTS_DATA, DIFFICULTIES, MONTH_NAMES, OFFICES, SCENARIOS } from '../data/uruguayData';
import { VISUAL_ASSETS } from '../data/visualAssets';
import { ambientAudio } from '../engine/audioEngine';
import { decodeCodeToGame, deleteSave, loadAllSaves, loadMetaStats } from '../engine/storageEngine';
import { AchievementCategory, DifficultyId, GameState, ScenarioId } from '../types/game';
import { CreditsFooter } from './CreditsFooter';
import { MultiplayerModal } from './MultiplayerModal';

interface HomeScreenProps {
  activeSave: GameState | null;
  onNewGame: (initialScenarioId?: ScenarioId, initialDifficultyId?: DifficultyId) => void;
  onLoadGame: (state: GameState) => void;
  onStartMultiplayer: (state: GameState) => void;
  onRefreshSaves: () => void;
}

const ACHIEVEMENT_CATEGORIES: Array<{ id: AchievementCategory; label: string }> = [
  { id: 'electoral', label: 'Electorales' },
  { id: 'gobierno', label: 'Gobierno' },
  { id: 'parlamentario', label: 'Parlamentarios' },
  { id: 'politico', label: 'Políticos' },
];

export const HomeScreen: React.FC<HomeScreenProps> = ({
  activeSave,
  onNewGame,
  onLoadGame,
  onStartMultiplayer,
  onRefreshSaves,
}) => {
  const [modal, setModal] = useState<'none' | 'saves' | 'import' | 'scenarios' | 'achievements' | 'history' | 'guide'>('none');
  const [showMultiplayer, setShowMultiplayer] = useState(false);
  const [quickDiff, setQuickDiff] = useState<DifficultyId>('normal');
  const [codeInput, setCodeInput] = useState('');
  const [importError, setImportError] = useState('');
  const [heroError, setHeroError] = useState(false);
  const [thumbError, setThumbError] = useState(false);
  const [audioOn, setAudioOn] = useState(() => ambientAudio.getEnabled());
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const saves = loadAllSaves();
  const meta = loadMetaStats();

  // Partículas ambientales War Room (respeta prefers-reduced-motion)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = Math.max(window.innerHeight, 920);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles = Array.from({ length: 28 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.8 + 0.6,
      speedY: -(Math.random() * 0.25 + 0.08),
      speedX: (Math.random() - 0.5) * 0.16,
      opacity: Math.random() * 0.42 + 0.14,
      color: Math.random() > 0.3 ? '#e87532' : '#ffb691',
    }));

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.y += p.speedY;
        p.x += p.speedX;
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(render);
    };
    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  const handleToggleAudio = () => {
    setAudioOn(ambientAudio.toggle());
  };

  const handleImport = () => {
    try {
      setImportError('');
      const game = decodeCodeToGame(codeInput);
      onLoadGame(game);
      setModal('none');
    } catch {
      setImportError('El código ingresado no corresponde a una partida válida.');
    }
  };

  const activeParty = activeSave ? activeSave.parties.find((p) => p.id === activeSave.player.partyId) : null;
  const activeOfficeLabel = activeSave
    ? OFFICES.find((o) => o.id === (activeSave.player.currentOffice ?? activeSave.player.targetOffice))?.name ?? 'Candidato'
    : 'Estado Mayor Republicano';
  const activeStability = activeSave
    ? Math.round(activeSave.politicalIndicators.coalitionStability || activeSave.player.attributes.popularity)
    : 0;
  const activeDiffLabel = activeSave
    ? DIFFICULTIES.find((d) => d.id === activeSave.difficultyId)?.name ?? 'Normal'
    : '';

  // Últimos logros reales desbloqueados desde el meta local
  const recentUnlocked = meta.unlockedAchievements
    .map((id) => ACHIEVEMENTS.find((a) => a.id === id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a))
    .slice(-2)
    .reverse();

  // Escenario destacado (cambia según partida o primero disponible)
  const featuredScenario = SCENARIOS[0];
  const totalPopulationUY = DEPARTMENTS_DATA.reduce((a, d) => a + d.population2023, 0);

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-[#0F1415] text-[#DFE3E4]">
      {/* Canvas de partículas ambientales */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-0 opacity-45 mix-blend-screen"
        aria-hidden="true"
      />

      {/* Resplandores atmosféricos War Room */}
      <div className="pointer-events-none absolute left-1/2 top-16 h-72 w-80 -translate-x-1/2 bg-gradient-to-b from-[#E87532]/20 via-[#FFB691]/10 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -right-20 top-1/2 h-64 w-64 bg-[#7B9C8E]/10 blur-3xl" />

      {/* Top Cinematic Gamer HUD Header */}
      <header className="safe-top relative z-20 w-full border-b border-[#574239]/60 bg-[#0A0F10]/95 px-3.5 py-2.5 shadow-2xl backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            {/* Perfil Táctico del Jugador */}
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#FFB691]/50 bg-[#262B2C] shadow-inner">
                  <Shield className="h-4 w-4 text-[#FFB691]" />
                </div>
                <span className="absolute -bottom-1 -right-1 rounded-sm border border-black/40 bg-[#E87532] px-1 font-mono-data text-[9px] font-bold text-[#511E00]">
                  ROU
                </span>
              </div>
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono-data text-[11px] font-bold tracking-wider text-[#DFE3E4]">
                    {activeSave ? activeSave.player.name.toUpperCase() : 'ESTADO MAYOR'}
                  </span>
                  <Verified className="h-3.5 w-3.5 text-[#ACCEBF]" />
                </div>
                <span className="mt-0.5 font-mono-data text-[9px] uppercase tracking-widest text-[#FFB691]">
                  {activeSave ? `${activeOfficeLabel} · Ciclo #${activeSave.cycleNumber}` : 'República Oriental del Uruguay'}
                </span>
              </div>
            </div>

            {/* BSO Equalizer & Audio Controller */}
            <div className="flex items-center gap-2">
              <div className="mr-1 hidden flex-col items-end text-right sm:flex">
                <span className="font-mono-data text-[9px] uppercase tracking-widest text-[#CDC6B8]">
                  Banda Sonora Orquestal
                </span>
                <span className="max-w-[170px] truncate font-mono-data text-[10px] text-[#ACCEBF]">
                  {audioOn ? 'Marcha Republicana Activa' : 'Silencio de Despacho'}
                </span>
              </div>
              <button
                onClick={handleToggleAudio}
                className="flex min-h-[38px] items-center gap-1.5 rounded-md border border-[#574239]/70 bg-[#262B2C] px-2.5 py-1 shadow-xs transition hover:border-[#E87532] active:scale-95"
                title="Controlar Audio Ambiental"
              >
                <div className={`flex h-3.5 w-3.5 items-end gap-0.5 pb-0.5 ${audioOn ? 'opacity-100' : 'opacity-25'}`}>
                  <span className="eq-bar-1 h-3 w-0.5 rounded-full bg-[#FFB691]" />
                  <span className="eq-bar-2 h-2 w-0.5 rounded-full bg-[#FFB691]" />
                  <span className="eq-bar-3 h-3.5 w-0.5 rounded-full bg-[#FFB691]" />
                </div>
                {audioOn ? (
                  <Volume2 className="h-4 w-4 text-[#FFB691]" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#CDC6B8]" />
                )}
                <span className="font-mono-data text-[10px] font-semibold text-[#CDC6B8]">
                  {audioOn ? 'BSO ON' : 'MUTE'}
                </span>
              </button>
            </div>
          </div>

          {/* Sub-cinta táctica */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/35 pt-1 font-mono-data text-[9px] text-[#CDC6B8]">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-[#FFB691]" />
              <span className="font-semibold tracking-wider text-[#FFB691]">
                REPÚBLICA ORIENTAL DEL URUGUAY
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#CDC6B8]/80">EL DESPACHO REPUBLICANO</span>
              <span className="rounded border border-[#574239]/50 bg-[#1B2021] px-1.5 py-0.5 text-[#ACCEBF]">
                CENSO {totalPopulationUY.toLocaleString('es-UY')}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Central Cinematográfico */}
      <main className="relative z-10 mx-auto w-full max-w-6xl flex-1 px-4 pb-8 pt-4 sm:px-6">
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Columna Principal: Emblema, Vignette, Título, Dial, CTAs */}
          <div className="flex flex-col lg:col-span-7">
            {/* Emblema Sol de Mayo rotatorio + Cinta Tricolor */}
            <div className="flex flex-col items-center">
              <div className="relative mb-1 flex items-center justify-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-[#FFB691]/40 bg-[#171C1D] shadow-2xl">
                  <svg
                    className="h-14 w-14 animate-[spin_45s_linear_infinite] text-[#FFB691]"
                    fill="currentColor"
                    viewBox="0 0 100 100"
                    aria-hidden="true"
                  >
                    <circle className="text-[#E87532]" cx="50" cy="50" fill="currentColor" r="16" />
                    <g stroke="currentColor" strokeLinecap="round" strokeWidth="2.5">
                      <line x1="50" x2="50" y1="8" y2="24" />
                      <line x1="50" x2="50" y1="76" y2="92" />
                      <line x1="8" x2="24" y1="50" y2="50" />
                      <line x1="76" x2="92" y1="50" y2="50" />
                      <line x1="20" x2="32" y1="20" y2="32" />
                      <line x1="68" x2="80" y1="68" y2="80" />
                      <line x1="20" x2="32" y1="80" y2="68" />
                      <line x1="68" x2="80" y1="32" y2="20" />
                    </g>
                  </svg>
                  <Landmark className="absolute h-5 w-5 text-[#DFE3E4]" />
                </div>
                <div className="absolute -bottom-2 flex items-center gap-0.5 rounded-full border border-[#574239]/60 bg-[#313637]/95 px-2 py-0.5 shadow-md">
                  <span className="h-1 w-2.5 rounded-sm bg-sky-400" />
                  <span className="h-1 w-2.5 rounded-sm bg-[#E9E2D4]" />
                  <span className="h-1 w-2.5 rounded-sm bg-sky-400" />
                </div>
              </div>

              {/* Palacio Legislativo Chiaroscuro Vignette */}
              <div className="relative mt-3 h-44 w-full overflow-hidden rounded-xl border border-[#574239]/55 bg-[#171C1D] shadow-2xl sm:h-52">
                {!heroError ? (
                  <img
                    src={VISUAL_ASSETS.homeHero}
                    alt="Palacio Legislativo de Montevideo al atardecer"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroError(true)}
                    className="h-full w-full object-cover opacity-65 contrast-125 saturate-75"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1B2021] font-display text-sm text-[#CDC6B8]">
                    Palacio Legislativo · Montevideo
                  </div>
                )}
                <div className="scanline pointer-events-none absolute inset-0 opacity-40" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0F1415] via-[#0F1415]/45 to-transparent" />

                <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 rounded border border-[#574239]/60 bg-[#0A0F10]/90 px-2 py-0.5 font-mono-data text-[10px] font-semibold text-[#FFB691]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FFB4AB]" />
                  SESIÓN EN VIVO
                </div>
                <div className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded border border-[#574239]/40 bg-[#0A0F10]/85 px-2 py-0.5 text-[#ACCEBF]">
                  <Shield className="h-3 w-3" />
                  <span className="font-mono-data text-[10px] font-medium">CONSTITUCIÓN ROU</span>
                </div>
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 font-mono-data text-[10px] text-[#CDC6B8]">
                  <span className="truncate">MONTEVIDEO • PALACIO LEGISLATIVO</span>
                  <span className="shrink-0 text-[#FFB691]">ASAMBLEA GENERAL</span>
                </div>
              </div>

              {/* Titular Editorial */}
              <div className="mt-4 w-full px-1 text-center">
                <div className="mb-1 inline-flex items-center gap-2">
                  <span className="h-px w-6 bg-[#FFB691]/40" />
                  <p className="font-mono-data text-[11px] font-bold uppercase tracking-[0.2em] text-[#FFB691]">
                    SIMULADOR POLÍTICO DE ALTA ESTRATEGIA
                  </p>
                  <span className="h-px w-6 bg-[#FFB691]/40" />
                </div>
                <h1 className="font-display text-3xl font-bold uppercase leading-tight tracking-tight text-[#FFDBCB] drop-shadow-lg sm:text-4xl">
                  ¿QUIÉN QUIERE GOBERNAR <span className="text-[#E87532]">URUGUAY</span>?
                </h1>
                <div className="mt-2 flex items-center justify-center gap-2 px-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#574239] to-transparent" />
                  <p className="px-1 text-center font-display text-base italic text-[#E9E2D4] sm:text-lg">
                    «El poder se conquista. Gobernar es otra historia»
                  </p>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#574239] to-transparent" />
                </div>
              </div>
            </div>

            {/* Selector Rápido de Dificultad */}
            <div className="mt-4">
              <div className="flex items-center rounded-xl border border-[#574239]/60 bg-[#0A0F10]/90 p-1.5 shadow-xl">
                <button
                  onClick={() => setQuickDiff('normal')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono-data text-xs transition active:scale-95 ${
                    quickDiff === 'normal'
                      ? 'border-t border-white/25 bg-[#E87532] font-bold text-[#511E00] shadow-md'
                      : 'text-[#CDC6B8] hover:bg-[#1B2021] hover:text-[#DFE3E4]'
                  }`}
                >
                  <Scale className="h-4 w-4" />
                  Modo Constitucional
                </button>
                <button
                  onClick={() => setQuickDiff('dificil')}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 font-mono-data text-xs transition active:scale-95 ${
                    quickDiff === 'dificil'
                      ? 'border-t border-white/20 bg-[#93000A] font-bold text-[#FFDAD6] shadow-md'
                      : 'text-[#CDC6B8] hover:bg-[#1B2021] hover:text-[#DFE3E4]'
                  }`}
                >
                  <Skull className="h-4 w-4" />
                  Realpolitik Feroz
                </button>
              </div>
              <p className="mt-1.5 text-center text-xs italic text-[#CDC6B8]">
                {quickDiff === 'normal'
                  ? 'Equilibrio estricto de mayorías parlamentarias, interpelaciones senatoriales y pactos de coalición.'
                  : 'Huelgas, presiones económicas, filtraciones mediáticas y competencia electoral sin tregua.'}
              </p>
            </div>

            {/* CTA Principal: NUEVA PARTIDA */}
            <div className="mt-4 space-y-2.5">
              <button
                onClick={() => onNewGame(undefined, quickDiff)}
                className="game-border-amber group relative flex w-full items-center justify-between overflow-hidden rounded-xl border-b border-t border-b-black/40 border-t-white/30 bg-gradient-to-b from-[#F28240] via-[#E87532] to-[#C95B1B] p-4 text-left transition hover:brightness-110 active:scale-[0.98]"
              >
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.22),_transparent_70%)]" />
                <div className="z-10 flex items-center gap-3.5">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/25 text-[#511E00] shadow-inner">
                    <PlusCircle className="h-6 w-6" />
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold tracking-wide text-[#341100] drop-shadow-xs sm:text-2xl">
                        NUEVA PARTIDA
                      </span>
                      <span className="h-2.5 w-2.5 animate-ping rounded-full bg-amber-200" />
                    </div>
                    <span className="font-mono-data text-[10px] font-semibold tracking-wider text-[#511E00]">
                      INICIAR CARRERA POLÍTICA DESDE CERO
                    </span>
                  </div>
                </div>
                <div className="z-10 flex items-center gap-1 rounded border border-white/15 bg-black/20 px-2.5 py-1.5 text-[#341100]">
                  <span className="font-mono-data text-xs font-bold">JUGAR</span>
                  <Swords className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </button>

              {/* Expediente de Partida Activa */}
              <div className="relative w-full overflow-hidden rounded-xl border border-[#574239]/80 bg-[#262B2C]/90 p-3.5 shadow-xl">
                <div className="mb-2.5 flex items-center justify-between border-b border-[#574239]/40 pb-2">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-[#FFB691]" />
                    <span className="font-mono-data text-[11px] font-bold uppercase tracking-wider text-[#FFB691]">
                      EXPEDIENTE DE PARTIDA ACTIVA
                    </span>
                  </div>
                  <div className="flex items-center gap-1 rounded border border-[#ACCEBF]/40 bg-[#7B9C8E]/20 px-2 py-0.5 font-mono-data text-[10px] text-[#ACCEBF]">
                    <Sparkles className="h-3 w-3" />
                    {activeSave ? 'AUTOGUARDADO' : 'SIN PARTIDA'}
                  </div>
                </div>

                {activeSave ? (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[#574239] bg-[#0A0F10]">
                        {!thumbError ? (
                          <img
                            src={VISUAL_ASSETS.ceremonyPalacio}
                            alt="Partida activa"
                            referrerPolicy="no-referrer"
                            onError={() => setThumbError(true)}
                            className="h-full w-full object-cover opacity-75"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center font-mono-data text-xs font-bold text-[#FFB691]">
                            {activeParty?.acronym ?? 'ROU'}
                          </div>
                        )}
                        <span className="absolute inset-x-0 bottom-0 bg-black/80 text-center font-mono-data text-[8px] text-[#FFDBCB]">
                          {activeParty?.acronym ?? 'ACTIVA'}
                        </span>
                      </div>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono-data text-sm font-bold text-[#DFE3E4]">
                            {activeSave.player.name}
                          </span>
                          <span className="rounded bg-[#171C1D] px-1.5 py-0.5 font-mono-data text-[9px] text-[#FFB691]">
                            Ciclo #{activeSave.cycleNumber}
                          </span>
                        </div>
                        <span className="truncate font-mono-data text-[11px] text-[#CDC6B8]">
                          {MONTH_NAMES[activeSave.currentMonth - 1]} {activeSave.currentYear} • {activeDiffLabel}
                        </span>
                        <div className="mt-1 flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full border border-[#574239]/50 bg-[#0A0F10]">
                            <div
                              className="h-full bg-gradient-to-r from-[#557568] to-[#ACCEBF]"
                              style={{ width: `${Math.min(100, Math.max(8, activeStability))}%` }}
                            />
                          </div>
                          <span className="font-mono-data text-[10px] font-bold text-[#ACCEBF]">
                            {activeStability}% ESTABILIDAD
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onLoadGame(activeSave)}
                      className="flex min-h-[54px] shrink-0 flex-col items-center justify-center rounded-lg border border-[#FFB691]/40 bg-[#FFB691]/10 px-3.5 py-2 text-[#FFB691] shadow transition hover:bg-[#E87532] hover:text-[#511E00] active:scale-95"
                    >
                      <Play className="h-5 w-5" />
                      <span className="mt-0.5 font-mono-data text-[9px] font-bold uppercase">CONTINUAR</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 py-1 text-xs text-[#CDC6B8]">
                    <span>Aún no hay una partida en curso. Creá una nueva o importá un código para empezar.</span>
                    <button
                      onClick={() => onNewGame(undefined, quickDiff)}
                      className="shrink-0 rounded border border-[#FFB691]/40 bg-[#FFB691]/10 px-3 py-2 font-mono-data text-[10px] font-bold uppercase text-[#FFB691]"
                    >
                      Crear
                    </button>
                  </div>
                )}
              </div>

              {/* Cargar Archivo de Estado */}
              <button
                onClick={() => setModal('saves')}
                className="flex w-full items-center justify-between rounded-xl border border-[#574239]/60 bg-[#1B2021] px-3.5 py-3 text-left shadow-md transition hover:bg-[#262B2C] active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#574239]/40 bg-[#0A0F10] text-[#CDC6B8]">
                    <FolderOpen className="h-4 w-4 text-[#FFB691]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono-data text-xs font-semibold text-[#DFE3E4]">
                      CARGAR ARCHIVO DE ESTADO
                    </span>
                    <span className="font-mono-data text-[10px] text-[#CDC6B8]">
                      ARCHIVADORES DEL SENADO · GUARDADOS LOCALES
                    </span>
                  </div>
                </div>
                <span className="rounded border border-[#574239]/40 bg-[#171C1D] px-2 py-1 font-mono-data text-[10px] font-bold text-[#FFB691]">
                  {saves.length} {saves.length === 1 ? 'PARTIDA' : 'PARTIDAS'}
                </span>
              </button>

              {/* Multijugador Online (WebSockets) */}
              <button
                onClick={() => setShowMultiplayer(true)}
                className="flex w-full items-center justify-between rounded-xl border border-[#ACCEBF]/45 bg-[#1B2021] px-3.5 py-3 text-left shadow-md transition hover:border-[#ACCEBF] hover:bg-[#262B2C] active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#ACCEBF]/40 bg-[#0A0F10]">
                    <Globe2 className="h-4 w-4 text-[#ACCEBF]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono-data text-xs font-semibold text-[#DFE3E4]">
                      MULTIJUGADOR ONLINE
                    </span>
                    <span className="font-mono-data text-[10px] text-[#CDC6B8]">
                      SALAS EN VIVO · ALIANZAS Y ELECCIONES CON AMIGOS
                    </span>
                  </div>
                </div>
                <span className="rounded border border-[#ACCEBF]/40 bg-[#557568]/25 px-2 py-1 font-mono-data text-[10px] font-bold text-[#ACCEBF]">
                  EN VIVO
                </span>
              </button>
            </div>
          </div>

          {/* Columna Derecha: Herramientas Operativas, Logros y Escenario Histórico */}
          <div className="flex flex-col gap-3.5 lg:col-span-5">
            {/* Botonera Táctica Operativa (3x2 grid en desktop, 3 cols compactas en iPhone) */}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setModal('scenarios')}
                className="flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#574239]/45 bg-[#171C1D] p-2.5 text-center shadow transition hover:border-[#E87532]/60 hover:bg-[#1B2021] active:scale-95"
              >
                <Compass className="h-5 w-5 text-[#FFB691]" />
                <span className="font-mono-data text-[10px] font-semibold leading-tight text-[#DFE3E4]">
                  ESCENARIOS ({SCENARIOS.length})
                </span>
              </button>

              <button
                onClick={() => setModal('achievements')}
                className="relative flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#574239]/45 bg-[#171C1D] p-2.5 text-center shadow transition hover:border-[#ACCEBF]/60 hover:bg-[#1B2021] active:scale-95"
              >
                <div className="relative">
                  <Award className="h-5 w-5 text-[#ACCEBF]" />
                  <span className="absolute -right-4 -top-1.5 rounded border border-black/50 bg-[#E87532] px-1 font-mono-data text-[8px] font-bold text-[#511E00]">
                    {meta.unlockedAchievements.length}/{ACHIEVEMENTS.length}
                  </span>
                </div>
                <span className="font-mono-data text-[10px] font-semibold leading-tight text-[#DFE3E4]">
                  LOGROS
                </span>
              </button>

              <button
                onClick={() => setModal('import')}
                className="flex min-h-[70px] flex-col items-center justify-center gap-1.5 rounded-xl border border-[#574239]/45 bg-[#171C1D] p-2.5 text-center shadow transition hover:border-[#E87532]/60 hover:bg-[#1B2021] active:scale-95"
              >
                <KeyRound className="h-5 w-5 text-[#CDC6B8]" />
                <span className="font-mono-data text-[10px] font-semibold leading-tight text-[#DFE3E4]">
                  IMPORTAR
                </span>
              </button>

              <button
                onClick={() => setModal('history')}
                className="flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border border-[#574239]/45 bg-[#171C1D] p-2 text-center shadow transition hover:border-[#E87532]/60 hover:bg-[#1B2021] active:scale-95"
              >
                <History className="h-4 w-4 text-[#FFB691]" />
                <span className="font-mono-data text-[10px] font-semibold text-[#DFE3E4]">
                  HISTORIAL ({meta.completedRuns.length})
                </span>
              </button>

              <button
                onClick={() => setModal('guide')}
                className="col-span-2 flex min-h-[60px] items-center justify-center gap-2 rounded-xl border border-[#574239]/45 bg-[#171C1D] px-3 py-2 text-center shadow transition hover:border-[#ACCEBF]/60 hover:bg-[#1B2021] active:scale-95"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-[#ACCEBF]" />
                <span className="font-mono-data text-[10px] font-semibold text-[#DFE3E4]">
                  CÓDICE Y MARCO CONSTITUCIONAL
                </span>
              </button>
            </div>

            {/* Cinta de Logros Desbloqueados */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#574239]/50 bg-[#0A0F10]/85 p-3 shadow-inner">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-4 w-4 text-[#FFB691]" />
                <span className="font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#CDC6B8]">
                  LOGROS RECIENTES:
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {recentUnlocked.length > 0 ? (
                  recentUnlocked.map((ach) => (
                    <span
                      key={ach.id}
                      className="inline-flex items-center gap-1 rounded border border-amber-500/45 bg-[#262B2C] px-2 py-0.5 font-mono-data text-[9px] font-semibold text-amber-200"
                    >
                      <Award className="h-3 w-3 text-amber-400" />
                      {ach.title}
                    </span>
                  ))
                ) : (
                  <span className="font-mono-data text-[10px] text-[#ACCEBF]">
                    {meta.governedDepartments.length}/19 Intendencias · {meta.gamesPlayed} partidas
                  </span>
                )}
              </div>
            </div>

            {/* Tarjeta de Escenario Histórico Destacado (Estilo Dilema de Archivo) */}
            <div className="relative overflow-hidden rounded-xl border border-[#574239]/60 bg-[#171C1D] p-3.5 shadow-xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4 text-[#FFB691]" />
                  <span className="font-mono-data text-[10px] font-bold uppercase tracking-wider text-[#FFB691]">
                    ESCENARIO HISTÓRICO DESTACADO
                  </span>
                </div>
                <span className="rounded bg-[#313637] px-1.5 py-0.5 font-mono-data text-[10px] font-bold text-[#CDC6B8]">
                  {featuredScenario.periodLabel}
                </span>
              </div>

              <div className="flex items-start gap-3">
                <img
                  src={VISUAL_ASSETS.ceremonyPalacio}
                  alt={featuredScenario.title}
                  referrerPolicy="no-referrer"
                  className="h-16 w-16 shrink-0 rounded-lg border border-[#574239]/40 bg-[#313637] object-cover"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="line-clamp-1 font-display text-lg font-semibold leading-snug text-[#DFE3E4]">
                    {featuredScenario.title}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[#CDC6B8]">
                    {featuredScenario.description}
                  </p>
                </div>
              </div>

              <div className="-mx-3.5 -mb-3.5 mt-3 flex items-center justify-between border-t border-[#574239]/40 bg-[#1B2021]/90 px-3.5 py-2.5">
                <span className="font-mono-data text-[10px] font-semibold text-[#ACCEBF]">
                  PIB {featuredScenario.macro.gdpGrowthPct > 0 ? '+' : ''}
                  {featuredScenario.macro.gdpGrowthPct}% · Inf. {featuredScenario.macro.inflationPct}%
                </span>
                <button
                  onClick={() => setModal('scenarios')}
                  className="flex items-center gap-1 font-mono-data text-[10px] font-bold text-[#FFB691] transition hover:text-[#FFDBCB]"
                >
                  EXPLORAR ESCENARIOS
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Tarjeta War Room: Calendario Constitucional */}
            <aside className="warroom-surface rounded-xl p-4">
              <div className="flex items-center justify-between border-b border-[#574239]/40 pb-2">
                <span className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#FFB691]">
                  Calendario Constitucional ROU
                </span>
                <span className="rounded border border-[#ACCEBF]/40 bg-[#557568]/20 px-1.5 py-0.5 font-mono-data text-[9px] font-bold text-[#ACCEBF]">
                  OFICIAL
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-[#CDC6B8]">
                <strong className="text-[#DFE3E4]">Ciclo institucional:</strong> Internas partidarias (junio), elección nacional con Senado y Diputados (octubre), eventual balotaje (noviembre), asunción el 1.° de marzo y departamentales en mayo.
              </p>
            </aside>
          </div>
        </div>
      </main>

      {/* Créditos obligatorios visibles en pantalla principal */}
      <CreditsFooter variant="dark" />

      {/* Modales unificados War Room Obsidian */}
      {modal !== 'none' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A0F10]/85 p-0 backdrop-blur-xs sm:items-center sm:p-4">
          <div className="animate-editorial-in safe-bottom max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#574239]/70 bg-[#171C1D] p-5 text-[#DFE3E4] shadow-2xl sm:rounded-xl">
            <div className="mb-3 flex justify-center sm:hidden">
              <span className="h-1 w-10 rounded-full bg-[#574239]" />
            </div>

            <div className="flex items-center justify-between border-b border-[#574239]/45 pb-3">
              <h2 className="font-display text-xl font-semibold text-[#DFE3E4]">
                {modal === 'saves' && 'Partidas guardadas'}
                {modal === 'import' && 'Importar partida por código'}
                {modal === 'scenarios' && 'Escenarios históricos de partida'}
                {modal === 'achievements' && 'Galería de logros políticos'}
                {modal === 'history' && 'Historial de carreras políticas'}
                {modal === 'guide' && 'Marco institucional de Uruguay'}
              </h2>
              <button
                onClick={() => setModal('none')}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#574239]/40 bg-[#262B2C] text-[#DEC1B4] hover:border-[#E87532] hover:text-white"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {modal === 'saves' && (
              <div className="mt-4 space-y-2.5">
                {saves.length === 0 ? (
                  <p className="text-sm text-[#CDC6B8]">No hay partidas guardadas en este navegador.</p>
                ) : (
                  saves.map((s) => {
                    const party = s.parties.find((p) => p.id === s.player.partyId);
                    const sc = SCENARIOS.find((x) => x.id === s.scenarioId);
                    const sOffice =
                      OFFICES.find((o) => o.id === (s.player.currentOffice ?? s.player.targetOffice))?.name ??
                      'Candidato';
                    return (
                      <div
                        key={s.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#574239]/45 bg-[#1B2021] p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-[#DFE3E4]">
                            {s.player.name}{' '}
                            <span className="font-semibold" style={{ color: party?.color ?? '#FFB691' }}>
                              ({party?.acronym})
                            </span>
                          </div>
                          <div className="truncate font-mono-data text-xs text-[#CDC6B8]">
                            {sc?.periodLabel} · {MONTH_NAMES[s.currentMonth - 1]} {s.currentYear} · {sOffice} · Ciclo #{s.cycleNumber}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onLoadGame(s);
                              setModal('none');
                            }}
                            className="executive-action-btn min-h-[42px] rounded-lg px-4 py-1.5 text-xs font-bold"
                          >
                            Cargar
                          </button>
                          <button
                            onClick={() => {
                              deleteSave(s.id);
                              onRefreshSaves();
                            }}
                            className="min-h-[42px] rounded-lg border border-[#93000A]/60 bg-[#93000A]/20 px-2.5 text-[#FFB4AB] hover:bg-[#93000A]/40"
                            title="Eliminar partida"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {modal === 'scenarios' && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-[#CDC6B8]">
                  Elegí un contexto histórico para iniciar inmediatamente la creación de tu personaje y campaña en ese período.
                </p>
                {SCENARIOS.map((sc) => (
                  <div key={sc.id} className="rounded-lg border border-[#574239]/45 bg-[#1B2021] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-base font-semibold text-[#DFE3E4]">{sc.title}</span>
                      <span className="font-mono-data text-xs font-bold text-[#FFB691]">{sc.periodLabel}</span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[#CDC6B8]">{sc.description}</p>
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/35 pt-2.5">
                      <div className="flex flex-wrap gap-3 font-mono-data text-[11px] text-[#DEC1B4]">
                        <span>PIB: {sc.macro.gdpGrowthPct > 0 ? '+' : ''}{sc.macro.gdpGrowthPct}%</span>
                        <span>Inflación: {sc.macro.inflationPct}%</span>
                        <span>Desempleo: {sc.macro.unemploymentPct}%</span>
                      </div>
                      <button
                        onClick={() => {
                          setModal('none');
                          onNewGame(sc.id, quickDiff);
                        }}
                        className="executive-action-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold"
                      >
                        Jugar escenario
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modal === 'import' && (
              <div className="mt-4 space-y-3">
                <p className="text-xs text-[#CDC6B8]">
                  Pegá el código exportado desde otra sesión o dispositivo (<code className="font-mono-data text-[#FFB691]">QQGUY2:...</code>).
                </p>
                <textarea
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  rows={5}
                  placeholder="QQGUY2:eyJ2ZXJzaW9uI..."
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] p-3 font-mono-data text-xs text-[#DFE3E4] placeholder:text-[#CDC6B8]/40 focus:border-[#E87532] focus:outline-none"
                />
                {importError && <p className="text-xs font-semibold text-[#FFB4AB]">{importError}</p>}
                <button
                  onClick={handleImport}
                  className="executive-action-btn min-h-[46px] w-full rounded-lg py-2.5 text-sm font-bold"
                >
                  Cargar partida
                </button>
              </div>
            )}

            {modal === 'achievements' && (
              <div className="mt-4 space-y-4">
                {ACHIEVEMENT_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="space-y-2">
                    <h3 className="font-mono-data text-[11px] font-bold uppercase tracking-wider text-[#FFB691]">
                      {cat.label}
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {ACHIEVEMENTS.filter((a) => a.category === cat.id).map((a) => {
                        const unlocked = meta.unlockedAchievements.includes(a.id);
                        return (
                          <div
                            key={a.id}
                            className={`rounded-lg border p-3 ${
                              unlocked
                                ? 'border-[#ACCEBF]/55 bg-[#557568]/20'
                                : 'border-[#574239]/40 bg-[#1B2021] opacity-75'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-[#DFE3E4]">{a.title}</span>
                              <span className={`font-mono-data font-bold ${unlocked ? 'text-[#ACCEBF]' : 'text-[#CDC6B8]'}`}>
                                {unlocked ? 'Obtenido' : 'Bloqueado'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-[#CDC6B8]">{a.description}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {modal === 'history' && (
              <div className="mt-4 space-y-2">
                {meta.completedRuns.length === 0 ? (
                  <p className="text-sm text-[#CDC6B8]">Completá elecciones o mandatos para registrar tu historial.</p>
                ) : (
                  meta.completedRuns.map((run) => (
                    <div key={run.id} className="rounded-lg border border-[#574239]/45 bg-[#1B2021] p-3 text-xs">
                      <div className="font-bold text-[#DFE3E4]">
                        {run.playerName} · {run.partyName}
                      </div>
                      <div className="mt-1 font-medium text-[#ACCEBF]">{run.outcomeLabel}</div>
                    </div>
                  ))
                )}
              </div>
            )}

            {modal === 'guide' && (
              <div className="mt-4 space-y-3 text-xs leading-relaxed text-[#CDC6B8]">
                <p>
                  <strong className="text-[#DFE3E4]">Elecciones Internas (junio):</strong> Voto voluntario. Gana la candidatura presidencial única quien supera el 50% o alcanza el 40% con 10 puntos de diferencia; de lo contrario, resuelve la Convención Nacional.
                </p>
                <p>
                  <strong className="text-[#DFE3E4]">Elecciones Nacionales (octubre):</strong> Voto obligatorio. Se eligen Presidente y Vicepresidente, 30 Senadores (circunscripción nacional D'Hondt) y 99 Diputados (mínimo 2 por departamento, representación proporcional integral). Los plebiscitos requieren más del 50% de los votos emitidos.
                </p>
                <p>
                  <strong className="text-[#DFE3E4]">Balotaje (noviembre):</strong> Segunda vuelta presidencial si ninguna fórmula supera el 50% de los votos emitidos en octubre.
                </p>
                <p>
                  <strong className="text-[#DFE3E4]">Departamentales y Municipales (mayo siguiente):</strong> Ley de Lemas en los 19 departamentos (Art. 271), Junta Departamental de 31 ediles con mayoría garantizada de 16 bancas al lema ganador (Art. 272) y Municipios (Ley 19.272).
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showMultiplayer && (
        <MultiplayerModal
          onClose={() => setShowMultiplayer(false)}
          onStartMultiplayerGame={(state) => {
            setShowMultiplayer(false);
            onStartMultiplayer(state);
          }}
        />
      )}
    </div>
  );
};
