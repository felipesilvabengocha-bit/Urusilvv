import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RippleEffectProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

export const RippleEffect: React.FC<RippleEffectProps> = ({ children, className = '', onClick }) => {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const handlePointerDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setRipples((prev) => [...prev, { id: Date.now(), x, y }]);
    if (onClick) onClick(e);
  };

  return (
    <div
      onClick={handlePointerDown}
      className={`relative overflow-hidden cursor-pointer ${className}`}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 z-20">
        <AnimatePresence>
          {ripples.map((rip) => (
            <motion.span
              key={rip.id}
              initial={{ scale: 0, opacity: 0.6 }}
              animate={{ scale: 3.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              onAnimationComplete={() => {
                setRipples((prev) => prev.filter((r) => r.id !== rip.id));
              }}
              style={{
                top: rip.y,
                left: rip.x,
                width: 60,
                height: 60,
              }}
              className="absolute -ml-7 -mt-7 rounded-full bg-gradient-to-r from-amber-400/40 via-orange-500/30 to-transparent blur-md"
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
