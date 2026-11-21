import { Transition } from 'framer-motion';

export const APPLE_SPRING_BOUNCY: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 24,
  mass: 0.9,
};

export const APPLE_SPRING_SMOOTH: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 35,
  mass: 1,
};

export const APPLE_SPRING_SNAPPY: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 28,
  mass: 0.8,
};

export const applePageTransition = {
  initial: { opacity: 0, scale: 0.98, filter: 'blur(4px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 1.02, filter: 'blur(4px)' },
  transition: APPLE_SPRING_SMOOTH,
};
