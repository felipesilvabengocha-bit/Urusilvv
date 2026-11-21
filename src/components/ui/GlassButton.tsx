import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { IOS_SPRING, iosCardTap } from '../../utils/iosSprings';

interface GlassButtonProps extends HTMLMotionProps<'button'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'amber';
  className?: string;
}

export const GlassButton: React.FC<GlassButtonProps> = ({
  children,
  variant = 'secondary',
  className = '',
  ...props
}) => {
  const variants = {
    primary: 'bg-[#E87532] text-[#511E00] border-amber-500/50 hover:brightness-110 shadow-lg shadow-orange-950/40',
    amber: 'bg-gradient-to-b from-[#F28240] via-[#E87532] to-[#C95B1B] text-[#341100] border-amber-300/40 shadow-xl',
    secondary: 'bg-[#1B2021]/80 text-[#DFE3E4] border-[#574239]/50 hover:bg-[#262B2C] hover:border-[#E87532]/60',
    danger: 'bg-[#93000A]/20 text-[#FFDAD6] border-[#93000A]/60 hover:bg-[#93000A]/40',
  };

  return (
    <motion.button
      whileHover={{ scale: 1.02, transition: IOS_SPRING }}
      whileTap={iosCardTap}
      className={`relative inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 font-mono-data text-xs font-bold backdrop-blur-xl transition-colors ${variants[variant]} ${className}`}
      {...props}
    >
      <span className="absolute inset-0 rounded-2xl bg-gradient-to-b from-white/[0.08] to-transparent pointer-events-none" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
};
