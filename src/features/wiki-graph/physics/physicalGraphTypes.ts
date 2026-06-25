export interface PhysicsPoint {
  readonly x: number;
  readonly y: number;
}

export interface PhysicsVelocity {
  vx: number;
  vy: number;
}

export interface PhysicsEdgeLink {
  readonly si: number;
  readonly ti: number;
}

/**
 * Estado completo del motor físico puro, sin dependencia de Cytoscape.
 *
 * Convención de índices para los typed arrays:
 *   positions[i * 2]      = x del nodo i
 *   positions[i * 2 + 1]  = y del nodo i
 *   velocities[i * 2]     = vx del nodo i
 *   velocities[i * 2 + 1] = vy del nodo i
 *
 * `alpha` y `stepCount` son mutables; cambian por paso en stepPhysicalGraph.
 */
export interface PhysicalGraphState {
  readonly nodeIds: readonly string[];
  readonly indexById: ReadonlyMap<string, number>;
  readonly positions: Float64Array;
  readonly velocities: Float64Array;
  alpha: number;
  stepCount: number;
}

export interface PhysicsStepOptions {
  readonly edgeLinks: readonly PhysicsEdgeLink[];
  readonly rootIndex: number | null;
  readonly fixedNodeIndices?: ReadonlySet<number>;
}