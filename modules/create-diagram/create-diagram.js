/**
 * modules/create-diagram/create-diagram.js
 * ----------------------------------------------------------------
 * CreateDiagram module v2 — draw.io-style canvas:
 *   - Shape palette (click a shape, it drops onto canvas)
 *   - Real connector handles (drag from a node's edge dot to another node)
 *   - Select node/connector -> delete or rename
 *   - Zoom (wheel + buttons) and pan (drag empty canvas)
 *
 * Render strategy: one SVG element is the whole canvas. A single
 * <g id="viewport"> group holds everything and gets a CSS-style
 * transform (translate + scale) for pan/zoom — this keeps connector
 * lines crisp at any zoom level instead of fighting with HTML/CSS
 * positioning.
 *
 * Still fully independent of AnalyzeDiagram/Settings — only talks
 * to storage.js.
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";

const SHAPE_TYPES = [
  { type: "rect", label: "Box", w: 110, h: 56 },
  { type: "rounded", label: "Process", w: 120, h: 56 },
  { type: "ellipse", label: "Circle", w: 100, h: 70 },
  { type: "diamond", label: "Decision", w: 120, h: 80 },
  { type: "triangle", label: "Triangle", w: 90, h: 80 },
  { type: "cylinder", label: "Database", w: 90, h: 80 },
  { type: "hexagon", label: "Hexagon", w: 120, h: 64 },
  { type: "parallelogram", label: "Input/Output", w: 120, h: 60 },
  { type: "cloud", label: "Cloud", w: 120, h: 76 },
  { type: "callout", label: "Callout", w: 120, h: 70 },
  { type: "person", label: "Actor", w: 60, h: 90 },
  { type: "document", label: "Document", w: 110, h: 70 },
  { type: "text", label: "Text", w: 90, h: 30 },
];

/** Small SVG icon glyphs (24x24 viewBox) for palette tiles — drawn as outline shapes, matching the canvas style. */
const SHAPE_ICONS = {
  rect: `<rect x="3" y="6" width="18" height="12" rx="1.5"/>`,
  rounded: `<rect x="3" y="6" width="18" height="12" rx="6"/>`,
  ellipse: `<ellipse cx="12" cy="12" rx="9" ry="6.5"/>`,
  diamond: `<polygon points="12,3 21,12 12,21 3,12"/>`,
  triangle: `<polygon points="12,4 21,20 3,20"/>`,
  cylinder: `<path d="M4 7c0-1.7 3.6-3 8-3s8 1.3 8 3v10c0 1.7-3.6 3-8 3s-8-1.3-8-3z"/><ellipse cx="12" cy="7" rx="8" ry="3"/>`,
  hexagon: `<polygon points="7,4 17,4 21,12 17,20 7,20 3,12"/>`,
  parallelogram: `<polygon points="7,6 21,6 17,18 3,18"/>`,
  cloud: `<path d="M6 17a4 4 0 0 1-1-7.9 5 5 0 0 1 9.6-2A4.5 4.5 0 0 1 18 16.5a3.5 3.5 0 0 1-.5.5z"/>`,
  callout: `<path d="M3 5h18v10H9l-4 4v-4H3z"/>`,
  person: `<circle cx="12" cy="6" r="3"/><path d="M6 21v-3a6 6 0 0 1 12 0v3"/>`,
  document: `<path d="M4 4h16v13c-2 0-2 2-4 2s-2-2-4-2-2 2-4 2-2-2-4-2z"/>`,
  text: `<line x1="5" y1="6" x2="19" y2="6"/><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="18" x2="13" y2="18"/>`,
};

/** Toolbar icon glyphs (24x24 viewBox), stroke-based, matching draw.io's compact icon strip. */
const TOOLBAR_ICONS = {
  zoomIn: `<circle cx="10" cy="10" r="6"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="10" y1="7" x2="10" y2="13"/><line x1="7" y1="10" x2="13" y2="10"/>`,
  zoomOut: `<circle cx="10" cy="10" r="6"/><line x1="14.5" y1="14.5" x2="20" y2="20"/><line x1="7" y1="10" x2="13" y2="10"/>`,
  undo: `<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>`,
  redo: `<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h1"/>`,
  trash: `<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>`,
  download: `<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 19h14"/>`,
  save: `<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v6h8V4"/><path d="M8 14h8v6H8z"/>`,
  fitToView: `<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M20 9V5a1 1 0 0 0-1-1h-4"/><path d="M4 15v4a1 1 0 0 0 1 1h4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/>`,
};

const LINE_STYLES = [
  { key: "straight", label: "Straight" },
  { key: "curved", label: "Curved" },
  { key: "orthogonal", label: "Right angle" },
];

/** Fill color swatches offered when a node is selected. First entry is "no fill override" (uses the default dark fill). */
const NODE_COLORS = [
  { key: "", swatch: "#0a0907", label: "Default" },
  { key: "#d4ff3a", swatch: "#d4ff3a", label: "Lime" },
  { key: "#4ee08a", swatch: "#4ee08a", label: "Green" },
  { key: "#5ab8ff", swatch: "#5ab8ff", label: "Blue" },
  { key: "#ff8a5c", swatch: "#ff8a5c", label: "Orange" },
  { key: "#ff5a4e", swatch: "#ff5a4e", label: "Red" },
  { key: "#c98fff", swatch: "#c98fff", label: "Purple" },
];

const HANDLE_R = 5;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.5;

let state = null;
let containerEl = null;
let svgEl = null;
let viewportEl = null;

function freshState() {
  return {
    diagramId: null,
    name: "diagram_01",
    nodes: [],        // { id, type, label, x, y, w, h }
    connectors: [],   // { id, from, to, label }
    selection: null,  // { kind: 'node'|'connector', id }
    pan: { x: 60, y: 40 },
    scale: 1,
    drag: null,        // active node drag info
    connecting: null,  // active connector-draw info
    panning: null,     // active canvas-pan info
    undoStack: [],      // snapshots of {nodes, connectors} before each change
    redoStack: [],
  };
}

export function initCreateDiagramView(container) {
  containerEl = container;
  state = freshState();
  lastTapByNodeId = {};
  lastTapByConnId = {};
  render();
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ----------------------------------------------------------------
// Undo / Redo
// ----------------------------------------------------------------

const MAX_HISTORY = 50;

/** Call BEFORE a mutation to push the current state onto the undo stack. */
function snapshot() {
  state.undoStack.push({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    connectors: JSON.parse(JSON.stringify(state.connectors)),
  });
  if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
  state.redoStack = [];
}

function undo() {
  if (state.undoStack.length === 0) return;
  const prev = state.undoStack.pop();
  state.redoStack.push({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    connectors: JSON.parse(JSON.stringify(state.connectors)),
  });
  state.nodes = prev.nodes;
  state.connectors = prev.connectors;
  setSelection(null, null);
  renderIconToolbar();
}

function redo() {
  if (state.redoStack.length === 0) return;
  const next = state.redoStack.pop();
  state.undoStack.push({
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    connectors: JSON.parse(JSON.stringify(state.connectors)),
  });
  state.nodes = next.nodes;
  state.connectors = next.connectors;
  setSelection(null, null);
  renderIconToolbar();
}

// ----------------------------------------------------------------
// Render shell (palette + toolbar + svg canvas + saved list)
// ----------------------------------------------------------------

function render() {
  containerEl.innerHTML = `
    <div class="flex-between" style="margin-bottom:10px; flex-wrap:wrap; gap:10px;">
      <input type="text" id="diagram-name-input" value="${escapeHtml(state.name)}"
        style="font-family: var(--font-serif); font-size:20px; border:none; background:transparent; padding:4px 0; min-width:160px;" />
      <button class="btn btn-primary" id="save-diagram-btn">Save</button>
    </div>

    <div id="icon-toolbar" class="flex gap-1" style="background: var(--color-bg-raised); border:1px solid var(--color-border); border-radius: var(--radius-md); padding:6px; margin-bottom:10px; flex-wrap:wrap;"></div>

    <div style="display:flex; gap:10px; align-items:stretch; width:100%; min-width:0;">
      <div class="panel" id="shape-palette-wrap" style="padding:10px; width:108px; flex-shrink:0; height:420px; overflow-y:auto;">
        <span class="label" style="margin-bottom:10px;">Shapes</span>
        <div id="shape-palette" style="display:grid; grid-template-columns:1fr 1fr; gap:6px;"></div>
      </div>

      <div class="panel corner-frame" id="canvas-wrap" style="position:relative; padding:0; overflow:hidden; height:420px; flex:1; min-width:0; touch-action:none;">
        <svg id="diagram-svg" width="100%" height="100%" style="display:block; cursor:grab;">
          <defs>
            <marker id="arrow-marker" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
              <polygon points="0 0, 9 4.5, 0 9" fill="#d4ff3a" />
            </marker>
          </defs>
          <g id="viewport"></g>
        </svg>
        <div id="connector-toolbar" class="hidden" style="position:absolute; display:flex; gap:2px; background: var(--color-bg-raised); border:1px solid var(--color-border-strong); border-radius: var(--radius-md); padding:4px; transform:translate(-50%,-120%); z-index:5;"></div>
        <div id="zoom-indicator" title="Double-click to reset view" style="position:absolute; bottom:10px; right:10px; font-size:11px; color: var(--color-text-tertiary); background: var(--color-bg-raised); border:1px solid var(--color-border); border-radius: var(--radius-sm); padding:4px 8px; cursor:pointer;">100%</div>
      </div>
    </div>

    <p style="font-size:11px; color: var(--color-text-tertiary); margin-top:8px;">
      Click a shape to add it. Drag a node to move it. Drag from the dot on a node's edge to another node to connect. Click a node or line to select, then use Delete in the toolbar. Scroll to zoom, drag empty canvas to pan.
    </p>

    <div class="panel mt-2" id="saved-list-panel">
      <span class="label">Saved diagrams</span>
      <div id="saved-diagrams-list"></div>
    </div>
  `;

  svgEl = document.getElementById("diagram-svg");
  viewportEl = document.getElementById("viewport");

  renderIconToolbar();
  renderPalette();
  document.getElementById("diagram-name-input").addEventListener("input", (e) => {
    state.name = e.target.value;
  });
  document.getElementById("save-diagram-btn").addEventListener("click", handleSave);
  document.getElementById("zoom-indicator").addEventListener("dblclick", resetView);

  attachCanvasEvents();
  renderDiagram();
  renderSavedDiagrams();
}

/** Builds a 24x24 stroke-icon button, matching draw.io's compact toolbar style. */
function iconButton(id, glyph, title, disabled) {
  return `
    <button class="btn" id="${id}" title="${title}" ${disabled ? "disabled" : ""}
      style="padding:7px; line-height:0;">
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${glyph}</svg>
    </button>`;
}

function renderIconToolbar() {
  const toolbar = document.getElementById("icon-toolbar");
  toolbar.innerHTML = [
    iconButton("zoom-out-toolbar-btn", TOOLBAR_ICONS.zoomOut, "Zoom out"),
    iconButton("zoom-in-toolbar-btn", TOOLBAR_ICONS.zoomIn, "Zoom in"),
    iconButton("fit-view-btn", TOOLBAR_ICONS.fitToView, "Fit all shapes in view"),
    spacer(),
    iconButton("undo-btn", TOOLBAR_ICONS.undo, "Undo", !state.undoStack || state.undoStack.length === 0),
    iconButton("redo-btn", TOOLBAR_ICONS.redo, "Redo", !state.redoStack || state.redoStack.length === 0),
    spacer(),
    iconButton("delete-selected-btn", TOOLBAR_ICONS.trash, "Delete selected", !state.selection),
    spacer(),
    iconButton("download-png-btn", TOOLBAR_ICONS.download, "Download PNG"),
  ].join("");

  document.getElementById("zoom-in-toolbar-btn").addEventListener("click", () => zoomBy(1.2));
  document.getElementById("zoom-out-toolbar-btn").addEventListener("click", () => zoomBy(1 / 1.2));
  document.getElementById("fit-view-btn").addEventListener("click", resetView);
  document.getElementById("delete-selected-btn").addEventListener("click", deleteSelection);
  document.getElementById("download-png-btn").addEventListener("click", handleDownloadPng);
  document.getElementById("undo-btn").addEventListener("click", undo);
  document.getElementById("redo-btn").addEventListener("click", redo);
}

function spacer() {
  return `<div style="width:1px; background: var(--color-border); margin:2px 4px;"></div>`;
}

function renderPalette() {
  const palette = document.getElementById("shape-palette");
  palette.innerHTML = SHAPE_TYPES.map(
    (s) => `
      <button class="btn" data-shape="${s.type}" title="${s.label}"
        style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:8px 4px; line-height:0;">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">${SHAPE_ICONS[s.type]}</svg>
        <span style="font-size:9px; line-height:1; letter-spacing:0.02em;">${s.label}</span>
      </button>`
  ).join("");
  palette.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => addShape(btn.dataset.shape));
  });
}

// ----------------------------------------------------------------
// Shape creation
// ----------------------------------------------------------------

function addShape(type) {
  snapshot();
  const def = SHAPE_TYPES.find((s) => s.type === type);
  const count = state.nodes.length;

  // Figure out how much canvas is actually visible right now (in diagram coords),
  // so new shapes always land somewhere the user can see — not at a fixed pixel
  // offset that may sit outside a narrow screen's visible area.
  const visible = getVisibleDiagramBounds();
  const cols = Math.max(1, Math.floor((visible.width - 40) / 140));
  const col = count % cols;
  const row = Math.floor(count / cols);

  const node = {
    id: generateId("node"),
    type,
    label: def.label,
    x: visible.x + 30 + col * 140,
    y: visible.y + 24 + row * 100,
    w: def.w,
    h: def.h,
  };
  state.nodes.push(node);
  setSelection("node", node.id);
  renderDiagram();
  renderIconToolbar();
}

// ----------------------------------------------------------------
// Viewport transform (pan/zoom)
// ----------------------------------------------------------------

function applyViewportTransform() {
  viewportEl.setAttribute(
    "transform",
    `translate(${state.pan.x} ${state.pan.y}) scale(${state.scale})`
  );
  const label = document.getElementById("zoom-indicator");
  if (label) label.textContent = `${Math.round(state.scale * 100)}%`;
}

function zoomBy(factor) {
  const newScale = clamp(state.scale * factor, MIN_SCALE, MAX_SCALE);
  state.scale = newScale;
  applyViewportTransform();
  if (state.selection && (state.selection.kind === "connector" || state.selection.kind === "node")) renderDiagram();
}

/** Computes the bounding box of all nodes AND any connector waypoints, so fit-to-view and PNG export never clip a dragged-out waypoint. */
function computeContentBounds() {
  const bounds = state.nodes.reduce(
    (acc, n) => ({
      minX: Math.min(acc.minX, n.x),
      minY: Math.min(acc.minY, n.y),
      maxX: Math.max(acc.maxX, n.x + n.w),
      maxY: Math.max(acc.maxY, n.y + n.h),
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  );

  state.connectors.forEach((conn) => {
    (conn.waypoints || []).forEach((wp) => {
      bounds.minX = Math.min(bounds.minX, wp.x);
      bounds.minY = Math.min(bounds.minY, wp.y);
      bounds.maxX = Math.max(bounds.maxX, wp.x);
      bounds.maxY = Math.max(bounds.maxY, wp.y);
    });
  });

  return bounds;
}

/** Resets pan/zoom so every node is visible — "zoom to fit" rather than a fixed reset point, since a diagram saved on a wide screen may have nodes off-screen on a narrow one. */
function resetView() {
  if (state.nodes.length === 0) {
    state.scale = 1;
    state.pan = { x: 60, y: 40 };
    applyViewportTransform();
    return;
  }

  const PADDING = 40;
  const bounds = computeContentBounds();

  const contentWidth = bounds.maxX - bounds.minX + PADDING * 2;
  const contentHeight = bounds.maxY - bounds.minY + PADDING * 2;
  const rect = svgEl.getBoundingClientRect();

  const scaleToFit = Math.min(rect.width / contentWidth, rect.height / contentHeight, MAX_SCALE);
  state.scale = clamp(scaleToFit, MIN_SCALE, MAX_SCALE);
  state.pan = {
    x: -bounds.minX * state.scale + PADDING * state.scale,
    y: -bounds.minY * state.scale + PADDING * state.scale,
  };

  applyViewportTransform();
  if (state.selection && (state.selection.kind === "connector" || state.selection.kind === "node")) renderDiagram();
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function svgPointFromEvent(evt) {
  const rect = svgEl.getBoundingClientRect();
  const point = evt.touches ? evt.touches[0] : evt;
  const sx = point.clientX - rect.left;
  const sy = point.clientY - rect.top;
  // convert screen coords to viewport (diagram) coords
  return {
    x: (sx - state.pan.x) / state.scale,
    y: (sy - state.pan.y) / state.scale,
  };
}

/**
 * Returns the currently-visible canvas area expressed in diagram
 * coordinates (accounting for the SVG's actual rendered pixel size,
 * current pan, and current zoom). Used to place new shapes somewhere
 * the user can actually see, regardless of screen width.
 */
function getVisibleDiagramBounds() {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: -state.pan.x / state.scale,
    y: -state.pan.y / state.scale,
    width: rect.width / state.scale,
    height: rect.height / state.scale,
  };
}

// ----------------------------------------------------------------
// Canvas-level events: pan (drag empty space) + wheel zoom
// ----------------------------------------------------------------

function attachCanvasEvents() {
  svgEl.addEventListener("wheel", (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoomBy(factor);
  }, { passive: false });

  svgEl.addEventListener("mousedown", (e) => {
    if (e.target === svgEl || e.target.id === "viewport") {
      startPan(e);
      setSelection(null, null);
    }
  });
  svgEl.addEventListener("touchstart", (e) => {
    if (e.target === svgEl || e.target.id === "viewport") {
      startPan(e);
    }
  }, { passive: true });
}

function startPan(evt) {
  const point = evt.touches ? evt.touches[0] : evt;
  state.panning = { startX: point.clientX, startY: point.clientY, origPan: { ...state.pan } };
  svgEl.style.cursor = "grabbing";
  hideConnectorToolbar();

  const onMove = (e) => {
    if (!state.panning) return;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - state.panning.startX;
    const dy = p.clientY - state.panning.startY;
    state.pan = { x: state.panning.origPan.x + dx, y: state.panning.origPan.y + dy };
    applyViewportTransform();
  };
  const onUp = () => {
    state.panning = null;
    svgEl.style.cursor = "grab";
    if (state.selection && (state.selection.kind === "connector" || state.selection.kind === "node")) renderDiagram();
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: true });
  document.addEventListener("touchend", onUp);
}

// ----------------------------------------------------------------
// Selection
// ----------------------------------------------------------------

function setSelection(kind, id) {
  state.selection = kind ? { kind, id } : null;
  const delBtn = document.getElementById("delete-selected-btn");
  if (delBtn) delBtn.disabled = !state.selection;
  if (!kind) hideConnectorToolbar();
  renderDiagram();
}

function deleteSelection() {
  if (!state.selection) return;
  snapshot();
  if (state.selection.kind === "node") {
    const id = state.selection.id;
    state.nodes = state.nodes.filter((n) => n.id !== id);
    state.connectors = state.connectors.filter((c) => c.from !== id && c.to !== id);
    delete lastTapByNodeId[id];
  } else if (state.selection.kind === "connector") {
    state.connectors = state.connectors.filter((c) => c.id !== state.selection.id);
    delete lastTapByConnId[state.selection.id];
  }
  setSelection(null, null);
  renderIconToolbar();
}

// ----------------------------------------------------------------
// Diagram rendering (nodes + connectors) inside #viewport
// ----------------------------------------------------------------

function renderDiagram() {
  viewportEl.innerHTML = "";
  applyViewportTransform();

  // connectors first (so nodes draw on top)
  state.connectors.forEach((conn) => renderConnector(conn));
  state.nodes.forEach((node) => renderNode(node));
}

/** Shows a small floating toolbar (line style picker) near the selected connector's midpoint, screen-positioned in CSS pixels. */
function positionConnectorToolbar(p1, p2) {
  const toolbar = document.getElementById("connector-toolbar");
  if (!toolbar) return;

  const conn = state.connectors.find(
    (c) => state.selection && c.id === state.selection.id
  );
  if (!conn) return;

  // midpoint in diagram coords -> screen coords (apply pan/scale)
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const screenX = midX * state.scale + state.pan.x;
  const screenY = midY * state.scale + state.pan.y;

  toolbar.style.left = `${screenX}px`;
  toolbar.style.top = `${screenY}px`;
  toolbar.classList.remove("hidden");

  toolbar.innerHTML = LINE_STYLES.map(
    (s) =>
      `<button class="btn${(conn.lineStyle || "straight") === s.key ? " btn-primary" : ""}" data-line-style="${s.key}" style="padding:5px 9px; font-size:11px; border:none;" title="${s.label}">${lineStyleIcon(s.key)}</button>`
  ).join("");

  toolbar.querySelectorAll("[data-line-style]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      conn.lineStyle = btn.dataset.lineStyle;
      renderDiagram();
    });
  });
}

/** Shows a small floating color-swatch toolbar above the selected node, same visual pattern as the connector line-style toolbar. */
function positionNodeColorToolbar(node) {
  const toolbar = document.getElementById("connector-toolbar");
  if (!toolbar) return;

  const screenX = (node.x + node.w / 2) * state.scale + state.pan.x;
  const screenY = node.y * state.scale + state.pan.y;

  toolbar.style.left = `${screenX}px`;
  toolbar.style.top = `${screenY}px`;
  toolbar.classList.remove("hidden");

  toolbar.innerHTML = NODE_COLORS.map((c) => {
    const isActive = (node.fillColor || "") === c.key;
    return `<button class="swatch-btn" data-color="${c.key}" title="${c.label}"
      style="width:20px; height:20px; border-radius:50%; background:${c.swatch}; border:2px solid ${isActive ? "#ffffff" : "rgba(255,255,255,0.25)"}; padding:0; cursor:pointer;"></button>`;
  }).join("");

  toolbar.querySelectorAll("[data-color]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      snapshot();
      node.fillColor = btn.dataset.color || null;
      renderDiagram();
    });
  });
}

function lineStyleIcon(key) {
  if (key === "curved") return "&#x2937;";
  if (key === "orthogonal") return "&#x231F;";
  return "&#x2192;";
}

function hideConnectorToolbar() {
  const toolbar = document.getElementById("connector-toolbar");
  if (toolbar) toolbar.classList.add("hidden");
}

function nodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

/** Returns the point on a node's boundary closest to a target point — used so connector lines touch the shape edge, not its center. */
function edgePoint(node, targetX, targetY) {
  const c = nodeCenter(node);
  const dx = targetX - c.x;
  const dy = targetY - c.y;
  if (dx === 0 && dy === 0) return c;

  const halfW = node.w / 2;
  const halfH = node.h / 2;
  const scaleX = halfW / Math.abs(dx || 1e-6);
  const scaleY = halfH / Math.abs(dy || 1e-6);
  const s = Math.min(scaleX, scaleY);

  return { x: c.x + dx * s, y: c.y + dy * s };
}

/** Builds an SVG path "d" string for a connector between two edge points, based on line style. */
/** Builds an SVG path "d" string for a connector, routing through any waypoints in order. */
function buildConnectorPath(p1, p2, lineStyle, waypoints) {
  const points = [p1, ...(waypoints || []), p2];

  if (lineStyle === "curved") {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const dx = b.x - a.x;
      d += ` C ${a.x + dx * 0.5} ${a.y}, ${a.x + dx * 0.5} ${b.y}, ${b.x} ${b.y}`;
    }
    return d;
  }

  if (lineStyle === "orthogonal") {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const midX = a.x + (b.x - a.x) / 2;
      d += ` L ${midX} ${a.y} L ${midX} ${b.y} L ${b.x} ${b.y}`;
    }
    return d;
  }

  // straight (default) — also used as the basis for "straight-through-waypoints"
  return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map((p) => `L ${p.x} ${p.y}`).join(" ");
}

function renderConnector(conn) {
  const fromNode = state.nodes.find((n) => n.id === conn.from);
  const toNode = state.nodes.find((n) => n.id === conn.to);
  if (!fromNode || !toNode) return;

  const toC = nodeCenter(toNode);
  const fromC = nodeCenter(fromNode);
  const waypoints = conn.waypoints || [];
  const aimTowardTo = waypoints.length > 0 ? waypoints[0] : toC;
  const aimTowardFrom = waypoints.length > 0 ? waypoints[waypoints.length - 1] : fromC;
  const p1 = edgePoint(fromNode, aimTowardTo.x, aimTowardTo.y);
  const p2 = edgePoint(toNode, aimTowardFrom.x, aimTowardFrom.y);
  const lineStyle = conn.lineStyle || "straight";
  const d = buildConnectorPath(p1, p2, lineStyle, waypoints);

  const isSelected = state.selection && state.selection.kind === "connector" && state.selection.id === conn.id;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

  // Wide invisible hit-path, easier to click than the thin visible line.
  // Double-click/double-tap on it inserts a new waypoint at that spot.
  const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  hitPath.setAttribute("d", d);
  hitPath.setAttribute("fill", "none");
  hitPath.setAttribute("stroke", "transparent");
  hitPath.setAttribute("stroke-width", "14");
  hitPath.style.cursor = "pointer";
  hitPath.addEventListener("click", (e) => {
    e.stopPropagation();
    const now = Date.now();
    const last = lastTapByConnId[conn.id] || 0;
    if (now - last < 400) {
      delete lastTapByConnId[conn.id];
      const clickPoint = svgPointFromEvent(e);
      snapshot();
      conn.waypoints = conn.waypoints || [];
      conn.waypoints.push({ x: clickPoint.x, y: clickPoint.y });
      setSelection("connector", conn.id);
      renderIconToolbar();
      return;
    }
    lastTapByConnId[conn.id] = now;
    setSelection("connector", conn.id);
  });
  g.appendChild(hitPath);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", isSelected ? "#ffffff" : "#d4ff3a");
  path.setAttribute("stroke-width", isSelected ? "2.5" : "1.5");
  path.setAttribute("marker-end", "url(#arrow-marker)");
  path.style.pointerEvents = "none";
  g.appendChild(path);

  if (isSelected) {
    waypoints.forEach((wp, idx) => renderWaypointHandle(g, conn, wp, idx));
  }

  viewportEl.appendChild(g);

  if (isSelected) {
    positionConnectorToolbar(p1, p2);
  }
}

/** Renders a single draggable waypoint handle. Drag to move it, double-click/double-tap to remove it. */
function renderWaypointHandle(g, conn, wp, index) {
  const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  dot.setAttribute("cx", wp.x);
  dot.setAttribute("cy", wp.y);
  dot.setAttribute("r", 5);
  dot.setAttribute("fill", "#ffffff");
  dot.setAttribute("stroke", "#0c0b09");
  dot.setAttribute("stroke-width", "1.5");
  dot.style.cursor = "grab";

  let dragStart = null;
  let preDragSnapshot = null;

  const onDown = (e) => {
    e.stopPropagation();
    dragStart = svgPointFromEvent(e);
    preDragSnapshot = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connectors: JSON.parse(JSON.stringify(state.connectors)),
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  };

  const onMove = (e) => {
    if (!dragStart) return;
    e.preventDefault();
    const point = svgPointFromEvent(e);
    wp.x = point.x;
    wp.y = point.y;
    renderDiagram();
  };

  const onUp = () => {
    if (dragStart && preDragSnapshot) {
      state.undoStack.push(preDragSnapshot);
      if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
      state.redoStack = [];
      renderIconToolbar();
    }
    dragStart = null;
    preDragSnapshot = null;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  dot.addEventListener("mousedown", onDown);
  dot.addEventListener("touchstart", onDown, { passive: true });

  let lastTap = 0;
  dot.addEventListener("click", (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap < 400) {
      snapshot();
      conn.waypoints.splice(index, 1);
      renderDiagram();
      renderIconToolbar();
      return;
    }
    lastTap = now;
  });

  g.appendChild(dot);
}

/** Prompts for a new label and applies it, with undo support. Shared by double-click (desktop) and double-tap (touch) rename. */
function renameNode(node) {
  const newLabel = prompt("Rename box:", node.label);
  if (newLabel !== null && newLabel.trim()) {
    snapshot();
    node.label = newLabel.trim();
    renderDiagram();
    renderIconToolbar();
  }
}

let lastTapByNodeId = {};
let lastTapByConnId = {};

function renderNode(node) {
  const isSelected = state.selection && state.selection.kind === "node" && state.selection.id === node.id;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);
  g.style.cursor = "grab";

  if (isSelected) {
    positionNodeColorToolbar(node);
  }

  const shape = makeShapeElement(node, isSelected);
  g.appendChild(shape);

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", node.x + node.w / 2);
  text.setAttribute("y", node.y + node.h / 2 + 4);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("fill", "#f4f2ea");
  text.setAttribute("font-size", "12.5");
  text.setAttribute("font-family", "JetBrains Mono, monospace");
  text.style.pointerEvents = "none";
  text.textContent = node.label;
  g.appendChild(text);

  // Connector handles — small dots at N/S/E/W edge midpoints
  const handles = [
    { x: node.x + node.w / 2, y: node.y },
    { x: node.x + node.w / 2, y: node.y + node.h },
    { x: node.x, y: node.y + node.h / 2 },
    { x: node.x + node.w, y: node.y + node.h / 2 },
  ];
  handles.forEach((h) => {
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", h.x);
    dot.setAttribute("cy", h.y);
    dot.setAttribute("r", HANDLE_R);
    dot.setAttribute("fill", "#0c0b09");
    dot.setAttribute("stroke", "#d4ff3a");
    dot.setAttribute("stroke-width", "1.5");
    dot.style.cursor = "crosshair";
    dot.style.opacity = isSelected ? "1" : "0.55";
    dot.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      startConnector(node.id, e);
    });
    dot.addEventListener("touchstart", (e) => {
      e.stopPropagation();
      startConnector(node.id, e);
    }, { passive: true });
    g.appendChild(dot);
  });

  g.addEventListener("click", (e) => {
    e.stopPropagation();
    if (node.dragged) {
      node.dragged = false;
      return;
    }
    const now = Date.now();
    const last = lastTapByNodeId[node.id] || 0;
    if (now - last < 400) {
      // Treat as a double-tap/double-click — works for touch screens too,
      // since the browser's native dblclick event isn't reliably fired
      // from two separate touch taps on Android/iOS. Tracked outside this
      // render closure because renderDiagram() rebuilds this element on
      // every state change (including the selection change from tap 1).
      delete lastTapByNodeId[node.id];
      renameNode(node);
      return;
    }
    lastTapByNodeId[node.id] = now;
    setSelection("node", node.id);
  });

  attachNodeDrag(g, node);
  viewportEl.appendChild(g);
}

/**
 * Returns SVG markup (as element-type + attribute info) describing a node's
 * shape outline. Used by BOTH the live canvas renderer and the PNG export,
 * so the two never drift out of sync with each other.
 *
 * Returns { tag, attrs } where tag is an SVG element name and attrs is a
 * plain object of attribute name -> value (excluding fill/stroke, which
 * callers apply themselves since they differ between canvas/export/selection state).
 */
function getShapeGeometry(node) {
  const { x, y, w, h } = node;
  const cx = x + w / 2;
  const cy = y + h / 2;

  switch (node.type) {
    case "ellipse":
      return { tag: "ellipse", attrs: { cx, cy, rx: w / 2, ry: h / 2 } };

    case "diamond":
      return {
        tag: "polygon",
        attrs: { points: `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}` },
      };

    case "triangle":
      return {
        tag: "polygon",
        attrs: { points: `${cx},${y} ${x + w},${y + h} ${x},${y + h}` },
      };

    case "hexagon": {
      const cut = w * 0.22;
      return {
        tag: "polygon",
        attrs: {
          points: `${x + cut},${y} ${x + w - cut},${y} ${x + w},${cy} ${x + w - cut},${y + h} ${x + cut},${y + h} ${x},${cy}`,
        },
      };
    }

    case "parallelogram": {
      const skew = w * 0.18;
      return {
        tag: "polygon",
        attrs: {
          points: `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}`,
        },
      };
    }

    case "cylinder": {
      const ry = Math.min(h * 0.18, 14);
      return {
        tag: "path",
        attrs: {
          d: `M ${x} ${y + ry} C ${x} ${y - ry / 2}, ${x + w} ${y - ry / 2}, ${x + w} ${y + ry} ` +
             `L ${x + w} ${y + h - ry} C ${x + w} ${y + h + ry / 2}, ${x} ${y + h + ry / 2}, ${x} ${y + h - ry} Z ` +
             `M ${x} ${y + ry} C ${x} ${y + ry * 2}, ${x + w} ${y + ry * 2}, ${x + w} ${y + ry}`,
        },
      };
    }

    case "cloud": {
      // A simple cloud silhouette built from overlapping circles, scaled to the node's box.
      const r1 = h * 0.32;
      return {
        tag: "path",
        attrs: {
          d: `M ${x + w * 0.22} ${y + h * 0.75} ` +
             `a ${r1} ${r1} 0 0 1 -${r1 * 0.3} -${h * 0.45} ` +
             `a ${h * 0.32} ${h * 0.32} 0 0 1 ${h * 0.55} -${h * 0.22} ` +
             `a ${h * 0.28} ${h * 0.28} 0 0 1 ${h * 0.42} ${h * 0.18} ` +
             `a ${h * 0.26} ${h * 0.26} 0 0 1 -${h * 0.06} ${h * 0.51} ` +
             `z`,
        },
      };
    }

    case "callout": {
      const tailW = w * 0.18;
      const bodyH = h * 0.78;
      return {
        tag: "path",
        attrs: {
          d: `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + bodyH} L ${x + tailW * 2} ${y + bodyH} ` +
             `L ${x + tailW} ${y + h} L ${x + tailW} ${y + bodyH} L ${x} ${y + bodyH} Z`,
        },
      };
    }

    case "document": {
      const waveH = h * 0.15;
      return {
        tag: "path",
        attrs: {
          d: `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h - waveH} ` +
             `C ${x + w * 0.75} ${y + h + waveH}, ${x + w * 0.25} ${y + h - waveH * 2}, ${x} ${y + h} Z`,
        },
      };
    }

    case "person": {
      const headR = w * 0.28;
      const headCx = cx;
      const headCy = y + headR + 2;
      return {
        tag: "g",
        attrs: {},
        children: [
          { tag: "circle", attrs: { cx: headCx, cy: headCy, r: headR } },
          {
            tag: "path",
            attrs: {
              d: `M ${x + w * 0.08} ${y + h} ` +
                 `Q ${x + w * 0.08} ${headCy + headR * 1.6}, ${cx} ${headCy + headR * 1.6} ` +
                 `Q ${x + w * 0.92} ${headCy + headR * 1.6}, ${x + w * 0.92} ${y + h}`,
            },
          },
        ],
      };
    }

    case "text":
      // Text nodes render as transparent — just a label, no visible box.
      return { tag: "rect", attrs: { x, y, width: w, height: h }, transparent: true };

    case "rounded":
      return { tag: "rect", attrs: { x, y, width: w, height: h, rx: 18 } };

    case "rect":
    default:
      return { tag: "rect", attrs: { x, y, width: w, height: h, rx: 6 } };
  }
}

function makeShapeElement(node, isSelected) {
  const stroke = isSelected ? "#ffffff" : "#d4ff3a";
  const strokeWidth = isSelected ? "2.5" : "1.5";
  const fill = node.type === "text" ? "transparent" : node.fillColor || "#0a0907";

  const geo = getShapeGeometry(node);
  const el = buildSvgElement(geo);
  el.setAttribute("fill", fill);
  if (!geo.transparent) {
    el.setAttribute("stroke", stroke);
    el.setAttribute("stroke-width", strokeWidth);
  }
  return el;
}

/** Recursively builds a real SVG DOM element (and any children) from a geometry descriptor. */
function buildSvgElement(geo) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", geo.tag);
  Object.entries(geo.attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (geo.children) {
    geo.children.forEach((childGeo) => el.appendChild(buildSvgElement(childGeo)));
  }
  return el;
}

// ----------------------------------------------------------------
// Node dragging
// ----------------------------------------------------------------

function attachNodeDrag(g, node) {
  let start = null;
  let preDragSnapshot = null;

  const onDown = (e) => {
    e.stopPropagation();
    const point = svgPointFromEvent(e);
    start = { x: point.x, y: point.y, origX: node.x, origY: node.y, moved: false };
    preDragSnapshot = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      connectors: JSON.parse(JSON.stringify(state.connectors)),
    };
    g.style.cursor = "grabbing";
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);
  };

  const onMove = (e) => {
    if (!start) return;
    e.preventDefault();
    const point = svgPointFromEvent(e);
    const dx = point.x - start.x;
    const dy = point.y - start.y;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) start.moved = true;
    node.x = start.origX + dx;
    node.y = start.origY + dy;
    node.dragged = start.moved;
    renderDiagram();
  };

  const onUp = () => {
    if (start && start.moved && preDragSnapshot) {
      state.undoStack.push(preDragSnapshot);
      if (state.undoStack.length > MAX_HISTORY) state.undoStack.shift();
      state.redoStack = [];
      renderIconToolbar();
    }
    start = null;
    preDragSnapshot = null;
    g.style.cursor = "grab";
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  g.addEventListener("mousedown", onDown);
  g.addEventListener("touchstart", onDown, { passive: true });
}

// ----------------------------------------------------------------
// Connector dragging (from a handle dot to another node)
// ----------------------------------------------------------------

function startConnector(fromNodeId, evt) {
  const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  tempLine.setAttribute("stroke", "#d4ff3a");
  tempLine.setAttribute("stroke-width", "1.5");
  tempLine.setAttribute("stroke-dasharray", "4 3");
  tempLine.style.pointerEvents = "none";
  viewportEl.appendChild(tempLine);

  const fromNode = state.nodes.find((n) => n.id === fromNodeId);
  const startPoint = svgPointFromEvent(evt);

  const updateTempLine = (curPoint) => {
    const edge = edgePoint(fromNode, curPoint.x, curPoint.y);
    tempLine.setAttribute("x1", edge.x);
    tempLine.setAttribute("y1", edge.y);
    tempLine.setAttribute("x2", curPoint.x);
    tempLine.setAttribute("y2", curPoint.y);
  };
  updateTempLine(startPoint);

  const onMove = (e) => {
    e.preventDefault();
    updateTempLine(svgPointFromEvent(e));
  };

  const onUp = (e) => {
    const point = svgPointFromEvent(e.changedTouches ? e.changedTouches[0] : e);
    const target = state.nodes.find(
      (n) =>
        n.id !== fromNodeId &&
        point.x >= n.x &&
        point.x <= n.x + n.w &&
        point.y >= n.y &&
        point.y <= n.y + n.h
    );
    tempLine.remove();
    if (target) {
      snapshot();
      const newConn = { id: generateId("conn"), from: fromNodeId, to: target.id, lineStyle: "straight", waypoints: [] };
      state.connectors.push(newConn);
      setSelection("connector", newConn.id);
      renderIconToolbar();
    } else {
      renderDiagram();
    }
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);
    document.removeEventListener("touchmove", onMove);
    document.removeEventListener("touchend", onUp);
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
  document.addEventListener("touchmove", onMove, { passive: false });
  document.addEventListener("touchend", onUp);
}

// ----------------------------------------------------------------
// Export to PNG (real file download)
// ----------------------------------------------------------------

/**
 * Renders the diagram (nodes + connectors, ignoring current pan/zoom)
 * to an off-screen SVG sized to fit the content, converts it to a PNG
 * via canvas, and triggers a browser download.
 */
async function handleDownloadPng() {
  if (state.nodes.length === 0) {
    showToast("Add at least one box first");
    return;
  }

  const PADDING = 40;
  const bounds = computeContentBounds();

  const width = bounds.maxX - bounds.minX + PADDING * 2;
  const height = bounds.maxY - bounds.minY + PADDING * 2;
  const offsetX = PADDING - bounds.minX;
  const offsetY = PADDING - bounds.minY;

  const svgMarkup = buildExportSvg(width, height, offsetX, offsetY);

  try {
    const pngDataUrl = await svgStringToPngDataUrl(svgMarkup, width, height);
    triggerDownload(pngDataUrl, `${sanitizeFilename(state.name)}.png`);
    showToast("Downloaded");
  } catch (err) {
    showToast("Download failed — try Save instead");
    console.error("PNG export failed:", err);
  }
}

/** Builds a standalone SVG string (no pan/zoom transform) for export. */
function buildExportSvg(width, height, offsetX, offsetY) {
  const parts = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
  );
  parts.push(`<rect width="${width}" height="${height}" fill="#0c0b09"/>`);
  parts.push(`<defs><marker id="export-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0, 9 4.5, 0 9" fill="#d4ff3a"/></marker></defs>`);
  parts.push(`<g transform="translate(${offsetX} ${offsetY})">`);

  state.connectors.forEach((conn) => {
    const fromNode = state.nodes.find((n) => n.id === conn.from);
    const toNode = state.nodes.find((n) => n.id === conn.to);
    if (!fromNode || !toNode) return;
    const toC = nodeCenter(toNode);
    const fromC = nodeCenter(fromNode);
    const waypoints = conn.waypoints || [];
    const aimTowardTo = waypoints.length > 0 ? waypoints[0] : toC;
    const aimTowardFrom = waypoints.length > 0 ? waypoints[waypoints.length - 1] : fromC;
    const p1 = edgePoint(fromNode, aimTowardTo.x, aimTowardTo.y);
    const p2 = edgePoint(toNode, aimTowardFrom.x, aimTowardFrom.y);
    const d = buildConnectorPath(p1, p2, conn.lineStyle || "straight", waypoints);
    parts.push(`<path d="${d}" fill="none" stroke="#d4ff3a" stroke-width="1.5" marker-end="url(#export-arrow)"/>`);
  });

  state.nodes.forEach((node) => {
    parts.push(exportShapeMarkup(node));
    parts.push(
      `<text x="${node.x + node.w / 2}" y="${node.y + node.h / 2 + 4}" text-anchor="middle" fill="#f4f2ea" font-size="12.5" font-family="JetBrains Mono, monospace">${escapeXml(node.label)}</text>`
    );
  });

  parts.push("</g></svg>");
  return parts.join("");
}

function exportShapeMarkup(node) {
  const stroke = "#d4ff3a";
  const fill = node.type === "text" ? "transparent" : node.fillColor || "#0a0907";
  const geo = getShapeGeometry(node);
  return geoToXmlString(geo, fill, geo.transparent ? null : stroke);
}

/** Serializes a geometry descriptor (from getShapeGeometry) to an XML string for the export SVG. */
function geoToXmlString(geo, fill, stroke) {
  const attrPairs = Object.entries(geo.attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(" ");
  const fillAttr = `fill="${fill}"`;
  const strokeAttr = stroke ? `stroke="${stroke}" stroke-width="1.5"` : "";

  if (geo.children) {
    const childMarkup = geo.children.map((c) => geoToXmlString(c, fill, stroke)).join("");
    return `<g ${fillAttr} ${strokeAttr}>${childMarkup}</g>`;
  }

  return `<${geo.tag} ${attrPairs} ${fillAttr} ${strokeAttr}/>`;
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Rasterizes an SVG string to a PNG data URL via an off-screen canvas. */
function svgStringToPngDataUrl(svgString, width, height) {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const scale = 2; // export at 2x for crisper output
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function triggerDownload(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function sanitizeFilename(name) {
  return (name || "diagram").trim().replace(/[^a-z0-9_\-]+/gi, "_") || "diagram";
}

// ----------------------------------------------------------------
// Persistence
// ----------------------------------------------------------------

async function handleSave() {
  const diagram = {
    id: state.diagramId,
    name: state.name,
    nodes: state.nodes.map(({ id, type, label, x, y, w, h, fillColor }) => ({ id, type, label, x, y, w, h, fillColor: fillColor || null })),
    connectors: state.connectors.map(({ id, from, to, lineStyle, waypoints }) => ({ id, from, to, lineStyle: lineStyle || "straight", waypoints: waypoints || [] })),
    meta: {},
  };

  const saved = await storage.diagrams.save(diagram);
  state.diagramId = saved.id;
  showToast("Diagram saved");
  renderSavedDiagrams();
}

async function renderSavedDiagrams() {
  const listEl = document.getElementById("saved-diagrams-list");
  if (!listEl) return;

  const diagrams = await storage.diagrams.list();

  if (diagrams.length === 0) {
    listEl.innerHTML = `<p style="font-size:13px; color: var(--color-text-tertiary); margin:0;">No saved diagrams yet.</p>`;
    return;
  }

  listEl.innerHTML = diagrams
    .map(
      (d) => `
      <div class="flex-between" style="padding:10px 0; border-top:1px solid var(--color-border);">
        <div>
          <div style="font-size:14px;">${escapeHtml(d.name)}</div>
          <div style="font-size:11px; color: var(--color-text-tertiary);">${new Date(d.updatedAt).toLocaleString()}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn" data-load="${d.id}">Open</button>
          <button class="btn btn-danger" data-delete="${d.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");

  listEl.querySelectorAll("[data-load]").forEach((btn) => {
    btn.addEventListener("click", () => loadDiagram(btn.dataset.load));
  });
  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this diagram?")) {
        await storage.diagrams.delete(btn.dataset.delete);
        renderSavedDiagrams();
      }
    });
  });
}

async function loadDiagram(id) {
  const diagram = await storage.diagrams.get(id);
  if (!diagram) return;

  state = freshState();
  state.diagramId = diagram.id;
  state.name = diagram.name;
  state.nodes = diagram.nodes || [];
  state.connectors = diagram.connectors || [];
  render();
  resetView();
}

function showToast(message) {
  let toast = document.getElementById("global-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "global-toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2000);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
