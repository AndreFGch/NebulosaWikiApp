export interface Velocity {
  vx: number;
  vy: number;
}

export interface ReconcileVelocitiesResult {
  alpha: number;
  hasNewNodes: boolean;
}

export interface EdgeLink {
  si: number;
  ti: number;
}

export interface GraphSimulationHandle {
  start(): void;
}
