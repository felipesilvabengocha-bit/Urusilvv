import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { APPLE_SPRING_SMOOTH } from '../../utils/appleSprings';

interface HeroTitleProps extends HTMLMotionProps<'div'> {
  title: string;
  subtitle?: string;
  badge?: string;
  className?: string;
}

export const HeroTitle: React.FC<HeroTitleProps> = ({ title, subtitle, badge, className = '', ...props }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={APPLE_SPRING_SMOOTH}
      className={`space-y-1.5 ${className}`}
      {...props}
    >
      {badge && (
        <span className="inline-flex items-center rounded-full border border-[#FFB691]/40 bg-[#FFB691]/10 px-3 py-1 font-mono-data text-[10px] font-extrabold uppercase tracking-widest text-[#FFB691]">
          {badge}
        </span>
      )}
      <h1 className="font-display text-3xl font-extrabold tracking-tight text-[#DFE3E4] sm:text-4xl">
        {title}
      </h1>
      {subtitle && (
        <p className="font-mono-data text-xs font-medium text-[#CDC6B8] max-w-xl">
          {subtitle}
        </p>
      )}
    </motion.div>
  );
};
