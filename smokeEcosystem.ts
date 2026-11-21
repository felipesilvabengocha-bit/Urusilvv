import { buildNewGameState } from './src/engine/gameFactory';
import { advanceOneMonth } from './src/engine/simulationEngine';
import { dispatchEcosystemAction } from './src/engine/ecosystemActions';

const memory = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: (key: string) => {
    memory.delete(key);
  },
  clear: () => memory.clear(),
  key: (index: number) => Array.from(memory.keys())[index] ?? null,
  get length() {
    return memory.size;
  },
};

let state = buildNewGameState({
  scenarioId: 'contemporaneo_2024',
  difficultyId: 'normal',
  originMode: 'partido_existente',
  selectedPartyId: 'fa',
  selectedSectorId: 'fa_mpp',
  playerName: 'Prueba Interna',
  biography: 'Prueba',
  attributes: { popularity: 60, charisma: 60, management: 60, territorialMachine: 60, negotiation: 60 },
  targetOffice: 'presidente',
  targetDepartment: 'montevideo',
});

const eco = state.expansion;
if (!eco) throw new Error('expansion no inicializada');
console.log('inicial:', {
  factions: eco.factions.length,
  advisors: eco.advisors.length,
  outlets: eco.mediaOutlets.length,
  segments: eco.opinionSegments.length,
  intendencies: eco.intendencyRelations.length,
  debates: eco.debates.length,
});

const playerFaction = eco.factions.find((f) => f.partyId === state.player.partyId)!;
const actions = [
  { type: 'court_faction' as const, factionId: playerFaction.id },
  { type: 'hire_advisor' as const, advisorId: eco.advisors[0].id },
  { type: 'media_interview' as const, outletId: eco.mediaOutlets[0].id },
  { type: 'start_negotiation' as const, partyId: 'pn', kind: 'apoyo_parlamentario' as const },
  { type: 'create_national_plan' as const, horizon: 5 as const, focus: 'desarrollo_productivo' },
  { type: 'intendency_agreement' as const, departmentId: 'montevideo' },
  { type: 'foreign_negotiation' as const, partnerId: 'brasil', kind: 'comercial' as const },
];
for (const action of actions) {
  const result = dispatchEcosystemAction(state, action);
  console.log(action.type, result.ok, result.message.slice(0, 110));
  if (result.ok) state = result.nextState;
}

for (let i = 0; i < 24; i += 1) {
  state = advanceOneMonth(state);
  if (state.player.politicalCapital < 0) throw new Error('CP negativo');
  if (!state.expansion) throw new Error('expansion perdida');
}
const e = state.expansion!;
console.log('tras 24 meses:', {
  fecha: `${state.currentMonth}/${state.currentYear}`,
  aprobacion: state.macro.governmentApprovalPct,
  cp: state.player.politicalCapital,
  fondos: state.player.campaignFundsUYU,
  noticias: e.mediaNews.length,
  crisis: e.cabinetCrises.length,
  controles: e.institutionalControls.length,
  evaluaciones: e.policyEvaluations.length,
  planes: e.nationalPlans.map((p) => `${p.name}:${p.status}`),
  transparencia: e.transparencyCases.length,
  convenios: e.intendencyRelations.filter((r) => r.agreement?.active).length,
  mercosur: e.mercosurIntegration,
  notas: e.lastMonthlyNotes,
});
console.log('history top:', state.history.slice(0, 5).map((h) => h.title));
