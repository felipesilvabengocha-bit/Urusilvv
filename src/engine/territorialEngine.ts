import { getPlayerCapabilities } from './capabilitiesEngine';
import { GameState, DepartmentWorkOrder } from '../types/game';

export function startDepartmentWorkOrder(
  state: GameState,
  departmentId: GameState['departments'][number]['id'],
  title: string,
  authorityLevel: DepartmentWorkOrder['authorityLevel'],
  costMillionsUYU: number,
  totalMonths: number,
  effectSummary: string
): { ok: boolean; nextState: GameState; message: string } {
  const caps = getPlayerCapabilities(state);
  const canExecute =
    caps.canExecuteDepartamentalWorks ||
    caps.canEditNationalBudgetAndFiscal ||
    caps.canAdministerDepartamentalBudget;
  if (!canExecute) {
    return { ok: false, nextState: state, message: caps.lockReasons.departamentalExecutive };
  }
  const safeMonths = Math.max(1, Math.min(24, Math.round(totalMonths)));
  const safeCost = Math.max(0, Math.round(costMillionsUYU));
  const costUYU = safeCost * 1_000_000;

  if (costUYU > 0 && state.player.campaignFundsUYU < costUYU) {
    return {
      ok: false,
      nextState: state,
      message: `Fondos insuficientes para la obra (se requieren $ ${safeCost.toLocaleString('es-UY')}M UYU).`,
    };
  }

  const order: DepartmentWorkOrder = {
    id: `obra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    departmentId,
    title,
    authorityLevel,
    costMillionsUYU: safeCost,
    totalMonths: safeMonths,
    remainingMonths: safeMonths,
    status: 'en_ejecucion',
    effectSummary,
  };

  const msg = `Obra «${title}» iniciada en ${departmentId} (${safeMonths} meses, $ ${safeCost}M UYU). Se descontó su presupuesto y quedará registrada en el Mapa Territorial.`;
  return {
    ok: true,
    message: msg,
    nextState: {
      ...state,
      publicWorksOrders: [...(state.publicWorksOrders ?? []), order],
      player: {
        ...state.player,
        campaignFundsUYU: state.player.campaignFundsUYU - costUYU,
        politicalCapital: Math.max(0, state.player.politicalCapital - 4),
      },
      history: [
        {
          id: `obra_start_${Date.now()}`,
          dateLabel: `${new Date().toLocaleDateString('es-UY')}`,
          category: 'gobierno',
          title: `Inicio de obra: ${title}`,
          detail: msg,
        },
        ...state.history,
      ],
    },
  };
}
