import React from 'react';

export const EC = {
  surface: 'warroom-surface rounded-xl p-4',
  border: 'border-[#574239]/40',
  text: 'text-[#DFE3E4]',
  muted: 'text-[#CDC6B8]',
  accent: 'text-[#FFB691]',
  green: 'text-[#ACCEBF]',
  gold: 'text-[#E8C57A]',
  danger: 'text-[#F08A7E]',
};

export const Meter: React.FC<{ value: number; tone?: 'good' | 'warn' | 'bad'; className?: string }> = ({
  value,
  tone = 'good',
  className = '',
}) => {
  const color =
    tone === 'bad' ? 'bg-[#C25A4E]' : tone === 'warn' ? 'bg-[#D9A441]' : 'bg-[#6FA98F]';
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-[#262B2C] ${className}`}>
      <div
        className={`h-full rounded-full ${color} transition-[width] duration-700 ease-out`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
};

export const Pill: React.FC<{
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'accent';
}> = ({ children, tone = 'neutral' }) => {
  const map = {
    neutral: 'border-[#574239]/60 bg-[#262B2C] text-[#CDC6B8]',
    good: 'border-[#557568]/60 bg-[#557568]/18 text-[#ACCEBF]',
    warn: 'border-[#D9A441]/50 bg-[#D9A441]/12 text-[#E8C57A]',
    bad: 'border-[#C25A4E]/55 bg-[#C25A4E]/14 text-[#F08A7E]',
    accent: 'border-[#E87532]/55 bg-[#E87532]/14 text-[#FFB691]',
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono-data text-[10px] font-bold uppercase tracking-wide ${map[tone]}`}
    >
      {children}
    </span>
  );
};

export const Btn: React.FC<{
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
  title?: string;
  className?: string;
}> = ({ children, onClick, disabled, tone = 'ghost', title, className = '' }) => {
  const styles =
    tone === 'primary'
      ? 'bg-[#E87532] text-[#511E00] hover:bg-[#F08A3E]'
      : tone === 'danger'
      ? 'border border-[#C25A4E]/50 bg-[#C25A4E]/12 text-[#F08A7E] hover:bg-[#C25A4E]/20'
      : 'border border-[#574239]/60 bg-[#262B2C] text-[#DFE3E4] hover:border-[#E87532]/50 hover:bg-[#2E3435]';
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-[32px] items-center justify-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  );
};

export const EcoCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, right, children, className = '' }) => (
  <section className={`${EC.surface} animate-fade-in-up ${className}`}>
    <div className={`flex flex-wrap items-start justify-between gap-2 border-b ${EC.border} pb-2`}>
      <div className="min-w-0">
        <h3 className={`flex items-center gap-1.5 font-display text-sm font-bold ${EC.text}`}>
          {icon}
          {title}
        </h3>
        {subtitle && <p className={`mt-0.5 text-[11px] ${EC.muted}`}>{subtitle}</p>}
      </div>
      {right}
    </div>
    <div className="mt-2.5 space-y-2.5">{children}</div>
  </section>
);

export const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className={`rounded-lg border border-dashed ${EC.border} px-3 py-2 text-[11px] ${EC.muted}`}>
    {children}
  </p>
);

export const Row: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={`rounded-lg border ${EC.border} bg-[#1B2021] px-2.5 py-2 transition hover:border-[#E87532]/35 ${className}`}
  >
    {children}
  </div>
);

export const toneFor = (value: number): 'good' | 'warn' | 'bad' =>
  value >= 62 ? 'good' : value >= 38 ? 'warn' : 'bad';
