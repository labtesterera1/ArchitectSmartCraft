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
  { type: "ellipse", label: "Circle", w: 100, h: 70 },
  { type: "diamond", label: "Decision", w: 120, h: 80 },
  { type: "rounded", label: "Process", w: 120, h: 56 },
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
  };
}

export function initCreateDiagramView(container) {
  containerEl = container;
  state = freshState();
  render();
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ----------------------------------------------------------------
// Render shell (palette + toolbar + svg canvas + saved list)
// ----------------------------------------------------------------

function render() {
  containerEl.innerHTML = `
    <div class="flex-between" style="margin-bottom:14px; flex-wrap:wrap; gap:10px;">
      <input type="text" id="diagram-name-input" value="${escapeHtml(state.name)}"
        style="font-family: var(--font-serif); font-size:20px; border:none; background:transparent; padding:4px 0; min-width:160px;" />
      <div class="flex gap-1">
        <button class="btn" id="delete-selected-btn" disabled>Delete</button>
        <button class="btn btn-primary" id="save-diagram-btn">Save</button>
      </div>
    </div>

    <div class="flex gap-1" id="shape-palette" style="flex-wrap:wrap; margin-bottom:12px;"></div>

    <div class="panel corner-frame" id="canvas-wrap" style="position:relative; padding:0; overflow:hidden; height:420px; touch-action:none;">
      <svg id="diagram-svg" width="100%" height="100%" style="display:block; cursor:grab;">
        <defs>
          <marker id="arrow-marker" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
            <polygon points="0 0, 9 4.5, 0 9" fill="#d4ff3a" />
          </marker>
        </defs>
        <g id="viewport"></g>
      </svg>
      <div class="flex gap-1" style="position:absolute; bottom:10px; right:10px;">
        <button class="btn" id="zoom-out-btn" style="padding:6px 10px;">&minus;</button>
        <button class="btn" id="zoom-reset-btn" style="padding:6px 10px; font-size:11px;">100%</button>
        <button class="btn" id="zoom-in-btn" style="padding:6px 10px;">+</button>
      </div>
    </div>

    <p style="font-size:11px; color: var(--color-text-tertiary); margin-top:8px;">
      Click a shape to add it. Drag a node to move it. Drag from the dot on a node's edge to another node to connect. Click a node or line to select, then Delete. Scroll to zoom, drag empty canvas to pan.
    </p>

    <div class="panel mt-2" id="saved-list-panel">
      <span class="label">Saved diagrams</span>
      <div id="saved-diagrams-list"></div>
    </div>
  `;

  svgEl = document.getElementById("diagram-svg");
  viewportEl = document.getElementById("viewport");

  renderPalette();
  document.getElementById("diagram-name-input").addEventListener("input", (e) => {
    state.name = e.target.value;
  });
  document.getElementById("save-diagram-btn").addEventListener("click", handleSave);
  document.getElementById("delete-selected-btn").addEventListener("click", deleteSelection);
  document.getElementById("zoom-in-btn").addEventListener("click", () => zoomBy(1.2));
  document.getElementById("zoom-out-btn").addEventListener("click", () => zoomBy(1 / 1.2));
  document.getElementById("zoom-reset-btn").addEventListener("click", resetView);

  attachCanvasEvents();
  renderDiagram();
  renderSavedDiagrams();
}

function renderPalette() {
  const palette = document.getElementById("shape-palette");
  palette.innerHTML = SHAPE_TYPES.map(
    (s) => `<button class="btn" data-shape="${s.type}">+ ${s.label}</button>`
  ).join("");
  palette.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => addShape(btn.dataset.shape));
  });
}

// ----------------------------------------------------------------
// Shape creation
// ----------------------------------------------------------------

function addShape(type) {
  const def = SHAPE_TYPES.find((s) => s.type === type);
  const count = state.nodes.length;
  const node = {
    id: generateId("node"),
    type,
    label: def.label,
    x: 40 + (count % 4) * 140,
    y: 30 + Math.floor(count / 4) * 110,
    w: def.w,
    h: def.h,
  };
  state.nodes.push(node);
  setSelection("node", node.id);
  renderDiagram();
}

// ----------------------------------------------------------------
// Viewport transform (pan/zoom)
// ----------------------------------------------------------------

function applyViewportTransform() {
  viewportEl.setAttribute(
    "transform",
    `translate(${state.pan.x} ${state.pan.y}) scale(${state.scale})`
  );
  const label = document.getElementById("zoom-reset-btn");
  if (label) label.textContent = `${Math.round(state.scale * 100)}%`;
}

function zoomBy(factor) {
  const newScale = clamp(state.scale * factor, MIN_SCALE, MAX_SCALE);
  state.scale = newScale;
  applyViewportTransform();
}

function resetView() {
  state.scale = 1;
  state.pan = { x: 60, y: 40 };
  applyViewportTransform();
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
  renderDiagram();
}

function deleteSelection() {
  if (!state.selection) return;
  if (state.selection.kind === "node") {
    const id = state.selection.id;
    state.nodes = state.nodes.filter((n) => n.id !== id);
    state.connectors = state.connectors.filter((c) => c.from !== id && c.to !== id);
  } else if (state.selection.kind === "connector") {
    state.connectors = state.connectors.filter((c) => c.id !== state.selection.id);
  }
  setSelection(null, null);
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

function renderConnector(conn) {
  const fromNode = state.nodes.find((n) => n.id === conn.from);
  const toNode = state.nodes.find((n) => n.id === conn.to);
  if (!fromNode || !toNode) return;

  const toC = nodeCenter(toNode);
  const fromC = nodeCenter(fromNode);
  const p1 = edgePoint(fromNode, toC.x, toC.y);
  const p2 = edgePoint(toNode, fromC.x, fromC.y);

  const isSelected = state.selection && state.selection.kind === "connector" && state.selection.id === conn.id;

  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

  // Wide invisible hit-line, easier to click than the thin visible line
  const hitLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  hitLine.setAttribute("x1", p1.x);
  hitLine.setAttribute("y1", p1.y);
  hitLine.setAttribute("x2", p2.x);
  hitLine.setAttribute("y2", p2.y);
  hitLine.setAttribute("stroke", "transparent");
  hitLine.setAttribute("stroke-width", "14");
  hitLine.style.cursor = "pointer";
  hitLine.addEventListener("click", (e) => {
    e.stopPropagation();
    setSelection("connector", conn.id);
  });
  g.appendChild(hitLine);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", p1.x);
  line.setAttribute("y1", p1.y);
  line.setAttribute("x2", p2.x);
  line.setAttribute("y2", p2.y);
  line.setAttribute("stroke", isSelected ? "#ffffff" : "#d4ff3a");
  line.setAttribute("stroke-width", isSelected ? "2.5" : "1.5");
  line.setAttribute("marker-end", "url(#arrow-marker)");
  line.style.pointerEvents = "none";
  g.appendChild(line);

  viewportEl.appendChild(g);
}

function renderNode(node) {
  const isSelected = state.selection && state.selection.kind === "node" && state.selection.id === node.id;
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("data-node-id", node.id);
  g.style.cursor = "grab";

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
    setSelection("node", node.id);
  });
  g.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    const newLabel = prompt("Rename box:", node.label);
    if (newLabel !== null && newLabel.trim()) {
      node.label = newLabel.trim();
      renderDiagram();
    }
  });

  attachNodeDrag(g, node);
  viewportEl.appendChild(g);
}

function makeShapeElement(node, isSelected) {
  const stroke = isSelected ? "#ffffff" : "#d4ff3a";
  const strokeWidth = isSelected ? "2.5" : "1.5";
  const fill = "#0a0907";

  let el;
  if (node.type === "ellipse") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    el.setAttribute("cx", node.x + node.w / 2);
    el.setAttribute("cy", node.y + node.h / 2);
    el.setAttribute("rx", node.w / 2);
    el.setAttribute("ry", node.h / 2);
  } else if (node.type === "diamond") {
    el = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    const points = [
      [cx, node.y],
      [node.x + node.w, cy],
      [cx, node.y + node.h],
      [node.x, cy],
    ]
      .map((p) => p.join(","))
      .join(" ");
    el.setAttribute("points", points);
  } else {
    el = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    el.setAttribute("x", node.x);
    el.setAttribute("y", node.y);
    el.setAttribute("width", node.w);
    el.setAttribute("height", node.h);
    el.setAttribute("rx", node.type === "rounded" ? 18 : 6);
  }

  el.setAttribute("fill", fill);
  el.setAttribute("stroke", stroke);
  el.setAttribute("stroke-width", strokeWidth);
  return el;
}

// ----------------------------------------------------------------
// Node dragging
// ----------------------------------------------------------------

function attachNodeDrag(g, node) {
  let start = null;

  const onDown = (e) => {
    e.stopPropagation();
    const point = svgPointFromEvent(e);
    start = { x: point.x, y: point.y, origX: node.x, origY: node.y, moved: false };
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
    start = null;
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
      state.connectors.push({ id: generateId("conn"), from: fromNodeId, to: target.id });
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
// Persistence
// ----------------------------------------------------------------

async function handleSave() {
  const diagram = {
    id: state.diagramId,
    name: state.name,
    nodes: state.nodes.map(({ id, type, label, x, y, w, h }) => ({ id, type, label, x, y, w, h })),
    connectors: state.connectors.map(({ id, from, to }) => ({ id, from, to })),
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
