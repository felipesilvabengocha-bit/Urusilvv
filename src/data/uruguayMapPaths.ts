import { DepartmentId } from '../types/game';

export interface DepartmentMapShape {
  id: DepartmentId;
  path: string;
  labelX: number;
  labelY: number;
  shortLabel: string;
}

/**
 * Cartografía SVG estilizada de los 19 departamentos de la República Oriental del Uruguay
 * en su disposición geográfica real (Norte: Artigas-Rivera-Cerro Largo; Litoral Oeste: Salto-Paysandú-Río Negro-Soriano-Colonia;
 * Centro: Tacuarembó-Durazno-Flores-Florida; Este: Treinta y Tres-Lavalleja-Rocha; Sur: San José-Canelones-Maldonado-Montevideo).
 */
export const URUGUAY_MAP_SHAPES: DepartmentMapShape[] = [
  {
    id: 'artigas',
    shortLabel: 'ART',
    labelX: 142,
    labelY: 56,
    path: 'M 102,22 L 154,18 L 194,48 L 198,84 L 146,86 L 106,96 L 88,68 Z',
  },
  {
    id: 'salto',
    shortLabel: 'SAL',
    labelX: 136,
    labelY: 126,
    path: 'M 88,68 L 106,96 L 146,86 L 198,84 L 204,132 L 178,158 L 118,162 L 84,142 L 82,98 Z',
  },
  {
    id: 'rivera',
    shortLabel: 'RIV',
    labelX: 248,
    labelY: 102,
    path: 'M 194,48 L 248,66 L 306,104 L 296,138 L 240,148 L 204,132 L 198,84 Z',
  },
  {
    id: 'paysandu',
    shortLabel: 'PAY',
    labelX: 132,
    labelY: 192,
    path: 'M 84,142 L 118,162 L 178,158 L 192,208 L 164,228 L 96,228 L 80,190 Z',
  },
  {
    id: 'tacuarembo',
    shortLabel: 'TAC',
    labelX: 238,
    labelY: 184,
    path: 'M 178,158 L 204,132 L 240,148 L 296,138 L 310,178 L 284,232 L 222,238 L 192,208 Z',
  },
  {
    id: 'cerro_largo',
    shortLabel: 'CL',
    labelX: 356,
    labelY: 196,
    path: 'M 306,104 L 368,142 L 420,188 L 398,246 L 336,246 L 284,232 L 310,178 L 296,138 Z',
  },
  {
    id: 'rio_negro',
    shortLabel: 'RN',
    labelX: 126,
    labelY: 256,
    path: 'M 96,228 L 164,228 L 192,248 L 172,286 L 96,288 L 78,258 Z',
  },
  {
    id: 'durazno',
    shortLabel: 'DUR',
    labelX: 232,
    labelY: 270,
    path: 'M 164,228 L 192,208 L 222,238 L 284,232 L 312,268 L 282,304 L 210,304 L 192,248 Z',
  },
  {
    id: 'treinta_y_tres',
    shortLabel: 'TT',
    labelX: 368,
    labelY: 276,
    path: 'M 284,232 L 336,246 L 398,246 L 424,282 L 404,316 L 332,318 L 312,268 Z',
  },
  {
    id: 'soriano',
    shortLabel: 'SOR',
    labelX: 112,
    labelY: 320,
    path: 'M 78,288 L 172,286 L 166,348 L 106,356 L 68,326 Z',
  },
  {
    id: 'flores',
    shortLabel: 'FLS',
    labelX: 192,
    labelY: 326,
    path: 'M 172,286 L 192,248 L 210,304 L 222,348 L 166,348 Z',
  },
  {
    id: 'florida',
    shortLabel: 'FLA',
    labelX: 258,
    labelY: 344,
    path: 'M 210,304 L 282,304 L 302,358 L 274,394 L 222,388 L 222,348 Z',
  },
  {
    id: 'lavalleja',
    shortLabel: 'LAV',
    labelX: 332,
    labelY: 358,
    path: 'M 282,304 L 312,268 L 332,318 L 372,332 L 366,396 L 314,404 L 302,358 Z',
  },
  {
    id: 'rocha',
    shortLabel: 'ROC',
    labelX: 416,
    labelY: 368,
    path: 'M 332,318 L 404,316 L 424,282 L 456,312 L 448,378 L 408,426 L 366,396 L 372,332 Z',
  },
  {
    id: 'colonia',
    shortLabel: 'COL',
    labelX: 112,
    labelY: 392,
    path: 'M 68,356 L 106,356 L 166,348 L 164,414 L 116,426 L 68,396 Z',
  },
  {
    id: 'san_jose',
    shortLabel: 'SJ',
    labelX: 192,
    labelY: 396,
    path: 'M 166,348 L 222,348 L 222,388 L 218,434 L 164,414 Z',
  },
  {
    id: 'canelones',
    shortLabel: 'CAN',
    labelX: 274,
    labelY: 422,
    path: 'M 222,388 L 274,394 L 314,404 L 318,448 L 276,456 L 266,436 L 234,438 L 218,434 Z',
  },
  {
    id: 'maldonado',
    shortLabel: 'MAL',
    labelX: 356,
    labelY: 428,
    path: 'M 314,404 L 366,396 L 408,426 L 372,462 L 318,448 Z',
  },
  {
    id: 'montevideo',
    shortLabel: 'MVD',
    labelX: 250,
    labelY: 454,
    path: 'M 234,438 L 266,436 L 276,456 L 252,468 L 230,458 Z',
  },
];
