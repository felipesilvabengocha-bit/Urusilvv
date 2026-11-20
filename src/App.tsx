import { useState } from 'react';
import { CreationWizard } from './components/CreationWizard';
import { GameWorkspace } from './components/GameWorkspace';
import { HomeScreen } from './components/HomeScreen';
import { multiplayerClient } from './engine/multiplayerClient';
import { getActiveSave } from './engine/storageEngine';
import { DifficultyId, GameState, ScenarioId } from './types/game';

export function App() {
  const [screen, setScreen] = useState<'home' | 'create' | 'play'>('home');
  const [activeSave, setActiveSave] = useState<GameState | null>(() => getActiveSave());
  const [currentGame, setCurrentGame] = useState<GameState | null>(null);
  const [launchScenarioId, setLaunchScenarioId] = useState<ScenarioId | undefined>(undefined);
  const [launchDifficultyId, setLaunchDifficultyId] = useState<DifficultyId | undefined>(undefined);
  const [isMultiplayer, setIsMultiplayer] = useState(false);

  const refreshActiveSave = () => {
    setActiveSave(getActiveSave());
  };

  if (screen === 'create') {
    return (
      <CreationWizard
        initialScenarioId={launchScenarioId}
        initialDifficultyId={launchDifficultyId}
        onCancel={() => {
          setLaunchScenarioId(undefined);
          setLaunchDifficultyId(undefined);
          setScreen('home');
        }}
        onCreated={(state) => {
          setLaunchScenarioId(undefined);
          setLaunchDifficultyId(undefined);
          setIsMultiplayer(false);
          setCurrentGame(state);
          refreshActiveSave();
          setScreen('play');
        }}
      />
    );
  }

  if (screen === 'play' && currentGame) {
    return (
      <GameWorkspace
        gameState={currentGame}
        isMultiplayer={isMultiplayer}
        onUpdateState={(next) => {
          setCurrentGame(next);
          refreshActiveSave();
        }}
        onExitHome={() => {
          if (isMultiplayer) {
            multiplayerClient.disconnect();
            setIsMultiplayer(false);
          }
          refreshActiveSave();
          setScreen('home');
        }}
      />
    );
  }

  return (
    <HomeScreen
      activeSave={activeSave}
      onNewGame={(scenarioId, difficultyId) => {
        setLaunchScenarioId(scenarioId);
        setLaunchDifficultyId(difficultyId);
        setScreen('create');
      }}
      onLoadGame={(state) => {
        setIsMultiplayer(false);
        setCurrentGame(state);
        setScreen('play');
      }}
      onStartMultiplayer={(state) => {
        setIsMultiplayer(true);
        setCurrentGame(state);
        setScreen('play');
      }}
      onRefreshSaves={refreshActiveSave}
    />
  );
}

export default App;
