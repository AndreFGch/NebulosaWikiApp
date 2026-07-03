//! Almacén canónico en memoria de un único `GraphId`, con índices de
//! incidencia de aristas entrantes y salientes por `NodeId`.

use std::collections::{HashMap, HashSet};

use super::{EdgeId, GraphEdge, GraphId, GraphNode, GraphRevision, GraphSnapshot, NodeId};

/// Rechazo estructural al insertar una arista cuyos endpoints no existen
/// en el store. Cerrado, puro: sin paths, strings dinámicos ni errores de SO.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GraphStoreError {
    MissingFromNode(NodeId),
    MissingToNode(NodeId),
}

pub(crate) struct GraphStore<TNodeMeta, TEdgeMeta> {
    graph_id: GraphId,
    nodes: HashMap<NodeId, GraphNode<TNodeMeta>>,
    edges: HashMap<EdgeId, GraphEdge<TEdgeMeta>>,
    outgoing: HashMap<NodeId, HashSet<EdgeId>>,
    incoming: HashMap<NodeId, HashSet<EdgeId>>,
}

impl<TNodeMeta, TEdgeMeta> GraphStore<TNodeMeta, TEdgeMeta> {
    pub(crate) fn new(graph_id: GraphId) -> Self {
        Self {
            graph_id,
            nodes: HashMap::new(),
            edges: HashMap::new(),
            outgoing: HashMap::new(),
            incoming: HashMap::new(),
        }
    }

    pub(crate) fn graph_id(&self) -> GraphId {
        self.graph_id
    }

    pub(crate) fn node(&self, id: NodeId) -> Option<&GraphNode<TNodeMeta>> {
        self.nodes.get(&id)
    }

    pub(crate) fn edge(&self, id: EdgeId) -> Option<&GraphEdge<TEdgeMeta>> {
        self.edges.get(&id)
    }

    /// Inserta o reemplaza un nodo. Los índices de aristas están indexados
    /// por `NodeId`, no por el nodo en sí, así que un reemplazo no los rompe.
    pub(crate) fn upsert_node(&mut self, node: GraphNode<TNodeMeta>) {
        self.nodes.insert(node.id, node);
    }

    /// Elimina un nodo y todas sus aristas incidentes (entrantes, salientes
    /// y self-loops), sin dejar entradas colgantes en los índices.
    pub(crate) fn remove_node(&mut self, id: NodeId) -> Option<GraphNode<TNodeMeta>> {
        let removed = self.nodes.remove(&id)?;

        let outgoing_ids: Vec<EdgeId> = self
            .outgoing
            .get(&id)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default();
        let incoming_ids: Vec<EdgeId> = self
            .incoming
            .get(&id)
            .map(|set| set.iter().copied().collect())
            .unwrap_or_default();

        for edge_id in outgoing_ids.into_iter().chain(incoming_ids) {
            self.remove_edge(edge_id);
        }

        Some(removed)
    }

    /// Inserta o reemplaza una arista. Rechaza antes de mutar si `from` o
    /// `to` no existen. Un reemplazo con el mismo `EdgeId` limpia los
    /// índices de los endpoints anteriores antes de registrar los nuevos.
    pub(crate) fn upsert_edge(
        &mut self,
        edge: GraphEdge<TEdgeMeta>,
    ) -> Result<(), GraphStoreError> {
        if !self.nodes.contains_key(&edge.from) {
            return Err(GraphStoreError::MissingFromNode(edge.from));
        }
        if !self.nodes.contains_key(&edge.to) {
            return Err(GraphStoreError::MissingToNode(edge.to));
        }

        if let Some(previous) = self.edges.get(&edge.id) {
            Self::unlink(&mut self.outgoing, previous.from, previous.id);
            Self::unlink(&mut self.incoming, previous.to, previous.id);
        }

        Self::link(&mut self.outgoing, edge.from, edge.id);
        Self::link(&mut self.incoming, edge.to, edge.id);
        self.edges.insert(edge.id, edge);
        Ok(())
    }

    /// Elimina una arista y la limpia de ambos índices.
    pub(crate) fn remove_edge(&mut self, id: EdgeId) -> Option<GraphEdge<TEdgeMeta>> {
        let removed = self.edges.remove(&id)?;
        Self::unlink(&mut self.outgoing, removed.from, removed.id);
        Self::unlink(&mut self.incoming, removed.to, removed.id);
        Some(removed)
    }

    /// IDs de aristas salientes de `node`, sin recorrer el mapa completo de aristas.
    pub(crate) fn outgoing_edge_ids(&self, node: NodeId) -> impl Iterator<Item = EdgeId> + '_ {
        self.outgoing
            .get(&node)
            .into_iter()
            .flat_map(|set| set.iter().copied())
    }

    /// IDs de aristas entrantes de `node`, sin recorrer el mapa completo de aristas.
    pub(crate) fn incoming_edge_ids(&self, node: NodeId) -> impl Iterator<Item = EdgeId> + '_ {
        self.incoming
            .get(&node)
            .into_iter()
            .flat_map(|set| set.iter().copied())
    }

    /// Snapshot inmutable del contenido canónico actual. La `GraphRevision`
    /// es responsabilidad del llamador: el store no la posee ni la incrementa.
    pub(crate) fn snapshot(&self, revision: GraphRevision) -> GraphSnapshot<TNodeMeta, TEdgeMeta>
    where
        TNodeMeta: Clone,
        TEdgeMeta: Clone,
    {
        GraphSnapshot {
            graph_id: self.graph_id,
            revision,
            nodes: self.nodes.values().cloned().collect(),
            edges: self.edges.values().cloned().collect(),
        }
    }

    fn link(index: &mut HashMap<NodeId, HashSet<EdgeId>>, node: NodeId, edge: EdgeId) {
        index.entry(node).or_default().insert(edge);
    }

    fn unlink(index: &mut HashMap<NodeId, HashSet<EdgeId>>, node: NodeId, edge: EdgeId) {
        if let Some(set) = index.get_mut(&node) {
            set.remove(&edge);
            if set.is_empty() {
                index.remove(&node);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestNodeMeta(&'static str);

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestEdgeMeta(&'static str);

    fn store() -> GraphStore<TestNodeMeta, TestEdgeMeta> {
        GraphStore::new(GraphId::new(1))
    }

    fn node(id: u64, label: &'static str) -> GraphNode<TestNodeMeta> {
        GraphNode {
            id: NodeId::new(id),
            metadata: TestNodeMeta(label),
        }
    }

    fn edge(id: u64, from: u64, to: u64, label: &'static str) -> GraphEdge<TestEdgeMeta> {
        GraphEdge {
            id: EdgeId::new(id),
            from: NodeId::new(from),
            to: NodeId::new(to),
            metadata: TestEdgeMeta(label),
        }
    }

    #[test]
    fn creation_preserves_graph_id() {
        let store = GraphStore::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(9));
        assert_eq!(store.graph_id(), GraphId::new(9));
    }

    #[test]
    fn valid_edge_insertion_updates_outgoing_and_incoming_indices() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));

        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let outgoing: Vec<EdgeId> = store.outgoing_edge_ids(NodeId::new(1)).collect();
        let incoming: Vec<EdgeId> = store.incoming_edge_ids(NodeId::new(2)).collect();

        assert_eq!(outgoing, vec![EdgeId::new(1)]);
        assert_eq!(incoming, vec![EdgeId::new(1)]);
    }

    #[test]
    fn edge_with_missing_endpoint_is_rejected_without_partial_mutation() {
        let mut store = store();
        store.upsert_node(node(1, "a"));

        let result = store.upsert_edge(edge(1, 1, 2, "a-missing"));

        assert_eq!(result, Err(GraphStoreError::MissingToNode(NodeId::new(2))));
        assert!(store.edge(EdgeId::new(1)).is_none());
        assert_eq!(store.outgoing_edge_ids(NodeId::new(1)).count(), 0);
        assert_eq!(store.incoming_edge_ids(NodeId::new(2)).count(), 0);
    }

    #[test]
    fn edge_with_missing_from_node_is_rejected_without_partial_mutation() {
        let mut store = store();
        store.upsert_node(node(2, "b"));

        let result = store.upsert_edge(edge(1, 1, 2, "missing-b"));

        assert_eq!(
            result,
            Err(GraphStoreError::MissingFromNode(NodeId::new(1)))
        );
        assert!(store.edge(EdgeId::new(1)).is_none());
        assert_eq!(store.outgoing_edge_ids(NodeId::new(1)).count(), 0);
        assert_eq!(store.incoming_edge_ids(NodeId::new(2)).count(), 0);
    }

    #[test]
    fn replacing_edge_with_new_endpoints_drops_old_indices() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));
        store.upsert_node(node(3, "c"));
        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        store.upsert_edge(edge(1, 1, 3, "a-c")).unwrap();

        assert_eq!(store.incoming_edge_ids(NodeId::new(2)).count(), 0);
        let incoming_c: Vec<EdgeId> = store.incoming_edge_ids(NodeId::new(3)).collect();
        assert_eq!(incoming_c, vec![EdgeId::new(1)]);
        let outgoing_a: Vec<EdgeId> = store.outgoing_edge_ids(NodeId::new(1)).collect();
        assert_eq!(outgoing_a, vec![EdgeId::new(1)]);
    }

    #[test]
    fn removing_edge_cleans_both_indices() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));
        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let removed = store.remove_edge(EdgeId::new(1));

        assert!(removed.is_some());
        assert_eq!(store.outgoing_edge_ids(NodeId::new(1)).count(), 0);
        assert_eq!(store.incoming_edge_ids(NodeId::new(2)).count(), 0);
    }

    #[test]
    fn removing_node_cleans_incident_edges_and_preserves_unrelated_edge() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));
        store.upsert_node(node(3, "c"));
        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap(); // outgoing de 1
        store.upsert_edge(edge(2, 2, 1, "b-a")).unwrap(); // incoming a 1
        store.upsert_edge(edge(3, 1, 1, "self")).unwrap(); // self-loop en 1
        store.upsert_edge(edge(4, 2, 3, "b-c")).unwrap(); // no relacionada con 1

        store.remove_node(NodeId::new(1));

        assert!(store.node(NodeId::new(1)).is_none());
        assert!(store.edge(EdgeId::new(1)).is_none());
        assert!(store.edge(EdgeId::new(2)).is_none());
        assert!(store.edge(EdgeId::new(3)).is_none());
        assert!(store.edge(EdgeId::new(4)).is_some());

        let outgoing_b: Vec<EdgeId> = store.outgoing_edge_ids(NodeId::new(2)).collect();
        assert_eq!(outgoing_b, vec![EdgeId::new(4)]);
    }

    #[test]
    fn snapshot_preserves_graph_id_and_caller_supplied_revision() {
        let store = store();

        let snapshot = store.snapshot(GraphRevision::new(5));

        assert_eq!(snapshot.graph_id, GraphId::new(1));
        assert_eq!(snapshot.revision, GraphRevision::new(5));
    }

    #[test]
    fn snapshot_contains_currently_canonical_nodes_and_edges() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));
        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let snapshot = store.snapshot(GraphRevision::new(1));

        assert!(snapshot.nodes.iter().any(|n| n.id == NodeId::new(1)));
        assert!(snapshot.nodes.iter().any(|n| n.id == NodeId::new(2)));
        assert!(snapshot.edges.iter().any(|e| e.id == EdgeId::new(1)));
        assert_eq!(snapshot.nodes.len(), 2);
        assert_eq!(snapshot.edges.len(), 1);
    }

    #[test]
    fn snapshot_is_independent_of_later_store_mutations() {
        let mut store = store();
        store.upsert_node(node(1, "a"));
        store.upsert_node(node(2, "b"));
        store.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let snapshot = store.snapshot(GraphRevision::new(1));

        store.remove_edge(EdgeId::new(1));
        store.remove_node(NodeId::new(1));
        store.upsert_node(node(3, "c"));

        assert!(snapshot.nodes.iter().any(|n| n.id == NodeId::new(1)));
        assert!(snapshot.nodes.iter().any(|n| n.id == NodeId::new(2)));
        assert!(snapshot.edges.iter().any(|e| e.id == EdgeId::new(1)));
        assert!(!snapshot.nodes.iter().any(|n| n.id == NodeId::new(3)));
    }

    struct NonCloneMeta;

    #[test]
    fn store_accepts_non_clonable_metadata_without_global_clone_bound() {
        let mut store: GraphStore<NonCloneMeta, NonCloneMeta> = GraphStore::new(GraphId::new(1));

        store.upsert_node(GraphNode {
            id: NodeId::new(1),
            metadata: NonCloneMeta,
        });

        assert!(store.node(NodeId::new(1)).is_some());
    }
}
