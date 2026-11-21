import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface DynamicIslandProps {
  message: string | null;
  type?: 'success' | 'warning' | 'info' | 'crisis';
  onClose: () => void;
}

export const DynamicIsland: React.FC<DynamicIslandProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 4500);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  const icons = {
    success: <CheckCircle className="h-4 w-4 text-[#ACCEBF]" />,
    warning: <AlertTriangle className="h-4 w-4 text-[#FFB691]" />,
    crisis: <AlertTriangle className="h-4 w-4 text-[#FFB4AB] animate-pulse" />,
    info: <Sparkles className="h-4 w-4 text-[#E87532]" />,
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4">
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -25, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-[#574239]/70 bg-[#0A0F10]/95 px-5 py-2.5 shadow-2xl backdrop-blur-2xl"
          >
            <div className="shrink-0">{icons[type]}</div>
            <p className="max-w-md truncate text-xs font-semibold text-[#DFE3E4]">{message}</p>
            <button
              onClick={onClose}
              className="ml-1 rounded-full bg-[#1B2021] p-1 text-[#8B9491] hover:text-white"
              aria-label="Cerrar notificación"
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
