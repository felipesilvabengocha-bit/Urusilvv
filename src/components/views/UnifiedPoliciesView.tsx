import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileText,
  Filter,
  Gavel,
  Landmark,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  LEGAL_INSTRUMENT_LABELS,
  ORIENTATION_LABELS,
  POLICY_CATALOG,
  POLICY_CATEGORIES,
} from '../../data/policyCatalog';
import { getPlayerCapabilities } from '../../engine/capabilitiesEngine';
import {
  enactPublicPolicy,
  isLegislativeInstrument,
  repealPublicPolicy,
  validatePolicyEligibility,
} from '../../engine/policyEngine';
import {
  GameState,
  LegalInstrumentType,
  PolicyCategoryCode,
  PolicyOrientation,
  PublicPolicyDraft,
} from '../../types/game';
import { POLICY_AREA_LABELS, PolicyLabChatView } from './PolicyLabChatView';

interface UnifiedPoliciesViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
}

type PoliciesSubTab = 'catalogo' | 'laboratorio' | 'activas';

export const UnifiedPoliciesView: React.FC<UnifiedPoliciesViewProps> = ({
  gameState,
  onUpdateState,
}) => {
  const [subTab, setSubTab] = useState<PoliciesSubTab>('catalogo');
  const [selectedCat, setSelectedCat] = useState<PolicyCategoryCode | 'ALL'>('ALL');
  const [orientationFilter, setOrientationFilter] = useState<PolicyOrientation | 'ALL'>('ALL');
  const [instrumentFilter, setInstrumentFilter] = useState<LegalInstrumentType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>(POLICY_CATALOG[0]?.id ?? '');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const caps = getPlayerCapabilities(gameState);
  const activePolicies = gameState.activePolicies ?? [];
  const runningCount = activePolicies.filter(
    (p) => p.status === 'en_implementacion' || p.status === 'vigente' || p.status === 'en_tramite_parlamentario'
  ).length;

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return POLICY_CATALOG.filter((pol) => {
      if (selectedCat !== 'ALL' && pol.categoryCode !== selectedCat) return false;
      if (orientationFilter !== 'ALL' && pol.orientation !== orientationFilter) return false;
      if (instrumentFilter !== 'ALL' && pol.legalInstrument !== instrumentFilter) return false;
      if (q) {
        const hay = `${pol.code ?? ''} ${pol.title} ${pol.summary} ${pol.responsibleBody ?? ''} ${pol.beneficiaries}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [selectedCat, orientationFilter, instrumentFilter, searchQuery]);

  const selectedPolicy: PublicPolicyDraft | undefined = useMemo(() => {
    return (
      filteredCatalog.find((p) => p.id === selectedPolicyId) ??
      filteredCatalog[0] ??
      POLICY_CATALOG[0]
    );
  }, [filteredCatalog, selectedPolicyId]);

  const activeCategoryMeta =
    selectedCat === 'ALL'
      ? null
      : POLICY_CATEGORIES.find((c) => c.code === selectedCat) ?? null;

  const handleEnactFromCatalog = (draft: PublicPolicyDraft) => {
    const res = enactPublicPolicy(gameState, draft);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      onUpdateState(res.nextState);
    }
  };

  const handleRepeal = (policyId: string) => {
    const res = repealPublicPolicy(gameState, policyId);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      onUpdateState(res.nextState);
    }
  };

  const eligibility = selectedPolicy
    ? validatePolicyEligibility(gameState, selectedPolicy)
    : { eligible: false, reason: '' };

  const activeStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of activePolicies) {
      if (p.code) map.set(p.code, p.status);
      map.set(p.title.toLowerCase(), p.status);
    }
    return map;
  }, [activePolicies]);

  return (
    <div className="space-y-4">
      {/* Sub-pestañas dentro de Gobierno > POLÍTICAS */}
      <div className="warroom-surface flex flex-wrap items-center justify-between gap-3 rounded-xl p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSubTab('catalogo')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
              subTab === 'catalogo'
                ? 'bg-[#E87532] text-[#511E00]'
                : 'bg-[#1B2021] text-[#DEC1B4] hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            Catálogo Jurídico A–J ({POLICY_CATALOG.length})
          </button>
          <button
            onClick={() => setSubTab('laboratorio')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
              subTab === 'laboratorio'
                ? 'bg-[#E87532] text-[#511E00]'
                : 'bg-[#1B2021] text-[#DEC1B4] hover:text-white'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Laboratorio OPP/MEF (IA)
          </button>
          <button
            onClick={() => setSubTab('activas')}
            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-lg px-3.5 py-1.5 font-mono-data text-xs font-bold transition ${
              subTab === 'activas'
                ? 'bg-[#E87532] text-[#511E00]'
                : 'bg-[#1B2021] text-[#DEC1B4] hover:text-white'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            Activas y En Trámite ({runningCount}/{activePolicies.length})
          </button>
        </div>

        <div className="font-mono-data text-[11px] text-[#CDC6B8]">
          Disponibles:{' '}
          <strong className="text-[#FFB691]">{Math.round(gameState.player.politicalCapital)} CP</strong> ·{' '}
          <strong className="text-[#ACCEBF]">
            ${Math.round(gameState.player.campaignFundsUYU / 1000).toLocaleString('es-UY')} mil UYU
          </strong>
        </div>
      </div>

      {feedback && (
        <div
          className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${
            feedback.ok
              ? 'border-[#ACCEBF]/50 bg-[#1B2021] text-[#ACCEBF]'
              : 'border-amber-500/50 bg-amber-950/30 text-[#FFB691]'
          }`}
        >
          {feedback.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* SUB-TAB 1: CATÁLOGO JURÍDICO A-J */}
      {subTab === 'catalogo' && (
        <div className="space-y-4">
          {/* Selector por Categorías A-J */}
          <section className="warroom-surface space-y-3 rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedCat('ALL')}
                className={`rounded-lg px-2.5 py-1.5 font-mono-data text-[11px] font-bold transition ${
                  selectedCat === 'ALL'
                    ? 'bg-[#E87532] text-[#511E00]'
                    : 'border border-[#574239]/50 bg-[#1B2021] text-[#DEC1B4] hover:border-[#E87532]'
                }`}
              >
                Todas ({POLICY_CATALOG.length})
              </button>
              {POLICY_CATEGORIES.map((cat) => {
                const count = POLICY_CATALOG.filter((p) => p.categoryCode === cat.code).length;
                return (
                  <button
                    key={cat.code}
                    onClick={() => setSelectedCat(cat.code)}
                    title={cat.name}
                    className={`rounded-lg px-2.5 py-1.5 font-mono-data text-[11px] font-bold transition ${
                      selectedCat === cat.code
                        ? 'bg-[#E87532] text-[#511E00]'
                        : 'border border-[#574239]/50 bg-[#1B2021] text-[#DEC1B4] hover:border-[#E87532]'
                    }`}
                  >
                    {cat.code} ({count})
                  </button>
                );
              })}
            </div>

            {activeCategoryMeta && (
              <div className="rounded-lg border border-[#574239]/40 bg-[#0A0F10] px-3 py-2 text-xs">
                <strong className="text-[#FFB691]">
                  Categoría {activeCategoryMeta.code} — {activeCategoryMeta.name}:
                </strong>{' '}
                <span className="text-[#CDC6B8]">{activeCategoryMeta.description}</span>
              </div>
            )}

            {/* Filtros avanzados */}
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="relative flex items-center">
                <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#CDC6B8]" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar código, título u organismo..."
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] py-2 pl-8 pr-3 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
                />
              </label>

              <label className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 shrink-0 text-[#FFB691]" />
                <select
                  value={orientationFilter}
                  onChange={(e) => setOrientationFilter(e.target.value as PolicyOrientation | 'ALL')}
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                >
                  <option value="ALL">Todas las orientaciones</option>
                  {Object.entries(ORIENTATION_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-1.5">
                <Gavel className="h-3.5 w-3.5 shrink-0 text-[#ACCEBF]" />
                <select
                  value={instrumentFilter}
                  onChange={(e) => setInstrumentFilter(e.target.value as LegalInstrumentType | 'ALL')}
                  className="w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                >
                  <option value="ALL">Todos los instrumentos</option>
                  {Object.entries(LEGAL_INSTRUMENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {/* Grilla Maestro-Detalle del Catálogo */}
          <div className="grid gap-4 lg:grid-cols-12">
            {/* Lista Izquierda */}
            <section className="warroom-surface rounded-xl p-3 lg:col-span-5">
              <div className="mb-2 flex items-center justify-between px-1 font-mono-data text-[10px] font-bold uppercase text-[#DEC1B4]">
                <span>Medidas encontradas ({filteredCatalog.length})</span>
                <span>Seleccioná una ficha</span>
              </div>
              <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                {filteredCatalog.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#574239]/50 p-6 text-center text-xs text-[#CDC6B8]">
                    Ninguna política coincide con los filtros actuales.
                  </div>
                ) : (
                  filteredCatalog.map((pol) => {
                    const isSelected = selectedPolicy?.id === pol.id;
                    const activeSt =
                      (pol.code && activeStatusMap.get(pol.code)) ||
                      activeStatusMap.get(pol.title.toLowerCase());
                    const isLaw = isLegislativeInstrument(pol.legalInstrument);
                    return (
                      <button
                        key={pol.id}
                        onClick={() => setSelectedPolicyId(pol.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          isSelected
                            ? 'border-[#E87532] bg-[#E87532]/15'
                            : 'border-[#574239]/45 bg-[#1B2021] hover:border-[#E87532]/65'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 font-mono-data text-[10px]">
                          <span className="font-bold text-[#FFB691]">
                            {pol.code} · {pol.orientation ? ORIENTATION_LABELS[pol.orientation] : ''}
                          </span>
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              activeSt
                                ? 'bg-[#557568]/35 text-[#ACCEBF]'
                                : isLaw
                                ? 'bg-amber-950/60 text-amber-300'
                                : 'bg-[#0A0F10] text-[#DEC1B4]'
                            }`}
                          >
                            {activeSt
                              ? activeSt.replace(/_/g, ' ')
                              : isLaw
                              ? 'Requiere Ley'
                              : 'Decreto / Ente'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs font-bold text-[#DFE3E4]">{pol.title}</div>
                        <div className="mt-1 flex items-center justify-between font-mono-data text-[10px] text-[#CDC6B8]">
                          <span>{pol.responsibleBody}</span>
                          <span>
                            {pol.politicalCapitalCost} CP · ${(pol.moneyCostUYU / 1000).toLocaleString('es-UY')}k
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </section>

            {/* Dossier Jurídico y Económico Derecho */}
            <section className="warroom-surface rounded-xl p-4 sm:p-5 lg:col-span-7">
              {selectedPolicy ? (
                <div className="space-y-4 text-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#574239]/40 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-mono-data text-[10px] font-bold uppercase">
                        <span className="rounded bg-[#E87532]/25 px-2 py-0.5 text-[#FFB691]">
                          {selectedPolicy.code}
                        </span>
                        <span className="rounded bg-[#1B2021] px-2 py-0.5 text-[#ACCEBF]">
                          {selectedPolicy.orientation
                            ? ORIENTATION_LABELS[selectedPolicy.orientation]
                            : 'General'}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 ${
                            selectedPolicy.riskLevel === 'alto'
                              ? 'bg-rose-950/60 text-rose-300'
                              : selectedPolicy.riskLevel === 'medio'
                              ? 'bg-amber-950/60 text-amber-300'
                              : 'bg-emerald-950/50 text-emerald-300'
                          }`}
                        >
                          Riesgo {selectedPolicy.riskLevel ?? 'medio'}
                        </span>
                      </div>
                      <h3 className="mt-1.5 font-display text-lg font-bold text-[#DFE3E4]">
                        {selectedPolicy.title}
                      </h3>
                      <p className="mt-1 leading-relaxed text-[#CDC6B8]">{selectedPolicy.summary}</p>
                    </div>
                  </div>

                  {/* Arquitectura Jurídica y Competencia */}
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2.5">
                      <div className="flex items-center gap-1 font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">
                        <FileText className="h-3 w-3" /> Instrumento y Competencia
                      </div>
                      <div className="mt-1 font-semibold text-[#DFE3E4]">
                        {selectedPolicy.legalInstrument
                          ? LEGAL_INSTRUMENT_LABELS[selectedPolicy.legalInstrument]
                          : 'Decreto PE'}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#DEC1B4]">
                        {selectedPolicy.requiredCompetence}
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2.5">
                      <div className="flex items-center gap-1 font-mono-data text-[10px] font-bold uppercase text-[#ACCEBF]">
                        <Landmark className="h-3 w-3" /> Organismo y Cartera
                      </div>
                      <div className="mt-1 font-semibold text-[#DFE3E4]">
                        {selectedPolicy.responsibleBody}
                      </div>
                      <div className="mt-0.5 text-[11px] text-[#CDC6B8]">
                        {POLICY_AREA_LABELS[selectedPolicy.ministryArea]}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-[#574239]/40 bg-[#0A0F10] p-3 text-[11px] leading-relaxed text-[#DEC1B4]">
                    <strong className="text-[#DFE3E4]">Base normativa y financiamiento:</strong>{' '}
                    {selectedPolicy.normativeText} · <em>Financiamiento:</em> {selectedPolicy.financingSource}.{' '}
                    <em>Beneficiarios:</em> {selectedPolicy.beneficiaries}.
                  </div>

                  {/* Impactos Inmediatos + Diferidos */}
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                      <div className="text-[10px] text-[#CDC6B8]">PIB (c/maduración)</div>
                      <div className="font-mono-data font-bold text-[#DFE3E4]">
                        {((selectedPolicy.estimatedEffects.gdpDelta ?? 0) + (selectedPolicy.delayedEffects.gdpDelta ?? 0)) >= 0
                          ? '+'
                          : ''}
                        {(
                          (selectedPolicy.estimatedEffects.gdpDelta ?? 0) +
                          (selectedPolicy.delayedEffects.gdpDelta ?? 0)
                        ).toFixed(2)}
                        %
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                      <div className="text-[10px] text-[#CDC6B8]">Desempleo</div>
                      <div className="font-mono-data font-bold text-[#ACCEBF]">
                        {((selectedPolicy.estimatedEffects.unemploymentDelta ?? 0) +
                          (selectedPolicy.delayedEffects.unemploymentDelta ?? 0)) >= 0
                          ? '+'
                          : ''}
                        {(
                          (selectedPolicy.estimatedEffects.unemploymentDelta ?? 0) +
                          (selectedPolicy.delayedEffects.unemploymentDelta ?? 0)
                        ).toFixed(2)}
                        %
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                      <div className="text-[10px] text-[#CDC6B8]">Costo Fiscal</div>
                      <div className="font-mono-data font-bold text-[#FFB691]">
                        {(selectedPolicy.estimatedEffects.fiscalCostPctGdp ?? 0).toFixed(2)}% PIB
                      </div>
                    </div>
                    <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                      <div className="text-[10px] text-[#CDC6B8]">Retorno Fiscal</div>
                      <div className="font-mono-data font-bold text-[#ACCEBF]">
                        +{(selectedPolicy.estimatedEffects.expectedRevenuePctGdp ?? 0).toFixed(2)}% PIB
                      </div>
                    </div>
                  </div>

                  {/* Externalidades y Resistencia Social */}
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                      <div className="font-mono-data text-[10px] font-bold uppercase text-emerald-300">
                        Externalidades Positivas
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-[#DFE3E4]">
                        {selectedPolicy.positiveExternalities.map((x, idx) => (
                          <li key={idx}>• {x}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 p-2.5">
                      <div className="font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">
                        Riesgos y Resistencias ({(selectedPolicy.socialResistance ?? []).join(', ') || 'Ninguna'})
                      </div>
                      <ul className="mt-1 space-y-0.5 text-[11px] text-[#DFE3E4]">
                        {selectedPolicy.negativeExternalities.map((x, idx) => (
                          <li key={idx}>• {x}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {!eligibility.eligible && eligibility.reason && (
                    <div className="rounded-lg border border-[#E87532]/45 bg-[#E87532]/12 px-3 py-2 text-[11px] text-[#FFB691]">
                      {eligibility.reason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/40 pt-3">
                    <div className="font-mono-data text-[11px] text-[#DEC1B4]">
                      Vigencia: <strong>{selectedPolicy.timelineMonths}m</strong> · Costo:{' '}
                      <strong className="text-[#FFB691]">{selectedPolicy.politicalCapitalCost} CP</strong> ·{' '}
                      <strong className="text-[#ACCEBF]">
                        ${(selectedPolicy.moneyCostUYU / 1000).toLocaleString('es-UY')} mil UYU
                      </strong>
                    </div>

                    <button
                      onClick={() => handleEnactFromCatalog(selectedPolicy)}
                      disabled={!eligibility.eligible}
                      className="executive-action-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-45"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {isLegislativeInstrument(selectedPolicy.legalInstrument)
                        ? 'Remitir Proyecto al Parlamento'
                        : 'Promulgar por vía Ejecutiva'}
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LABORATORIO OPP/MEF (GEMINI) */}
      {subTab === 'laboratorio' && (
        <PolicyLabChatView
          gameState={gameState}
          onUpdateState={onUpdateState}
          hideActiveSection
        />
      )}

      {/* SUB-TAB 3: ACTIVAS, EN TRÁMITE Y REZAGOS */}
      {subTab === 'activas' && (
        <section className="warroom-surface space-y-4 rounded-xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#574239]/40 pb-3">
            <div>
              <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <TrendingUp className="h-4 w-4 text-[#E87532]" />
                Registro de Políticas Vigentes y en Trámite ({activePolicies.length})
              </h3>
              <p className="text-xs text-[#CDC6B8]">
                Seguimiento mensual de impacto estimado vs. observado y cola de maduración a 4 horizontes.
              </p>
            </div>
          </div>

          {activePolicies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#574239]/50 p-6 text-center text-xs text-[#CDC6B8]">
              Todavía no promulgaste ni remitiste políticas públicas en este mandato. Elegí una medida en el{' '}
              <button
                onClick={() => setSubTab('catalogo')}
                className="font-bold text-[#FFB691] underline"
              >
                Catálogo Jurídico A–J
              </button>{' '}
              o diseñá una a medida en el{' '}
              <button
                onClick={() => setSubTab('laboratorio')}
                className="font-bold text-[#ACCEBF] underline"
              >
                Laboratorio OPP/MEF
              </button>
              .
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {activePolicies.map((pol) => {
                const linkedBill = pol.linkedBillId
                  ? gameState.bills.find((b) => b.id === pol.linkedBillId)
                  : undefined;
                const pendingPipe = (gameState.effectPipeline ?? []).filter(
                  (e) => e.sourceId === pol.id && !e.applied
                );
                return (
                  <div
                    key={pol.id}
                    className="rounded-xl border border-[#574239]/45 bg-[#1B2021] p-4 text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5 font-mono-data text-[10px]">
                          {pol.code && (
                            <span className="rounded bg-[#E87532]/20 px-1.5 py-0.5 font-bold text-[#FFB691]">
                              {pol.code}
                            </span>
                          )}
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold uppercase ${
                              pol.status === 'vigente' || pol.status === 'en_implementacion'
                                ? 'bg-emerald-950/60 text-emerald-300'
                                : pol.status === 'en_tramite_parlamentario'
                                ? 'bg-amber-950/60 text-amber-300'
                                : 'bg-[#0A0F10] text-[#CDC6B8]'
                            }`}
                          >
                            {pol.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[#DEC1B4]">
                            Mes {pol.activeMonths}/{pol.timelineMonths}
                          </span>
                        </div>
                        <div className="mt-1 font-bold text-[#DFE3E4]">{pol.title}</div>
                        <div className="text-[11px] text-[#CDC6B8]">
                          {POLICY_AREA_LABELS[pol.ministryArea]}
                        </div>
                      </div>

                      {(pol.status === 'en_implementacion' || pol.status === 'vigente') &&
                        caps.canEditNationalBudgetAndFiscal && (
                          <button
                            onClick={() => handleRepeal(pol.id)}
                            className="rounded border border-[#574239]/60 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40"
                          >
                            Derogar
                          </button>
                        )}
                    </div>

                    {linkedBill && (
                      <div className="mt-2 rounded-lg border border-amber-500/35 bg-amber-950/20 px-2.5 py-1.5 font-mono-data text-[10px] text-amber-200">
                        Trámite legislativo: {linkedBill.legislativeStage?.replace(/_/g, ' ') ?? linkedBill.status}
                        {typeof linkedBill.deadlineDaysRemaining === 'number'
                          ? ` (${linkedBill.deadlineDaysRemaining}d restantes)`
                          : ''}
                      </div>
                    )}

                    <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-lg bg-[#0A0F10] p-2 font-mono-data text-[10px]">
                      <div>
                        <span className="text-[#CDC6B8]">PIB est/obs:</span>
                        <div className="font-bold text-[#DFE3E4]">
                          {(pol.estimatedEffects.gdpDelta ?? 0).toFixed(2)}% /{' '}
                          {pol.observedEffects.gdpImpactAcc.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[#CDC6B8]">Pobreza obs:</span>
                        <div className="font-bold text-[#ACCEBF]">
                          {pol.observedEffects.povertyImpactAcc.toFixed(2)}%
                        </div>
                      </div>
                      <div>
                        <span className="text-[#CDC6B8]">Saldo fiscal:</span>
                        <div className="font-bold text-[#FFB691]">
                          {pol.observedEffects.fiscalNetAcc.toFixed(2)}% PIB
                        </div>
                      </div>
                    </div>

                    {pendingPipe.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1 font-mono-data text-[10px] text-[#DEC1B4]">
                        {pendingPipe.map((pItem) => (
                          <span
                            key={pItem.id}
                            className="rounded border border-[#574239]/40 bg-[#0A0F10] px-1.5 py-0.5"
                          >
                            {pItem.horizon}: {pItem.remainingMonths}m
                          </span>
                        ))}
                      </div>
                    )}

                    {(pol.synergies.length > 0 || pol.conflicts.length > 0) && (
                      <div className="mt-2 space-y-0.5 text-[11px]">
                        {pol.synergies.map((s, idx) => (
                          <div key={idx} className="text-emerald-300">
                            ✓ {s}
                          </div>
                        ))}
                        {pol.conflicts.map((c, idx) => (
                          <div key={idx} className="text-amber-300">
                            ⚠ {c}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
