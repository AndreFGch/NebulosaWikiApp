import cytoscape from "cytoscape";

export const FOLDER_COLORS: Record<string, string> = {
  notes:    "#8b7cf6",
  projects: "#34d399",
  sources:  "#38bdf8",
  skills:   "#f472b6",
  sessions: "#f59e0b",
  indexes:  "#facc15",
};

export const GRAPH_STYLE = [
  {
    selector: "node",
    style: {
      "background-color": "#303655",
      "label": "data(label)",
      "color": "#40475e",
      "font-size": "9px",
      "font-family": "Inter, Avenir, Helvetica, Arial, sans-serif",
      "text-valign": "bottom",
      "text-halign": "center",
      "text-margin-y": 4,
      "width": "mapData(connections, 0, 20, 13, 28)",
      "height": "mapData(connections, 0, 20, 13, 28)",
      "border-width": 1,
      "border-color": "#424870",
      "border-opacity": 0.6,
      "text-wrap": "ellipsis",
      "text-max-width": "80px",
      "text-opacity": 0,
      "text-outline-width": 0,
    } as unknown as cytoscape.Css.Node,
  },
  ...Object.entries(FOLDER_COLORS).map(([folder, color]) => ({
    selector: `node[folder = "${folder}"]`,
    style: { "background-color": color } as cytoscape.Css.Node,
  })),
  {
    selector: 'node[folder = "indexes"]',
    style: {
      "width": 9,
      "height": 9,
      "opacity": 0.7,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[nodeType = "missing"]',
    style: {
      "background-color": "#2a2d45",
      "border-width": 1,
      "border-color": "#4a4a6a",
      "border-style": "dashed",
      "width": 10,
      "height": 10,
      "opacity": 0.45,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node[nodeType = "orphan"]',
    style: {
      "border-width": 1.5,
      "border-color": "#fb923c",
      "opacity": 0.7,
      "width": 12,
      "height": 12,
    } as cytoscape.Css.Node,
  },
  {
    selector: "node.nw-neighbor",
    style: {
      "text-opacity": 1,
      "color": "#7880a2",
      "font-size": "8.5px",
      "z-index": 5,
      "border-width": 1.5,
      "border-color": "#7c6af7",
      "border-opacity": 0.95,
      "background-blacken": -0.08,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: "node.nw-hovered",
    style: {
      "text-opacity": 1,
      "color": "#c4b5fd",
      "font-size": "10px",
      "z-index": 10,
      "border-width": 2,
      "border-color": "#8b7cf6",
      "border-opacity": 1,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: "node.nw-dimmed",
    style: {
      "opacity": 0.16,
      "text-opacity": 0,
    },
  },
  {
    selector: "node.nw-selected",
    style: {
      "border-width": 2.5,
      "border-color": "#c4b5fd",
      "border-opacity": 1,
      "width": 32,
      "height": 32,
      "text-opacity": 1,
      "color": "#eceef8",
      "font-size": "11px",
      "z-index": 20,
      "background-blacken": -0.12,
      "shadow-blur": 18,
      "shadow-color": "#7c6af7",
      "shadow-offset-x": 0,
      "shadow-offset-y": 0,
      "shadow-opacity": 0.7,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: "node.nw-root",
    style: {
      "width": 30,
      "height": 30,
      "border-width": 2.5,
      "border-color": "#c4b5fd",
      "border-opacity": 1,
      "text-opacity": 1,
      "color": "#e9d5ff",
      "font-size": "10px",
      "z-index": 15,
      "shadow-blur": 14,
      "shadow-color": "#7c6af7",
      "shadow-offset-x": 0,
      "shadow-offset-y": 0,
      "shadow-opacity": 0.55,
    } as unknown as cytoscape.Css.Node,
  },
  {
    selector: "edge",
    style: {
      "width": 0.75,
      "line-color": "#3f466d",
      "target-arrow-shape": "none",
      "curve-style": "straight",
      "opacity": 0.18,
    },
  },
  {
    selector: 'edge[edgeType = "broken"]',
    style: {
      "width": 0.75,
      "line-color": "#5c2020",
      "line-style": "dashed",
      "opacity": 0.18,
    } as cytoscape.Css.Edge,
  },
  {
    selector: "edge.nw-connected",
    style: {
      "opacity": 0.92,
      "width": 2,
      "line-color": "#a78bfa",
    },
  },
  {
    selector: "edge.nw-dimmed-edge",
    style: {
      "opacity": 0.035,
    },
  },
  {
    selector: "edge.nw-connected-hover",
    style: {
      "opacity": 0.88,
      "width": 1.7,
      "line-color": "#9b8cff",
    },
  },
  {
    selector: "edge.nw-dimmed-hover",
    style: {
      "opacity": 0.035,
    },
  },
];
