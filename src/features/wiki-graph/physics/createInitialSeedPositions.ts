import type { PhysicsEdgeLink, PhysicsPoint } from "./physicalGraphTypes";

const MIN_GRID_SPACING = 56;
const MAX_GRID_SPACING = 84;
const MAX_COMPONENT_HALF_EXTENT = 560;
const COMPONENT_GAP = 144;

interface Component {
  readonly indices: readonly number[];
  readonly minNodeId: string;
}

interface LocalLayout {
  readonly localPositions: ReadonlyMap<number, PhysicsPoint>;
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

function buildAdjacency(
  nodeCount: number,
  edgeLinks: readonly PhysicsEdgeLink[],
  nodeIds: readonly string[],
): number[][] {
  const adjacency: number[][] = Array.from(
    { length: nodeCount },
    () => [],
  );

  for (const { si, ti } of edgeLinks) {
    if (
      !Number.isInteger(si) ||
      !Number.isInteger(ti) ||
      si < 0 ||
      ti < 0 ||
      si >= nodeCount ||
      ti >= nodeCount ||
      si === ti
    ) {
      continue;
    }

    adjacency[si].push(ti);
    adjacency[ti].push(si);
  }

  for (let index = 0; index < nodeCount; index++) {
    adjacency[index].sort((left, right) => {
      const leftId = nodeIds[left];
      const rightId = nodeIds[right];

      return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
  }

  return adjacency;
}

function detectComponents(
  nodeIds: readonly string[],
  adjacency: readonly number[][],
): Component[] {
  const visited = new Uint8Array(nodeIds.length);
  const components: Component[] = [];

  const sortedIndices = Array.from(
    { length: nodeIds.length },
    (_, index) => index,
  ).sort((left, right) => {
    const leftId = nodeIds[left];
    const rightId = nodeIds[right];

    return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
  });

  for (const startIndex of sortedIndices) {
    if (visited[startIndex]) {
      continue;
    }

    const indices: number[] = [];
    const queue: number[] = [startIndex];
    visited[startIndex] = 1;

    let head = 0;

    while (head < queue.length) {
      const currentIndex = queue[head++];
      indices.push(currentIndex);

      for (const neighborIndex of adjacency[currentIndex]) {
        if (visited[neighborIndex]) {
          continue;
        }

        visited[neighborIndex] = 1;
        queue.push(neighborIndex);
      }
    }

    let minNodeId = nodeIds[indices[0]];

    for (const index of indices) {
      const nodeId = nodeIds[index];

      if (nodeId < minNodeId) {
        minNodeId = nodeId;
      }
    }

    components.push({
      indices,
      minNodeId,
    });
  }

  return components;
}

function buildSpiralCells(
  count: number,
): ReadonlyArray<readonly [number, number]> {
  const cells: Array<readonly [number, number]> = [];

  if (count <= 0) {
    return cells;
  }

  cells.push([0, 0]);

  for (let layer = 1; cells.length < count; layer++) {
    for (let x = -layer; x <= layer && cells.length < count; x++) {
      cells.push([x, -layer]);
    }

    for (let y = -layer + 1; y <= layer && cells.length < count; y++) {
      cells.push([layer, y]);
    }

    for (let x = layer - 1; x >= -layer && cells.length < count; x--) {
      cells.push([x, layer]);
    }

    for (let y = layer - 1; y >= -layer + 1 && cells.length < count; y--) {
      cells.push([-layer, y]);
    }
  }

  return cells;
}

function computeSpacing(nodeCount: number): number {
  if (nodeCount <= 1) {
    return MAX_GRID_SPACING;
  }

  const maxLayer = Math.ceil((Math.sqrt(nodeCount) - 1) / 2);
  const rawSpacing =
    MAX_COMPONENT_HALF_EXTENT / Math.max(maxLayer, 1);

  return Math.max(
    MIN_GRID_SPACING,
    Math.min(MAX_GRID_SPACING, rawSpacing),
  );
}

function layoutComponentLocal(
  component: Component,
  adjacency: readonly number[][],
  anchorIndex: number,
): LocalLayout {
  const spacing = computeSpacing(component.indices.length);
  const cells = buildSpiralCells(component.indices.length);

  const bfsOrder: number[] = [];
  const visited = new Set<number>();

  const startIndex = component.indices.includes(anchorIndex)
    ? anchorIndex
    : component.indices[0];

  visited.add(startIndex);

  const queue: number[] = [startIndex];
  let head = 0;

  while (head < queue.length) {
    const currentIndex = queue[head++];
    bfsOrder.push(currentIndex);

    for (const neighborIndex of adjacency[currentIndex]) {
      if (visited.has(neighborIndex)) {
        continue;
      }

      visited.add(neighborIndex);
      queue.push(neighborIndex);
    }
  }

  for (const index of component.indices) {
    if (!visited.has(index)) {
      bfsOrder.push(index);
    }
  }

  const localPositions = new Map<number, PhysicsPoint>();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (let orderIndex = 0; orderIndex < bfsOrder.length; orderIndex++) {
    const nodeIndex = bfsOrder[orderIndex];
    const [gridX, gridY] = cells[orderIndex];

    const x = gridX * spacing;
    const y = gridY * spacing;

    localPositions.set(nodeIndex, { x, y });

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  return {
    localPositions,
    minX,
    maxX,
    minY,
    maxY,
  };
}

function findLexMinAnchor(
  component: Component,
  nodeIds: readonly string[],
): number {
  let minIndex = component.indices[0];
  let minNodeId = nodeIds[minIndex];

  for (const index of component.indices) {
    const nodeId = nodeIds[index];

    if (nodeId < minNodeId) {
      minNodeId = nodeId;
      minIndex = index;
    }
  }

  return minIndex;
}

export function createInitialSeedPositions(
  nodeIds: readonly string[],
  edgeLinks: readonly PhysicsEdgeLink[],
  rootNodeId: string | null,
): Map<string, PhysicsPoint> {
  const result = new Map<string, PhysicsPoint>();
  const nodeCount = nodeIds.length;

  if (nodeCount === 0) {
    return result;
  }

  if (nodeCount === 1) {
    result.set(nodeIds[0], { x: 0, y: 0 });
    return result;
  }

  const adjacency = buildAdjacency(nodeCount, edgeLinks, nodeIds);
  const components = detectComponents(nodeIds, adjacency);

  const rootNodeIndex =
    rootNodeId === null ? -1 : nodeIds.indexOf(rootNodeId);

  let primaryComponentIndex = -1;

  if (rootNodeIndex >= 0) {
    primaryComponentIndex = components.findIndex((component) =>
      component.indices.includes(rootNodeIndex),
    );
  }

  if (primaryComponentIndex < 0) {
    let bestSize = -1;
    let bestMinNodeId = "";

    for (let index = 0; index < components.length; index++) {
      const component = components[index];
      const size = component.indices.length;

      if (
        size > bestSize ||
        (size === bestSize && component.minNodeId < bestMinNodeId)
      ) {
        bestSize = size;
        bestMinNodeId = component.minNodeId;
        primaryComponentIndex = index;
      }
    }
  }

  const primaryComponent = components[primaryComponentIndex];

  const primaryAnchor =
    rootNodeIndex >= 0 &&
    primaryComponent.indices.includes(rootNodeIndex)
      ? rootNodeIndex
      : findLexMinAnchor(primaryComponent, nodeIds);

  const primaryLayout = layoutComponentLocal(
    primaryComponent,
    adjacency,
    primaryAnchor,
  );

  for (const [nodeIndex, point] of primaryLayout.localPositions) {
    result.set(nodeIds[nodeIndex], point);
  }

  const secondaryComponents = components
    .filter((_, index) => index !== primaryComponentIndex)
    .sort((left, right) => {
      const sizeDifference = right.indices.length - left.indices.length;

      if (sizeDifference !== 0) {
        return sizeDifference;
      }

      return left.minNodeId < right.minNodeId
        ? -1
        : left.minNodeId > right.minNodeId
          ? 1
          : 0;
    });

  if (secondaryComponents.length === 0) {
    return result;
  }

  const secondaryLayouts = secondaryComponents.map((component) => {
    const anchor = findLexMinAnchor(component, nodeIds);

    return layoutComponentLocal(component, adjacency, anchor);
  });

  const columnCount = Math.ceil(Math.sqrt(secondaryComponents.length));

  let currentY = primaryLayout.maxY + COMPONENT_GAP;
  let componentOffset = 0;

  while (componentOffset < secondaryComponents.length) {
    const rowEnd = Math.min(
      componentOffset + columnCount,
      secondaryComponents.length,
    );

    const rowItemCount = rowEnd - componentOffset;

    let totalRowWidth = 0;

    for (let index = componentOffset; index < rowEnd; index++) {
      const layout = secondaryLayouts[index];
      totalRowWidth += layout.maxX - layout.minX;
    }

    totalRowWidth += (rowItemCount - 1) * COMPONENT_GAP;

    let currentX = -totalRowWidth / 2;
    let rowMaxBottom = -Infinity;

    for (let index = componentOffset; index < rowEnd; index++) {
      const layout = secondaryLayouts[index];

      const width = layout.maxX - layout.minX;
      const height = layout.maxY - layout.minY;

      const offsetX = currentX - layout.minX;
      const offsetY = currentY - layout.minY;

      for (const [nodeIndex, point] of layout.localPositions) {
        result.set(nodeIds[nodeIndex], {
          x: point.x + offsetX,
          y: point.y + offsetY,
        });
      }

      rowMaxBottom = Math.max(rowMaxBottom, currentY + height);
      currentX += width + COMPONENT_GAP;
    }

    currentY = rowMaxBottom + COMPONENT_GAP;
    componentOffset = rowEnd;
  }

  return result;
}