import { Transition } from 'framer-motion';

export const IOS_SPRING: Transition = {
  type: 'spring',
  stiffness: 350,
  damping: 30,
};

export const IOS_SPRING_BOUNCY: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 24,
};

export const IOS_SPRING_SMOOTH: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 32,
};

export const iosCardHover = {
  scale: 1.01,
  transition: IOS_SPRING,
};

export const iosCardTap = {
  scale: 0.98,
  transition: { duration: 0.1 },
};

export const iosFadeSlideIn = {
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -8, scale: 0.98 },
  transition: IOS_SPRING,
};

export const iosSheetModal = {
  initial: { opacity: 0, y: '100%', scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: '100%', scale: 0.95 },
  transition: IOS_SPRING_SMOOTH,
};
