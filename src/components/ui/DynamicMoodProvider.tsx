import React from 'react';

export type NationalMood = 'crisis' | 'success' | 'neutral';

export function getNationalMood(gameState: { politicalIndicators: { coalitionStability: number }; macro: { gdpGrowthPct: number }; player: { attributes: { popularity: number } } }): NationalMood {
  const stability = gameState.politicalIndicators.coalitionStability;
  const gdp = gameState.macro.gdpGrowthPct;
  const pop = gameState.player.attributes.popularity;

  if (stability < 40 || gdp < -1 || pop < 35) {
    return 'crisis';
  }
  if (stability > 70 && gdp > 2 && pop > 55) {
    return 'success';
  }
  return 'neutral';
}

interface DynamicMoodProviderProps {
  mood: NationalMood;
  children: React.ReactNode;
}

export const DynamicMoodProvider: React.FC<DynamicMoodProviderProps> = ({ mood, children }) => {
  const moodGlows = {
    crisis: 'shadow-[inset_0_0_80px_rgba(147,0,10,0.18)] border-red-950/40',
    success: 'shadow-[inset_0_0_80px_rgba(85,117,104,0.18)] border-emerald-900/40',
    neutral: 'shadow-[inset_0_0_60px_rgba(232,117,50,0.08)] border-[#574239]/40',
  };

  return (
    <div className={`relative min-h-[100dvh] transition-colors duration-700 ${moodGlows[mood]}`}>
      {children}
    </div>
  );
};
