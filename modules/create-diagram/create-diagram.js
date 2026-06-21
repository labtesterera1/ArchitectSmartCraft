/**
 * modules/create-diagram/create-diagram.js
 * ----------------------------------------------------------------
 * CreateDiagram — draw.io-style diagram editor, built from scratch.
 *
 * Layout: top toolbar | left palette | main SVG canvas with grid
 * Features: 13 shapes, fill colors, connector styles (straight/
 * curved/orthogonal), draggable waypoints with visible +/× controls,
 * text tool, undo/redo, zoom/pan, fit-to-view, PNG export, save/load.
 *
 * Independent module — only talks to storage.js.
 * ----------------------------------------------------------------
 */
import storage from "../../js/storage.js";

// ================================================================
// CONSTANTS
// ================================================================

const SHAPES = [
  { type: "rect",          label: "Box",         w: 120, h: 60,  icon: `<rect x="3" y="6" width="18" height="12" rx="2"/>` },
  { type: "rounded",       label: "Process",     w: 120, h: 60,  icon: `<rect x="3" y="6" width="18" height="12" rx="6"/>` },
  { type: "ellipse",       label: "Ellipse",     w: 120, h: 80,  icon: `<ellipse cx="12" cy="12" rx="9" ry="6"/>` },
  { type: "diamond",       label: "Decision",    w: 120, h: 90,  icon: `<polygon points="12,3 21,12 12,21 3,12"/>` },
  { type: "triangle",      label: "Triangle",    w: 100, h: 90,  icon: `<polygon points="12,4 21,20 3,20"/>` },
  { type: "cylinder",      label: "Database",    w: 100, h: 90,  icon: `<path d="M4 8c0-2 3.6-4 8-4s8 2 8 4v8c0 2-3.6 4-8 4s-8-2-8-4z"/><ellipse cx="12" cy="8" rx="8" ry="4"/>` },
  { type: "hexagon",       label: "Hexagon",     w: 130, h: 70,  icon: `<polygon points="7,4 17,4 21,12 17,20 7,20 3,12"/>` },
  { type: "parallelogram", label: "I/O",         w: 130, h: 60,  icon: `<polygon points="7,6 21,6 17,18 3,18"/>` },
  { type: "cloud",         label: "Cloud",       w: 140, h: 90,  icon: `<path d="M6 19a4 4 0 0 1-.8-7.9 5.5 5.5 0 0 1 10.2-2A4 4 0 0 1 18 17H6z"/>` },
  { type: "callout",       label: "Callout",     w: 130, h: 80,  icon: `<path d="M3 4h18v11H10l-3 5v-5H3z"/>` },
  { type: "person",        label: "Actor",       w: 70,  h: 100, icon: `<circle cx="12" cy="7" r="3"/><path d="M7 21v-4a5 5 0 0 1 10 0v4"/>` },
  { type: "document",      label: "Document",    w: 120, h: 80,  icon: `<path d="M4 4h16v13c-2 0-2 2-4 2s-2-2-4-2-2 2-4 2-2-2-4-2z"/>` },
  { type: "text",          label: "Text",        w: 100, h: 32,  icon: `<line x1="6" y1="7" x2="18" y2="7"/><line x1="12" y1="7" x2="12" y2="18"/><line x1="9" y1="18" x2="15" y2="18"/>` },
];

const COLORS = [
  { key: "",        hex: "#0a0907", label: "Default" },
  { key: "#d4ff3a", hex: "#d4ff3a", label: "Lime" },
  { key: "#4ee08a", hex: "#4ee08a", label: "Green" },
  { key: "#5ab8ff", hex: "#5ab8ff", label: "Blue" },
  { key: "#ff8a5c", hex: "#ff8a5c", label: "Orange" },
  { key: "#ff5a4e", hex: "#ff5a4e", label: "Red" },
  { key: "#c98fff", hex: "#c98fff", label: "Purple" },
  { key: "#ffd700", hex: "#ffd700", label: "Gold" },
  { key: "#ffffff", hex: "#ffffff", label: "White" },
];

const LINE_STYLES = [
  { key: "straight",    label: "Straight",    icon: `<line x1="4" y1="19" x2="20" y2="5"/>` },
  { key: "curved",      label: "Curved",      icon: `<path d="M4 19C4 9 20 15 20 5"/>` },
  { key: "orthogonal",  label: "Right-angle", icon: `<path d="M4 19V12H20V5"/>` },
];

const ARROW_TYPES = [
  { key: "none",     label: "None",          icon: `<line x1="4" y1="12" x2="20" y2="12"/>` },
  { key: "arrow",    label: "Arrow",         icon: `<line x1="4" y1="12" x2="18" y2="12"/><path d="M14 8l5 4-5 4"/>` },
  { key: "filled",   label: "Filled arrow",  icon: `<line x1="4" y1="12" x2="16" y2="12"/><polygon points="14,8 20,12 14,16"/>` },
  { key: "diamond",  label: "Diamond",       icon: `<line x1="4" y1="12" x2="14" y2="12"/><polygon points="14,12 17,9 20,12 17,15"/>` },
  { key: "circle",   label: "Circle",        icon: `<line x1="4" y1="12" x2="16" y2="12"/><circle cx="18" cy="12" r="3"/>` },
];

const GRID_SIZE = 20;
const HANDLE_R  = 6;
const MIN_ZOOM  = 0.2;
const MAX_ZOOM  = 3;
const MAX_UNDO  = 60;

const THEMES = [
  { key:"dark",      label:"Dark",      bg:"#0c0b09", grid:"rgba(212,255,58,0.06)", stroke:"#d4ff3a", fill:"#0a0907", text:"#f4f2ea", border:"rgba(212,255,58,0.18)" },
  { key:"light",     label:"Light",     bg:"#ffffff", grid:"rgba(0,0,0,0.07)",       stroke:"#333333", fill:"#ffffff", text:"#222222", border:"rgba(0,0,0,0.15)" },
  { key:"blueprint", label:"Blueprint", bg:"#1a3a5c", grid:"rgba(100,180,255,0.12)", stroke:"#88ccff", fill:"#1a3a5c", text:"#e8f0ff", border:"rgba(100,180,255,0.25)" },
  { key:"warm",      label:"Warm",      bg:"#2d2418", grid:"rgba(255,200,80,0.08)",  stroke:"#ffc850", fill:"#2d2418", text:"#f5e6c8", border:"rgba(255,200,80,0.2)" },
  { key:"white",     label:"Clean",     bg:"#f8f8f8", grid:"rgba(0,0,0,0.05)",       stroke:"#555555", fill:"#f8f8f8", text:"#111111", border:"rgba(0,0,0,0.12)" },
];

// ================================================================
// MODULE STATE
// ================================================================

let el = {};          // cached DOM references
let S  = newState();  // diagram + UI state
let customShapes = []; // uploaded images: [{id, name, dataUrl}]

function newState() {
  return {
    id: null, name: "Untitled", nodes: [], conns: [],
    sel: null, pan: { x: 40, y: 30 }, zoom: 1,
    undo: [], redo: [], activeWp: null,
    tool: null,           // null | "text" | "connect"
    lineStyle: "straight", // default for new connectors
    pendingColor: null,
    theme: "dark",         // canvas theme key
  };
}

function theme() { return THEMES.find(t => t.key === S.theme) || THEMES[0]; }

// ================================================================
// ENTRY
// ================================================================

export async function initCreateDiagramView(container) {
  S = newState();
  const savedTheme = await storage.settings.get("diagramTheme");
  if (savedTheme && THEMES.find(t => t.key === savedTheme)) S.theme = savedTheme;
  const savedShapes = await storage.settings.get("customShapes");
  if (Array.isArray(savedShapes)) customShapes = savedShapes;
  buildShell(container);
  draw();
  loadSavedList();
}

// ================================================================
// SHELL (toolbar + palette + canvas)
// ================================================================

function buildShell(container) {
  container.innerHTML = `
  <div class="flex-between" style="margin-bottom:8px;flex-wrap:wrap;gap:8px">
    <input id="dd-name" type="text" value="${esc(S.name)}" style="font-family:var(--font-serif);font-size:20px;border:none;background:transparent;padding:4px 0;min-width:140px"/>
    <button class="btn btn-primary" id="dd-save">Save</button>
  </div>
  <div style="position:relative">
    <div id="dd-toolbar" class="flex gap-1" style="background:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:5px;flex-wrap:wrap"></div>
    <div id="dd-popup" class="hidden" style="position:absolute;top:100%;margin-top:4px;background:var(--color-bg-raised);border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:6px;z-index:20"></div>
  </div>
  <div style="display:flex;gap:8px;margin-top:8px;width:100%;min-width:0">
    <div class="panel" id="dd-palette" style="padding:8px;width:112px;flex-shrink:0;height:440px;overflow-y:auto"></div>
    <div class="panel corner-frame" id="dd-canvas-wrap" style="position:relative;padding:0;overflow:hidden;height:440px;flex:1;min-width:0;touch-action:none">
      <svg id="dd-svg" width="100%" height="100%" style="display:block;cursor:grab">
        <defs>
          <pattern id="grid" width="${GRID_SIZE}" height="${GRID_SIZE}" patternUnits="userSpaceOnUse">
            <path d="M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}" fill="none" stroke="rgba(212,255,58,0.06)" stroke-width="0.5"/>
          </pattern>
          <marker id="ah" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="#d4ff3a"/></marker>
          <marker id="ah-w" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="#fff"/></marker>
          <marker id="ah-filled" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="#d4ff3a"/></marker>
          <marker id="ah-filled-w" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="#fff"/></marker>
          <marker id="ah-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><polygon points="0,5 5,0 10,5 5,10" fill="#d4ff3a"/></marker>
          <marker id="ah-diamond-w" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><polygon points="0,5 5,0 10,5 5,10" fill="#fff"/></marker>
          <marker id="ah-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="#d4ff3a"/></marker>
          <marker id="ah-circle-w" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="#fff"/></marker>
          <marker id="ah-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="none" stroke="#d4ff3a" stroke-width="1.5"/></marker>
          <marker id="ah-arrow-w" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="none" stroke="#fff" stroke-width="1.5"/></marker>
          <marker id="ah-s-arrow" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><path d="M9 0L0 4.5L9 9" fill="none" stroke="#d4ff3a" stroke-width="1.5"/></marker>
          <marker id="ah-s-filled" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><polygon points="9 0,0 4.5,9 9" fill="#d4ff3a"/></marker>
          <marker id="ah-s-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse"><polygon points="0,5 5,0 10,5 5,10" fill="#d4ff3a"/></marker>
          <marker id="ah-s-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="#d4ff3a"/></marker>
        </defs>
        <rect id="dd-grid-bg" width="9999" height="9999" fill="url(#grid)"/>
        <g id="dd-vp"></g>
      </svg>
      <div id="dd-float" class="hidden" style="position:absolute;display:flex;gap:2px;background:var(--color-bg-raised);border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:4px;transform:translate(-50%,-120%);z-index:5"></div>
      <div id="dd-zoom-label" style="position:absolute;bottom:8px;right:8px;font-size:11px;color:var(--color-text-tertiary);background:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:4px;padding:3px 7px;cursor:pointer">100%</div>
    </div>
  </div>
  <div class="panel mt-2"><span class="label">Saved diagrams</span><div id="dd-saved"></div></div>`;

  el.svg     = document.getElementById("dd-svg");
  el.vp      = document.getElementById("dd-vp");
  el.gridBg  = document.getElementById("dd-grid-bg");
  el.toolbar = document.getElementById("dd-toolbar");
  el.popup   = document.getElementById("dd-popup");
  el.palette = document.getElementById("dd-palette");
  el.float   = document.getElementById("dd-float");
  el.saved   = document.getElementById("dd-saved");
  el.name    = document.getElementById("dd-name");
  el.zoomLbl = document.getElementById("dd-zoom-label");

  el.name.addEventListener("input", (e) => (S.name = e.target.value));
  document.getElementById("dd-save").addEventListener("click", save);
  el.zoomLbl.addEventListener("dblclick", fitView);

  buildToolbar();
  buildPalette();
  bindCanvas();
  bindKeyboard();
  applyTheme();
}

// ================================================================
// TOOLBAR
// ================================================================

function tbBtn(id, icon, title, disabled, active) {
  const cls = active ? "btn btn-primary" : "btn";
  return `<button class="${cls}" id="${id}" title="${title}" ${disabled?"disabled":""} style="padding:6px;line-height:0">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icon}</svg></button>`;
}
function tbSep() { return `<div style="width:1px;background:var(--color-border);margin:1px 3px"></div>`; }

const TB = {
  zoomIn:  `<circle cx="10" cy="10" r="6"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="10" y1="7" x2="10" y2="13"/><line x1="7" y1="10" x2="13" y2="10"/>`,
  zoomOut: `<circle cx="10" cy="10" r="6"/><line x1="14" y1="14" x2="20" y2="20"/><line x1="7" y1="10" x2="13" y2="10"/>`,
  fit:     `<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M20 9V5a1 1 0 0 0-1-1h-4"/><path d="M4 15v4a1 1 0 0 0 1 1h4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/>`,
  undo:    `<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10h-1"/>`,
  redo:    `<path d="M15 7l5 5-5 5"/><path d="M20 12H9a5 5 0 0 0 0 10h1"/>`,
  conn:    `<line x1="5" y1="19" x2="19" y2="5"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/>`,
  brush:   `<path d="M12 3c-2 4-6 7-6 11a6 6 0 0 0 12 0c0-4-4-7-6-11z"/>`,
  text:    `<line x1="6" y1="6" x2="18" y2="6"/><line x1="12" y1="6" x2="12" y2="18"/><line x1="9" y1="18" x2="15" y2="18"/>`,
  trash:   `<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>`,
  dl:      `<path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 19h14"/>`,
  theme:   `<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/>`,
  copy:    `<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>`,
  paste:   `<rect x="6" y="3" width="12" height="6" rx="1"/><rect x="4" y="9" width="16" height="12" rx="2"/>`,
};

function buildToolbar() {
  el.toolbar.innerHTML = [
    tbBtn("tb-zo", TB.zoomOut, "Zoom out"),
    tbBtn("tb-zi", TB.zoomIn,  "Zoom in"),
    tbBtn("tb-fit",TB.fit,     "Fit to view"),
    tbSep(),
    tbBtn("tb-un", TB.undo, "Undo",  S.undo.length===0),
    tbBtn("tb-re", TB.redo, "Redo",  S.redo.length===0),
    tbSep(),
    tbBtn("tb-cn", TB.conn,  "Connector tool", false, S.tool==="connect"),
    tbBtn("tb-br", TB.brush, "Fill color"),
    tbBtn("tb-tx", TB.text,  "Text tool", false, S.tool==="text"),
    tbBtn("tb-th", TB.theme, "Canvas theme"),
    tbSep(),
    tbBtn("tb-cp", TB.copy,  "Copy", !S.sel || S.sel.k !== "node"),
    tbBtn("tb-ps", TB.paste, "Paste", !S._clipboard),
    tbBtn("tb-del",TB.trash, "Delete", !S.sel),
    tbSep(),
    tbBtn("tb-dl", TB.dl,    "Download PNG"),
  ].join("");

  on("tb-zo",  () => doZoom(1/1.15));
  on("tb-zi",  () => doZoom(1.15));
  on("tb-fit", fitView);
  on("tb-un",  undo);
  on("tb-re",  redo);
  on("tb-cn",  openConnPopup);
  on("tb-br",  openColorPopup);
  on("tb-tx",  toggleTextTool);
  on("tb-th",  openThemePopup);
  on("tb-cp",  copyNode);
  on("tb-ps",  pasteNode);
  on("tb-del", deleteSel);
  on("tb-dl",  downloadPng);
}
function on(id, fn) { document.getElementById(id).addEventListener("click", fn); }

// ================================================================
// PALETTE
// ================================================================

function buildPalette() {
  el.palette.innerHTML = `<span class="label" style="margin-bottom:8px">Shapes</span>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">${SHAPES.map(s =>
    `<button class="btn" data-shape="${s.type}" title="${s.label}" style="display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;line-height:0">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4">${s.icon}</svg>
      <span style="font-size:8px;line-height:1">${s.label}</span></button>`
  ).join("")}</div>
  <div style="margin-top:12px;border-top:1px solid var(--color-border);padding-top:10px">
    <span class="label" style="margin-bottom:6px">Store Shapes</span>
    <div id="dd-custom-shapes" style="display:grid;grid-template-columns:1fr 1fr;gap:5px"></div>
    <label class="btn btn-block mt-1" style="font-size:10px;cursor:pointer;justify-content:center;padding:6px">
      + Upload
      <input type="file" id="dd-shape-upload" accept="image/*" class="hidden" multiple/>
    </label>
  </div>`;
  el.palette.querySelectorAll("[data-shape]").forEach(b =>
    b.addEventListener("click", () => addShape(b.dataset.shape)));
  document.getElementById("dd-shape-upload").addEventListener("change", handleShapeUpload);
  renderCustomShapes();
}

// ================================================================
// CANVAS EVENTS
// ================================================================

function bindCanvas() {
  el.svg.addEventListener("wheel", e => { e.preventDefault(); doZoom(e.deltaY<0?1.08:1/1.08); }, {passive:false});

  el.svg.addEventListener("mousedown", canvasDown);
  el.svg.addEventListener("touchstart", canvasDown, {passive:true});
}

function canvasDown(e) {
  if (e.target !== el.svg && e.target !== el.gridBg && e.target.id !== "dd-vp") return;
  if (S.tool === "text") { placeText(e); return; }
  if (S.tool === "connect") { startFreeConnect(e); return; }
  startPan(e);
  setSel(null);
}

/** Freeform connector drawing — click anywhere to start, drag to end. Snaps to boxes if near one. */
function startFreeConnect(evt) {
  const startPt = svgPt(evt);
  const startNode = nodeAt(startPt);

  const tmp = svgEl("line");
  tmp.setAttribute("stroke","#d4ff3a"); tmp.setAttribute("stroke-width","1.5");
  tmp.setAttribute("stroke-dasharray","4 3"); tmp.style.pointerEvents="none";
  tmp.setAttribute("x1", startPt.x); tmp.setAttribute("y1", startPt.y);
  tmp.setAttribute("x2", startPt.x); tmp.setAttribute("y2", startPt.y);
  el.vp.appendChild(tmp);

  const mv = e => {
    e.preventDefault(); const p = svgPt(e);
    tmp.setAttribute("x2", p.x); tmp.setAttribute("y2", p.y);
  };
  const up = e => {
    const endPt = svgPt(e.changedTouches ? e.changedTouches[0] : e);
    tmp.remove();
    // Only create if dragged at least a small distance
    if (Math.hypot(endPt.x - startPt.x, endPt.y - startPt.y) > 10) {
      const endNode = nodeAt(endPt);
      snap();
      const nc = {
        id: uid("c"), style: S.lineStyle, wp: [], startArrow: "none", endArrow: "filled",
        from: startNode ? startNode.id : null,
        to: endNode ? endNode.id : null,
        fromPt: startNode ? null : { x: startPt.x, y: startPt.y },
        toPt: endNode ? null : { x: endPt.x, y: endPt.y },
      };
      S.conns.push(nc);
      setSel({ k: "conn", id: nc.id });
    }
    off(mv, up);
    // Tool stays active for more connections
  };
  listen(mv, up);
}

/** Finds the node at a given point, or null if clicking empty canvas. */
function nodeAt(pt) {
  return S.nodes.find(n => pt.x >= n.x && pt.x <= n.x + n.w && pt.y >= n.y && pt.y <= n.y + n.h) || null;
}

function startPan(evt) {
  const p = ptr(evt);
  const orig = {...S.pan};
  el.svg.style.cursor = "grabbing";
  hideFloat();

  const move = e => {
    const c = ptr(e);
    S.pan = { x: orig.x + c.x - p.x, y: orig.y + c.y - p.y };
    applyVP();
  };
  const up = () => {
    el.svg.style.cursor = S.tool === "text" ? "text" : "grab";
    off(move, up);
  };
  listen(move, up);
}

// ================================================================
// VIEWPORT TRANSFORM
// ================================================================

function applyVP() {
  el.vp.setAttribute("transform", `translate(${S.pan.x},${S.pan.y}) scale(${S.zoom})`);
  el.gridBg.setAttribute("transform", `translate(${S.pan.x},${S.pan.y}) scale(${S.zoom})`);
  el.zoomLbl.textContent = `${Math.round(S.zoom*100)}%`;
}

function doZoom(factor) {
  S.zoom = clamp(S.zoom * factor, MIN_ZOOM, MAX_ZOOM);
  applyVP();
  if (S.sel) draw();
}

function fitView() {
  const hasContent = S.nodes.length > 0 || S.conns.some(c => c.fromPt || c.toPt);
  if (!hasContent) { S.zoom=1; S.pan={x:40,y:30}; applyVP(); return; }
  const b = contentBounds();
  const PAD = 40;
  const cw = b.maxX-b.minX+PAD*2, ch = b.maxY-b.minY+PAD*2;
  const r = el.svg.getBoundingClientRect();
  S.zoom = clamp(Math.min(r.width/cw, r.height/ch), MIN_ZOOM, MAX_ZOOM);
  S.pan = { x: -b.minX*S.zoom+PAD*S.zoom, y: -b.minY*S.zoom+PAD*S.zoom };
  applyVP(); draw();
}

// ================================================================
// SELECTION
// ================================================================

function setSel(s) {
  S.sel = s;
  S.activeWp = null;
  closePopup();
  hideFloat();
  draw();
  buildToolbar();
}

function deleteSel() {
  if (!S.sel) return;
  snap();
  if (S.sel.k === "node") {
    S.nodes = S.nodes.filter(n => n.id !== S.sel.id);
    S.conns = S.conns.filter(c => c.from !== S.sel.id && c.to !== S.sel.id);
  } else {
    S.conns = S.conns.filter(c => c.id !== S.sel.id);
  }
  setSel(null);
}

// ================================================================
// UNDO / REDO
// ================================================================

function snap() {
  S.undo.push({ nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) });
  if (S.undo.length > MAX_UNDO) S.undo.shift();
  S.redo = [];
}
function undo() {
  if (!S.undo.length) return;
  S.redo.push({ nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) });
  const prev = S.undo.pop();
  S.nodes = prev.nodes; S.conns = prev.conns;
  setSel(null);
}
function redo() {
  if (!S.redo.length) return;
  S.undo.push({ nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) });
  const next = S.redo.pop();
  S.nodes = next.nodes; S.conns = next.conns;
  setSel(null);
}

// ================================================================
// ADD SHAPE
// ================================================================

function addShape(type) {
  snap();
  const def = SHAPES.find(s => s.type === type);
  const vis = visBounds();
  const cols = Math.max(1, Math.floor((vis.w - 30) / 150));
  const i = S.nodes.length;
  const node = {
    id: uid("n"), type, label: def.label,
    x: vis.x + 20 + (i % cols) * 150,
    y: vis.y + 20 + Math.floor(i / cols) * 110,
    w: def.w, h: def.h, fill: null,
  };
  S.nodes.push(node);
  setSel({ k: "node", id: node.id });
}

// ================================================================
// TEXT TOOL
// ================================================================

function toggleTextTool() {
  if (S.tool === "text") { S.tool = null; }
  else { S.tool = "text"; }
  el.svg.style.cursor = S.tool === "text" ? "text" : "grab";
  closePopup();
  buildToolbar();
}

function placeText(evt) {
  const p = svgPt(evt);
  snap();
  const node = { id: uid("n"), type: "text", label: "Text", x: p.x-50, y: p.y-16, w: 100, h: 32, fill: null };
  S.nodes.push(node);
  S.tool = null;
  el.svg.style.cursor = "grab";
  setSel({ k: "node", id: node.id });
  buildToolbar();
  const newLabel = prompt("Enter text:", node.label);
  if (newLabel !== null && newLabel.trim()) node.label = newLabel.trim();
  draw();
}

// ================================================================
// CONNECTOR STYLE / COLOR POPUPS
// ================================================================

function closePopup() { el.popup && el.popup.classList.add("hidden"); }

function openConnPopup() {
  // If already in connect mode, toggle it off
  if (S.tool === "connect") {
    S.tool = null; el.svg.style.cursor = "grab"; buildToolbar(); return;
  }
  if (!el.popup.classList.contains("hidden")) { closePopup(); return; }
  el.popup.style.left = document.getElementById("tb-cn").offsetLeft + "px";
  el.popup.innerHTML = `<div style="display:flex;flex-direction:column;gap:3px">${
    LINE_STYLES.map(ls => `<button class="btn${S.lineStyle===ls.key?" btn-primary":""}" data-ls="${ls.key}" style="padding:6px 10px;line-height:0;display:flex;gap:6px;align-items:center" title="${ls.label}">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${ls.icon}</svg>
      <span style="font-size:11px">${ls.label}</span></button>`).join("")
  }</div>`;
  el.popup.classList.remove("hidden");
  el.popup.querySelectorAll("[data-ls]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    S.lineStyle = b.dataset.ls;
    // If a connector is currently selected, apply immediately
    if (S.sel && S.sel.k === "conn") {
      const c = S.conns.find(c => c.id === S.sel.id);
      if (c) { snap(); c.style = S.lineStyle; draw(); }
    }
    // Arm the connect tool — user can now click any box to start drawing
    S.tool = "connect";
    el.svg.style.cursor = "crosshair";
    closePopup(); buildToolbar();
  }));
}

function openColorPopup() {
  if (!el.popup.classList.contains("hidden")) { closePopup(); return; }
  const selNode = S.sel && S.sel.k === "node" ? S.nodes.find(n => n.id === S.sel.id) : null;
  el.popup.style.left = document.getElementById("tb-br").offsetLeft + "px";
  el.popup.innerHTML = `<div style="display:flex;gap:4px;flex-wrap:wrap;max-width:200px">${
    COLORS.map(c => {
      const active = selNode && (selNode.fill||"") === c.key;
      return `<button data-clr="${c.key}" title="${c.label}" style="width:24px;height:24px;border-radius:50%;background:${c.hex};border:2px solid ${active?"#fff":"rgba(255,255,255,0.2)"};padding:0;cursor:pointer"></button>`;
    }).join("")
  }</div>${!selNode?`<p style="font-size:10px;color:var(--color-text-tertiary);margin:6px 0 0">Select a shape first, or pick a color for the next one.</p>`:""}`;
  el.popup.classList.remove("hidden");
  el.popup.querySelectorAll("[data-clr]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    const color = b.dataset.clr;
    if (selNode) { snap(); selNode.fill = color || null; draw(); }
    else S.pendingColor = color || null;
    closePopup();
  }));
}

// ================================================================
// DRAWING — MAIN RENDER
// ================================================================

// ================================================================
// THEME
// ================================================================

function openThemePopup() {
  if (!el.popup.classList.contains("hidden")) { closePopup(); return; }
  el.popup.style.left = document.getElementById("tb-th").offsetLeft + "px";
  el.popup.innerHTML = `<div style="display:flex;flex-direction:column;gap:3px">${
    THEMES.map(t => `<button class="btn${S.theme===t.key?" btn-primary":""}" data-theme="${t.key}" style="padding:6px 12px;display:flex;gap:8px;align-items:center;border:none">
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${t.bg};border:2px solid ${t.stroke}"></span>
      <span style="font-size:11px">${t.label}</span></button>`).join("")
  }</div>`;
  el.popup.classList.remove("hidden");
  el.popup.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", async e => {
    e.stopPropagation();
    S.theme = b.dataset.theme;
    await storage.settings.set("diagramTheme", S.theme);
    closePopup();
    applyTheme();
    draw();
    buildToolbar();
  }));
}

function applyTheme() {
  const t = theme();
  const wrap = document.getElementById("dd-canvas-wrap");
  if (wrap) wrap.style.background = t.bg;
  // Update grid pattern
  const gridPath = el.svg.querySelector("#grid path");
  if (gridPath) gridPath.setAttribute("stroke", t.grid);
  // Update all markers to use theme stroke color
  el.svg.querySelectorAll("[id^='ah']").forEach(m => {
    m.querySelectorAll("polygon").forEach(p => { if(p.getAttribute("fill")!=="#fff") p.setAttribute("fill", t.stroke); });
    m.querySelectorAll("circle").forEach(c => { if(c.getAttribute("fill")!=="#fff") c.setAttribute("fill", t.stroke); });
    m.querySelectorAll("path").forEach(p => { if(p.getAttribute("stroke") && p.getAttribute("stroke")!=="#fff") p.setAttribute("stroke", t.stroke); });
  });
}

// ================================================================
// COPY / PASTE
// ================================================================

function copyNode() {
  if (!S.sel || S.sel.k !== "node") return;
  const node = S.nodes.find(n => n.id === S.sel.id);
  if (!node) return;
  S._clipboard = structuredClone(node);
  buildToolbar();
  toast("Copied");
}

function pasteNode() {
  if (!S._clipboard) return;
  snap();
  const node = { ...structuredClone(S._clipboard), id: uid("n"), x: S._clipboard.x + 30, y: S._clipboard.y + 30 };
  S.nodes.push(node);
  S._clipboard.x += 30; S._clipboard.y += 30; // offset next paste
  setSel({ k: "node", id: node.id });
  toast("Pasted");
}

function bindKeyboard() {
  document.addEventListener("keydown", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key === "c") { copyNode(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "v") { pasteNode(); e.preventDefault(); }
    if ((e.ctrlKey || e.metaKey) && e.key === "z") { if (e.shiftKey) redo(); else undo(); e.preventDefault(); }
    if (e.key === "Delete" || e.key === "Backspace") { if (S.sel) { deleteSel(); e.preventDefault(); } }
  });
}

// ================================================================
// STORE SHAPES (upload custom images)
// ================================================================

async function handleShapeUpload(e) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  for (const file of files) {
    const dataUrl = await fileToBase64(file);
    customShapes.push({ id: uid("cs"), name: file.name.replace(/\.\w+$/, ""), dataUrl });
  }
  await storage.settings.set("customShapes", customShapes);
  renderCustomShapes();
  e.target.value = "";
  toast(`${files.length} shape${files.length > 1 ? "s" : ""} uploaded`);
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });
}

function renderCustomShapes() {
  const container = document.getElementById("dd-custom-shapes");
  if (!container) return;
  if (!customShapes.length) { container.innerHTML = `<p style="font-size:9px;color:var(--color-text-tertiary);grid-column:1/-1">No shapes uploaded yet</p>`; return; }
  container.innerHTML = customShapes.map(cs => `
    <div class="btn" data-cs="${cs.id}" title="${cs.name}" style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 2px;line-height:0;position:relative;cursor:pointer">
      <img src="${cs.dataUrl}" style="width:28px;height:28px;object-fit:contain"/>
      <span style="font-size:7px;line-height:1;max-width:44px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cs.name)}</span>
      <button data-rm-cs="${cs.id}" style="position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;background:#ff5a4e;border:none;color:#fff;font-size:9px;line-height:1;cursor:pointer;padding:0" title="Remove">×</button>
    </div>`).join("");
  container.querySelectorAll("[data-cs]").forEach(b => b.addEventListener("click", () => addImageShape(b.dataset.cs)));
  container.querySelectorAll("[data-rm-cs]").forEach(b => b.addEventListener("click", async e => {
    e.stopPropagation();
    customShapes = customShapes.filter(c => c.id !== b.dataset.rmCs);
    await storage.settings.set("customShapes", customShapes);
    renderCustomShapes();
  }));
}

function addImageShape(csId) {
  const cs = customShapes.find(c => c.id === csId);
  if (!cs) return;
  snap();
  const vis = visBounds();
  const node = {
    id: uid("n"), type: "image", label: cs.name,
    x: vis.x + 40, y: vis.y + 40, w: 80, h: 80,
    fill: null, imageData: cs.dataUrl,
  };
  S.nodes.push(node);
  setSel({ k: "node", id: node.id });
}

// ================================================================
// DRAWING — MAIN RENDER
// ================================================================

function draw() {
  el.vp.innerHTML = "";
  applyVP();
  S.conns.forEach(drawConn);
  S.nodes.forEach(drawNode);
}

// ================================================================
// DRAW NODE
// ================================================================

function drawNode(node) {
  const isSel = S.sel && S.sel.k === "node" && S.sel.id === node.id;
  const g = svgEl("g"); g.style.cursor = "grab";

  // shape
  let shape;
  if (node.type === "image" && node.imageData) {
    shape = svgEl("image");
    shape.setAttribute("href", node.imageData);
    shape.setAttribute("x", node.x); shape.setAttribute("y", node.y);
    shape.setAttribute("width", node.w); shape.setAttribute("height", node.h);
    shape.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (isSel) {
      const border = svgEl("rect");
      border.setAttribute("x", node.x); border.setAttribute("y", node.y);
      border.setAttribute("width", node.w); border.setAttribute("height", node.h);
      border.setAttribute("fill", "none"); border.setAttribute("stroke", "#fff");
      border.setAttribute("stroke-width", "2.5"); border.setAttribute("stroke-dasharray", "4 2");
      border.setAttribute("rx", "4");
      g.appendChild(border);
    }
  } else {
    shape = buildShape(node);
    const t = theme();
    const fill = node.type === "text" ? "transparent" : (node.fill || t.fill);
    shape.setAttribute("fill", fill);
    if (node.type !== "text") {
      shape.setAttribute("stroke", isSel ? "#fff" : t.stroke);
      shape.setAttribute("stroke-width", isSel ? "2.5" : "1.5");
    }
  }
  g.appendChild(shape);

  // label (skip for image nodes or show below)
  if (node.type !== "image") {
    const txt = svgEl("text");
    txt.setAttribute("x", node.x + node.w/2);
    txt.setAttribute("y", node.y + node.h/2 + 5);
    txt.setAttribute("text-anchor", "middle");
    const fontSize = node.fontSize || 12;
    const t = theme();
    const nodeFill = node.type === "text" ? "transparent" : (node.fill || t.fill);
    const textColor = node.textColor || (lightOrDark(nodeFill) === "dark" ? t.text : "#0c0b09");
    txt.setAttribute("fill", textColor);
    txt.setAttribute("font-size", fontSize);
    txt.setAttribute("font-family", "JetBrains Mono,monospace");
    txt.style.pointerEvents = "none";
    txt.textContent = node.label;
    g.appendChild(txt);
  }

  // edge handles (for connecting)
  if (isSel) {
    handles(node).forEach(h => {
      const dot = svgEl("circle");
      dot.setAttribute("cx", h.x); dot.setAttribute("cy", h.y);
      dot.setAttribute("r", HANDLE_R);
      dot.setAttribute("fill", "#0c0b09"); dot.setAttribute("stroke", "#d4ff3a"); dot.setAttribute("stroke-width", "1.5");
      dot.style.cursor = "crosshair"; dot.style.opacity = "0.8";
      dot.addEventListener("mousedown", e => { e.stopPropagation(); startConnect(node.id, e); });
      dot.addEventListener("touchstart", e => { e.stopPropagation(); startConnect(node.id, e); }, {passive:true});
      g.appendChild(dot);
    });
    // show text formatting float only for text nodes
    if (node.type === "text") showTextFloat(node);
  }

  // interactions
  let tapT = 0;
  g.addEventListener("click", e => {
    e.stopPropagation();
    if (S.tool === "connect") return; // handled by mousedown below
    if (node._dragged) { node._dragged = false; return; }
    const now = Date.now();
    if (now - tapT < 400) { tapT=0; renameNode(node); return; }
    tapT = now;
    setSel({ k: "node", id: node.id });
    if (S.pendingColor !== null && S.pendingColor !== undefined) {
      node.fill = S.pendingColor; S.pendingColor = null; draw();
    }
  });

  // When connect tool is armed, mousedown on any box starts a connection from it
  g.addEventListener("mousedown", e => {
    if (S.tool !== "connect") return;
    e.stopPropagation();
    startConnect(node.id, e);
  });
  g.addEventListener("touchstart", e => {
    if (S.tool !== "connect") return;
    e.stopPropagation();
    startConnect(node.id, e);
  }, {passive:true});

  attachDrag(g, node);
  el.vp.appendChild(g);
}

function renameNode(node) {
  const v = prompt("Rename:", node.label);
  if (v !== null && v.trim()) { snap(); node.label = v.trim(); draw(); buildToolbar(); }
}

function showNodeFloat(node) {
  const x = (node.x + node.w/2) * S.zoom + S.pan.x;
  const y = node.y * S.zoom + S.pan.y;
  el.float.style.left = x+"px"; el.float.style.top = y+"px";
  el.float.classList.remove("hidden");
  el.float.innerHTML = COLORS.slice(0,7).map(c => {
    const active = (node.fill||"") === c.key;
    return `<button data-nclr="${c.key}" style="width:18px;height:18px;border-radius:50%;background:${c.hex};border:2px solid ${active?"#fff":"rgba(255,255,255,.2)"};padding:0;cursor:pointer"></button>`;
  }).join("");
  el.float.querySelectorAll("[data-nclr]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); node.fill = b.dataset.nclr||null; draw();
  }));
}

/** Shows font size +/- and text color controls when a text node is selected. */
function showTextFloat(node) {
  const x = (node.x + node.w/2) * S.zoom + S.pan.x;
  const y = node.y * S.zoom + S.pan.y;
  el.float.style.left = x+"px"; el.float.style.top = y+"px";
  el.float.classList.remove("hidden");
  const sz = node.fontSize || 12;
  el.float.innerHTML = `
    <button data-txact="minus" class="btn" style="padding:3px 7px;font-size:12px;line-height:1;border:none" title="Decrease font">A-</button>
    <span style="font-size:11px;color:var(--color-text);min-width:28px;text-align:center">${sz}px</span>
    <button data-txact="plus" class="btn" style="padding:3px 7px;font-size:12px;line-height:1;border:none" title="Increase font">A+</button>
    <div style="width:1px;background:var(--color-border);margin:0 3px"></div>
    ${COLORS.slice(0,7).map(c => {
      const active = (node.textColor||"") === c.key;
      return `<button data-txclr="${c.key}" style="width:16px;height:16px;border-radius:50%;background:${c.hex};border:2px solid ${active?"#fff":"rgba(255,255,255,.2)"};padding:0;cursor:pointer" title="${c.label}"></button>`;
    }).join("")}
  `;
  el.float.querySelector('[data-txact="minus"]').addEventListener("click", e => {
    e.stopPropagation(); snap(); node.fontSize = Math.max(8, sz - 2); draw();
  });
  el.float.querySelector('[data-txact="plus"]').addEventListener("click", e => {
    e.stopPropagation(); snap(); node.fontSize = Math.min(48, sz + 2); draw();
  });
  el.float.querySelectorAll("[data-txclr]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); node.textColor = b.dataset.txclr || null; draw();
  }));
}
function hideFloat() { el.float && el.float.classList.add("hidden"); }

// ================================================================
// DRAW CONNECTOR
// ================================================================

function drawConn(conn) {
  const fn = conn.from ? S.nodes.find(n => n.id === conn.from) : null;
  const tn = conn.to ? S.nodes.find(n => n.id === conn.to) : null;
  // Skip if referencing a deleted node (but not if it's a freeform point)
  if (conn.from && !fn) return;
  if (conn.to && !tn) return;

  const wp = conn.wp || [];

  // Resolve start point
  let p1;
  if (fn) {
    const aimTo = wp.length ? wp[0] : (tn ? center(tn) : (conn.toPt || {x:0,y:0}));
    p1 = edgePt(fn, aimTo.x, aimTo.y);
  } else {
    p1 = conn.fromPt || {x:0, y:0};
  }

  // Resolve end point
  let p2;
  if (tn) {
    const aimFrom = wp.length ? wp[wp.length-1] : (fn ? center(fn) : (conn.fromPt || {x:0,y:0}));
    p2 = edgePt(tn, aimFrom.x, aimFrom.y);
  } else {
    p2 = conn.toPt || {x:0, y:0};
  }

  const d  = buildPath(p1, p2, conn.style || "straight", wp);
  const isSel = S.sel && S.sel.k === "conn" && S.sel.id === conn.id;

  const g = svgEl("g");

  // hit area
  const hit = svgEl("path");
  hit.setAttribute("d", d); hit.setAttribute("fill", "none");
  hit.setAttribute("stroke", "transparent"); hit.setAttribute("stroke-width", "14");
  hit.style.cursor = "pointer";
  hit.addEventListener("click", e => { e.stopPropagation(); setSel({k:"conn",id:conn.id}); });
  g.appendChild(hit);

  // visible line
  const line = svgEl("path");
  line.setAttribute("d", d); line.setAttribute("fill", "none");
  line.setAttribute("stroke", isSel ? "#fff" : theme().stroke);
  line.setAttribute("stroke-width", isSel ? "2.5" : "1.5");
  const endArrow = conn.endArrow || "filled";
  const startArrow = conn.startArrow || "none";
  const suffix = isSel ? "-w" : "";
  if (endArrow !== "none") line.setAttribute("marker-end", `url(#ah-${endArrow}${suffix})`);
  if (startArrow !== "none") line.setAttribute("marker-start", `url(#ah-s-${startArrow})`);
  line.style.pointerEvents = "none";
  g.appendChild(line);

  // when selected: waypoint handles + add button + line-style toolbar
  // Show endpoint dots for freeform (non-node-attached) start/end points
  if (!fn) drawEndpointDot(g, p1, conn, "fromPt", isSel);
  if (!tn) drawEndpointDot(g, p2, conn, "toPt", isSel);

  if (isSel) {
    const allPts = [p1, ...wp, p2];
    wp.forEach((w, i) => drawWpHandle(g, conn, w, i));
    drawAddWpBtn(g, conn, allPts);
    showConnFloat(p1, p2, conn);
  }
  el.vp.appendChild(g);
}

/** Renders a visible dot at a freeform connector endpoint. Draggable when the connector is selected. */
function drawEndpointDot(g, pt, conn, ptKey, isSel) {
  const isStart = ptKey === "fromPt";
  const dot = svgEl("circle");
  dot.setAttribute("cx", pt.x); dot.setAttribute("cy", pt.y);
  dot.setAttribute("r", isSel ? 8 : 6);
  dot.setAttribute("fill", isStart ? "#4ee08a" : "#5ab8ff");
  dot.setAttribute("stroke", "#0c0b09"); dot.setAttribute("stroke-width", "2");
  dot.style.cursor = isSel ? "grab" : "pointer";

  if (isSel) {
    let start = null, pre = null, moved = false;
    const dn = e => {
      e.stopPropagation(); start = svgPt(e); moved = false;
      pre = { nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) };
      listen(mv, up);
    };
    const mv = e => {
      e.preventDefault(); const p = svgPt(e);
      if (Math.abs(p.x - start.x) > 2 || Math.abs(p.y - start.y) > 2) moved = true;
      conn[ptKey] = { x: p.x, y: p.y };
      // Snap to a box if dragged onto one
      const snapNode = nodeAt(p);
      if (snapNode) {
        if (ptKey === "fromPt") { conn.from = snapNode.id; conn.fromPt = null; }
        else { conn.to = snapNode.id; conn.toPt = null; }
      } else {
        if (ptKey === "fromPt") { conn.from = null; }
        else { conn.to = null; }
      }
      draw();
    };
    const up = () => {
      if (moved && pre) { S.undo.push(pre); if (S.undo.length > MAX_UNDO) S.undo.shift(); S.redo = []; buildToolbar(); }
      start = null; pre = null; off(mv, up);
    };
    dot.addEventListener("mousedown", dn);
    dot.addEventListener("touchstart", dn, { passive: true });
  } else {
    dot.addEventListener("click", e => { e.stopPropagation(); setSel({ k: "conn", id: conn.id }); });
  }
  g.appendChild(dot);
}

function showConnFloat(p1, p2, conn) {
  const mx = (p1.x+p2.x)/2*S.zoom+S.pan.x;
  const my = (p1.y+p2.y)/2*S.zoom+S.pan.y;
  el.float.style.left = mx+"px"; el.float.style.top = my+"px";
  el.float.classList.remove("hidden");

  const curStyle = conn.style || "straight";
  const curEnd = conn.endArrow || "filled";
  const curStart = conn.startArrow || "none";

  el.float.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:4px">
      <div style="display:flex;gap:2px">
        ${LINE_STYLES.map(ls =>
          `<button class="btn${curStyle===ls.key?" btn-primary":""}" data-fls="${ls.key}" style="padding:3px 6px;font-size:10px;border:none;line-height:0" title="${ls.label}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${ls.icon}</svg></button>`
        ).join("")}
      </div>
      <div style="display:flex;gap:2px;align-items:center">
        <span style="font-size:9px;color:var(--color-text-tertiary);width:28px">Start</span>
        ${ARROW_TYPES.map(at =>
          `<button class="btn${curStart===at.key?" btn-primary":""}" data-fsa="${at.key}" style="padding:2px 4px;border:none;line-height:0" title="${at.label}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`
        ).join("")}
      </div>
      <div style="display:flex;gap:2px;align-items:center">
        <span style="font-size:9px;color:var(--color-text-tertiary);width:28px">End</span>
        ${ARROW_TYPES.map(at =>
          `<button class="btn${curEnd===at.key?" btn-primary":""}" data-fea="${at.key}" style="padding:2px 4px;border:none;line-height:0" title="${at.label}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`
        ).join("")}
      </div>
    </div>
  `;

  el.float.querySelectorAll("[data-fls]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.style = b.dataset.fls; draw();
  }));
  el.float.querySelectorAll("[data-fsa]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.startArrow = b.dataset.fsa; draw();
  }));
  el.float.querySelectorAll("[data-fea]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.endArrow = b.dataset.fea; draw();
  }));
}

// ================================================================
// WAYPOINTS
// ================================================================

function drawAddWpBtn(g, conn, pts) {
  let best = {len:-1, mid:null, idx:0};
  for (let i=0; i<pts.length-1; i++) {
    const l = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y);
    if (l > best.len) best = {len:l, mid:{x:(pts[i].x+pts[i+1].x)/2, y:(pts[i].y+pts[i+1].y)/2}, idx:i};
  }
  if (!best.mid) return;
  const bg = svgEl("g"); bg.style.cursor = "pointer";
  const c = svgEl("circle"); c.setAttribute("cx",best.mid.x); c.setAttribute("cy",best.mid.y);
  c.setAttribute("r",9); c.setAttribute("fill","#d4ff3a"); c.setAttribute("stroke","#0c0b09"); c.setAttribute("stroke-width","1.5");
  bg.appendChild(c);
  const t = svgEl("text"); t.setAttribute("x",best.mid.x); t.setAttribute("y",best.mid.y+4);
  t.setAttribute("text-anchor","middle"); t.setAttribute("font-size","13"); t.setAttribute("font-weight","bold");
  t.setAttribute("fill","#0c0b09"); t.style.pointerEvents="none"; t.textContent="+";
  bg.appendChild(t);
  bg.addEventListener("click", e => {
    e.stopPropagation(); snap();
    conn.wp = conn.wp||[];
    conn.wp.splice(best.idx, 0, {...best.mid});
    draw(); buildToolbar();
  });
  g.appendChild(bg);
}

function drawWpHandle(g, conn, wp, idx) {
  const isActive = S.activeWp && S.activeWp.cid===conn.id && S.activeWp.i===idx;
  const dot = svgEl("circle");
  dot.setAttribute("cx",wp.x); dot.setAttribute("cy",wp.y);
  dot.setAttribute("r", isActive?7:5);
  dot.setAttribute("fill","#fff"); dot.setAttribute("stroke",isActive?"#d4ff3a":"#0c0b09");
  dot.setAttribute("stroke-width",isActive?"2.5":"1.5");
  dot.style.cursor = "grab";

  let start=null, pre=null, moved=false;
  const dn = e => {
    e.stopPropagation(); start=svgPt(e); moved=false;
    pre={nodes:structuredClone(S.nodes),conns:structuredClone(S.conns)};
    listen(mv, up);
  };
  const mv = e => {
    e.preventDefault(); const p=svgPt(e);
    if(Math.abs(p.x-start.x)>2||Math.abs(p.y-start.y)>2) moved=true;
    wp.x=p.x; wp.y=p.y; draw();
  };
  const up = () => {
    if(moved&&pre){S.undo.push(pre);if(S.undo.length>MAX_UNDO)S.undo.shift();S.redo=[];buildToolbar();}
    if(!moved){S.activeWp=isActive?null:{cid:conn.id,i:idx}; draw();}
    start=null; pre=null; off(mv,up);
  };
  dot.addEventListener("mousedown",dn);
  dot.addEventListener("touchstart",dn,{passive:true});
  g.appendChild(dot);

  if (isActive) {
    const rx=wp.x+14, ry=wp.y-14;
    const xg = svgEl("g"); xg.style.cursor="pointer";
    const xc = svgEl("circle"); xc.setAttribute("cx",rx); xc.setAttribute("cy",ry);
    xc.setAttribute("r",8); xc.setAttribute("fill","#ff5a4e"); xc.setAttribute("stroke","#0c0b09"); xc.setAttribute("stroke-width","1.5");
    xg.appendChild(xc);
    const xt = svgEl("text"); xt.setAttribute("x",rx); xt.setAttribute("y",ry+3.5);
    xt.setAttribute("text-anchor","middle"); xt.setAttribute("font-size","11"); xt.setAttribute("font-weight","bold");
    xt.setAttribute("fill","#fff"); xt.style.pointerEvents="none"; xt.textContent="\u00d7";
    xg.appendChild(xt);
    xg.addEventListener("click", e => {
      e.stopPropagation(); snap(); conn.wp.splice(idx,1); S.activeWp=null; draw(); buildToolbar();
    });
    g.appendChild(xg);
  }
}

// ================================================================
// CONNECTOR DRAWING (from edge handle)
// ================================================================

function startConnect(fromId, evt) {
  const tmp = svgEl("line");
  tmp.setAttribute("stroke","#d4ff3a"); tmp.setAttribute("stroke-width","1.5");
  tmp.setAttribute("stroke-dasharray","4 3"); tmp.style.pointerEvents="none";
  el.vp.appendChild(tmp);

  const fromNode = S.nodes.find(n => n.id === fromId);
  const sp = svgPt(evt);

  const mv = e => {
    e.preventDefault(); const p=svgPt(e);
    const ep = edgePt(fromNode, p.x, p.y);
    tmp.setAttribute("x1",ep.x); tmp.setAttribute("y1",ep.y);
    tmp.setAttribute("x2",p.x); tmp.setAttribute("y2",p.y);
  };
  const up = e => {
    const p = svgPt(e.changedTouches ? e.changedTouches[0] : e);
    const target = S.nodes.find(n => n.id!==fromId && p.x>=n.x && p.x<=n.x+n.w && p.y>=n.y && p.y<=n.y+n.h);
    tmp.remove();
    if (target) {
      snap();
      const nc = {id:uid("c"), from:fromId, to:target.id, style:S.lineStyle, wp:[], startArrow:"none", endArrow:"filled"};
      S.conns.push(nc);
      setSel({k:"conn", id:nc.id});
    }
    off(mv, up);
  };
  listen(mv, up);
}

// ================================================================
// NODE DRAG
// ================================================================

function attachDrag(g, node) {
  let start=null, pre=null;
  const dn = e => {
    if (S.tool === "connect") return; // connect tool handles this mousedown instead
    e.stopPropagation();
    start = svgPt(e);
    node._ox=node.x; node._oy=node.y; node._dragged=false;
    pre={nodes:structuredClone(S.nodes),conns:structuredClone(S.conns)};
    listen(mv, up);
  };
  const mv = e => {
    e.preventDefault(); const p=svgPt(e);
    const dx=p.x-start.x, dy=p.y-start.y;
    if(Math.abs(dx)>2||Math.abs(dy)>2) node._dragged=true;
    node.x=node._ox+dx; node.y=node._oy+dy;
    draw();
  };
  const up = () => {
    if(node._dragged&&pre){S.undo.push(pre);if(S.undo.length>MAX_UNDO)S.undo.shift();S.redo=[];buildToolbar();}
    start=null; pre=null; off(mv,up);
  };
  g.addEventListener("mousedown",dn);
  g.addEventListener("touchstart",dn,{passive:true});
}

// ================================================================
// SHAPE GEOMETRY (shared by canvas + PNG export)
// ================================================================

function buildShape(node) {
  const {x,y,w,h,type} = node;
  const cx=x+w/2, cy=y+h/2;
  switch(type) {
    case "ellipse":       return mkEl("ellipse",{cx,cy,rx:w/2,ry:h/2});
    case "diamond":       return mkEl("polygon",{points:`${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}`});
    case "triangle":      return mkEl("polygon",{points:`${cx},${y} ${x+w},${y+h} ${x},${y+h}`});
    case "hexagon":       { const c=w*.22; return mkEl("polygon",{points:`${x+c},${y} ${x+w-c},${y} ${x+w},${cy} ${x+w-c},${y+h} ${x+c},${y+h} ${x},${cy}`}); }
    case "parallelogram": { const s=w*.18; return mkEl("polygon",{points:`${x+s},${y} ${x+w},${y} ${x+w-s},${y+h} ${x},${y+h}`}); }
    case "cylinder":      { const ry=Math.min(h*.18,14); return mkEl("path",{d:`M${x} ${y+ry}C${x} ${y-ry/2} ${x+w} ${y-ry/2} ${x+w} ${y+ry}V${y+h-ry}C${x+w} ${y+h+ry/2} ${x} ${y+h+ry/2} ${x} ${y+h-ry}Z M${x} ${y+ry}C${x} ${y+ry*2} ${x+w} ${y+ry*2} ${x+w} ${y+ry}`}); }
    case "cloud":         { const bh=h*.75; return mkEl("path",{d:`M${x+w*.22} ${y+bh}a${h*.32} ${h*.32} 0 0 1-${h*.3*.32} -${h*.45}a${h*.32} ${h*.32} 0 0 1 ${h*.55} -${h*.22}a${h*.28} ${h*.28} 0 0 1 ${h*.42} ${h*.18}a${h*.26} ${h*.26} 0 0 1-${h*.06} ${h*.51}z`}); }
    case "callout":       { const bH=h*.78, tw=w*.18; return mkEl("path",{d:`M${x} ${y}H${x+w}V${y+bH}H${x+tw*2}L${x+tw} ${y+h}V${y+bH}H${x}Z`}); }
    case "document":      { const wH=h*.15; return mkEl("path",{d:`M${x} ${y}H${x+w}V${y+h-wH}C${x+w*.75} ${y+h+wH} ${x+w*.25} ${y+h-wH*2} ${x} ${y+h}Z`}); }
    case "person":        { const hr=w*.28, hcy=y+hr+2; const g=svgEl("g"); g.appendChild(mkEl("circle",{cx,cy:hcy,r:hr})); g.appendChild(mkEl("path",{d:`M${x+w*.08} ${y+h}Q${x+w*.08} ${hcy+hr*1.6} ${cx} ${hcy+hr*1.6}Q${x+w*.92} ${hcy+hr*1.6} ${x+w*.92} ${y+h}`})); return g; }
    case "rounded":       return mkEl("rect",{x,y,width:w,height:h,rx:18});
    case "text":          return mkEl("rect",{x,y,width:w,height:h,rx:4,"stroke-dasharray":"3 2",stroke:"rgba(212,255,58,0.3)","stroke-width":"0.8"});
    case "image":         return mkEl("rect",{x,y,width:w,height:h,rx:4}); // fallback outline
    default:              return mkEl("rect",{x,y,width:w,height:h,rx:6});
  }
}

// ================================================================
// CONNECTOR PATH
// ================================================================

function buildPath(p1, p2, style, wp) {
  const pts = [p1, ...(wp||[]), p2];
  if (style === "curved") {
    let d = `M${pts[0].x} ${pts[0].y}`;
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],dx=b.x-a.x; d+=` C${a.x+dx*.5} ${a.y},${a.x+dx*.5} ${b.y},${b.x} ${b.y}`;}
    return d;
  }
  if (style === "orthogonal") {
    let d = `M${pts[0].x} ${pts[0].y}`;
    for(let i=0;i<pts.length-1;i++){const a=pts[i],b=pts[i+1],mx=a.x+(b.x-a.x)/2; d+=` L${mx} ${a.y}L${mx} ${b.y}L${b.x} ${b.y}`;}
    return d;
  }
  return `M${pts[0].x} ${pts[0].y} `+pts.slice(1).map(p=>`L${p.x} ${p.y}`).join(" ");
}

// ================================================================
// PNG EXPORT
// ================================================================

async function downloadPng() {
  if (!S.nodes.length && !S.conns.length) { toast("Add something first"); return; }
  const PAD=40, b=contentBounds();
  const w=b.maxX-b.minX+PAD*2, h=b.maxY-b.minY+PAD*2;
  const ox=PAD-b.minX, oy=PAD-b.minY;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  const t = theme();
  svg += `<rect width="${w}" height="${h}" fill="${t.bg}"/>`;
  svg += `<defs><marker id="ea" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="ea-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>`;
  svg += `<marker id="ea-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="ea-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-arrow" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><path d="M9 0L0 4.5L9 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>`;
  svg += `<marker id="es-filled" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><polygon points="9 0,0 4.5,9 9" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>`;
  svg += `</defs>`;
  svg += `<g transform="translate(${ox},${oy})">`;

  S.conns.forEach(c => {
    const fn=c.from?S.nodes.find(n=>n.id===c.from):null;
    const tn=c.to?S.nodes.find(n=>n.id===c.to):null;
    if(c.from&&!fn) return;
    if(c.to&&!tn) return;
    const wp=c.wp||[];
    let p1, p2;
    if(fn){const aim=wp.length?wp[0]:(tn?center(tn):(c.toPt||{x:0,y:0}));p1=edgePt(fn,aim.x,aim.y);}else{p1=c.fromPt||{x:0,y:0};}
    if(tn){const aim=wp.length?wp[wp.length-1]:(fn?center(fn):(c.fromPt||{x:0,y:0}));p2=edgePt(tn,aim.x,aim.y);}else{p2=c.toPt||{x:0,y:0};}
    let markers = "";
    const endA = c.endArrow || "filled";
    const startA = c.startArrow || "none";
    if (endA === "filled") markers += ` marker-end="url(#ea)"`;
    else if (endA !== "none") markers += ` marker-end="url(#ea-${endA})"`;
    if (startA !== "none") markers += ` marker-start="url(#es-${startA})"`;
    svg += `<path d="${buildPath(p1,p2,c.style||"straight",wp)}" fill="none" stroke="${t.stroke}" stroke-width="1.5"${markers}/>`;
  });

  S.nodes.forEach(n => {
    const fill = n.type==="text"?"transparent":(n.fill||t.fill);
    const stroke = n.type==="text"?"none":t.stroke;
    svg += shapeToSvgStr(n, fill, stroke);
    const fontSize = n.fontSize || 12;
    const tc = n.textColor || (lightOrDark(fill)==="dark"?t.text:"#0c0b09");
    svg += `<text x="${n.x+n.w/2}" y="${n.y+n.h/2+5}" text-anchor="middle" fill="${tc}" font-size="${fontSize}" font-family="JetBrains Mono,monospace">${escXml(n.label)}</text>`;
  });

  svg += "</g></svg>";

  try {
    const url = await svg2png(svg, w, h);
    const a = document.createElement("a");
    a.href = url; a.download = `${(S.name||"diagram").replace(/[^a-z0-9_-]/gi,"_")}.png`;
    document.body.appendChild(a); a.click(); a.remove(); toast("Downloaded");
  } catch(e) { toast("Download failed"); console.error(e); }
}

function shapeToSvgStr(node, fill, stroke) {
  const {x,y,w,h,type} = node;
  const cx=x+w/2, cy=y+h/2;
  const fa=`fill="${fill}"`, sa=stroke==="none"?"":`stroke="${stroke}" stroke-width="1.5"`;
  switch(type) {
    case "ellipse": return `<ellipse cx="${cx}" cy="${cy}" rx="${w/2}" ry="${h/2}" ${fa} ${sa}/>`;
    case "diamond": return `<polygon points="${cx},${y} ${x+w},${cy} ${cx},${y+h} ${x},${cy}" ${fa} ${sa}/>`;
    case "triangle": return `<polygon points="${cx},${y} ${x+w},${y+h} ${x},${y+h}" ${fa} ${sa}/>`;
    case "hexagon": { const c=w*.22; return `<polygon points="${x+c},${y} ${x+w-c},${y} ${x+w},${cy} ${x+w-c},${y+h} ${x+c},${y+h} ${x},${cy}" ${fa} ${sa}/>`; }
    case "parallelogram": { const s=w*.18; return `<polygon points="${x+s},${y} ${x+w},${y} ${x+w-s},${y+h} ${x},${y+h}" ${fa} ${sa}/>`; }
    case "cylinder": { const ry=Math.min(h*.18,14); return `<path d="M${x} ${y+ry}C${x} ${y-ry/2} ${x+w} ${y-ry/2} ${x+w} ${y+ry}V${y+h-ry}C${x+w} ${y+h+ry/2} ${x} ${y+h+ry/2} ${x} ${y+h-ry}Z M${x} ${y+ry}C${x} ${y+ry*2} ${x+w} ${y+ry*2} ${x+w} ${y+ry}" ${fa} ${sa}/>`; }
    case "cloud": { const bh=h*.75; return `<path d="M${x+w*.22} ${y+bh}a${h*.32} ${h*.32} 0 0 1-${h*.3*.32} -${h*.45}a${h*.32} ${h*.32} 0 0 1 ${h*.55} -${h*.22}a${h*.28} ${h*.28} 0 0 1 ${h*.42} ${h*.18}a${h*.26} ${h*.26} 0 0 1-${h*.06} ${h*.51}z" ${fa} ${sa}/>`; }
    case "callout": { const bH=h*.78,tw=w*.18; return `<path d="M${x} ${y}H${x+w}V${y+bH}H${x+tw*2}L${x+tw} ${y+h}V${y+bH}H${x}Z" ${fa} ${sa}/>`; }
    case "document": { const wH=h*.15; return `<path d="M${x} ${y}H${x+w}V${y+h-wH}C${x+w*.75} ${y+h+wH} ${x+w*.25} ${y+h-wH*2} ${x} ${y+h}Z" ${fa} ${sa}/>`; }
    case "person": { const hr=w*.28,hcy=y+hr+2; return `<g ${fa} ${sa}><circle cx="${cx}" cy="${hcy}" r="${hr}"/><path d="M${x+w*.08} ${y+h}Q${x+w*.08} ${hcy+hr*1.6} ${cx} ${hcy+hr*1.6}Q${x+w*.92} ${hcy+hr*1.6} ${x+w*.92} ${y+h}"/></g>`; }
    case "rounded": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" ${fa} ${sa}/>`;
    case "text": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="transparent"/>`;
    case "image": return node.imageData ? `<image href="${node.imageData}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` : "";
    default: return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" ${fa} ${sa}/>`;
  }
}

// ================================================================
// PERSISTENCE
// ================================================================

async function save() {
  const saved = await storage.diagrams.save({
    id: S.id, name: S.name,
    nodes: S.nodes.map(({id,type,label,x,y,w,h,fill,fontSize,textColor,imageData})=>({id,type,label,x,y,w,h,fill,fontSize:fontSize||null,textColor:textColor||null,imageData:imageData||null})),
    connectors: S.conns.map(({id,from,to,style,wp,startArrow,endArrow,fromPt,toPt})=>({id,from,to,style,wp:wp||[],startArrow:startArrow||"none",endArrow:endArrow||"filled",fromPt:fromPt||null,toPt:toPt||null})),
  });
  S.id = saved.id;
  toast("Saved"); loadSavedList();
}

async function loadSavedList() {
  const list = await storage.diagrams.list();
  if (!list.length) { el.saved.innerHTML = `<p style="font-size:13px;color:var(--color-text-tertiary)">No saved diagrams.</p>`; return; }
  el.saved.innerHTML = list.map(d => `
    <div class="flex-between" style="padding:8px 0;border-top:1px solid var(--color-border)">
      <div><div style="font-size:14px">${esc(d.name)}</div>
      <div style="font-size:11px;color:var(--color-text-tertiary)">${new Date(d.updatedAt).toLocaleString()}</div></div>
      <div class="flex gap-1">
        <button class="btn" data-load="${d.id}">Open</button>
        <button class="btn btn-danger" data-rm="${d.id}">Del</button>
      </div>
    </div>`).join("");
  el.saved.querySelectorAll("[data-load]").forEach(b => b.addEventListener("click", () => loadDiagram(b.dataset.load)));
  el.saved.querySelectorAll("[data-rm]").forEach(b => b.addEventListener("click", async () => {
    if(confirm("Delete?")) { await storage.diagrams.delete(b.dataset.rm); loadSavedList(); }
  }));
}

async function loadDiagram(id) {
  const d = await storage.diagrams.get(id);
  if (!d) return;
  S = newState();
  S.id = d.id; S.name = d.name;
  S.nodes = d.nodes || [];
  S.conns = (d.connectors || []).map(c => ({...c, wp: c.wp || []}));
  el.name.value = S.name;
  draw(); fitView(); buildToolbar(); loadSavedList();
}

// ================================================================
// UTILITIES
// ================================================================

function uid(p) { return `${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function esc(s) { const d=document.createElement("div"); d.textContent=s; return d.innerHTML; }
function escXml(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function clamp(v,a,b) { return Math.max(a,Math.min(b,v)); }
function svgEl(tag) { return document.createElementNS("http://www.w3.org/2000/svg", tag); }
function mkEl(tag,attrs) { const e=svgEl(tag); for(const[k,v]of Object.entries(attrs)) e.setAttribute(k,v); return e; }
function ptr(e) { const p=e.touches?e.touches[0]:e; return {x:p.clientX,y:p.clientY}; }
function svgPt(e) { const r=el.svg.getBoundingClientRect(); const p=e.touches?e.touches[0]:e; return {x:(p.clientX-r.left-S.pan.x)/S.zoom, y:(p.clientY-r.top-S.pan.y)/S.zoom}; }
function center(n) { return {x:n.x+n.w/2, y:n.y+n.h/2}; }
function handles(n) { return [{x:n.x+n.w/2,y:n.y},{x:n.x+n.w/2,y:n.y+n.h},{x:n.x,y:n.y+n.h/2},{x:n.x+n.w,y:n.y+n.h/2}]; }

function edgePt(n, tx, ty) {
  const c=center(n), dx=tx-c.x, dy=ty-c.y;
  if(!dx&&!dy) return c;
  const sx=n.w/2/Math.abs(dx||1e-6), sy=n.h/2/Math.abs(dy||1e-6), s=Math.min(sx,sy);
  return {x:c.x+dx*s, y:c.y+dy*s};
}

function contentBounds() {
  const b = S.nodes.reduce((a,n)=>({minX:Math.min(a.minX,n.x),minY:Math.min(a.minY,n.y),maxX:Math.max(a.maxX,n.x+n.w),maxY:Math.max(a.maxY,n.y+n.h)}),{minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity});
  S.conns.forEach(c=>{
    (c.wp||[]).forEach(w=>{b.minX=Math.min(b.minX,w.x);b.minY=Math.min(b.minY,w.y);b.maxX=Math.max(b.maxX,w.x);b.maxY=Math.max(b.maxY,w.y);});
    if(c.fromPt){b.minX=Math.min(b.minX,c.fromPt.x);b.minY=Math.min(b.minY,c.fromPt.y);b.maxX=Math.max(b.maxX,c.fromPt.x);b.maxY=Math.max(b.maxY,c.fromPt.y);}
    if(c.toPt){b.minX=Math.min(b.minX,c.toPt.x);b.minY=Math.min(b.minY,c.toPt.y);b.maxX=Math.max(b.maxX,c.toPt.x);b.maxY=Math.max(b.maxY,c.toPt.y);}
  });
  return b;
}

function visBounds() { const r=el.svg.getBoundingClientRect(); return {x:-S.pan.x/S.zoom, y:-S.pan.y/S.zoom, w:r.width/S.zoom, h:r.height/S.zoom}; }

function lightOrDark(hex) {
  if (!hex || hex === "transparent" || hex === "#0a0907") return "dark";
  const c = hex.replace("#","");
  const r=parseInt(c.substr(0,2),16), g=parseInt(c.substr(2,2),16), b=parseInt(c.substr(4,2),16);
  return (r*299+g*587+b*114)/1000 > 150 ? "light" : "dark";
}

function listen(mv,up) {
  document.addEventListener("mousemove",mv);
  document.addEventListener("mouseup",up);
  document.addEventListener("touchmove",mv,{passive:false});
  document.addEventListener("touchend",up);
}
function off(mv,up) {
  document.removeEventListener("mousemove",mv);
  document.removeEventListener("mouseup",up);
  document.removeEventListener("touchmove",mv);
  document.removeEventListener("touchend",up);
}

function svg2png(svgStr, w, h) {
  return new Promise((res,rej) => {
    const blob = new Blob([svgStr],{type:"image/svg+xml;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const s=2, c=document.createElement("canvas"); c.width=w*s; c.height=h*s;
      const ctx=c.getContext("2d"); ctx.scale(s,s); ctx.drawImage(img,0,0,w,h);
      URL.revokeObjectURL(url); res(c.toDataURL("image/png"));
    };
    img.onerror = e => { URL.revokeObjectURL(url); rej(e); };
    img.src = url;
  });
}

function toast(msg) {
  let t = document.getElementById("dd-toast");
  if(!t){t=document.createElement("div");t.id="dd-toast";t.className="toast";document.body.appendChild(t);}
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2000);
}
