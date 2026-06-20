/**
 * modules/create-diagram/create-diagram.js
 * ----------------------------------------------------------------
 * CreateDiagram module — lets the user build a simple architecture
 * diagram by adding boxes and connecting them, then save it via
 * storage.js. Fully independent of AnalyzeDiagram and Settings.
 *
 * This is a deliberately simple first version: click "Add box",
 * type a label, drag to position, click two boxes in sequence to
 * connect them. It is NOT a full drag-and-drop graph editor yet —
 * that can be layered on in a later iteration without touching
 * other modules.
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";

let state = {
  diagramId: null,
  name: "Untitled diagram",
  nodes: [],       // { id, label, x, y }
  connectors: [],  // { from, to }
  connectingFromId: null,
};

let containerEl = null;

export function initCreateDiagramView(container) {
  containerEl = container;
  resetState();
  render();
}

function resetState() {
  state = {
    diagramId: null,
    name: "Untitled diagram",
    nodes: [],
    connectors: [],
    connectingFromId: null,
  };
}

function generateNodeId() {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function render() {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <div class="flex-between mt-1" style="margin-bottom:16px;">
      <input type="text" id="diagram-name-input" value="${escapeHtml(state.name)}"
        style="font-family: var(--font-serif); font-size:20px; border:none; background:transparent; padding:4px 0;" />
      <div class="flex gap-1">
        <button class="btn" id="add-box-btn">+ Box</button>
        <button class="btn btn-primary" id="save-diagram-btn">Save</button>
      </div>
    </div>

    <p style="font-size:12px; color: var(--color-text-tertiary);">
      Tap "+ Box" to add a node. Drag boxes to position them. Tap one box, then another, to connect them.
    </p>

    <div class="panel corner-frame" id="canvas-wrap" style="position:relative; min-height:380px; overflow:hidden; touch-action:none;">
      <svg id="connector-layer" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none;"></svg>
      <div id="node-layer" style="position:relative; width:100%; height:380px;"></div>
    </div>

    <div class="panel mt-2" id="saved-list-panel">
      <span class="label">Saved diagrams</span>
      <div id="saved-diagrams-list"></div>
    </div>
  `;

  document.getElementById("diagram-name-input").addEventListener("input", (e) => {
    state.name = e.target.value;
  });
  document.getElementById("add-box-btn").addEventListener("click", addBox);
  document.getElementById("save-diagram-btn").addEventListener("click", handleSave);

  renderNodes();
  renderConnectors();
  renderSavedDiagrams();
}

function addBox() {
  const label = prompt("Box label (e.g. 'Server', 'Database'):", "New box");
  if (label === null) return;

  const node = {
    id: generateNodeId(),
    label: label.trim() || "Untitled",
    x: 24 + (state.nodes.length % 4) * 110,
    y: 24 + Math.floor(state.nodes.length / 4) * 90,
  };
  state.nodes.push(node);
  renderNodes();
  renderConnectors();
}

function renderNodes() {
  const layer = document.getElementById("node-layer");
  if (!layer) return;
  layer.innerHTML = "";

  state.nodes.forEach((node) => {
    const el = document.createElement("div");
    el.className = "diagram-node";
    el.dataset.id = node.id;
    el.textContent = node.label;
    el.style.cssText = `
      position:absolute; left:${node.x}px; top:${node.y}px;
      min-width:90px; max-width:140px; padding:10px 12px;
      background: var(--color-bg-inset); border:1.5px solid var(--color-accent);
      border-radius: var(--radius-md); color: var(--color-text);
      font-size:13px; cursor:grab; user-select:none; text-align:center;
    `;
    if (node.id === state.connectingFromId) {
      el.style.boxShadow = "0 0 0 2px var(--color-accent)";
    }

    attachDragHandlers(el, node);
    el.addEventListener("click", (e) => {
      if (el.dataset.dragged === "true") {
        el.dataset.dragged = "false";
        return;
      }
      handleNodeTap(node.id);
    });

    layer.appendChild(el);
  });
}

function attachDragHandlers(el, node) {
  let startX, startY, origX, origY, moved;

  const onPointerDown = (e) => {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX;
    startY = point.clientY;
    origX = node.x;
    origY = node.y;
    moved = false;
    document.addEventListener("mousemove", onPointerMove);
    document.addEventListener("mouseup", onPointerUp);
    document.addEventListener("touchmove", onPointerMove, { passive: false });
    document.addEventListener("touchend", onPointerUp);
  };

  const onPointerMove = (e) => {
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    const dx = point.clientX - startX;
    const dy = point.clientY - startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
    node.x = Math.max(0, origX + dx);
    node.y = Math.max(0, origY + dy);
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
    renderConnectors();
  };

  const onPointerUp = () => {
    el.dataset.dragged = moved ? "true" : "false";
    document.removeEventListener("mousemove", onPointerMove);
    document.removeEventListener("mouseup", onPointerUp);
    document.removeEventListener("touchmove", onPointerMove);
    document.removeEventListener("touchend", onPointerUp);
  };

  el.addEventListener("mousedown", onPointerDown);
  el.addEventListener("touchstart", onPointerDown, { passive: false });
}

function handleNodeTap(nodeId) {
  if (!state.connectingFromId) {
    state.connectingFromId = nodeId;
    renderNodes();
    return;
  }

  if (state.connectingFromId === nodeId) {
    state.connectingFromId = null;
    renderNodes();
    return;
  }

  state.connectors.push({ from: state.connectingFromId, to: nodeId });
  state.connectingFromId = null;
  renderNodes();
  renderConnectors();
}

function renderConnectors() {
  const svg = document.getElementById("connector-layer");
  if (!svg) return;
  svg.innerHTML = `
    <defs>
      <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <polygon points="0 0, 8 4, 0 8" fill="#d4ff3a" />
      </marker>
    </defs>
  `;

  state.connectors.forEach((conn) => {
    const fromNode = state.nodes.find((n) => n.id === conn.from);
    const toNode = state.nodes.find((n) => n.id === conn.to);
    if (!fromNode || !toNode) return;

    const x1 = fromNode.x + 45;
    const y1 = fromNode.y + 20;
    const x2 = toNode.x + 45;
    const y2 = toNode.y + 20;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", x1);
    line.setAttribute("y1", y1);
    line.setAttribute("x2", x2);
    line.setAttribute("y2", y2);
    line.setAttribute("stroke", "#d4ff3a");
    line.setAttribute("stroke-width", "1.5");
    line.setAttribute("marker-end", "url(#arrow)");
    svg.appendChild(line);
  });
}

async function handleSave() {
  const diagram = {
    id: state.diagramId,
    name: state.name,
    nodes: state.nodes,
    connectors: state.connectors,
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

  state = {
    diagramId: diagram.id,
    name: diagram.name,
    nodes: diagram.nodes || [],
    connectors: diagram.connectors || [],
    connectingFromId: null,
  };
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
