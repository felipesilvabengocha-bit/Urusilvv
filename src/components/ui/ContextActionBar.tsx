import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ChevronUp, Command } from 'lucide-react';
import { IOS_SPRING } from '../../utils/iosSprings';

interface ContextActionBarProps {
  children: React.ReactNode;
  hint?: string;
}

export const ContextActionBar: React.FC<ContextActionBarProps> = ({ children, hint = 'Acciones contextuales disponibles' }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 15, scale: 0.95 }}
            transition={IOS_SPRING}
            className="flex items-center gap-3 rounded-2xl border border-[#574239]/70 bg-[#0A0F10]/90 px-4 py-3 shadow-2xl backdrop-blur-2xl"
          >
            <div className="flex items-center gap-2 border-r border-[#574239]/50 pr-3">
              <Command className="h-4 w-4 text-[#FFB691]" />
              <span className="hidden font-mono-data text-[10px] font-semibold text-[#CDC6B8] sm:inline">
                {hint}
              </span>
            </div>
            <div className="flex items-center gap-2">{children}</div>
            <button
              onClick={() => setExpanded(false)}
              className="ml-1 rounded-lg bg-[#1B2021] p-1.5 text-[#CDC6B8] hover:text-white"
              title="Minimizar barra"
            >
              <ChevronUp className="h-4 w-4 rotate-180" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && (
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          onClick={() => setExpanded(true)}
          className="flex items-center gap-2 rounded-full border border-[#E87532]/50 bg-[#0A0F10] px-4 py-2 font-mono-data text-xs font-bold text-[#FFB691] shadow-2xl backdrop-blur-xl hover:border-[#E87532]"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>Acciones</span>
        </motion.button>
      )}
    </div>
  );
};
