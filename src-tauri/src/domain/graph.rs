//! Contratos base puros de GraphCore.
//!
//! Dominio agnóstico: sin Tauri, sin filesystem, sin Markdown, sin
//! serialización, sin identificadores generados aleatoriamente.

pub(crate) mod store;

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct GraphId(u64);

impl GraphId {
    pub(crate) fn new(value: u64) -> Self {
        Self(value)
    }
}

impl core::fmt::Debug for GraphId {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("GraphId(<opaque>)")
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct NodeId(u64);

impl NodeId {
    pub(crate) fn new(value: u64) -> Self {
        Self(value)
    }
}

impl core::fmt::Debug for NodeId {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("NodeId(<opaque>)")
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct EdgeId(u64);

impl EdgeId {
    pub(crate) fn new(value: u64) -> Self {
        Self(value)
    }
}

impl core::fmt::Debug for EdgeId {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("EdgeId(<opaque>)")
    }
}

/// Revisión opaca de un grafo. Solo comparable por igualdad; no expone
/// orden ni aritmética pública para impedir que capas externas la traten
/// como contador.
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct GraphRevision(u64);

impl GraphRevision {
    pub(crate) fn new(value: u64) -> Self {
        Self(value)
    }
}

impl core::fmt::Debug for GraphRevision {
    fn fmt(&self, f: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        f.write_str("GraphRevision(<opaque>)")
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphNode<TMeta> {
    pub id: NodeId,
    pub metadata: TMeta,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphEdge<TMeta> {
    pub id: EdgeId,
    pub from: NodeId,
    pub to: NodeId,
    pub metadata: TMeta,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphSnapshot<TNodeMeta, TEdgeMeta> {
    pub graph_id: GraphId,
    pub revision: GraphRevision,
    pub nodes: Vec<GraphNode<TNodeMeta>>,
    pub edges: Vec<GraphEdge<TEdgeMeta>>,
}

/// Delta entre dos revisiones de un grafo. `updated_nodes` y
/// `updated_edges` son reemplazos completos del elemento, no parches.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphDelta<TNodeMeta, TEdgeMeta> {
    pub graph_id: GraphId,
    pub from_revision: GraphRevision,
    pub to_revision: GraphRevision,
    pub added_nodes: Vec<GraphNode<TNodeMeta>>,
    pub removed_node_ids: Vec<NodeId>,
    pub updated_nodes: Vec<GraphNode<TNodeMeta>>,
    pub added_edges: Vec<GraphEdge<TEdgeMeta>>,
    pub removed_edge_ids: Vec<EdgeId>,
    pub updated_edges: Vec<GraphEdge<TEdgeMeta>>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestNodeMeta(&'static str);

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestEdgeMeta(&'static str);

    #[test]
    fn ids_are_used_by_role_in_structures() {
        let node = GraphNode {
            id: NodeId::new(1),
            metadata: TestNodeMeta("nota-a"),
        };
        let edge = GraphEdge {
            id: EdgeId::new(1),
            from: NodeId::new(1),
            to: NodeId::new(2),
            metadata: TestEdgeMeta("enlace"),
        };

        assert_eq!(node.id, NodeId::new(1));
        assert_eq!(edge.from, NodeId::new(1));
        assert_eq!(edge.to, NodeId::new(2));
    }

    #[test]
    fn snapshot_preserves_graph_id_and_revision() {
        let snapshot: GraphSnapshot<TestNodeMeta, TestEdgeMeta> = GraphSnapshot {
            graph_id: GraphId::new(7),
            revision: GraphRevision::new(3),
            nodes: vec![],
            edges: vec![],
        };

        assert_eq!(snapshot.graph_id, GraphId::new(7));
        assert_eq!(snapshot.revision, GraphRevision::new(3));
    }

    #[test]
    fn delta_preserves_source_and_target_revisions() {
        let delta: GraphDelta<TestNodeMeta, TestEdgeMeta> = GraphDelta {
            graph_id: GraphId::new(1),
            from_revision: GraphRevision::new(1),
            to_revision: GraphRevision::new(2),
            added_nodes: vec![],
            removed_node_ids: vec![],
            updated_nodes: vec![],
            added_edges: vec![],
            removed_edge_ids: vec![],
            updated_edges: vec![],
        };

        assert_eq!(delta.from_revision, GraphRevision::new(1));
        assert_eq!(delta.to_revision, GraphRevision::new(2));
    }

    #[test]
    fn delta_represents_updates_as_full_replacement() {
        let replaced_node = GraphNode {
            id: NodeId::new(1),
            metadata: TestNodeMeta("actualizado"),
        };
        let replaced_edge = GraphEdge {
            id: EdgeId::new(1),
            from: NodeId::new(1),
            to: NodeId::new(2),
            metadata: TestEdgeMeta("actualizado"),
        };

        let delta = GraphDelta {
            graph_id: GraphId::new(1),
            from_revision: GraphRevision::new(1),
            to_revision: GraphRevision::new(2),
            added_nodes: Vec::<GraphNode<TestNodeMeta>>::new(),
            removed_node_ids: vec![],
            updated_nodes: vec![replaced_node.clone()],
            added_edges: Vec::<GraphEdge<TestEdgeMeta>>::new(),
            removed_edge_ids: vec![],
            updated_edges: vec![replaced_edge.clone()],
        };

        // El reemplazo es completo: el único elemento presente es la
        // versión final, no un fragmento a mezclar con la anterior.
        assert_eq!(delta.updated_nodes, vec![replaced_node]);
        assert_eq!(delta.updated_edges, vec![replaced_edge]);
    }

    #[test]
    fn debug_format_does_not_leak_internal_value() {
        let secret = "424242";
        let graph_id = format!("{:?}", GraphId::new(424242));
        let node_id = format!("{:?}", NodeId::new(424242));
        let edge_id = format!("{:?}", EdgeId::new(424242));
        let revision = format!("{:?}", GraphRevision::new(424242));

        assert!(!graph_id.contains(secret));
        assert!(!node_id.contains(secret));
        assert!(!edge_id.contains(secret));
        assert!(!revision.contains(secret));
    }
}
