import type {
  GraphNodeId,
  GraphEdgeId,
  LogicalNode,
  LogicalEdge,
  LogicalGraphSnapshot,
  GraphNeighborDirection,
} from "./graphTypes";

function getOrCreate<K, V>(map: Map<K, V[]>, key: K): V[] {
  let list = map.get(key);
  if (list === undefined) {
    list = [];
    map.set(key, list);
  }
  return list;
}

/**
 * Store en memoria del grafo lógico.
 * Indexa nodos y aristas para consultas O(1).
 * No muta el snapshot recibido.
 * No conoce Cytoscape, React, layout ni física.
 */
export class WikiGraphStore {
  private readonly _nodes: Map<GraphNodeId, LogicalNode>;
  private readonly _edges: Map<GraphEdgeId, LogicalEdge>;
  private readonly _outgoing: Map<GraphNodeId, GraphEdgeId[]>;
  private readonly _incoming: Map<GraphNodeId, GraphEdgeId[]>;

  constructor(snapshot: LogicalGraphSnapshot) {
    this._nodes = new Map();
    this._edges = new Map();
    this._outgoing = new Map();
    this._incoming = new Map();

    for (const node of snapshot.nodes) {
      if (this._nodes.has(node.id)) {
        throw new Error(`WikiGraphStore: nodo duplicado id="${node.id}"`);
      }
      this._nodes.set(node.id, node);
    }

    for (const edge of snapshot.edges) {
      if (this._edges.has(edge.id)) {
        throw new Error(`WikiGraphStore: arista duplicada id="${edge.id}"`);
      }
      this._edges.set(edge.id, edge);

      // Indexar siempre, aunque source o target no existan en _nodes.
      // getNeighbors filtra luego; getOutgoingEdges/getIncomingEdges exponen toda la topología.
      getOrCreate(this._outgoing, edge.source).push(edge.id);
      getOrCreate(this._incoming, edge.target).push(edge.id);
    }
  }

  getNode(nodeId: GraphNodeId): LogicalNode | undefined {
    return this._nodes.get(nodeId);
  }

  getEdge(edgeId: GraphEdgeId): LogicalEdge | undefined {
    return this._edges.get(edgeId);
  }

  getNodes(): ReadonlyArray<LogicalNode> {
    return Array.from(this._nodes.values());
  }

  getEdges(): ReadonlyArray<LogicalEdge> {
    return Array.from(this._edges.values());
  }

  getOutgoingEdges(nodeId: GraphNodeId): ReadonlyArray<LogicalEdge> {
    const ids = this._outgoing.get(nodeId) ?? [];
    return ids.flatMap((id) => {
      const edge = this._edges.get(id);
      return edge !== undefined ? [edge] : [];
    });
  }

  getIncomingEdges(nodeId: GraphNodeId): ReadonlyArray<LogicalEdge> {
    const ids = this._incoming.get(nodeId) ?? [];
    return ids.flatMap((id) => {
      const edge = this._edges.get(id);
      return edge !== undefined ? [edge] : [];
    });
  }

  getNeighbors(nodeId: GraphNodeId, direction: GraphNeighborDirection): ReadonlyArray<LogicalNode> {
    const neighborIds = new Set<GraphNodeId>();

    if (direction === "outgoing" || direction === "both") {
      for (const edge of this.getOutgoingEdges(nodeId)) {
        const n = this._nodes.get(edge.target);
        if (n !== undefined && n.exists) neighborIds.add(edge.target);
      }
    }

    if (direction === "incoming" || direction === "both") {
      for (const edge of this.getIncomingEdges(nodeId)) {
        const n = this._nodes.get(edge.source);
        if (n !== undefined && n.exists) neighborIds.add(edge.source);
      }
    }

    return Array.from(neighborIds).flatMap((id) => {
      const node = this._nodes.get(id);
      return node !== undefined && node.exists ? [node] : [];
    });
  }

  hasNode(nodeId: GraphNodeId): boolean {
    return this._nodes.has(nodeId);
  }

  hasEdge(edgeId: GraphEdgeId): boolean {
    return this._edges.has(edgeId);
  }

  get nodeCount(): number {
    return this._nodes.size;
  }

  get edgeCount(): number {
    return this._edges.size;
  }
}
