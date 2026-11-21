import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface ToastProps {
  message: string;
  type?: 'success' | 'warning' | 'info';
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-[#ACCEBF]" />,
    warning: <AlertTriangle className="h-5 w-5 text-[#FFB691]" />,
    info: <Info className="h-5 w-5 text-[#E87532]" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      className="pointer-events-auto flex w-80 items-center gap-3 rounded-xl border border-[#574239]/60 bg-[#171C1D] p-4 shadow-2xl"
    >
      <div className="shrink-0">{icons[type]}</div>
      <p className="flex-1 text-xs font-semibold text-[#DFE3E4]">{message}</p>
      <button onClick={onClose} className="rounded p-1 hover:bg-[#262B2C]">
        <X className="h-4 w-4 text-[#8B9491]" />
      </button>
    </motion.div>
  );
};
