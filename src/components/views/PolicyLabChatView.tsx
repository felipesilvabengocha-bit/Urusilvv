import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Lock,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { LEGAL_INSTRUMENT_LABELS } from '../../data/policyCatalog';
import { MONTH_NAMES } from '../../data/uruguayData';
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
  NationalBudgetCategory,
  PublicPolicyDraft,
} from '../../types/game';

interface PolicyLabChatViewProps {
  gameState: GameState;
  onUpdateState: (next: GameState) => void;
  hideActiveSection?: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  clarifyingQuestions?: string[];
}

const SUGGESTED_PROMPTS = [
  'Crear programa de subsidios a la contratación de jóvenes de 18 a 25 años financiado con recorte de gastos administrativos.',
  'Plan de inversión en riego agropecuario y energía verde en el interior por 24 meses financiado con bonos verdes y ajuste menor de IRAE.',
  'Plan de becas escolares y conectividad UTEC en barrios vulnerables para reducir deserción educativa.',
];

export const POLICY_AREA_LABELS: Record<NationalBudgetCategory, string> = {
  educacion: 'Educación (MEC / ANEP / Udelar)',
  salud: 'Salud Pública (MSP / ASSE)',
  seguridad: 'Seguridad Pública (MI)',
  jubilaciones: 'Jubilaciones y Pensiones (BPS)',
  desarrollo_social: 'Desarrollo e Inclusión Social (MIDES)',
  infraestructura: 'Infraestructura, Puertos y Energía (MTOP / MIEM)',
  transporte: 'Transporte y Logística (MTOP)',
  vivienda: 'Vivienda y Ordenamiento Territorial (MVOT)',
  ciencia_tecnologia: 'Ciencia, Tecnología e Innovación (ANII)',
  desarrollo_productivo: 'Desarrollo Productivo, Agro e Industria (MGAP / MIEM)',
  cultura: 'Cultura y Deporte (MEC)',
  medioambiente: 'Medio Ambiente y Agua (MA)',
  defensa: 'Defensa Nacional (MDN)',
  relaciones_exteriores: 'Relaciones Exteriores (MRREE)',
  administracion: 'Economía, Administración y Org. Art. 220 (MEF / OPP)',
  intereses_otros: 'Servicio de Deuda y Obligaciones Financieras',
};

export const PolicyLabChatView: React.FC<PolicyLabChatViewProps> = ({
  gameState,
  onUpdateState,
  hideActiveSection = false,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Soy el equipo técnico OPP / MEF. Describí libremente la política pública que querés diseñar (objetivo, instrumento, financiamiento y plazo). Analizo su impacto fiscal, macroeconómico y externalidades antes de promulgarla o enviarla al Parlamento.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<PublicPolicyDraft | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const caps = getPlayerCapabilities(gameState);
  const canEnactExecutive = caps.canSignPresidentialDecrees;
  const canSubmitBills = caps.canIntroduceNationalBills;
  const activePolicies = gameState.activePolicies ?? [];

  const handleSend = async (customText?: string) => {
    const text = (customText ?? input).trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    if (!customText) setInput('');
    setLoading(true);
    setErrorMsg(null);

    try {
      const m = gameState.macro;
      const summary = {
        currentDate: `${MONTH_NAMES[gameState.currentMonth - 1]} ${gameState.currentYear}`,
        office: caps.currentOfficeTitle,
        gdpGrowthPct: m.gdpGrowthPct,
        inflationPct: m.inflationPct,
        unemploymentPct: m.unemploymentPct,
        employmentRatePct: m.employmentRatePct,
        povertyPct: m.povertyPct,
        giniIndex: m.giniIndex,
        fiscalDeficitPctGdp: m.fiscalDeficitPctGdp,
        grossDebtPctGdp: m.grossDebtPctGdp,
        revenuePctGdp: m.revenuePctGdp,
        spendingPctGdp: m.spendingPctGdp,
        countryRiskBps: m.countryRiskBps,
        activePoliciesCount: activePolicies.filter((p) => p.status !== 'finalizada' && p.status !== 'derogada').length,
      };

      const resp = await fetch('/api/policies/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages.map((x) => ({ role: x.role, content: x.content })),
          gameStateSummary: summary,
          currentDraft: draft,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || 'Error al analizar la política pública.');
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.assistantReply || 'Análisis completado.',
          clarifyingQuestions: Array.isArray(data.clarifyingQuestions) ? data.clarifyingQuestions : [],
        },
      ]);

      if (data.policyDraft) {
        setDraft(data.policyDraft as PublicPolicyDraft);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de comunicación con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnactPolicy = () => {
    if (!draft) return;
    const res = enactPublicPolicy(gameState, draft);
    setActionNotice(res.message);
    if (res.ok) {
      onUpdateState(res.nextState);
      setDraft(null);
    }
  };

  const handleRepealPolicy = (policyId: string) => {
    const res = repealPublicPolicy(gameState, policyId);
    setActionNotice(res.message);
    if (res.ok) {
      onUpdateState(res.nextState);
    }
  };

  const draftCheck = draft ? validatePolicyEligibility(gameState, draft) : { eligible: false };

  return (
    <div className="space-y-5 animate-editorial-in">
      {!canEnactExecutive && !canSubmitBills && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#E87532]/45 bg-[#E87532]/12 p-4 text-xs text-[#DFE3E4]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-[#FFB691]" />
          <div>
            <strong className="text-[#FFB691]">Modo Análisis Programático:</strong> {caps.lockReasons.nationalBudget} Podés diseñar borradores técnicos, pero la promulgación exige ejercer la Presidencia o iniciativa legislativa.
          </div>
        </div>
      )}

      {!canEnactExecutive && canSubmitBills && (
        <div className="flex items-start gap-2.5 rounded-xl border border-[#557568]/45 bg-[#557568]/15 p-3.5 text-xs text-[#DFE3E4]">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#ACCEBF]" />
          <div>
            <strong className="text-[#ACCEBF]">Iniciativa Parlamentaria Habilitada:</strong> Como {caps.currentOfficeTitle} podés presentar propuestas con rango de <em>Proyecto de Ley</em> para su trámite bicameral en el Parlamento.
          </div>
        </div>
      )}

      {actionNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-[#ACCEBF]/50 bg-[#1B2021] px-4 py-3 text-xs font-semibold text-[#ACCEBF]">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-12">
        {/* Chat Conversacional con OPP / MEF */}
        <section className="warroom-surface flex flex-col rounded-xl p-4 sm:p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[#574239]/40 pb-3">
            <div>
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#FFB691]">
                Laboratorio Técnico OPP / MEF
              </div>
              <h2 className="mt-0.5 flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <Sparkles className="h-4 w-4 text-[#E87532]" />
                Diseñador Avanzado de Políticas Públicas
              </h2>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((sp, i) => (
              <button
                key={i}
                onClick={() => handleSend(sp)}
                disabled={loading}
                className="rounded-lg border border-[#574239]/50 bg-[#1B2021] px-2.5 py-1.5 text-left text-[11px] text-[#CDC6B8] transition hover:border-[#E87532] hover:text-white disabled:opacity-50"
              >
                Idea {i + 1}: {sp.slice(0, 48)}...
              </button>
            ))}
          </div>

          <div className="mt-3 max-h-[360px] flex-1 space-y-2.5 overflow-y-auto rounded-xl border border-[#574239]/40 bg-[#0A0F10] p-3">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'ml-6 border border-[#E87532]/40 bg-[#E87532]/14 text-[#DFE3E4]'
                    : 'mr-6 border border-[#574239]/40 bg-[#171C1D] text-[#CDC6B8]'
                }`}
              >
                <div className="mb-1 font-mono-data text-[9px] font-bold uppercase tracking-wider text-[#FFB691]">
                  {m.role === 'user' ? gameState.player.name : 'Mesa Técnica OPP / MEF'}
                </div>
                <p>{m.content}</p>
                {m.clarifyingQuestions && m.clarifyingQuestions.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-[#574239]/35 pt-2 text-[11px] text-[#ACCEBF]">
                    {m.clarifyingQuestions.map((q, qi) => (
                      <li key={qi}>• {q}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 p-2 text-xs text-[#FFB691]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Modelando impacto macroeconómico y fiscal...
              </div>
            )}
          </div>

          {errorMsg && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-950/30 p-2.5 text-xs text-rose-300">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describí objetivo, instrumento, financiamiento y plazo..."
              className="flex-1 rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2.5 text-xs text-[#DFE3E4] focus:border-[#E87532] focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="executive-action-btn inline-flex min-h-[42px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              Enviar
            </button>
          </div>
        </section>

        {/* Ficha Estructurada Editable */}
        <section className="warroom-surface rounded-xl p-4 sm:p-5 lg:col-span-6">
          <div className="flex items-center justify-between border-b border-[#574239]/40 pb-3">
            <div>
              <div className="font-mono-data text-[10px] font-bold uppercase tracking-widest text-[#ACCEBF]">
                Dictamen Estructural
              </div>
              <h3 className="mt-0.5 flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
                <FileCheck2 className="h-4 w-4 text-[#ACCEBF]" />
                Ficha de Política Pública
              </h3>
            </div>
            {draft && (
              <button
                onClick={() => setDraft(null)}
                className="inline-flex items-center gap-1 rounded border border-[#574239]/60 px-2.5 py-1 text-[11px] text-[#CDC6B8] hover:text-white"
              >
                <Trash2 className="h-3 w-3" /> Descartar
              </button>
            )}
          </div>

          {!draft ? (
            <div className="mt-6 rounded-xl border border-dashed border-[#574239]/55 bg-[#1B2021]/60 p-6 text-center text-xs text-[#CDC6B8]">
              Conversá con el asesor OPP/MEF para estructurar una propuesta. Cuando esté definida, aquí podrás revisar costos, plazos, externalidades y promulgarla.
            </div>
          ) : (
            <div className="mt-3 space-y-3 text-xs">
              <label className="block">
                <span className="text-[11px] font-semibold text-[#DEC1B4]">Título de la política</span>
                <input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs font-bold text-[#DFE3E4]"
                />
              </label>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#DEC1B4]">Cartera ejecutora</span>
                  <select
                    value={draft.ministryArea}
                    onChange={(e) => setDraft({ ...draft, ministryArea: e.target.value as NationalBudgetCategory })}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                  >
                    {Object.entries(POLICY_AREA_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[11px] font-semibold text-[#DEC1B4]">Instrumento jurídico</span>
                  <select
                    value={draft.legalInstrument ?? 'decreto_pe'}
                    onChange={(e) => setDraft({ ...draft, legalInstrument: e.target.value as LegalInstrumentType })}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-2.5 py-2 text-xs text-[#DFE3E4]"
                  >
                    {Object.entries(LEGAL_INSTRUMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#DEC1B4]">Financiamiento</span>
                  <input
                    value={draft.financingSource}
                    onChange={(e) => setDraft({ ...draft, financingSource: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 text-xs text-[#DFE3E4]"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-[#DEC1B4]">Vigencia (meses)</span>
                  <input
                    type="number"
                    min={6}
                    max={60}
                    value={draft.timelineMonths}
                    onChange={(e) =>
                      setDraft({ ...draft, timelineMonths: Math.max(6, Math.min(60, Number(e.target.value) || 12)) })
                    }
                    className="mt-1 w-full rounded-lg border border-[#574239]/60 bg-[#0A0F10] px-3 py-2 font-mono-data text-xs text-[#DFE3E4]"
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                  <div className="text-[10px] text-[#CDC6B8]">Costo Fiscal</div>
                  <div className="font-mono-data font-bold text-[#FFB691]">
                    {(draft.estimatedEffects.fiscalCostPctGdp ?? 0).toFixed(2)}% PIB
                  </div>
                </div>
                <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                  <div className="text-[10px] text-[#CDC6B8]">Retorno Fiscal</div>
                  <div className="font-mono-data font-bold text-[#ACCEBF]">
                    +{(draft.estimatedEffects.expectedRevenuePctGdp ?? 0).toFixed(2)}% PIB
                  </div>
                </div>
                <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                  <div className="text-[10px] text-[#CDC6B8]">PIB est.</div>
                  <div className="font-mono-data font-bold text-[#DFE3E4]">
                    {(draft.estimatedEffects.gdpDelta ?? 0) >= 0 ? '+' : ''}
                    {(draft.estimatedEffects.gdpDelta ?? 0).toFixed(2)}%
                  </div>
                </div>
                <div className="rounded-lg border border-[#574239]/40 bg-[#1B2021] p-2">
                  <div className="text-[10px] text-[#CDC6B8]">Desempleo est.</div>
                  <div className="font-mono-data font-bold text-[#DFE3E4]">
                    {(draft.estimatedEffects.unemploymentDelta ?? 0) >= 0 ? '+' : ''}
                    {(draft.estimatedEffects.unemploymentDelta ?? 0).toFixed(2)}%
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5">
                  <div className="font-mono-data text-[10px] font-bold uppercase text-emerald-300">
                    Externalidades Positivas
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-[#DFE3E4]">
                    {draft.positiveExternalities.slice(0, 3).map((x, i) => (
                      <li key={i}>• {x}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 p-2.5">
                  <div className="font-mono-data text-[10px] font-bold uppercase text-[#FFB691]">
                    Riesgos / Externalidades Negativas
                  </div>
                  <ul className="mt-1 space-y-0.5 text-[11px] text-[#DFE3E4]">
                    {draft.negativeExternalities.slice(0, 3).map((x, i) => (
                      <li key={i}>• {x}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {!draftCheck.eligible && draftCheck.reason && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-950/20 px-3 py-2 text-[11px] text-[#FFB691]">
                  {draftCheck.reason}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#574239]/40 pt-3">
                <div className="font-mono-data text-[11px] text-[#DEC1B4]">
                  Costo: <strong className="text-[#FFB691]">{draft.politicalCapitalCost} CP</strong> ·{' '}
                  <strong className="text-[#ACCEBF]">${(draft.moneyCostUYU / 1000).toLocaleString('es-UY')} mil UYU</strong>
                </div>
                <button
                  onClick={handleEnactPolicy}
                  disabled={!draftCheck.eligible}
                  className="executive-action-btn inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-45"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {isLegislativeInstrument(draft.legalInstrument)
                    ? 'Remitir al Parlamento'
                    : 'Promulgar Política'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Políticas Activas: Estimado vs Observado */}
      {!hideActiveSection && (
        <section className="warroom-surface rounded-xl p-5">
          <div className="flex items-center justify-between border-b border-[#574239]/40 pb-3">
            <h3 className="flex items-center gap-2 font-display text-lg font-bold text-[#DFE3E4]">
              <TrendingUp className="h-4 w-4 text-[#E87532]" />
              Políticas Públicas Vigentes ({activePolicies.length}) — Estimado vs. Observado
            </h3>
          </div>

          {activePolicies.length === 0 ? (
            <p className="mt-3 text-xs text-[#CDC6B8]">
              No promulgaste políticas públicas personalizadas aún. Usá el Diseñador OPP/MEF superior para crear medidas económicas o sociales.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {activePolicies.map((pol) => (
                <div key={pol.id} className="rounded-xl border border-[#574239]/45 bg-[#1B2021] p-4 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-[#DFE3E4]">{pol.title}</div>
                      <div className="font-mono-data text-[10px] text-[#FFB691]">
                        {POLICY_AREA_LABELS[pol.ministryArea]} · Mes {pol.activeMonths}/{pol.timelineMonths} · {pol.status}
                      </div>
                    </div>
                    {(pol.status === 'en_implementacion' || pol.status === 'vigente') && canEnactExecutive && (
                      <button
                        onClick={() => handleRepealPolicy(pol.id)}
                        className="rounded border border-[#574239]/60 px-2 py-1 text-[10px] text-rose-300 hover:bg-rose-950/40"
                      >
                        Derogar
                      </button>
                    )}
                  </div>

                  <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-lg bg-[#0A0F10] p-2 font-mono-data text-[10px]">
                    <div>
                      <span className="text-[#CDC6B8]">PIB est/obs:</span>
                      <div className="font-bold text-[#DFE3E4]">
                        {(pol.estimatedEffects.gdpDelta ?? 0).toFixed(2)}% / {pol.observedEffects.gdpImpactAcc.toFixed(2)}%
                      </div>
                    </div>
                    <div>
                      <span className="text-[#CDC6B8]">Pobreza obs:</span>
                      <div className="font-bold text-[#ACCEBF]">{pol.observedEffects.povertyImpactAcc.toFixed(2)}%</div>
                    </div>
                    <div>
                      <span className="text-[#CDC6B8]">Saldo fiscal:</span>
                      <div className="font-bold text-[#FFB691]">{pol.observedEffects.fiscalNetAcc.toFixed(2)}% PIB</div>
                    </div>
                  </div>

                  {(pol.synergies.length > 0 || pol.conflicts.length > 0) && (
                    <div className="mt-2 space-y-0.5 text-[11px]">
                      {pol.synergies.map((s, idx) => (
                        <div key={idx} className="text-emerald-300">✓ {s}</div>
                      ))}
                      {pol.conflicts.map((c, idx) => (
                        <div key={idx} className="text-amber-300">⚠ {c}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
