import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Flag, Shield, Sparkles, UserCheck } from 'lucide-react';
import {
  BASE_PARTIES,
  DEPARTMENTS_DATA,
  DIFFICULTIES,
  HISTORICAL_PRESETS,
  OFFICES,
  SCENARIOS,
} from '../data/uruguayData';
import { buildNewGameState } from '../engine/gameFactory';
import { bumpGamesPlayed, saveGame } from '../engine/storageEngine';
import {
  CharacterAttributes,
  DepartmentId,
  DifficultyId,
  EmblemId,
  GameState,
  OfficeId,
  Party,
  ScenarioId,
} from '../types/game';
import { CreditsFooter } from './CreditsFooter';

interface CreationWizardProps {
  initialScenarioId?: ScenarioId;
  initialDifficultyId?: DifficultyId;
  onCancel: () => void;
  onCreated: (state: GameState) => void;
}

const EMBLEMS: Array<{ id: EmblemId; label: string }> = [
  { id: 'sol', label: 'Sol de Mayo' },
  { id: 'bandera', label: 'Bandera Artiguista' },
  { id: 'ceibo', label: 'Flor de Ceibo' },
  { id: 'balanza', label: 'Balanza Republicana' },
  { id: 'espiga', label: 'Espiga Productiva' },
  { id: 'engranaje', label: 'Engranaje Industrial' },
];

export const CreationWizard: React.FC<CreationWizardProps> = ({
  initialScenarioId,
  initialDifficultyId,
  onCancel,
  onCreated,
}) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [scenarioId, setScenarioId] = useState<ScenarioId>(initialScenarioId ?? 'contemporaneo_2024');
  const [difficultyId, setDifficultyId] = useState<DifficultyId>(initialDifficultyId ?? 'normal');

  const [originMode, setOriginMode] = useState<'partido_existente' | 'partido_nuevo' | 'personaje_historico'>(
    'partido_existente'
  );
  const [selectedPartyId, setSelectedPartyId] = useState<string>('fa');
  const [selectedSectorId, setSelectedSectorId] = useState<string>('fa_mpp');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('orsi');

  const [customPartyName, setCustomPartyName] = useState('Encuentro Republicano Uruguayo');
  const [customAcronym, setCustomAcronym] = useState('ERU');
  const [customColor, setCustomColor] = useState('#557568');
  const [customEmblem, setCustomEmblem] = useState<EmblemId>('ceibo');
  const [customEco, setCustomEco] = useState(50);
  const [customSoc, setCustomSoc] = useState(58);
  const [customProgram, setCustomProgram] = useState(
    'Descentralización productiva, estabilidad macroeconómica y modernización educativa.'
  );

  const [playerName, setPlayerName] = useState('Martín Ferreira');
  const [biography, setBiography] = useState(
    'Dirigente con experiencia territorial y parlamentaria orientado a construir mayorías de diálogo.'
  );
  const [attributes, setAttributes] = useState<CharacterAttributes>(() => {
    const startDiff = DIFFICULTIES.find((d) => d.id === (initialDifficultyId ?? 'normal'))!;
    const avg = Math.floor(startDiff.attributeBudget / 5);
    const rem = startDiff.attributeBudget - avg * 5;
    return {
      popularity: avg + rem,
      charisma: avg,
      management: avg,
      territorialMachine: avg,
      negotiation: avg,
    };
  });

  const [targetOffice, setTargetOffice] = useState<OfficeId>('presidente');
  const [targetDepartment, setTargetDepartment] = useState<DepartmentId>('montevideo');
  const [targetMunicipality, setTargetMunicipality] = useState('Municipio B');

  const difficulty = DIFFICULTIES.find((d) => d.id === difficultyId)!;
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const totalPointsUsed =
    attributes.popularity +
    attributes.charisma +
    attributes.management +
    attributes.territorialMachine +
    attributes.negotiation;

  const remainingPoints = difficulty.attributeBudget - totalPointsUsed;

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const p = HISTORICAL_PRESETS.find((x) => x.id === presetId);
    if (!p) return;
    setPlayerName(p.name);
    setSelectedPartyId(p.partyId);
    setSelectedSectorId(p.sectorId);
    setTargetOffice(p.defaultOffice);
    setTargetDepartment(p.defaultDepartment);
    setBiography(p.biography);
    setAttributes({ ...p.attributes });
  };

  const handleDifficultyChange = (id: DifficultyId) => {
    setDifficultyId(id);
    const nextDiff = DIFFICULTIES.find((d) => d.id === id)!;
    const avg = Math.floor(nextDiff.attributeBudget / 5);
    const rem = nextDiff.attributeBudget - avg * 5;
    setAttributes({
      popularity: avg + rem,
      charisma: avg,
      management: avg,
      territorialMachine: avg,
      negotiation: avg,
    });
  };

  const updateAttr = (key: keyof CharacterAttributes, nextVal: number) => {
    const clamped = Math.max(20, Math.min(90, nextVal));
    const diff = clamped - attributes[key];
    if (originMode !== 'personaje_historico' && diff > remainingPoints) return;
    setAttributes((prev) => ({ ...prev, [key]: clamped }));
  };

  const activePartyPreview = useMemo(
    () => BASE_PARTIES.find((p) => p.id === selectedPartyId) ?? BASE_PARTIES[0],
    [selectedPartyId]
  );

  const activeDeptData = useMemo(
    () => DEPARTMENTS_DATA.find((d) => d.id === targetDepartment) ?? DEPARTMENTS_DATA[0],
    [targetDepartment]
  );

  const handleCreateGame = () => {
    const baseState = buildNewGameState({
      scenarioId,
      difficultyId,
      originMode,
      selectedPartyId,
      selectedSectorId,
      selectedPresetId,
      playerName,
      biography,
      attributes,
      targetOffice,
      targetDepartment,
      targetMunicipality,
      customParty:
        originMode === 'partido_nuevo'
          ? {
              name: customPartyName,
              acronym: customAcronym,
              color: customColor,
              emblem: customEmblem,
              economic: customEco,
              social: customSoc,
              program: customProgram,
            }
          : undefined,
    });
    saveGame(baseState);
    bumpGamesPlayed();
    onCreated(baseState);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#0F1415] text-[#DFE3E4]">
      <div className="safe-top flex-1 px-3.5 py-4 pb-24 sm:px-6 sm:py-6 sm:pb-24">
        <div className="mx-auto max-w-4xl space-y-5">
          {/* Barra superior de pasos en Obsidian War Room */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#574239]/55 bg-[#171C1D] p-3.5 text-[#DFE3E4] shadow-xl sm:p-4">
            <button
              onClick={onCancel}
              className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-[#CDC6B8] transition hover:text-[#FFB691]"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </button>

            <div className="flex items-center gap-2">
              {[
                { n: 1, label: 'Escenario' },
                { n: 2, label: 'Partido' },
                { n: 3, label: 'Perfil' },
                { n: 4, label: 'Cargo' },
              ].map((item) => (
                <div
                  key={item.n}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold ${
                    step === item.n
                      ? 'bg-[#E87532] text-white'
                      : step > item.n
                      ? 'bg-[#557568] text-white'
                      : 'bg-[#1B1F20] text-[#9CA3A5]'
                  }`}
                >
                  <span className="font-mono-data">{item.n}.</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* PASO 1 */}
          {step === 1 && (
            <div className="warroom-surface space-y-5 rounded-xl p-5 sm:p-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#DFE3E4]">1. Escenario histórico y dificultad</h2>
                <p className="mt-1 text-xs text-[#CDC6B8]">
                  Elegí el punto de partida institucional y la exigencia de la simulación.
                </p>
              </div>

              <div className="space-y-2.5">
                {SCENARIOS.map((sc) => (
                  <button
                    key={sc.id}
                    onClick={() => setScenarioId(sc.id)}
                    className={`w-full rounded-lg border p-4 text-left transition ${
                      scenarioId === sc.id
                        ? 'border-[#E87532] bg-[#E87532]/12'
                        : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-display text-base font-bold text-[#DFE3E4]">{sc.title}</span>
                      <span className="font-mono-data text-xs font-bold text-[#FFB691]">{sc.periodLabel}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-[#CDC6B8]">{sc.description}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono-data text-[11px] text-[#DEC1B4]">
                      <span>PIB: USD {sc.macro.gdpBillionsUSD}B ({sc.macro.gdpGrowthPct > 0 ? '+' : ''}{sc.macro.gdpGrowthPct}%)</span>
                      <span>Inflación: {sc.macro.inflationPct}%</span>
                      <span>Desempleo: {sc.macro.unemploymentPct}%</span>
                      <span className="font-sans font-medium text-[#ACCEBF]">{sc.dataSourceNote}</span>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <h3 className="mb-2.5 text-sm font-bold text-[#DFE3E4]">Nivel de dificultad</h3>
                <div className="grid gap-2.5 sm:grid-cols-5">
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDifficultyChange(d.id)}
                      className={`rounded-lg border p-3 text-left transition ${
                        difficultyId === d.id
                          ? 'border-[#E87532] bg-[#E87532]/14'
                          : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                      }`}
                    >
                      <div className="text-sm font-bold text-[#DFE3E4]">{d.name}</div>
                      <div className="mt-1 text-[11px] leading-snug text-[#CDC6B8]">{d.summary}</div>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}

          {/* PASO 2 */}
          {step === 2 && (
            <div className="warroom-surface space-y-5 rounded-xl p-5 sm:p-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#DFE3E4]">2. Espacio político, lema y sector interno</h2>
                <p className="mt-1 text-xs text-[#CDC6B8]">
                  Competí dentro de un partido uruguayo y su corriente interna, fundá un partido nuevo o asumí un personaje histórico.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-3">
                {[
                  { id: 'partido_existente', label: 'A. Partido uruguayo existente', icon: Flag },
                  { id: 'partido_nuevo', label: 'B. Crear partido desde cero', icon: Sparkles },
                  { id: 'personaje_historico', label: 'C. Personaje histórico / actual', icon: UserCheck },
                ].map((opt) => {
                  const Icon = opt.icon;
                  const active = originMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setOriginMode(opt.id as typeof originMode);
                        if (opt.id === 'personaje_historico') applyPreset(selectedPresetId);
                      }}
                      className={`flex min-h-[44px] items-center gap-2 rounded-lg border p-3 text-left text-xs font-bold transition ${
                        active
                          ? 'border-[#E87532] bg-[#E87532]/15 text-[#DFE3E4]'
                          : 'border-[#574239]/45 bg-[#1B2021] text-[#CDC6B8] hover:border-[#FFB691]/45'
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-[#FFB691]' : 'text-[#ACCEBF]'}`} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {originMode === 'partido_existente' && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#DEC1B4]">Lema (Partido)</div>
                    {BASE_PARTIES.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedPartyId(p.id);
                          setSelectedSectorId(p.sectors[0].id);
                        }}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selectedPartyId === p.id
                            ? 'border-[#E87532] bg-[#262B2C] shadow-xs'
                            : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-2 text-sm font-bold text-[#DFE3E4]">
                            <span className="h-3 w-3 rounded-sm" style={{ backgroundColor: p.color }} />
                            {p.name} ({p.acronym})
                          </span>
                          <span className="font-mono-data text-xs font-bold text-[#FFB691]">
                            {(scenario.partySharesOverride?.[p.id] ?? p.baseNationalShare).toFixed(1)}%
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-[#CDC6B8]">{p.historicalNote}</p>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[#DEC1B4]">
                      Sector interno en {activePartyPreview.name}
                    </div>
                    {activePartyPreview.sectors.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setSelectedSectorId(sec.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selectedSectorId === sec.id
                            ? 'border-[#557568] bg-[#557568]/18'
                            : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#ACCEBF]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#DFE3E4]">{sec.name}</span>
                          <span className="font-mono-data text-xs font-bold text-[#ACCEBF]">{sec.internalWeight}%</span>
                        </div>
                        <div className="mt-1 text-[11px] font-medium text-[#FFB691]">Referente: {sec.leader}</div>
                        <p className="mt-1 text-[11px] text-[#CDC6B8]">{sec.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {originMode === 'partido_nuevo' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[#DFE3E4]">
                      Nombre del nuevo partido
                      <input
                        value={customPartyName}
                        onChange={(e) => setCustomPartyName(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-[#DFE3E4]">
                        Sigla
                        <input
                          value={customAcronym}
                          maxLength={4}
                          onChange={(e) => setCustomAcronym(e.target.value.toUpperCase())}
                          className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm uppercase text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-[#DFE3E4]">
                        Color
                        <input
                          type="color"
                          value={customColor}
                          onChange={(e) => setCustomColor(e.target.value)}
                          className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-[#574239]/60 bg-[#0A0F10] p-1"
                        />
                      </label>
                    </div>
                    <div>
                      <span className="block text-xs font-semibold text-[#DFE3E4]">Emblema</span>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        {EMBLEMS.map((em) => (
                          <button
                            key={em.id}
                            onClick={() => setCustomEmblem(em.id)}
                            className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                              customEmblem === em.id
                                ? 'border-[#E87532] bg-[#E87532]/16 text-[#DFE3E4]'
                                : 'border-[#574239]/45 bg-[#1B2021] text-[#CDC6B8]'
                            }`}
                          >
                            {em.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="block text-xs font-semibold text-[#DFE3E4]">
                      Eje económico (0 Estatista · 100 Pro-mercado): <strong className="font-mono-data text-[#FFB691]">{customEco}</strong>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={customEco}
                        onChange={(e) => setCustomEco(Number(e.target.value))}
                        className="mt-2 w-full accent-[#E87532]"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-[#DFE3E4]">
                      Eje social (0 Conservador · 100 Progresista): <strong className="font-mono-data text-[#FFB691]">{customSoc}</strong>
                      <input
                        type="range"
                        min={5}
                        max={95}
                        value={customSoc}
                        onChange={(e) => setCustomSoc(Number(e.target.value))}
                        className="mt-2 w-full accent-[#E87532]"
                      />
                    </label>
                    <label className="block text-xs font-semibold text-[#DFE3E4]">
                      Programa fundacional
                      <textarea
                        rows={3}
                        value={customProgram}
                        onChange={(e) => setCustomProgram(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] p-2.5 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                      />
                    </label>
                  </div>
                </div>
              )}

              {originMode === 'personaje_historico' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {HISTORICAL_PRESETS.map((hp) => {
                    const party = BASE_PARTIES.find((p) => p.id === hp.partyId);
                    return (
                      <button
                        key={hp.id}
                        onClick={() => applyPreset(hp.id)}
                        className={`rounded-lg border p-3.5 text-left transition ${
                          selectedPresetId === hp.id
                            ? 'border-[#E87532] bg-[#E87532]/14'
                            : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#DFE3E4]">{hp.name}</span>
                          <span
                            className="rounded px-2 py-0.5 font-mono-data text-[11px] font-bold text-white"
                            style={{ backgroundColor: party?.color ?? '#262B2C' }}
                          >
                            {party?.acronym}
                          </span>
                        </div>
                        <div className="mt-1 text-[11px] font-semibold text-[#ACCEBF]">{hp.eraNote}</div>
                        <p className="mt-1 text-[11px] text-[#CDC6B8]">{hp.biography}</p>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          )}

          {/* PASO 3 */}
          {step === 3 && (
            <div className="warroom-surface space-y-5 rounded-xl p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-2xl font-bold text-[#DFE3E4]">3. Personaje y atributos</h2>
                  <p className="mt-1 text-xs text-[#CDC6B8]">
                    Tus atributos influyen directamente en elecciones internas, campañas, gestión de gabinete y acuerdos parlamentarios.
                  </p>
                </div>
                {originMode !== 'personaje_historico' && (
                  <div className="rounded-lg border border-[#E87532]/50 bg-[#E87532]/14 px-3 py-1.5 text-xs font-bold text-[#DFE3E4]">
                    Puntos disponibles: <span className="font-mono-data text-[#FFB691]">{remainingPoints}</span>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#DFE3E4]">
                  Nombre del candidato / dirigente
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#DFE3E4]">
                  Trayectoria previa
                  <input
                    value={biography}
                    onChange={(e) => setBiography(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-lg border border-[#574239]/45 bg-[#1B2021] p-4">
                {(
                  [
                    ['popularity', 'Popularidad inicial', 'Conocimiento público y aprobación ciudadana inicial.'],
                    ['charisma', 'Carisma y oratoria', 'Rendimiento en debates, entrevistas y actos públicos.'],
                    ['management', 'Capacidad de gestión', 'Solvencia técnica en administración pública o intendencias.'],
                    ['territorialMachine', 'Aparato territorial', 'Fuerza en comités, clubes, listas y los 19 departamentos.'],
                    ['negotiation', 'Negociación política', 'Acuerdos entre sectores, coaliciones y bancadas parlamentarias.'],
                  ] as Array<[keyof CharacterAttributes, string, string]>
                ).map(([key, title, desc]) => (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#DFE3E4]">{title}</span>
                      <span className="font-mono-data font-bold text-[#FFB691]">{attributes[key]} / 90</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={90}
                      disabled={originMode === 'personaje_historico'}
                      value={attributes[key]}
                      onChange={(e) => updateAttr(key, Number(e.target.value))}
                      className="w-full accent-[#E87532] disabled:opacity-60"
                    />
                    <div className="text-[11px] text-[#CDC6B8]">{desc}</div>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* PASO 4 */}
          {step === 4 && (
            <div className="warroom-surface space-y-5 rounded-xl p-5 sm:p-6">
              <div>
                <h2 className="font-display text-2xl font-bold text-[#DFE3E4]">4. Cargo objetivo y departamento base</h2>
                <p className="mt-1 text-xs text-[#CDC6B8]">
                  Cada cargo abre facultades institucionales distintas. En cada ciclo electoral podrás postularte al cargo que elijas.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {OFFICES.map((off) => (
                  <button
                    key={off.id}
                    onClick={() => setTargetOffice(off.id)}
                    className={`rounded-lg border p-3.5 text-left transition ${
                      targetOffice === off.id
                        ? 'border-[#E87532] bg-[#E87532]/14'
                        : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#FFB691]/45'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#DFE3E4]">{off.name}</span>
                      <span className="font-mono-data text-[10px] font-bold uppercase text-[#ACCEBF]">{off.level}</span>
                    </div>
                    <div className="mt-1 text-[11px] font-semibold text-[#FFB691]">{off.constitutionRef}</div>
                    <p className="mt-1 text-[11px] text-[#CDC6B8]">{off.description}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-4 rounded-lg border border-[#574239]/45 bg-[#1B2021] p-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-[#DFE3E4]">
                  Departamento base
                  <select
                    value={targetDepartment}
                    onChange={(e) => {
                      const nextDept = e.target.value as DepartmentId;
                      setTargetDepartment(nextDept);
                      const found = DEPARTMENTS_DATA.find((d) => d.id === nextDept);
                      if (found?.sampleMunicipalities[0]) {
                        setTargetMunicipality(found.sampleMunicipalities[0]);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                  >
                    {DEPARTMENTS_DATA.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} (Cap. {d.capital} · {d.population2023.toLocaleString('es-UY')} hab.)
                      </option>
                    ))}
                  </select>
                </label>

                {targetOffice === 'alcalde' ? (
                  <label className="block text-xs font-semibold text-[#DFE3E4]">
                    Municipio objetivo ({activeDeptData.municipalitiesCount} en el departamento)
                    <select
                      value={targetMunicipality}
                      onChange={(e) => setTargetMunicipality(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-sm text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                    >
                      {activeDeptData.sampleMunicipalities.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <div className="text-xs text-[#CDC6B8]">
                    <div className="font-bold text-[#DFE3E4]">Perfil de {activeDeptData.name}</div>
                    <div className="mt-1">
                      Intendencia actual: {activeDeptData.currentIntendenteName} · {activeDeptData.baselineDeputies} Diputados base.
                    </div>
                    <div className="mt-1 font-medium text-[#ACCEBF]">
                      {activeDeptData.economicProfile.join(' · ')}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-[#557568]/50 bg-[#557568]/15 p-3.5 text-xs text-[#DFE3E4]">
                <strong className="text-[#ACCEBF]">Regla institucional:</strong> comenzás la partida como aspirante/candidato sin cargo público. Primero debés hacer campaña mes a mes, disputar las elecciones del calendario constitucional y ganar en las urnas para desbloquear las atribuciones del cargo.
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Barra única de navegación entre pasos (Desktop y Móvil) */}
      <div className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-[#574239]/55 bg-[#0A0F10]/95 px-3.5 py-2.5 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-2.5">
          {step > 1 ? (
            <button
              onClick={() => setStep((step - 1) as 1 | 2 | 3 | 4)}
              className="min-h-[46px] rounded-lg border border-[#574239]/60 bg-[#1B2021] px-4 py-2 text-xs font-semibold text-[#DFE3E4] hover:border-[#FFB691]"
            >
              Atrás
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="min-h-[46px] rounded-lg border border-[#574239]/60 bg-[#1B2021] px-4 py-2 text-xs font-semibold text-[#CDC6B8] hover:border-[#FFB691]"
            >
              Inicio
            </button>
          )}

          {step < 4 ? (
            <button
              onClick={() => setStep((step + 1) as 1 | 2 | 3 | 4)}
              className="executive-action-btn inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold sm:flex-none sm:px-7"
            >
              Siguiente ({step}/4)
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleCreateGame}
              className="executive-action-btn inline-flex min-h-[46px] flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold sm:flex-none sm:px-7"
            >
              <Shield className="h-4 w-4" />
              Iniciar carrera política
              <Check className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="hidden pb-20 sm:block">
        <CreditsFooter variant="dark" />
      </div>
    </div>
  );
};
