import React from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { IOS_SPRING, iosCardTap } from '../../utils/iosSprings';

interface IOSTouchCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const IOSTouchCard: React.FC<IOSTouchCardProps> = ({ children, className = '', ...props }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.015, transition: IOS_SPRING }}
      whileTap={iosCardTap}
      className={`cursor-pointer rounded-2xl border border-[#574239]/40 bg-[#171C1D]/90 p-4 shadow-xl backdrop-blur-md transition-colors hover:border-[#E87532]/60 ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  );
};
