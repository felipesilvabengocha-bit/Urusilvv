import React from 'react';
import { motion } from 'framer-motion';

interface InertialScrollContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const InertialScrollContainer: React.FC<InertialScrollContainerProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative h-full w-full overflow-y-auto overscroll-y-contain ${className}`}>
      <motion.div
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="min-h-full w-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
