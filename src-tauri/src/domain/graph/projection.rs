//! `GraphProjection`: vista estructural global e inmutable de un `GraphState`
//! en un instante dado. Solo membresía de `NodeId`/`EdgeId`, sin metadata,
//! sin paths, sin layout, sin lógica de presentación.

use std::collections::HashSet;

use super::{EdgeId, GraphId, GraphRevision, NodeId};

pub(crate) struct GraphProjection {
    graph_id: GraphId,
    revision: GraphRevision,
    node_ids: HashSet<NodeId>,
    edge_ids: HashSet<EdgeId>,
}

impl GraphProjection {
    /// Construcción interna al crate: solo `GraphState` arma proyecciones,
    /// nunca directamente desde IDs arbitrarios externos.
    pub(super) fn new(
        graph_id: GraphId,
        revision: GraphRevision,
        node_ids: HashSet<NodeId>,
        edge_ids: HashSet<EdgeId>,
    ) -> Self {
        Self {
            graph_id,
            revision,
            node_ids,
            edge_ids,
        }
    }

    pub(crate) fn graph_id(&self) -> GraphId {
        self.graph_id
    }

    pub(crate) fn revision(&self) -> GraphRevision {
        self.revision
    }

    pub(crate) fn node_count(&self) -> usize {
        self.node_ids.len()
    }

    pub(crate) fn edge_count(&self) -> usize {
        self.edge_ids.len()
    }

    pub(crate) fn contains_node(&self, id: NodeId) -> bool {
        self.node_ids.contains(&id)
    }

    pub(crate) fn contains_edge(&self, id: EdgeId) -> bool {
        self.edge_ids.contains(&id)
    }

    /// IDs de nodos incluidos. Orden no contractual: respaldo `HashSet`.
    pub(crate) fn node_ids(&self) -> impl Iterator<Item = NodeId> + '_ {
        self.node_ids.iter().copied()
    }

    /// IDs de aristas incluidas. Orden no contractual: respaldo `HashSet`.
    pub(crate) fn edge_ids(&self) -> impl Iterator<Item = EdgeId> + '_ {
        self.edge_ids.iter().copied()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn projection_reports_given_graph_id_and_revision() {
        let projection = GraphProjection::new(
            GraphId::new(3),
            GraphRevision::new(2),
            HashSet::new(),
            HashSet::new(),
        );

        assert_eq!(projection.graph_id(), GraphId::new(3));
        assert_eq!(projection.revision(), GraphRevision::new(2));
        assert_eq!(projection.node_count(), 0);
        assert_eq!(projection.edge_count(), 0);
    }

    #[test]
    fn projection_reports_membership_and_counts() {
        let node_ids = HashSet::from([NodeId::new(1), NodeId::new(2)]);
        let edge_ids = HashSet::from([EdgeId::new(1)]);
        let projection =
            GraphProjection::new(GraphId::new(1), GraphRevision::new(1), node_ids, edge_ids);

        assert_eq!(projection.node_count(), 2);
        assert_eq!(projection.edge_count(), 1);
        assert!(projection.contains_node(NodeId::new(1)));
        assert!(projection.contains_node(NodeId::new(2)));
        assert!(!projection.contains_node(NodeId::new(3)));
        assert!(projection.contains_edge(EdgeId::new(1)));
        assert!(!projection.contains_edge(EdgeId::new(2)));
    }

    #[test]
    fn projection_enumerates_ids_without_contractual_order() {
        let node_ids = HashSet::from([NodeId::new(1), NodeId::new(2)]);
        let edge_ids = HashSet::from([EdgeId::new(1)]);
        let projection =
            GraphProjection::new(GraphId::new(1), GraphRevision::new(1), node_ids, edge_ids);

        let node_ids: HashSet<NodeId> = projection.node_ids().collect();
        let edge_ids: HashSet<EdgeId> = projection.edge_ids().collect();

        assert_eq!(node_ids, HashSet::from([NodeId::new(1), NodeId::new(2)]));
        assert_eq!(edge_ids, HashSet::from([EdgeId::new(1)]));
    }
}
