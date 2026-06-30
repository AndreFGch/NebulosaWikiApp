import type cytoscape from "cytoscape";

export interface Velocity {
  vx: number;
  vy: number;
}

export interface ReconcileVelocitiesResult {
  alpha: number;
  hasNewNodes: boolean;
}

export interface SimulationEdgeLink {
  readonly si: number;
  readonly ti: number;
  readonly key: string;
}

export interface SimulationTopologyUpdate {
  readonly nodeArr: cytoscape.NodeSingular[];
  readonly edgeLinks: readonly SimulationEdgeLink[];
}

export interface GraphSimulationHandle {
  start(): void;
  pause(): void;
  resume(): void;
  updateTopology(update: SimulationTopologyUpdate): void;
}
