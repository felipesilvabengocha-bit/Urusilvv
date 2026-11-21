import React from 'react';
import { motion } from 'framer-motion';
import { GlassPanel } from './GlassPanel';

interface LiveMetricWidgetProps {
  label: string;
  value: string | number;
  changeLabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ComponentType<{ className?: string }>;
  colorAccent?: string;
}

export const LiveMetricWidget: React.FC<LiveMetricWidgetProps> = ({
  label,
  value,
  changeLabel,
  trend = 'neutral',
  icon: Icon,
  colorAccent = '#E87532',
}) => {
  return (
    <GlassPanel interactive className="flex flex-col gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono-data text-[10px] uppercase tracking-wider text-[#CDC6B8]">
          {label}
        </span>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-black/30 shadow-inner"
          style={{ color: colorAccent }}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-2">
        <motion.span
          key={String(value)}
          initial={{ opacity: 0, y: 4, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="font-display text-2xl font-bold tracking-tight text-[#DFE3E4]"
        >
          {value}
        </motion.span>
        {changeLabel && (
          <span
            className={`font-mono-data text-[10px] font-semibold ${
              trend === 'up'
                ? 'text-[#ACCEBF]'
                : trend === 'down'
                ? 'text-[#FFB4AB]'
                : 'text-[#CDC6B8]'
            }`}
          >
            {changeLabel}
          </span>
        )}
      </div>
    </GlassPanel>
  );
};
