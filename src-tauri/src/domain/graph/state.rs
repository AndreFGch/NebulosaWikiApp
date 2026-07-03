//! `GraphState`: dueño puro de un `GraphStore` y su `GraphRevision`.
//!
//! `GraphStore` sigue sin conocer revisiones. `GraphState` es el único
//! punto de este tramo que las posee y avanza.

use super::store::{GraphStore, GraphStoreError};
use super::{
    EdgeId, GraphDelta, GraphEdge, GraphId, GraphNode, GraphRevision, GraphSnapshot, NodeId,
};

/// Error cerrado de `GraphState`. Sin strings dinámicos, paths ni errores de SO.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum GraphStateError {
    Store(GraphStoreError),
    RevisionExhausted,
}

pub(crate) struct GraphState<TNodeMeta, TEdgeMeta> {
    store: GraphStore<TNodeMeta, TEdgeMeta>,
    revision: GraphRevision,
}

impl<TNodeMeta, TEdgeMeta> GraphState<TNodeMeta, TEdgeMeta> {
    pub(crate) fn new(graph_id: GraphId) -> Self {
        Self {
            store: GraphStore::new(graph_id),
            revision: GraphRevision::initial(),
        }
    }

    pub(crate) fn graph_id(&self) -> GraphId {
        self.store.graph_id()
    }

    pub(crate) fn revision(&self) -> GraphRevision {
        self.revision
    }

    pub(crate) fn node(&self, id: NodeId) -> Option<&GraphNode<TNodeMeta>> {
        self.store.node(id)
    }

    pub(crate) fn edge(&self, id: EdgeId) -> Option<&GraphEdge<TEdgeMeta>> {
        self.store.edge(id)
    }

    pub(crate) fn outgoing_edge_ids(&self, node: NodeId) -> impl Iterator<Item = EdgeId> + '_ {
        self.store.outgoing_edge_ids(node)
    }

    pub(crate) fn incoming_edge_ids(&self, node: NodeId) -> impl Iterator<Item = EdgeId> + '_ {
        self.store.incoming_edge_ids(node)
    }

    pub(crate) fn snapshot(&self) -> GraphSnapshot<TNodeMeta, TEdgeMeta>
    where
        TNodeMeta: Clone,
        TEdgeMeta: Clone,
    {
        self.store.snapshot(self.revision)
    }

    /// Inserta o reemplaza un nodo. Siempre cuenta como mutación aceptada.
    pub(crate) fn upsert_node(
        &mut self,
        node: GraphNode<TNodeMeta>,
    ) -> Result<(), GraphStateError> {
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        self.store.upsert_node(node);
        self.revision = next;
        Ok(())
    }

    /// Inserta o reemplaza una arista. Si el store la rechaza, ni la
    /// topología ni la revisión cambian.
    pub(crate) fn upsert_edge(
        &mut self,
        edge: GraphEdge<TEdgeMeta>,
    ) -> Result<(), GraphStateError> {
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        self.store
            .upsert_edge(edge)
            .map_err(GraphStateError::Store)?;
        self.revision = next;
        Ok(())
    }

    /// Elimina un nodo existente y avanza la revisión. Si no existe,
    /// retorna `Ok(None)` sin cambiar revisión ni store.
    pub(crate) fn remove_node(
        &mut self,
        id: NodeId,
    ) -> Result<Option<GraphNode<TNodeMeta>>, GraphStateError> {
        if self.store.node(id).is_none() {
            return Ok(None);
        }
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let removed = self.store.remove_node(id);
        self.revision = next;
        Ok(removed)
    }

    /// Elimina una arista existente y avanza la revisión. Si no existe,
    /// retorna `Ok(None)` sin cambiar revisión ni store.
    pub(crate) fn remove_edge(
        &mut self,
        id: EdgeId,
    ) -> Result<Option<GraphEdge<TEdgeMeta>>, GraphStateError> {
        if self.store.edge(id).is_none() {
            return Ok(None);
        }
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let removed = self.store.remove_edge(id);
        self.revision = next;
        Ok(removed)
    }

    /// Igual que `upsert_node`, pero además arma el `GraphDelta` estructural
    /// de la mutación aceptada (nodo nuevo vs. reemplazo).
    pub(crate) fn upsert_node_with_delta(
        &mut self,
        node: GraphNode<TNodeMeta>,
    ) -> Result<GraphDelta<TNodeMeta, TEdgeMeta>, GraphStateError>
    where
        TNodeMeta: Clone,
    {
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let existed = self.store.node(node.id).is_some();
        let from_revision = self.revision;
        let inserted = node.clone();

        self.store.upsert_node(node);
        self.revision = next;

        let mut delta = empty_delta(self.store.graph_id(), from_revision, next);
        if existed {
            delta.updated_nodes.push(inserted);
        } else {
            delta.added_nodes.push(inserted);
        }
        Ok(delta)
    }

    /// Igual que `upsert_edge`, pero además arma el `GraphDelta` estructural
    /// de la mutación aceptada (arista nueva vs. reemplazo). Si el store
    /// rechaza la arista, no se emite delta ni cambia revisión/topología.
    pub(crate) fn upsert_edge_with_delta(
        &mut self,
        edge: GraphEdge<TEdgeMeta>,
    ) -> Result<GraphDelta<TNodeMeta, TEdgeMeta>, GraphStateError>
    where
        TEdgeMeta: Clone,
    {
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let existed = self.store.edge(edge.id).is_some();
        let from_revision = self.revision;
        let inserted = edge.clone();

        self.store
            .upsert_edge(edge)
            .map_err(GraphStateError::Store)?;
        self.revision = next;

        let mut delta = empty_delta(self.store.graph_id(), from_revision, next);
        if existed {
            delta.updated_edges.push(inserted);
        } else {
            delta.added_edges.push(inserted);
        }
        Ok(delta)
    }

    /// Igual que `remove_node`, pero además arma el `GraphDelta` estructural:
    /// el `NodeId` removido y las aristas incidentes eliminadas por cascada
    /// (una self-loop aparece una sola vez).
    pub(crate) fn remove_node_with_delta(
        &mut self,
        id: NodeId,
    ) -> Result<Option<GraphDelta<TNodeMeta, TEdgeMeta>>, GraphStateError> {
        if self.store.node(id).is_none() {
            return Ok(None);
        }
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let from_revision = self.revision;

        let mut removed_edge_ids: Vec<EdgeId> = self.store.outgoing_edge_ids(id).collect();
        for edge_id in self.store.incoming_edge_ids(id) {
            if !removed_edge_ids.contains(&edge_id) {
                removed_edge_ids.push(edge_id);
            }
        }

        self.store.remove_node(id);
        self.revision = next;

        let mut delta = empty_delta(self.store.graph_id(), from_revision, next);
        delta.removed_node_ids.push(id);
        delta.removed_edge_ids = removed_edge_ids;
        Ok(Some(delta))
    }

    /// Igual que `remove_edge`, pero además arma el `GraphDelta` estructural
    /// con únicamente ese `EdgeId` en `removed_edge_ids`.
    pub(crate) fn remove_edge_with_delta(
        &mut self,
        id: EdgeId,
    ) -> Result<Option<GraphDelta<TNodeMeta, TEdgeMeta>>, GraphStateError> {
        if self.store.edge(id).is_none() {
            return Ok(None);
        }
        let next = self
            .revision
            .advance()
            .ok_or(GraphStateError::RevisionExhausted)?;
        let from_revision = self.revision;

        self.store.remove_edge(id);
        self.revision = next;

        let mut delta = empty_delta(self.store.graph_id(), from_revision, next);
        delta.removed_edge_ids.push(id);
        Ok(Some(delta))
    }
}

fn empty_delta<TNodeMeta, TEdgeMeta>(
    graph_id: GraphId,
    from_revision: GraphRevision,
    to_revision: GraphRevision,
) -> GraphDelta<TNodeMeta, TEdgeMeta> {
    GraphDelta {
        graph_id,
        from_revision,
        to_revision,
        added_nodes: Vec::new(),
        removed_node_ids: Vec::new(),
        updated_nodes: Vec::new(),
        added_edges: Vec::new(),
        removed_edge_ids: Vec::new(),
        updated_edges: Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestNodeMeta(&'static str);

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct TestEdgeMeta(&'static str);

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
    fn starts_with_given_graph_id_and_initial_revision() {
        let state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(7));

        assert_eq!(state.graph_id(), GraphId::new(7));
        assert_eq!(state.revision(), GraphRevision::initial());
    }

    #[test]
    fn inserting_node_advances_revision_and_snapshot_contains_it() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        let before = state.revision();

        state.upsert_node(node(1, "a")).unwrap();

        assert!(state.revision() != before);
        let snapshot = state.snapshot();
        assert!(snapshot.nodes.iter().any(|n| n.id == NodeId::new(1)));
        assert_eq!(snapshot.revision, state.revision());
    }

    #[test]
    fn each_accepted_mutation_advances_revision_by_one_step() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));

        state.upsert_node(node(1, "a")).unwrap();
        let after_first = state.revision();
        state.upsert_node(node(2, "b")).unwrap();
        let after_second = state.revision();
        state.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();
        let after_third = state.revision();

        assert_eq!(after_first, GraphRevision::new(1));
        assert_eq!(after_second, GraphRevision::new(2));
        assert_eq!(after_third, GraphRevision::new(3));
    }

    #[test]
    fn invalid_edge_returns_store_error_without_changing_revision_or_snapshot() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        let before = state.revision();
        let before_snapshot = state.snapshot();

        let result = state.upsert_edge(edge(1, 1, 2, "a-missing"));

        assert_eq!(
            result,
            Err(GraphStateError::Store(GraphStoreError::MissingToNode(
                NodeId::new(2)
            )))
        );
        assert_eq!(state.revision(), before);
        assert_eq!(state.snapshot(), before_snapshot);
    }

    #[test]
    fn removing_missing_node_or_edge_does_not_change_revision() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        let before = state.revision();

        assert_eq!(state.remove_node(NodeId::new(1)).unwrap(), None);
        assert_eq!(state.remove_edge(EdgeId::new(1)).unwrap(), None);
        assert_eq!(state.revision(), before);
    }

    #[test]
    fn removing_existing_edge_advances_revision() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        state.upsert_node(node(2, "b")).unwrap();
        state.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let outgoing_before: Vec<EdgeId> = state.outgoing_edge_ids(NodeId::new(1)).collect();
        let incoming_before: Vec<EdgeId> = state.incoming_edge_ids(NodeId::new(2)).collect();

        assert_eq!(outgoing_before, vec![EdgeId::new(1)]);
        assert_eq!(incoming_before, vec![EdgeId::new(1)]);

        let removed = state.remove_edge(EdgeId::new(1)).unwrap();

        assert!(removed.is_some());
        assert_eq!(state.revision(), GraphRevision::new(4));
        assert_eq!(state.outgoing_edge_ids(NodeId::new(1)).count(), 0);
        assert_eq!(state.incoming_edge_ids(NodeId::new(2)).count(), 0);
    }

    #[test]
    fn removing_existing_node_advances_revision_and_drops_incident_edges() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        state.upsert_node(node(2, "b")).unwrap();
        state.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();

        let removed = state.remove_node(NodeId::new(1)).unwrap();

        assert!(removed.is_some());
        assert_eq!(state.revision(), GraphRevision::new(4));
        assert!(state.edge(EdgeId::new(1)).is_none());
    }

    struct NonCloneMeta;

    #[test]
    fn accepts_non_clonable_metadata_for_mutations_and_queries() {
        let mut state: GraphState<NonCloneMeta, NonCloneMeta> = GraphState::new(GraphId::new(1));

        state
            .upsert_node(GraphNode {
                id: NodeId::new(1),
                metadata: NonCloneMeta,
            })
            .unwrap();

        assert!(state.node(NodeId::new(1)).is_some());
    }

    #[test]
    fn revision_exhaustion_is_rejected_without_mutating_store() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta> {
            store: GraphStore::new(GraphId::new(1)),
            revision: GraphRevision::new(u64::MAX),
        };

        let result = state.upsert_node(node(1, "a"));

        assert_eq!(result, Err(GraphStateError::RevisionExhausted));
        assert!(state.node(NodeId::new(1)).is_none());
        assert_eq!(state.revision, GraphRevision::new(u64::MAX));
    }

    #[test]
    fn upsert_node_with_delta_reports_new_node_as_added() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));

        let delta = state.upsert_node_with_delta(node(1, "a")).unwrap();

        assert_eq!(delta.graph_id, GraphId::new(1));
        assert_eq!(delta.from_revision, GraphRevision::initial());
        assert_eq!(delta.to_revision, GraphRevision::new(1));
        assert_eq!(delta.added_nodes, vec![node(1, "a")]);
        assert!(delta.updated_nodes.is_empty());
    }

    #[test]
    fn upsert_node_with_delta_reports_existing_node_id_as_updated() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();

        let delta = state.upsert_node_with_delta(node(1, "b")).unwrap();

        assert_eq!(delta.from_revision, GraphRevision::new(1));
        assert_eq!(delta.to_revision, GraphRevision::new(2));
        assert!(delta.added_nodes.is_empty());
        assert_eq!(delta.updated_nodes, vec![node(1, "b")]);
    }

    #[test]
    fn upsert_edge_with_delta_reports_new_edge_then_replacement_as_updated() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        state.upsert_node(node(2, "b")).unwrap();

        let added_delta = state.upsert_edge_with_delta(edge(1, 1, 2, "a-b")).unwrap();

        assert_eq!(added_delta.from_revision, GraphRevision::new(2));
        assert_eq!(added_delta.to_revision, GraphRevision::new(3));
        assert_eq!(added_delta.added_edges, vec![edge(1, 1, 2, "a-b")]);
        assert!(added_delta.updated_edges.is_empty());

        let updated_delta = state
            .upsert_edge_with_delta(edge(1, 1, 2, "a-b-v2"))
            .unwrap();

        assert_eq!(updated_delta.from_revision, GraphRevision::new(3));
        assert_eq!(updated_delta.to_revision, GraphRevision::new(4));
        assert!(updated_delta.added_edges.is_empty());
        assert_eq!(updated_delta.updated_edges, vec![edge(1, 1, 2, "a-b-v2")]);
    }

    #[test]
    fn upsert_edge_with_delta_rejects_invalid_edge_without_side_effects() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        let before = state.revision();
        let before_snapshot = state.snapshot();

        let result = state.upsert_edge_with_delta(edge(1, 1, 2, "a-missing"));

        assert_eq!(
            result,
            Err(GraphStateError::Store(GraphStoreError::MissingToNode(
                NodeId::new(2)
            )))
        );
        assert_eq!(state.revision(), before);
        assert_eq!(state.snapshot(), before_snapshot);
    }

    #[test]
    fn remove_node_with_delta_reports_missing_without_advancing_revision() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        let before = state.revision();

        let result = state.remove_node_with_delta(NodeId::new(1));

        assert_eq!(result.unwrap(), None);
        assert_eq!(state.revision(), before);
        assert!(state.node(NodeId::new(1)).is_none());
    }

    #[test]
    fn remove_edge_with_delta_reports_missing_and_existing_edge() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        state.upsert_node(node(2, "b")).unwrap();
        state.upsert_edge(edge(1, 1, 2, "a-b")).unwrap();
        let before = state.revision();

        assert_eq!(state.remove_edge_with_delta(EdgeId::new(2)).unwrap(), None);
        assert_eq!(state.revision(), before);

        let delta = state
            .remove_edge_with_delta(EdgeId::new(1))
            .unwrap()
            .unwrap();

        assert_eq!(delta.from_revision, before);
        assert_eq!(delta.to_revision, GraphRevision::new(4));
        assert_eq!(delta.removed_edge_ids, vec![EdgeId::new(1)]);
        assert!(delta.added_nodes.is_empty());
        assert!(delta.removed_node_ids.is_empty());
        assert!(delta.updated_nodes.is_empty());
        assert!(delta.added_edges.is_empty());
        assert!(delta.updated_edges.is_empty());
    }

    #[test]
    fn remove_node_with_delta_reports_node_and_all_incident_edges_once_each() {
        let mut state = GraphState::<TestNodeMeta, TestEdgeMeta>::new(GraphId::new(1));
        state.upsert_node(node(1, "a")).unwrap();
        state.upsert_node(node(2, "b")).unwrap();
        state.upsert_edge(edge(1, 1, 2, "out")).unwrap(); // saliente de 1
        state.upsert_edge(edge(2, 2, 1, "in")).unwrap(); // entrante a 1
        state.upsert_edge(edge(3, 1, 1, "self")).unwrap(); // self-loop en 1
        let before = state.revision();

        let delta = state
            .remove_node_with_delta(NodeId::new(1))
            .unwrap()
            .unwrap();

        assert_eq!(delta.from_revision, before);
        assert_eq!(delta.to_revision, GraphRevision::new(6));
        assert_eq!(state.revision(), GraphRevision::new(6));
        assert_eq!(delta.removed_node_ids, vec![NodeId::new(1)]);
        assert_eq!(delta.removed_edge_ids.len(), 3);
        assert!(delta.removed_edge_ids.contains(&EdgeId::new(1)));
        assert!(delta.removed_edge_ids.contains(&EdgeId::new(2)));
        assert!(delta.removed_edge_ids.contains(&EdgeId::new(3)));
        assert!(delta.added_nodes.is_empty());
        assert!(delta.updated_nodes.is_empty());
        assert!(delta.added_edges.is_empty());
        assert!(delta.updated_edges.is_empty());
    }

    #[test]
    fn non_delta_apis_still_accept_non_clonable_metadata() {
        let mut state: GraphState<NonCloneMeta, NonCloneMeta> = GraphState::new(GraphId::new(1));

        state
            .upsert_node(GraphNode {
                id: NodeId::new(1),
                metadata: NonCloneMeta,
            })
            .unwrap();
        state
            .upsert_node(GraphNode {
                id: NodeId::new(2),
                metadata: NonCloneMeta,
            })
            .unwrap();
        state
            .upsert_edge(GraphEdge {
                id: EdgeId::new(1),
                from: NodeId::new(1),
                to: NodeId::new(2),
                metadata: NonCloneMeta,
            })
            .unwrap();

        assert!(state.remove_edge(EdgeId::new(1)).unwrap().is_some());
        assert!(state.remove_node(NodeId::new(1)).unwrap().is_some());
    }
}
