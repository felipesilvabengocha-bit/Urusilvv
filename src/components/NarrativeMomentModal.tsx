import React, { useState } from 'react';
import { ArrowRight, Newspaper, X } from 'lucide-react';
import { VISUAL_ASSETS } from '../data/visualAssets';
import { NarrativeMoment } from '../types/game';

interface NarrativeMomentModalProps {
  moment: NarrativeMoment;
  onDismiss: () => void;
}

export const NarrativeMomentModal: React.FC<NarrativeMomentModalProps> = ({ moment, onDismiss }) => {
  const [imgError, setImgError] = useState(false);
  const imgSrc = VISUAL_ASSETS[moment.imageKey] ?? VISUAL_ASSETS.ceremonyPalacio;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#0A0F10]/85 p-0 backdrop-blur-xs sm:items-center sm:p-6">
      <article className="animate-editorial-in safe-bottom max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#574239]/70 bg-[#171C1D] text-[#DFE3E4] shadow-2xl sm:rounded-xl">
        {/* Indicador táctil móvil */}
        <div className="flex justify-center bg-[#0A0F10] pt-2 sm:hidden">
          <span className="h-1 w-10 rounded-full bg-[#574239]" />
        </div>

        {/* Cabecera de crónica oficial */}
        <header className="border-b border-[#574239]/55 bg-[#0A0F10] px-4 py-3 text-[#DFE3E4] sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-mono-data text-[10px] uppercase tracking-[0.14em] text-[#FFB691] sm:text-[11px]">
              <Newspaper className="h-4 w-4 shrink-0 text-[#E87532]" />
              <span className="truncate">{moment.newspaperName}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono-data text-[10px] text-[#CDC6B8] sm:text-[11px]">{moment.dateLabel}</span>
              <button
                onClick={onDismiss}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#CDC6B8] transition hover:bg-[#262B2C] hover:text-[#DFE3E4]"
                aria-label="Cerrar portada"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Imagen institucional */}
        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-[#574239]/55 bg-[#0A0F10]">
          {!imgError ? (
            <img
              src={imgSrc}
              alt={moment.headline}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="h-full w-full object-cover contrast-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#0A0F10] p-6 text-center text-sm text-[#CDC6B8]">
              Crónica Gráfica Institucional · República Oriental del Uruguay
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0F10]/95 to-transparent" />
          <div className="absolute bottom-2.5 left-4 right-4 flex items-center justify-between gap-2 font-mono-data text-[10px] font-semibold uppercase tracking-[0.12em] text-[#DFE3E4] sm:left-5 sm:right-5 sm:text-[11px]">
            <span>{moment.kicker}</span>
            <span className="hidden rounded border border-[#E87532]/60 bg-[#0A0F10]/85 px-2 py-0.5 text-[9px] text-[#FFB691] sm:inline">
              EDICIÓN OFICIAL
            </span>
          </div>
        </div>

        {/* Cuerpo editorial */}
        <div className="space-y-4 p-4 sm:p-7">
          <h2 className="font-display text-2xl font-semibold leading-tight text-[#DFE3E4] sm:text-3xl [text-wrap:balance]">
            {moment.headline}
          </h2>
          <p className="text-sm font-semibold leading-snug text-[#DEC1B4] sm:text-base">
            {moment.subheadline}
          </p>

          <div className="border-y border-[#574239]/40 py-0.5">
            <div className="h-px w-full bg-[#574239]/40" />
          </div>

          <p className="newspaper-dropcap text-sm leading-relaxed text-[#CDC6B8]">{moment.bodyText}</p>

          {moment.quoteText && (
            <blockquote className="rounded-lg border border-[#574239]/45 bg-[#1B2021] px-4 py-3 font-display text-sm italic text-[#E9E2D4]">
              {moment.quoteText}
            </blockquote>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onDismiss}
              className="executive-action-btn inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold transition active:scale-[0.99] sm:w-auto"
            >
              Continuar la partida
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
};
