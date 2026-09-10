/**
 * TypeScript type definitions
 */

export interface Point {
  x: number;
  y: number;
}

// NOTE: WorkflowStep is a legacy type stub — App.tsx uses its own inline `Step` type.
// Kept here for reference but not imported anywhere active.
export const WorkflowStep = {
  IDLE: 'idle',
  ORIGIN: 'origin',
  SHOTS: 'shots',
  SCALE: 'scale',
  CALCULATE: 'calculate',
  RESULTS: 'results'
} as const;
export type WorkflowStep = typeof WorkflowStep[keyof typeof WorkflowStep];

export interface AppState {
  // Image
  imageUrl: string | null;
  imageWidth: number;
  imageHeight: number;
  
  // Workflow
  currentStep: WorkflowStep;
  
  // Points
  originPoint: Point | null;
  shotPoints: Point[];
  scalePoints: Point[];
  
  // Scale
  scaleDistance: number;
  scaleUnit: string;
  unitsPerPixel: number;
  
  // Results
  results: CEPResults | null;
}

export interface CEPResults {
  numPoints: number;
  meanX: number;
  meanY: number;
  sigmaX: number;
  sigmaY: number;
  combinedStd: number;
  cep50: number;
  cep90?: number;
  cep95?: number;
  blockingRadius: number;
  extremeSpread: number;
  meanToOrigin: number;
  unit: string;
  precisionRating: string;
}

export interface ViewportState {
  scale: number;
  offsetX: number;
  offsetY: number;
  minScale: number;
  maxScale: number;
}

export type PointType = 'origin' | 'shot' | 'scale';

export interface DrawnPoint {
  point: Point;
  type: PointType;
  index?: number;
}
