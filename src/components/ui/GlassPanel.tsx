import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { IOS_SPRING, iosCardTap } from '../../utils/iosSprings';

interface GlassPanelProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
}

export const GlassPanel: React.FC<GlassPanelProps> = ({ children, className = '', interactive = false, ...props }) => {
  return (
    <motion.div
      whileHover={interactive ? { scale: 1.01, y: -2, transition: IOS_SPRING } : undefined}
      whileTap={interactive ? iosCardTap : undefined}
      className={`relative overflow-hidden rounded-3xl border border-[#574239]/50 bg-[#171C1D]/80 p-5 shadow-2xl backdrop-blur-2xl transition-colors hover:border-[#E87532]/60 ${className}`}
      {...props}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.04] via-transparent to-black/[0.15] pointer-events-none" />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};
