export interface WikiNode {
  id: string;
  title: string;
  relativePath: string;
  folder: string;
  tags: string[];
  type: string;
  outgoingCount: number;
  backlinkCount: number;
  isOrphan: boolean;
  exists: boolean;
}

export interface WikiEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  type: string;
  weight: number;
  isBacklink: boolean;
  isBroken: boolean;
}

export interface WikiGraph {
  nodes: WikiNode[];
  edges: WikiEdge[];
  orphanNodes: WikiNode[];
  brokenLinks: WikiEdge[];
  tags: string[];
  folders: string[];
}

export interface GraphHealth {
  tone: "pending" | "warning" | "healthy";
  headline: string;
  actionNote: string | null;
  connections: number;
  brokenCount: number;
  orphanCount: number;
}
