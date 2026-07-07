/**
 * modules/create-diagram/create-diagram.js
 * ----------------------------------------------------------------
 * CreateDiagram — draw.io-style diagram editor, built from scratch.
 *
 * Layout: top toolbar | left palette | main SVG canvas with grid
 * Features: 31 shapes, fill colors, connector styles (straight/
 * curved/orthogonal), draggable waypoints with visible +/× controls,
 * text tool, undo/redo, zoom/pan, fit-to-view, PNG export, save/load.
 *
 * Independent module — only talks to storage.js.
 * ----------------------------------------------------------------
 */
import storage from "../../js/storage.js";
import { loadApiConfig } from "../settings/settings.js";

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
  { type: "group",         label: "Group",       w: 240, h: 180, icon: `<rect x="3" y="3" width="18" height="18" rx="2" stroke-dasharray="3 2" fill="none"/><line x1="3" y1="8" x2="12" y2="8"/>` },
  { type: "sync",          label: "Sync",        w: 80,  h: 80,  icon: `<path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>` },
  { type: "key",           label: "Key",         w: 100, h: 50,  icon: `<circle cx="8" cy="12" r="4"/><path d="M12 12h8"/><path d="M17 9v6"/><path d="M20 9v6"/>` },
  { type: "server",        label: "Server",      w: 90,  h: 100, icon: `<rect x="4" y="4" width="16" height="6" rx="1"/><rect x="4" y="14" width="16" height="6" rx="1"/><circle cx="8" cy="7" r="1" fill="currentColor"/><circle cx="8" cy="17" r="1" fill="currentColor"/>` },
  { type: "shield",        label: "Shield",      w: 80,  h: 100, icon: `<path d="M12 3l7 3v5c0 5-3.5 9.7-7 11-3.5-1.3-7-6-7-11V6z"/>` },
  { type: "lock",          label: "Lock",        w: 70,  h: 90,  icon: `<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>` },
  { type: "play",          label: "Play",        w: 80,  h: 80,  icon: `<polygon points="6,4 20,12 6,20"/>` },
  { type: "api",           label: "API",         w: 90,  h: 60,  icon: `<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 14V10l2 2 2-2v4M14 10h2.5a1.5 1.5 0 0 1 0 3H14" fill="none"/>` },
  { type: "chevron",       label: "Chevron",     w: 140, h: 80,  icon: `<path d="M3 5h12l5 7-5 7H3l5-7z"/>` },
  { type: "arrowUp",       label: "Arrow",       w: 90,  h: 90,  icon: `<line x1="5" y1="19" x2="18" y2="6"/><path d="M10 6h8v8"/>` },
  { type: "list",          label: "List",        w: 160, h: 130, icon: `<rect x="3" y="4" width="18" height="16" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="6" y1="13" x2="16" y2="13"/><line x1="6" y1="17" x2="14" y2="17"/>` },
  { type: "speechRect",    label: "Speech box",  w: 140, h: 90,  icon: `<path d="M3 4h18v11H11l-4 5v-5H3z"/>` },
  { type: "smiley",        label: "Smiley",      w: 110, h: 110, icon: `<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="15" cy="10" r="1" fill="currentColor"/><path d="M8 14.5c1 1.3 2.4 2 4 2s3-.7 4-2" fill="none"/>` },
  { type: "elbow",         label: "Elbow",       w: 110, h: 110, icon: `<path d="M5 20h6l9-13"/><circle cx="20" cy="5" r="1.4"/>` },
  { type: "relationship",  label: "Relation",    w: 170, h: 70,  icon: `<polygon points="12,12 22,4 35,12 22,20" transform="translate(-9,0) scale(0.62)"/><line x1="2" y1="12" x2="22" y2="12"/>` },
  { type: "envelope",      label: "Envelope",    w: 110, h: 75,  icon: `<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 6l9 7 9-7"/>` },
  { type: "check",         label: "Check",       w: 90,  h: 90,  icon: `<path d="M4 13l5 6L20 5"/>` },
  { type: "doubleArrow",   label: "2-way arrow", w: 140, h: 60,  icon: `<line x1="3" y1="12" x2="21" y2="12"/><path d="M3 12l4-4M3 12l4 4"/><path d="M21 12l-4-4M21 12l-4 4"/>` },
  { type: "banner",        label: "Banner",      w: 150, h: 90,  icon: `<path d="M3 4h18v11c-2-2-4 2-6 0s-4 2-6 0-4 2-6 0z"/>` },
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

// Border (stroke) style options for shapes
const BORDER_STYLES = [
  { key: "solid",  label: "Solid",  dash: null,    icon: "▬" },
  { key: "dashed", label: "Dashed", dash: "8 4",   icon: "╌" },
  { key: "dotted", label: "Dotted", dash: "2 4",   icon: "·" },
];

// Stroke color options (separate from fill colors)
const STROKE_COLORS = [
  { key: "",        hex: null,      label: "Default" },
  { key: "#ffffff", hex: "#ffffff", label: "White" },
  { key: "#d4ff3a", hex: "#d4ff3a", label: "Lime" },
  { key: "#ffd700", hex: "#ffd700", label: "Gold" },
  { key: "#5ab8ff", hex: "#5ab8ff", label: "Blue" },
  { key: "#4ee08a", hex: "#4ee08a", label: "Green" },
  { key: "#ff5a4e", hex: "#ff5a4e", label: "Red" },
  { key: "#c98fff", hex: "#c98fff", label: "Purple" },
];

const LINE_STYLES = [
  { key: "straight",    label: "Straight",      icon: `<line x1="4" y1="19" x2="20" y2="5"/>`, dash: null },
  { key: "curved",      label: "Curved",        icon: `<path d="M4 19C4 9 20 15 20 5"/>`, dash: null },
  { key: "orthogonal",  label: "Right-angle",   icon: `<path d="M4 19V12H20V5"/>`, dash: null },
  { key: "dashed",      label: "Dashed",        icon: `<line x1="4" y1="19" x2="20" y2="5" stroke-dasharray="3 2"/>`, dash: "6 3" },
  { key: "dotted",      label: "Dotted",        icon: `<line x1="4" y1="19" x2="20" y2="5" stroke-dasharray="1.5 2"/>`, dash: "2 3" },
  { key: "dash-curved", label: "Dashed curved", icon: `<path d="M4 19C4 9 20 15 20 5" stroke-dasharray="3 2"/>`, dash: "6 3", base: "curved" },
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
  { key:"dark",      label:"Dark",      bg:"#0c0b09", grid:"rgba(212,255,58,0.06)", stroke:"#d4ff3a", fill:"#0a0907", text:"#f4f2ea", border:"rgba(212,255,58,0.18)", sel:"#5ab8ff", handle:"#d4ff3a" },
  { key:"light",     label:"Light",     bg:"#ffffff", grid:"rgba(0,0,0,0.07)",       stroke:"#333333", fill:"#ffffff", text:"#222222", border:"rgba(0,0,0,0.15)",       sel:"#0066cc", handle:"#333333" },
  { key:"blueprint", label:"Blueprint", bg:"#1a3a5c", grid:"rgba(100,180,255,0.12)", stroke:"#88ccff", fill:"#1a3a5c", text:"#e8f0ff", border:"rgba(100,180,255,0.25)", sel:"#ffd700", handle:"#88ccff" },
  { key:"warm",      label:"Warm",      bg:"#2d2418", grid:"rgba(255,200,80,0.08)",  stroke:"#ffc850", fill:"#2d2418", text:"#f5e6c8", border:"rgba(255,200,80,0.2)",   sel:"#5ab8ff", handle:"#ffc850" },
  { key:"white",     label:"Clean",     bg:"#f8f8f8", grid:"rgba(0,0,0,0.05)",       stroke:"#555555", fill:"#f8f8f8", text:"#111111", border:"rgba(0,0,0,0.12)",       sel:"#0066cc", handle:"#555555" },
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
    connDefaults: { color: null, width: 2, opacity: 100, radius: 0, startArrow: "none", endArrow: "filled" },
    pendingColor: null,
    theme: "dark",         // canvas theme key
    exportBorder: true,    // draw a border frame around downloaded PNG
  };
}

function theme() { return THEMES.find(t => t.key === S.theme) || THEMES[0]; }

/** Fills in defaults for connector styling fields (color/width/opacity/radius) so
 *  diagrams saved before these features existed still render correctly. */
function normConn(c) {
  return {
    ...c,
    wp: c.wp || [],
    color: c.color != null ? c.color : null,
    width: c.width != null ? c.width : 2,
    opacity: c.opacity != null ? c.opacity : 100,
    radius: c.radius != null ? c.radius : 0,
  };
}

// ================================================================
// ENTRY
// ================================================================

export async function initCreateDiagramView(container) {
  S = newState();
  const savedTheme = await storage.settings.get("diagramTheme");
  if (savedTheme && THEMES.find(t => t.key === savedTheme)) S.theme = savedTheme;
  const savedBorder = await storage.settings.get("exportBorder");
  if (typeof savedBorder === "boolean") S.exportBorder = savedBorder;
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
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.flex = "1";
  container.style.minHeight = "0";
  container.innerHTML = `
  <div style="position:relative">
    <div id="dd-toolbar" class="flex gap-1" style="background:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:5px;flex-wrap:wrap;margin-bottom:8px"></div>
    <div id="dd-popup" class="hidden" style="position:absolute;top:100%;margin-top:4px;background:var(--color-bg-raised);border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:6px;z-index:20"></div>
  </div>
  <div style="display:flex;gap:8px;flex:1;min-height:0;overflow:hidden">
    <div style="display:flex;flex-direction:column;gap:8px;width:140px;flex-shrink:0;overflow:hidden">
      <div style="padding:10px 8px 8px;background:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:var(--radius-md);flex-shrink:0">
        <input id="dd-name" type="text" value="${esc(S.name)}"
          style="font-family:var(--font-serif);font-size:16px;border:none;background:transparent;
          padding:2px 0;width:100%;color:var(--color-text);outline:none;margin-bottom:8px;
          border-bottom:1px solid var(--color-border)"/>
        <button class="btn btn-primary" id="dd-save" style="width:100%;padding:6px 0">Save</button>
      </div>
      <div class="panel" id="dd-palette" style="padding:8px;flex:1;overflow-y:auto;min-height:0"></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;flex:1;min-width:0;min-height:0;overflow:hidden;height:100%">
    <div class="panel corner-frame" id="dd-canvas-wrap" style="position:relative;padding:0;overflow:hidden;flex:1;width:100%;min-height:0;touch-action:none">
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
      <div id="dd-conn-bar" class="hidden" style="position:absolute;top:6px;left:6px;right:6px;display:flex;gap:4px;flex-wrap:wrap;align-items:center;background:var(--color-bg-raised);border:1px solid var(--color-border-strong);border-radius:var(--radius-md);padding:5px 8px;z-index:5;font-size:10px"></div>
      <div id="dd-zoom-label" style="position:absolute;bottom:8px;right:8px;font-size:11px;color:var(--color-text-tertiary);background:var(--color-bg-raised);border:1px solid var(--color-border);border-radius:4px;padding:3px 7px;cursor:pointer">100%</div>
    </div>
      <div class="panel" style="flex-shrink:0;height:160px;overflow-y:auto;min-height:0">
        <span class="label" style="font-size:10px;letter-spacing:0.1em;opacity:0.7">SAVED DIAGRAMS</span>
        <div id="dd-saved"></div>
      </div>
    </div>
  </div>`;

  el.svg     = document.getElementById("dd-svg");
  el.vp      = document.getElementById("dd-vp");
  el.gridBg  = document.getElementById("dd-grid-bg");
  el.toolbar = document.getElementById("dd-toolbar");
  el.popup   = document.getElementById("dd-popup");
  el.palette = document.getElementById("dd-palette");
  el.float   = document.getElementById("dd-float");
  el.connBar = document.getElementById("dd-conn-bar");
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
  rename:  `<path d="M11 4H4v16h16v-7"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>`,
  exprt:   `<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 3v12"/><path d="M16 7l-4-4-4 4"/>`,
  imprt:   `<path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6"/><path d="M12 15V3"/><path d="M8 11l4 4 4-4"/>`,
  newDoc:  `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><line x1="9" y1="15" x2="15" y2="15"/>`,
  lineUp:  `<line x1="5" y1="6" x2="19" y2="6"/><circle cx="10" cy="6" r="2" fill="currentColor"/><line x1="5" y1="12" x2="19" y2="12"/><circle cx="15" cy="12" r="2" fill="currentColor"/><line x1="5" y1="18" x2="19" y2="18"/><circle cx="8" cy="18" r="2" fill="currentColor"/>`,
};

function buildToolbar() {
  const hasSel = !!S.sel;
  const hasNode = hasSel && S.sel.k === "node";
  el.toolbar.innerHTML = [
    tbBtn("tb-new",TB.newDoc, "New / Clear canvas"),
    tbSep(),
    tbBtn("tb-zo", TB.zoomOut, "Zoom out"),
    tbBtn("tb-zi", TB.zoomIn,  "Zoom in"),
    tbBtn("tb-fit",TB.fit,     "Fit to view"),
    tbSep(),
    tbBtn("tb-un", TB.undo, "Undo",  S.undo.length===0),
    tbBtn("tb-re", TB.redo, "Redo",  S.redo.length===0),
    tbSep(),
    tbBtn("tb-cn", TB.conn,  "Connector tool", false, S.tool==="connect"),
    tbBtn("tb-lu", TB.lineUp,"Line-Up: line style, thickness, opacity, corners", false, S.tool==="connect" || (el.popup && !el.popup.classList.contains("hidden") && el.popup.dataset.mode === "lineup")),
    tbBtn("tb-br", TB.brush, "Fill color"),
    tbBtn("tb-tx", TB.text,  "Text tool", false, S.tool==="text"),
    tbBtn("tb-th", TB.theme, "Canvas theme"),
    tbSep(),
    tbBtn("tb-rn", TB.rename,"Rename", !hasNode),
    tbBtn("tb-cp", TB.copy,  "Copy", !hasNode),
    tbBtn("tb-ps", TB.paste, "Paste", !S._clipboard),
    tbBtn("tb-del",TB.trash, "Delete", !hasSel),
    tbSep(),
    tbBtn("tb-ex", TB.exprt, "Export diagram"),
    tbBtn("tb-im", TB.imprt, "Import diagram / image"),
    tbBtn("tb-dl", TB.dl,    "Download PNG"),
  ].join("");

  on("tb-new", clearCanvas);
  on("tb-zo",  () => doZoom(1/1.15));
  on("tb-zi",  () => doZoom(1.15));
  on("tb-fit", fitView);
  on("tb-un",  undo);
  on("tb-re",  redo);
  on("tb-cn",  openConnPopup);
  on("tb-lu",  openLineUpPopup);
  on("tb-br",  openColorPopup);
  on("tb-tx",  toggleTextTool);
  on("tb-th",  openThemePopup);
  on("tb-rn",  handleRename);
  on("tb-cp",  copyNode);
  on("tb-ps",  pasteNode);
  on("tb-del", deleteSel);
  on("tb-ex",  exportDiagram);
  on("tb-im",  importDiagram);
  on("tb-dl",  downloadPng);
}
function on(id, fn) { document.getElementById(id).addEventListener("click", fn); }

// ================================================================
// PALETTE
// ================================================================

function buildPalette() {
  el.palette.innerHTML = `<span class="label" style="margin-bottom:8px">Shapes</span>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">${SHAPES.map(s =>
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
        id: uid("c"), style: S.lineStyle, wp: [],
        startArrow: S.connDefaults.startArrow, endArrow: S.connDefaults.endArrow,
        color: S.connDefaults.color, width: S.connDefaults.width, opacity: S.connDefaults.opacity, radius: S.connDefaults.radius,
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

function clearCanvas() {
  if (S.nodes.length === 0 && S.conns.length === 0) return;
  if (!confirm("Clear the entire canvas? This can be undone with Ctrl+Z.")) return;
  snap();
  S.nodes = []; S.conns = [];
  S.name = "Untitled"; S.id = null;
  el.name.value = S.name;
  setSel(null);
  toast("Canvas cleared");
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
  draw();
  // Open inline editor immediately
  setTimeout(() => renameNode(node), 50);
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
// LINE-UP — single toolbar entry point for ALL line styling controls
// (type, arrows, color, thickness, opacity, rounded corners). Edits the
// selected connector directly if one is selected; otherwise sets the
// defaults new connectors will be drawn with (Miro's "preset" behavior).
// ================================================================

function openLineUpPopup() {
  const alreadyOpen = !el.popup.classList.contains("hidden") && el.popup.dataset.mode === "lineup";
  if (alreadyOpen) {
    closePopup();
    if (S.tool === "connect") { S.tool = null; el.svg.style.cursor = "grab"; buildToolbar(); }
    return;
  }
  el.popup.dataset.mode = "lineup";
  el.popup.style.left = document.getElementById("tb-lu").offsetLeft + "px";
  el.popup.classList.remove("hidden");
  const selConn = (S.sel && S.sel.k === "conn") ? S.conns.find(c => c.id === S.sel.id) : null;
  if (selConn) {
    snap(); // group every tweak made in this popup session into one undo step
  } else {
    // No line selected: arm the connector tool so the user can immediately drag
    // a new line between boxes (or on empty canvas) while the panel stays open.
    S.tool = "connect";
    el.svg.style.cursor = "crosshair";
    buildToolbar();
  }
  renderLineUpPopup();
}

function renderLineUpPopup() {
  const t = theme();
  const selConn = (S.sel && S.sel.k === "conn") ? S.conns.find(c => c.id === S.sel.id) : null;
  const editingSelected = !!selConn;
  const target = editingSelected ? selConn : S.connDefaults;
  const style = editingSelected ? (selConn.style || "straight") : S.lineStyle;
  const startA = target.startArrow || "none";
  const endA = target.endArrow || "filled";
  const color = target.color || "";
  const width = target.width || 2;
  const opacity = target.opacity != null ? target.opacity : 100;
  const radius = target.radius || 0;

  el.popup.innerHTML = `
    <div style="width:230px;display:flex;flex-direction:column;gap:10px;font-size:11px">
      <div style="opacity:0.6">${editingSelected ? "Styling selected line" : "Default style for new lines"}</div>
      <div>
        <div style="opacity:0.7;margin-bottom:4px">Line type</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px">${LINE_STYLES.map(ls => `
          <button class="btn${style===ls.key?" btn-primary":""}" data-lu-style="${ls.key}" style="padding:4px 6px;border:none;line-height:0" title="${ls.label}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${ls.icon}</svg></button>`).join("")}
        </div>
      </div>
      <div style="display:flex;gap:10px">
        <div style="flex:1">
          <div style="opacity:0.7;margin-bottom:4px">Start</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${ARROW_TYPES.map(at => `
            <button class="btn${startA===at.key?" btn-primary":""}" data-lu-start="${at.key}" style="padding:3px 4px;border:none;line-height:0" title="${at.label}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`).join("")}
          </div>
        </div>
        <div style="flex:1">
          <div style="opacity:0.7;margin-bottom:4px">End</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px">${ARROW_TYPES.map(at => `
            <button class="btn${endA===at.key?" btn-primary":""}" data-lu-end="${at.key}" style="padding:3px 4px;border:none;line-height:0" title="${at.label}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`).join("")}
          </div>
        </div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px"><span>Thickness</span><span id="dd-lu-w-val">${width}</span></div>
        <input id="dd-lu-width" type="range" min="1" max="12" step="1" value="${width}" style="width:100%">
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px"><span>Opacity</span><span id="dd-lu-o-val">${opacity}%</span></div>
        <input id="dd-lu-opacity" type="range" min="10" max="100" step="5" value="${opacity}" style="width:100%">
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px"><span>Rounded corners</span><span id="dd-lu-r-val">${radius}</span></div>
        <input id="dd-lu-radius" type="range" min="0" max="40" step="2" value="${radius}" style="width:100%">
        <div style="opacity:0.5;font-size:10px;margin-top:2px">Applies to right-angle lines</div>
      </div>
      <div>
        <div style="opacity:0.7;margin-bottom:4px">Color</div>
        <div style="display:flex;gap:5px;flex-wrap:wrap">${STROKE_COLORS.map(c => `
          <button data-lu-color="${c.key}" title="${c.label}" style="width:18px;height:18px;border-radius:50%;cursor:pointer;padding:0;
            border:1.5px solid ${color===c.key?t.sel:"rgba(0,0,0,0.2)"};background:${c.hex || t.stroke}"></button>`).join("")}
        </div>
      </div>
    </div>
  `;

  el.popup.querySelectorAll("[data-lu-style]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    if (editingSelected) selConn.style = b.dataset.luStyle; else S.lineStyle = b.dataset.luStyle;
    if (editingSelected) draw();
    renderLineUpPopup();
  }));
  el.popup.querySelectorAll("[data-lu-start]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); target.startArrow = b.dataset.luStart;
    if (editingSelected) draw();
    renderLineUpPopup();
  }));
  el.popup.querySelectorAll("[data-lu-end]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); target.endArrow = b.dataset.luEnd;
    if (editingSelected) draw();
    renderLineUpPopup();
  }));
  el.popup.querySelectorAll("[data-lu-color]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); target.color = b.dataset.luColor || null;
    if (editingSelected) draw();
    renderLineUpPopup();
  }));
  document.getElementById("dd-lu-width").addEventListener("input", e => {
    target.width = parseInt(e.target.value, 10);
    document.getElementById("dd-lu-w-val").textContent = target.width;
    if (editingSelected) draw();
  });
  document.getElementById("dd-lu-opacity").addEventListener("input", e => {
    target.opacity = parseInt(e.target.value, 10);
    document.getElementById("dd-lu-o-val").textContent = target.opacity + "%";
    if (editingSelected) draw();
  });
  document.getElementById("dd-lu-radius").addEventListener("input", e => {
    target.radius = parseInt(e.target.value, 10);
    document.getElementById("dd-lu-r-val").textContent = target.radius;
    if (editingSelected) draw();
  });
}

// ================================================================
// THEME
// ================================================================

function openThemePopup() {
  if (!el.popup.classList.contains("hidden")) { closePopup(); return; }
  renderThemePopup();
  el.popup.classList.remove("hidden");
}

function renderThemePopup() {
  el.popup.style.left = document.getElementById("tb-th").offsetLeft + "px";
  el.popup.innerHTML = `<div style="display:flex;flex-direction:column;gap:3px">${
    THEMES.map(t => `<button class="btn${S.theme===t.key?" btn-primary":""}" data-theme="${t.key}" style="padding:6px 12px;display:flex;gap:8px;align-items:center;border:none">
      <span style="display:inline-block;width:18px;height:18px;border-radius:4px;background:${t.bg};border:2px solid ${t.stroke}"></span>
      <span style="font-size:11px">${t.label}</span></button>`).join("")
  }<div style="border-top:1px solid var(--color-border);margin-top:4px;padding-top:6px">
    <button class="btn" id="dd-export-border-toggle" style="padding:6px 12px;display:flex;gap:8px;align-items:center;border:none;width:100%">
      <span style="display:inline-flex;width:18px;height:18px;border-radius:4px;align-items:center;justify-content:center;border:2px solid var(--color-text-tertiary)">${S.exportBorder?"✓":""}</span>
      <span style="font-size:11px">Border on download</span>
    </button>
  </div></div>`;
  el.popup.querySelectorAll("[data-theme]").forEach(b => b.addEventListener("click", async e => {
    e.stopPropagation();
    S.theme = b.dataset.theme;
    await storage.settings.set("diagramTheme", S.theme);
    closePopup();
    applyTheme();
    draw();
    buildToolbar();
  }));
  document.getElementById("dd-export-border-toggle").addEventListener("click", async e => {
    e.stopPropagation();
    S.exportBorder = !S.exportBorder;
    await storage.settings.set("exportBorder", S.exportBorder);
    renderThemePopup();
  });
}


function applyTheme() {
  const t = theme();
  const wrap = document.getElementById("dd-canvas-wrap");
  if (wrap) {
    wrap.style.background = t.bg;
    wrap.style.border = `2px solid ${t.border}`;
  }
  const gridPath = el.svg.querySelector("#grid path");
  if (gridPath) gridPath.setAttribute("stroke", t.grid);
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
// RENAME (toolbar button — reliable, no double-tap needed)
// ================================================================

function handleRename() {
  if (!S.sel || S.sel.k !== "node") return;
  const node = S.nodes.find(n => n.id === S.sel.id);
  if (node) renameNode(node);
}

// ================================================================
// EXPORT / IMPORT DIAGRAM
// ================================================================

function exportDiagram() {
  const data = {
    format: "ArchitectSmartCraft", version: "2.5",
    name: S.name, theme: S.theme,
    nodes: S.nodes.map(({id,type,label,x,y,w,h,fill,fontSize,textColor,imageData})=>({id,type,label,x,y,w,h,fill,fontSize,textColor,imageData})),
    conns: S.conns.map(({id,from,to,style,wp,startArrow,endArrow,fromPt,toPt,color,width,opacity,radius})=>({id,from,to,style,wp,startArrow,endArrow,fromPt,toPt,color:color||null,width:width||2,opacity:opacity!=null?opacity:100,radius:radius||0})),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(S.name||"diagram").replace(/[^a-z0-9_-]/gi,"_")}.asc.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("Diagram exported");
}

function importDiagram() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,.asc.json,image/*";
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.type.startsWith("image/")) await importFromImage(file);
    else await importFromJson(file);
  });
  input.click();
}

async function importFromJson(file) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.format !== "ArchitectSmartCraft") { toast("Not a valid diagram file"); return; }
    snap();
    S.name = data.name || "Imported";
    S.nodes = data.nodes || [];
    S.conns = (data.conns || []).map(normConn);
    if (data.theme && THEMES.find(t => t.key === data.theme)) S.theme = data.theme;
    el.name.value = S.name;
    applyTheme(); draw(); fitView(); buildToolbar();
    toast("Diagram imported");
  } catch (e) { toast("Import failed: " + e.message); }
}

async function importFromImage(file) {
  const { provider, apiKey } = await loadApiConfig();
  const base64 = await fileToBase64(file);

  if (!provider || !apiKey) {
    snap();
    const vis = visBounds();
    S.nodes.push({ id: uid("n"), type: "image", label: file.name, x: vis.x+20, y: vis.y+20, w: 400, h: 300, fill: null, imageData: base64 });
    draw(); buildToolbar();
    toast("Image added as reference (set an AI key in Settings to auto-convert to diagram)");
    return;
  }

  toast("Analyzing image...");

  try {
    const dj = await convertImageToDiagram(provider, apiKey, base64);
    if (!dj) { toast("Could not parse diagram from image"); return; }
    snap();
    S.name = dj.name || file.name.replace(/\.\w+$/, "");
    el.name.value = S.name;
    const idMap = {};
    (dj.nodes || []).forEach(n => {
      const id = uid("n"); idMap[n.id || n.label] = id;
      S.nodes.push({ id, type: n.type||"rect", label: n.label||"", x: n.x||0, y: n.y||0, w: n.w||120, h: n.h||60, fill: n.fill||null });
    });
    (dj.connectors || []).forEach(c => {
      const fromId = idMap[c.from]||idMap[c.from_label];
      const toId = idMap[c.to]||idMap[c.to_label];
      if (fromId && toId) S.conns.push({ id: uid("c"), from: fromId, to: toId, style: c.style||"straight", wp: [], startArrow:"none", endArrow:"filled", color:null, width:2, opacity:100, radius:0 });
    });
    draw(); fitView(); buildToolbar();
    toast(`Converted: ${S.nodes.length} shapes, ${S.conns.length} connections`);
  } catch (e) {
    console.error("AI conversion failed:", e);
    snap();
    const vis = visBounds();
    S.nodes.push({ id: uid("n"), type: "image", label: file.name, x: vis.x+20, y: vis.y+20, w: 400, h: 300, fill: null, imageData: base64 });
    draw(); buildToolbar();
    toast("AI conversion failed — added as reference image. " + e.message);
  }
}

async function convertImageToDiagram(provider, apiKey, imageBase64) {
  const prompt = `Analyze this architecture/flow diagram image. Return ONLY valid JSON (no markdown, no backticks) with this structure:
{"name":"title","nodes":[{"id":"1","label":"Name","type":"rect","x":100,"y":50,"w":120,"h":60,"fill":null}],"connectors":[{"from":"1","to":"2","style":"straight"}]}
Rules: type=rect|rounded|ellipse|diamond|cylinder|cloud|hexagon|parallelogram|triangle|callout|text. Positions on 0-1000 x 0-800 grid matching layout. fill=hex color or null. style=straight|curved|orthogonal. Every node needs unique id. connectors reference node ids.`;

  let res;
  if (provider === "groq") {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
      body: JSON.stringify({model:"llama-3.2-90b-vision-preview",messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:{url:imageBase64}}]}]}),
    });
  } else if (provider === "mistral") {
    res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${apiKey}`},
      body: JSON.stringify({model:"pixtral-12b-2409",messages:[{role:"user",content:[{type:"text",text:prompt},{type:"image_url",image_url:imageBase64}]}]}),
    });
  } else { throw new Error("Vision not supported by " + provider); }

  if (!res.ok) throw new Error(`API error (${res.status})`);
  const data = await res.json();
  const text = data.choices[0].message.content;
  return JSON.parse(text.replace(/```json\s*/g,"").replace(/```\s*/g,"").trim());
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

  // apply rotation around the node's center if set
  if (node.rotate) {
    const cx = node.x + node.w/2, cy = node.y + node.h/2;
    g.setAttribute("transform", `rotate(${node.rotate},${cx},${cy})`);
  }

  // invisible hit-area covering the full bounding box — guarantees click/drag works
  // even for hollow/outline shapes (sync, check, arrows, elbow, etc.) where the
  // visible geometry has no fill and clicks would otherwise only land on thin strokes.
  const hit = svgEl("rect");
  hit.setAttribute("x", node.x); hit.setAttribute("y", node.y);
  hit.setAttribute("width", node.w); hit.setAttribute("height", node.h);
  hit.setAttribute("fill", "transparent");
  hit.setAttribute("stroke", "none");
  g.appendChild(hit);

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
      border.setAttribute("fill", "none"); border.setAttribute("stroke", t.sel);
      border.setAttribute("stroke-width", "2.5"); border.setAttribute("stroke-dasharray", "4 2");
      border.setAttribute("rx", "4");
      g.appendChild(border);
    }
  } else {
    shape = buildShape(node);
    const t = theme();
    const fill = (node.type === "text" || node.type === "group") ? "transparent" : (node.fill || t.fill);
    shape.setAttribute("fill", fill);
    if (node.type !== "text") {
      // stroke color: per-node override > selection highlight > theme default
      const strokeClr = isSel ? t.sel : (node.strokeColor || t.stroke);
      shape.setAttribute("stroke", strokeClr);
      shape.setAttribute("stroke-width", isSel ? "2.5" : (node.type === "group" ? "2" : "1.5"));
      // border style: dotted / dashed / solid
      const bsDef = BORDER_STYLES.find(b => b.key === node.borderStyle);
      if (bsDef && bsDef.dash) {
        shape.setAttribute("stroke-dasharray", bsDef.dash);
      } else if (node.type !== "group") {
        shape.removeAttribute("stroke-dasharray");
      }
    }
  }
  shape.style.pointerEvents = "none";
  g.appendChild(shape);

  // ── Hover-to-connect dots (Miro-style): appear on mouseover of ANY box, even
  // unselected, so dragging box-to-box connectors doesn't require picking the
  // connector tool first. Stay fully visible while the node is selected too.
  {
    const t3 = theme();
    const hoverDots = [];
    handles(node).forEach(h => {
      const cdot = svgEl("circle");
      cdot.setAttribute("cx", h.x); cdot.setAttribute("cy", h.y);
      cdot.setAttribute("r", 5);
      cdot.setAttribute("fill", t3.sel); cdot.setAttribute("stroke", "#fff"); cdot.setAttribute("stroke-width", "1.5");
      cdot.style.cursor = "crosshair";
      cdot.style.transition = "opacity 0.12s";
      cdot.style.opacity = isSel ? "0.85" : "0";
      cdot.style.pointerEvents = isSel ? "auto" : "none";
      cdot.addEventListener("mousedown", e => { e.stopPropagation(); startConnect(node.id, e); });
      cdot.addEventListener("touchstart", e => { e.stopPropagation(); startConnect(node.id, e); }, { passive: true });
      g.appendChild(cdot);
      hoverDots.push(cdot);
    });
    if (!isSel) {
      g.addEventListener("mouseenter", () => hoverDots.forEach(d => { d.style.opacity = "0.85"; d.style.pointerEvents = "auto"; }));
      g.addEventListener("mouseleave", () => hoverDots.forEach(d => { d.style.opacity = "0"; d.style.pointerEvents = "none"; }));
    }
  }

  // label (skip for image nodes or show below)
  if (node.type !== "image") {
    const txt = svgEl("text");
    txt.setAttribute("x", labelX(node));
    txt.setAttribute("y", labelY(node));
    txt.setAttribute("text-anchor", labelAnchor(node));
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

  // edge handles (for connecting) + corner resize handles + rotate handle
  if (isSel) {
    const t2 = theme();

    // ── Rotate handle (circle above top-center, with a line connecting it) ──
    const rotCx = node.x + node.w/2;
    const rotCy = node.y - 28;
    const rotLine = mkEl("line", { x1: node.x+node.w/2, y1: node.y, x2: rotCx, y2: rotCy,
      stroke: t2.handle, "stroke-width": "1.5", "stroke-dasharray": "3 2" });
    rotLine.style.pointerEvents = "none";
    g.appendChild(rotLine);

    const rotDot = svgEl("circle");
    rotDot.setAttribute("cx", rotCx); rotDot.setAttribute("cy", rotCy);
    rotDot.setAttribute("r", 7);
    rotDot.setAttribute("fill", t2.sel); rotDot.setAttribute("stroke", "#fff"); rotDot.setAttribute("stroke-width", "1.5");
    rotDot.style.cursor = "crosshair";
    rotDot.innerHTML = "";
    rotDot.addEventListener("mousedown", e => {
      e.stopPropagation();
      const cx = node.x + node.w/2, cy = node.y + node.h/2;
      const startAngle = (node.rotate || 0);
      const startEvtAngle = Math.atan2(svgPt(e).y - cy, svgPt(e).x - cx) * 180 / Math.PI;
      const pre = { nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) };
      const mv = e2 => {
        const p = svgPt(e2);
        const angle = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
        node.rotate = startAngle + (angle - startEvtAngle);
        draw();
      };
      const up = () => { S.undo.push(pre); S.redo=[]; buildToolbar(); off(mv, up); };
      listen(mv, up);
    });
    rotDot.addEventListener("touchstart", e => {
      e.stopPropagation();
      const cx = node.x + node.w/2, cy = node.y + node.h/2;
      const startAngle = (node.rotate || 0);
      const startEvtAngle = Math.atan2(svgPt(e).y - cy, svgPt(e).x - cx) * 180 / Math.PI;
      const pre = { nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) };
      const mv = e2 => {
        const p = svgPt(e2);
        const angle = Math.atan2(p.y - cy, p.x - cx) * 180 / Math.PI;
        node.rotate = startAngle + (angle - startEvtAngle);
        draw();
      };
      const up = () => { S.undo.push(pre); S.redo=[]; buildToolbar(); off(mv, up); };
      listen(mv, up);
    }, { passive: true });
    g.appendChild(rotDot);

    // ── 8 resize handles (4 corners + 4 edge midpoints) ──
    const resizeHandles = [
      { id:"nw", cx:node.x,           cy:node.y,           cursor:"nw-resize" },
      { id:"n",  cx:node.x+node.w/2,  cy:node.y,           cursor:"n-resize"  },
      { id:"ne", cx:node.x+node.w,    cy:node.y,           cursor:"ne-resize" },
      { id:"e",  cx:node.x+node.w,    cy:node.y+node.h/2,  cursor:"e-resize"  },
      { id:"se", cx:node.x+node.w,    cy:node.y+node.h,    cursor:"se-resize" },
      { id:"s",  cx:node.x+node.w/2,  cy:node.y+node.h,    cursor:"s-resize"  },
      { id:"sw", cx:node.x,           cy:node.y+node.h,    cursor:"sw-resize" },
      { id:"w",  cx:node.x,           cy:node.y+node.h/2,  cursor:"w-resize"  },
    ];

    resizeHandles.forEach(h => {
      const isCorner = ["nw","ne","se","sw"].includes(h.id);

      // corner = filled square; edge midpoint = open circle (distinguishes resize from connect)
      let dot;
      if (isCorner) {
        dot = mkEl("rect", {
          x: h.cx - 5, y: h.cy - 5, width: 10, height: 10, rx: 2,
          fill: t2.sel, stroke: "#fff", "stroke-width": "1.5"
        });
      } else {
        dot = svgEl("circle");
        dot.setAttribute("cx", h.cx); dot.setAttribute("cy", h.cy);
        dot.setAttribute("r", HANDLE_R);
        dot.setAttribute("fill", t2.bg); dot.setAttribute("stroke", t2.handle); dot.setAttribute("stroke-width", "1.5");
      }
      dot.style.cursor = h.cursor;

      const startResize = e => {
        e.stopPropagation();
        const origX=node.x, origY=node.y, origW=node.w, origH=node.h;
        const startPt = svgPt(e);
        const pre = { nodes: structuredClone(S.nodes), conns: structuredClone(S.conns) };
        const MIN = 30;
        const mv = e2 => {
          const p = svgPt(e2);
          const dx = p.x - startPt.x, dy = p.y - startPt.y;
          let nx=origX, ny=origY, nw=origW, nh=origH;
          if (h.id.includes("e"))  nw = Math.max(MIN, origW + dx);
          if (h.id.includes("s"))  nh = Math.max(MIN, origH + dy);
          if (h.id.includes("w"))  { nw = Math.max(MIN, origW - dx); nx = origX + origW - nw; }
          if (h.id.includes("n"))  { nh = Math.max(MIN, origH - dy); ny = origY + origH - nh; }
          node.x=nx; node.y=ny; node.w=nw; node.h=nh;
          draw();
        };
        const up = () => { S.undo.push(pre); S.redo=[]; buildToolbar(); off(mv, up); };
        listen(mv, up);
      };
      dot.addEventListener("mousedown", startResize);
      dot.addEventListener("touchstart", startResize, { passive: true });
      g.appendChild(dot);
    });

    // ── (rotate handle + resize handles moved here — connector dots are now
    //    hover-activated below so boxes can be connected without selecting first) ──

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
      node.fill = S.pendingColor; S.pendingColor = null; draw(); return;
    }
    if (node.type !== "text") showNodeFloat(node);
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
  // Create an inline editable input positioned over the node on the canvas
  const wrap = document.getElementById("dd-canvas-wrap");
  const sx = (node.x + node.w/2) * S.zoom + S.pan.x;
  const sy = (node.y + node.h/2) * S.zoom + S.pan.y;
  const t = theme();

  const input = document.createElement("input");
  input.type = "text";
  input.value = node.label;
  input.style.cssText = `position:absolute;left:${sx}px;top:${sy}px;transform:translate(-50%,-50%);
    font-family:JetBrains Mono,monospace;font-size:${(node.fontSize||12)*S.zoom}px;
    text-align:center;background:${t.bg};color:${t.text};
    border:2px solid ${t.sel};border-radius:4px;padding:2px 6px;
    outline:none;z-index:10;min-width:40px;max-width:${node.w*S.zoom+40}px`;
  wrap.appendChild(input);
  input.focus();
  input.select();

  const finish = () => {
    const v = input.value.trim();
    if (v && v !== node.label) { snap(); node.label = v; }
    input.remove();
    draw(); buildToolbar();
  };
  input.addEventListener("blur", finish);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); input.blur(); }
    if (e.key === "Escape") { input.value = node.label; input.blur(); }
  });
}

function showNodeFloat(node) {
  const x = (node.x + node.w/2) * S.zoom + S.pan.x;
  const y = node.y * S.zoom + S.pan.y;
  el.float.style.left = x+"px"; el.float.style.top = y+"px";
  // Override the hardcoded flex layout so our column layout works
  el.float.style.display = "block";
  el.float.style.padding = "4px 6px";
  el.float.classList.remove("hidden");

  const sep = `<div style="width:1px;background:var(--color-border);margin:0 2px;align-self:stretch"></div>`;

  // Fill color dots
  const fillRow = COLORS.slice(0,7).map(c => {
    const active = (node.fill||"") === c.key;
    return `<button data-nclr="${c.key}" title="Fill: ${c.label}"
      style="width:16px;height:16px;border-radius:50%;background:${c.hex};
      border:2px solid ${active?"#fff":"rgba(255,255,255,.2)"};padding:0;cursor:pointer;flex-shrink:0"></button>`;
  }).join("");

  // Border style buttons — solid / dashed / dotted
  const borderRow = BORDER_STYLES.map(b => {
    const active = (node.borderStyle||"solid") === b.key;
    const dash = b.dash ? `stroke-dasharray="${b.dash}"` : "";
    return `<button data-nborder="${b.key}" title="${b.label}"
      style="width:30px;height:20px;padding:0;cursor:pointer;border-radius:4px;
      border:1px solid ${active?"var(--color-primary)":"transparent"};
      background:${active?"rgba(212,255,58,.15)":"transparent"};
      display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">
      <svg viewBox="0 0 28 8" width="26" height="8">
        <line x1="2" y1="4" x2="26" y2="4"
          stroke="${active?"var(--color-primary)":"var(--color-text)"}"
          stroke-width="2" ${dash}/>
      </svg></button>`;
  }).join("");

  // Stroke color dots
  const strokeRow = STROKE_COLORS.map(c => {
    const active = (node.strokeColor||"") === c.key;
    const bg = c.hex || "transparent";
    return `<button data-nstroke="${c.key}" title="Border color: ${c.label}"
      style="width:16px;height:16px;border-radius:50%;background:${bg};
      border:2px solid ${active?"#fff":"rgba(255,255,255,.25)"};
      padding:0;cursor:pointer;flex-shrink:0;position:relative;overflow:hidden;
      ${!c.hex?"box-shadow:inset 0 0 0 1px rgba(255,255,255,.3);":""}">
      ${!c.hex?`<svg viewBox="0 0 12 12" width="12" height="12" style="position:absolute;top:0;left:0"><line x1="1" y1="11" x2="11" y2="1" stroke="#f55" stroke-width="1.5"/></svg>`:""}
    </button>`;
  }).join("");

  el.float.innerHTML = `
    <div style="display:flex;align-items:center;gap:3px;margin-bottom:5px">
      <span style="font-size:9px;color:var(--color-text-tertiary);min-width:28px;flex-shrink:0">Fill</span>
      ${sep}${fillRow}${sep}
      <button id="dd-convert-btn" title="Convert shape"
        style="background:none;border:none;cursor:pointer;padding:1px 4px;font-size:12px;
        color:var(--color-text);border-radius:4px;line-height:1;flex-shrink:0">⇄</button>
    </div>
    <div style="display:flex;align-items:center;gap:3px">
      <span style="font-size:9px;color:var(--color-text-tertiary);min-width:28px;flex-shrink:0">Border</span>
      ${sep}${borderRow}${sep}${strokeRow}
    </div>`;

  el.float.querySelectorAll("[data-nclr]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); node.fill = b.dataset.nclr||null; draw(); showNodeFloat(node);
  }));

  el.float.querySelectorAll("[data-nborder]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); node.borderStyle = b.dataset.nborder; draw(); showNodeFloat(node);
  }));

  el.float.querySelectorAll("[data-nstroke]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); node.strokeColor = b.dataset.nstroke||null; draw(); showNodeFloat(node);
  }));

  document.getElementById("dd-convert-btn").addEventListener("click", e => {
    e.stopPropagation(); openConvertPopup(node);
  });
}

/** Shows the shape-type picker popup anchored below the convert button */
function openConvertPopup(node) {
  // remove any existing convert popup
  const old = document.getElementById("dd-convert-popup");
  if (old) { old.remove(); return; }

  const popup = document.createElement("div");
  popup.id = "dd-convert-popup";
  popup.style.cssText = `
    position:absolute;
    background:var(--color-bg-raised);
    border:1px solid var(--color-border-strong);
    border-radius:var(--radius-md);
    padding:6px;
    z-index:30;
    display:grid;
    grid-template-columns:repeat(5,36px);
    gap:4px;
    box-shadow:0 4px 16px rgba(0,0,0,.4);
  `;

  // Position below the float bar
  const floatRect = el.float.getBoundingClientRect();
  const wrapRect = document.getElementById("dd-canvas-wrap").getBoundingClientRect();
  popup.style.left = (floatRect.left - wrapRect.left) + "px";
  popup.style.top  = (floatRect.bottom - wrapRect.top + 4) + "px";

  // Exclude 'text', 'image', 'group' from convert targets (structural types)
  const convertable = SHAPES.filter(s => s.type !== "image");
  convertable.forEach(s => {
    const btn = document.createElement("button");
    const isActive = node.type === s.type;
    btn.title = s.label;
    btn.style.cssText = `
      width:36px;height:36px;padding:2px;border-radius:6px;cursor:pointer;border:none;
      background:${isActive ? "var(--color-primary)" : "transparent"};
      display:flex;align-items:center;justify-content:center;
    `;
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22"
      fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
      style="color:${isActive ? "#000" : "var(--color-text)"}">
      ${s.icon}
    </svg>`;
    btn.addEventListener("mouseenter", () => { if (!isActive) btn.style.background = "var(--color-bg-hover,rgba(255,255,255,.08))"; });
    btn.addEventListener("mouseleave", () => { if (!isActive) btn.style.background = "transparent"; });
    btn.addEventListener("click", e => {
      e.stopPropagation();
      snap();
      node.type = s.type;
      popup.remove();
      draw();
    });
    popup.appendChild(btn);
  });

  document.getElementById("dd-canvas-wrap").appendChild(popup);

  // close on next outside click
  const close = e => {
    if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener("click", close); }
  };
  setTimeout(() => document.addEventListener("click", close), 10);
}

/** Shows font size +/- and text color controls when a text node is selected. */
function showTextFloat(node) {
  const x = (node.x + node.w/2) * S.zoom + S.pan.x;
  const y = node.y * S.zoom + S.pan.y;
  el.float.style.left = x+"px"; el.float.style.top = y+"px";
  el.float.style.display = "flex";
  el.float.style.padding = "4px";
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
function hideFloat() {
  el.float && el.float.classList.add("hidden");
  el.connBar && el.connBar.classList.add("hidden");
  const cp = document.getElementById("dd-convert-popup");
  if (cp) cp.remove();
}

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

  const connStyle = conn.style || "straight";
  const lsDef = LINE_STYLES.find(ls => ls.key === connStyle);
  const pathStyle = lsDef && lsDef.base ? lsDef.base : connStyle;
  const d  = buildPath(p1, p2, pathStyle, wp, conn.radius || 0);
  const isSel = S.sel && S.sel.k === "conn" && S.sel.id === conn.id;

  const g = svgEl("g");

  // hit area
  const hit = svgEl("path");
  hit.setAttribute("d", d); hit.setAttribute("fill", "none");
  hit.setAttribute("stroke", "transparent"); hit.setAttribute("stroke-width", "14");
  hit.style.cursor = "pointer";
  hit.addEventListener("click", e => { e.stopPropagation(); setSel({k:"conn",id:conn.id}); });
  g.appendChild(hit);

  // visible line — custom color/thickness/opacity (Miro-style connector styling), falls
  // back to theme defaults when not set on the connector
  const baseWidth = conn.width || 2;
  const line = svgEl("path");
  line.setAttribute("d", d); line.setAttribute("fill", "none");
  line.setAttribute("stroke", conn.color || (isSel ? theme().sel : theme().stroke));
  line.setAttribute("stroke-width", String(isSel ? baseWidth + 1 : baseWidth));
  line.setAttribute("opacity", String((conn.opacity != null ? conn.opacity : 100) / 100));
  if (lsDef && lsDef.dash) line.setAttribute("stroke-dasharray", lsDef.dash);
  const endArrow = conn.endArrow || "filled";
  const startArrow = conn.startArrow || "none";
  if (conn.color) {
    // Custom stroke color: generate a matching-color marker on the fly so the
    // arrowhead doesn't stay lime/white while the line itself is recolored.
    if (endArrow !== "none") line.setAttribute("marker-end", `url(#${ensureColorMarker(endArrow, conn.color, false)})`);
    if (startArrow !== "none") line.setAttribute("marker-start", `url(#${ensureColorMarker(startArrow, conn.color, true)})`);
  } else {
    const suffix = isSel ? "-w" : "";
    if (endArrow !== "none") line.setAttribute("marker-end", `url(#ah-${endArrow}${suffix})`);
    if (startArrow !== "none") line.setAttribute("marker-start", `url(#ah-s-${startArrow})`);
  }
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
  dot.setAttribute("stroke", theme().bg); dot.setAttribute("stroke-width", "2");
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
      // Keep as freeform point during drag — don't snap mid-drag
      conn[ptKey] = { x: p.x, y: p.y };
      if (ptKey === "fromPt") conn.from = null;
      else conn.to = null;
      draw();
    };
    const up = e => {
      if (moved) {
        // Snap to box only on release
        const endP = svgPt(e.changedTouches ? e.changedTouches[0] : e);
        const snapNode = nodeAt(endP);
        if (snapNode) {
          if (ptKey === "fromPt") { conn.from = snapNode.id; conn.fromPt = null; }
          else { conn.to = snapNode.id; conn.toPt = null; }
        }
        if (pre) { S.undo.push(pre); if (S.undo.length > MAX_UNDO) S.undo.shift(); S.redo = []; }
        draw(); buildToolbar();
      }
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
  // Show connector options in fixed bar at top of canvas (not floating over the line)
  const t = theme();
  const curStyle = conn.style || "straight";
  const curEnd = conn.endArrow || "filled";
  const curStart = conn.startArrow || "none";
  const curColor = conn.color || t.stroke;

  el.connBar.classList.remove("hidden");
  el.connBar.innerHTML = `
    <span style="color:${t.text};opacity:0.6;margin-right:4px">Line:</span>
    ${LINE_STYLES.map(ls =>
      `<button class="btn${curStyle===ls.key?" btn-primary":""}" data-fls="${ls.key}" style="padding:3px 6px;border:none;line-height:0" title="${ls.label}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${ls.icon}</svg></button>`
    ).join("")}
    <div style="width:1px;height:18px;background:${t.border};margin:0 4px"></div>
    <span style="color:${t.text};opacity:0.6">Start:</span>
    ${ARROW_TYPES.map(at =>
      `<button class="btn${curStart===at.key?" btn-primary":""}" data-fsa="${at.key}" style="padding:2px 4px;border:none;line-height:0" title="${at.label}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`
    ).join("")}
    <div style="width:1px;height:18px;background:${t.border};margin:0 4px"></div>
    <span style="color:${t.text};opacity:0.6">End:</span>
    ${ARROW_TYPES.map(at =>
      `<button class="btn${curEnd===at.key?" btn-primary":""}" data-fea="${at.key}" style="padding:2px 4px;border:none;line-height:0" title="${at.label}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${at.icon}</svg></button>`
    ).join("")}
    <div style="width:1px;height:18px;background:${t.border};margin:0 4px"></div>
    <button class="btn" id="dd-conn-color-btn" title="Line color" style="padding:2px 4px;border:none;line-height:0;display:flex;align-items:center">
      <span style="width:14px;height:14px;border-radius:50%;display:inline-block;border:1px solid ${t.border};background:${curColor}"></span>
    </button>
    <button class="btn" id="dd-conn-more-btn" title="More line options" style="padding:2px 6px;border:none;line-height:0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
    </button>
  `;

  el.connBar.querySelectorAll("[data-fls]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.style = b.dataset.fls; draw();
  }));
  el.connBar.querySelectorAll("[data-fsa]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.startArrow = b.dataset.fsa; draw();
  }));
  el.connBar.querySelectorAll("[data-fea]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap(); conn.endArrow = b.dataset.fea; draw();
  }));
  document.getElementById("dd-conn-color-btn").addEventListener("click", e => {
    e.stopPropagation(); openConnColorPopup(conn, e.currentTarget);
  });
  document.getElementById("dd-conn-more-btn").addEventListener("click", e => {
    e.stopPropagation(); openConnStylePopup(conn, e.currentTarget);
  });
}

/** Small popup anchored under the connBar color swatch — pick a stroke color for
 *  the selected connector (defaults back to the theme's stroke color when cleared). */
function openConnColorPopup(conn, anchorBtn) {
  const old = document.getElementById("dd-connclr-popup");
  if (old) { old.remove(); return; }
  const wrap = document.getElementById("dd-canvas-wrap");
  const t = theme();
  const popup = document.createElement("div");
  popup.id = "dd-connclr-popup";
  popup.style.cssText = `
    position:absolute; z-index:8; background:${t.bg==="#ffffff"||t.bg==="#f8f8f8"?"var(--color-bg-raised)":t.bg};
    border:1px solid var(--color-border-strong); border-radius:var(--radius-md); padding:6px;
    display:flex; gap:4px; flex-wrap:wrap; max-width:170px;`;
  const barRect = el.connBar.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  popup.style.left = (anchorBtn.getBoundingClientRect().left - wrapRect.left) + "px";
  popup.style.top  = (barRect.bottom - wrapRect.top + 4) + "px";

  popup.innerHTML = STROKE_COLORS.map(c => `
    <button data-cclr="${c.key}" title="${c.label}" style="width:20px;height:20px;border-radius:50%;border:1.5px solid ${(conn.color||"")===c.key?t.sel:"rgba(0,0,0,0.15)"};
      background:${c.hex || t.stroke};cursor:pointer;padding:0"></button>
  `).join("");
  popup.querySelectorAll("[data-cclr]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation(); snap();
    conn.color = b.dataset.cclr || null;
    draw(); popup.remove();
    document.removeEventListener("click", closeOnOutside);
  }));
  wrap.appendChild(popup);
  const closeOnOutside = e => { if (!popup.contains(e.target) && e.target !== anchorBtn) { popup.remove(); document.removeEventListener("click", closeOnOutside); } };
  setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
}

/** Miro-style expanded connector panel: thickness / opacity / rounded-corner sliders
 *  plus a brand-colors row, anchored below the "more options" (⋮) button. */
function openConnStylePopup(conn, anchorBtn) {
  const old = document.getElementById("dd-connstyle-popup");
  if (old) { old.remove(); return; }
  snap(); // group any slider tweaks made in this session into one undo step

  const wrap = document.getElementById("dd-canvas-wrap");
  const t = theme();
  const popup = document.createElement("div");
  popup.id = "dd-connstyle-popup";
  popup.style.cssText = `
    position:absolute; z-index:8; width:220px; background:var(--color-bg-raised);
    border:1px solid var(--color-border-strong); border-radius:var(--radius-md); padding:14px;
    display:flex; flex-direction:column; gap:10px; font-size:12px; color:${t.text};`;
  const barRect = el.connBar.getBoundingClientRect();
  const wrapRect = wrap.getBoundingClientRect();
  let left = anchorBtn.getBoundingClientRect().left - wrapRect.left - 190;
  if (left < 4) left = 4;
  popup.style.left = left + "px";
  popup.style.top  = (barRect.bottom - wrapRect.top + 4) + "px";

  const width = conn.width || 2;
  const opacity = conn.opacity != null ? conn.opacity : 100;
  const radius = conn.radius || 0;

  popup.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px">
        <span>Thickness</span><span id="dd-cs-w-val">${width}</span>
      </div>
      <input id="dd-cs-width" type="range" min="1" max="12" step="1" value="${width}" style="width:100%">
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px">
        <span>Opacity</span><span id="dd-cs-o-val">${opacity}%</span>
      </div>
      <input id="dd-cs-opacity" type="range" min="10" max="100" step="5" value="${opacity}" style="width:100%">
    </div>
    <div>
      <div style="display:flex;justify-content:space-between;opacity:0.7;margin-bottom:4px">
        <span>Rounded corners</span><span id="dd-cs-r-val">${radius}</span>
      </div>
      <input id="dd-cs-radius" type="range" min="0" max="40" step="2" value="${radius}" style="width:100%">
      <div style="opacity:0.55;font-size:10px;margin-top:3px">Applies to right-angle (elbow) lines</div>
    </div>
    <div>
      <div style="opacity:0.7;margin-bottom:4px">Colors</div>
      <div id="dd-cs-colors" style="display:flex;gap:5px;flex-wrap:wrap">
        ${STROKE_COLORS.map(c => `
          <button data-cscol="${c.key}" title="${c.label}" style="width:18px;height:18px;border-radius:50%;cursor:pointer;padding:0;
            border:1.5px solid ${(conn.color||"")===c.key?t.sel:"rgba(0,0,0,0.15)"};background:${c.hex || t.stroke}"></button>
        `).join("")}
      </div>
    </div>
  `;

  popup.querySelector("#dd-cs-width").addEventListener("input", e => {
    conn.width = parseInt(e.target.value, 10);
    popup.querySelector("#dd-cs-w-val").textContent = conn.width;
    draw();
  });
  popup.querySelector("#dd-cs-opacity").addEventListener("input", e => {
    conn.opacity = parseInt(e.target.value, 10);
    popup.querySelector("#dd-cs-o-val").textContent = conn.opacity + "%";
    draw();
  });
  popup.querySelector("#dd-cs-radius").addEventListener("input", e => {
    conn.radius = parseInt(e.target.value, 10);
    popup.querySelector("#dd-cs-r-val").textContent = conn.radius;
    draw();
  });
  popup.querySelectorAll("[data-cscol]").forEach(b => b.addEventListener("click", e => {
    e.stopPropagation();
    conn.color = b.dataset.cscol || null;
    draw();
    popup.querySelectorAll("[data-cscol]").forEach(x => x.style.border = `1.5px solid ${x.dataset.cscol===(conn.color||"")?t.sel:"rgba(0,0,0,0.15)"}`);
  }));

  // Keep interactions inside the popup from bubbling to the canvas (which would
  // deselect the connector and close the bar).
  popup.addEventListener("click", e => e.stopPropagation());
  popup.addEventListener("mousedown", e => e.stopPropagation());
  popup.addEventListener("touchstart", e => e.stopPropagation(), { passive: true });

  wrap.appendChild(popup);
  const closeOnOutside = e => {
    if (!popup.contains(e.target) && e.target !== anchorBtn) {
      popup.remove(); buildToolbar(); document.removeEventListener("click", closeOnOutside);
    }
  };
  setTimeout(() => document.addEventListener("click", closeOnOutside), 0);
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
  dot.setAttribute("fill","#fff"); dot.setAttribute("stroke",isActive?theme().handle:theme().bg);
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
      const nc = {id:uid("c"), from:fromId, to:target.id, style:S.lineStyle, wp:[],
        startArrow:S.connDefaults.startArrow, endArrow:S.connDefaults.endArrow,
        color:S.connDefaults.color, width:S.connDefaults.width, opacity:S.connDefaults.opacity, radius:S.connDefaults.radius};
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
    if(node._dragged && node.type !== "text") showNodeFloat(node);
    start=null; pre=null; off(mv,up);
  };
  g.addEventListener("mousedown",dn);
  g.addEventListener("touchstart",dn,{passive:true});
}

// ================================================================
// SHAPE GEOMETRY (shared by canvas + PNG export)
// ================================================================

function labelY(node) {
  if (node.type === "list")  return node.y + Math.min(node.h*.22, 32)/2 + 4;
  if (node.type === "group") return node.y + 16;
  return node.y + node.h/2 + 5;
}
function labelX(node) {
  if (node.type === "group") return node.x + 10;
  return node.x + node.w/2;
}
function labelAnchor(node) {
  if (node.type === "group") return "start";
  return "middle";
}

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
    case "group": {
      const g=svgEl("g");
      const rect=mkEl("rect",{x,y,width:w,height:h,rx:6,"stroke-dasharray":"8 4"});
      g.appendChild(rect);
      return g;
    }
    case "text":          return mkEl("rect",{x,y,width:w,height:h,rx:4,"stroke-dasharray":"3 2",stroke:"rgba(212,255,58,0.3)","stroke-width":"0.8"});
    case "image":         return mkEl("rect",{x,y,width:w,height:h,rx:4});
    case "sync": {
      const r=Math.min(w,h)*.35, g=svgEl("g");
      g.appendChild(mkEl("path",{d:`M${cx+r} ${cy} A${r} ${r} 0 1 1 ${cx} ${cy-r}`,fill:"none"}));
      g.appendChild(mkEl("polygon",{points:`${cx-4},${cy-r-5} ${cx},${cy-r} ${cx-4},${cy-r+5}`}));
      g.appendChild(mkEl("path",{d:`M${cx-r} ${cy} A${r} ${r} 0 1 1 ${cx} ${cy+r}`,fill:"none"}));
      g.appendChild(mkEl("polygon",{points:`${cx+4},${cy+r-5} ${cx},${cy+r} ${cx+4},${cy+r+5}`}));
      return g;
    }
    case "key": {
      const r=Math.min(w,h)*.22, g=svgEl("g");
      g.appendChild(mkEl("circle",{cx:x+r+w*.08,cy,r}));
      g.appendChild(mkEl("line",{x1:x+r*2+w*.08,y1:cy,x2:x+w*.92,y2:cy}));
      g.appendChild(mkEl("line",{x1:x+w*.72,y1:cy-h*.18,x2:x+w*.72,y2:cy+h*.18}));
      g.appendChild(mkEl("line",{x1:x+w*.85,y1:cy-h*.18,x2:x+w*.85,y2:cy+h*.18}));
      return g;
    }
    case "server": {
      const g=svgEl("g"), sh=(h-8)/3;
      for(let i=0;i<3;i++){
        g.appendChild(mkEl("rect",{x:x+2,y:y+2+i*(sh+2),width:w-4,height:sh,rx:4}));
        g.appendChild(mkEl("circle",{cx:x+14,cy:y+2+i*(sh+2)+sh/2,r:3}));
      }
      return g;
    }
    case "shield":        return mkEl("path",{d:`M${cx} ${y}L${x+w} ${y+h*.25}V${y+h*.55}C${x+w} ${y+h*.8} ${cx} ${y+h} ${cx} ${y+h}C${cx} ${y+h} ${x} ${y+h*.8} ${x} ${y+h*.55}V${y+h*.25}Z`});
    case "lock": {
      const bw=w*.7, bh=h*.45, bx=x+(w-bw)/2, by=y+h*.5, g=svgEl("g");
      g.appendChild(mkEl("rect",{x:bx,y:by,width:bw,height:bh,rx:5}));
      g.appendChild(mkEl("path",{d:`M${bx+bw*.18} ${by}V${y+h*.3}A${bw*.32} ${bw*.32} 0 0 1 ${bx+bw*.82} ${y+h*.3}V${by}`,fill:"none"}));
      return g;
    }
    case "play":          return mkEl("polygon",{points:`${x+w*.2},${y+h*.1} ${x+w*.85},${cy} ${x+w*.2},${y+h*.9}`});
    case "api":           return mkEl("rect",{x,y,width:w,height:h,rx:8});
    case "chevron":       { const c=Math.min(w*.28,40); return mkEl("polygon",{points:`${x},${y} ${x+w-c},${y} ${x+w},${cy} ${x+w-c},${y+h} ${x},${y+h} ${x+c},${cy}`}); }
    case "arrowUp": {
      const g=svgEl("g"), tw=w*.32, sh=h*.32, ax=x+w*.05, ay=y+h*.95, bx=x+w*.95, by=y+h*.05;
      g.appendChild(mkEl("line",{x1:ax,y1:ay,x2:bx,y2:by}));
      g.appendChild(mkEl("polyline",{points:`${bx-tw},${by} ${bx},${by} ${bx},${by+tw}`,fill:"none"}));
      return g;
    }
    case "list": {
      const g=svgEl("g"), hh=Math.min(h*.22,32);
      g.appendChild(mkEl("rect",{x,y,width:w,height:h,rx:2}));
      g.appendChild(mkEl("line",{x1:x,y1:y+hh,x2:x+w,y2:y+hh}));
      const rows=3, rh=(h-hh)/rows;
      for(let i=1;i<rows;i++) g.appendChild(mkEl("line",{x1:x,y1:y+hh+rh*i,x2:x+w,y2:y+hh+rh*i,"stroke-width":"0.75",opacity:"0.5"}));
      for(let i=0;i<rows;i++) {
        const t=mkEl("text",{x:x+14,y:y+hh+rh*i+rh/2+4,"font-size":"11","font-family":"JetBrains Mono,monospace","stroke-width":"0"});
        t.textContent = `Item ${i+1}`;
        g.appendChild(t);
      }
      return g;
    }
    case "speechRect":    { const bH=h*.78, tw=w*.16, tx=x+w*.22; return mkEl("path",{d:`M${x} ${y}H${x+w}V${y+bH}H${tx+tw}L${tx} ${y+h}V${y+bH}H${x}Z`}); }
    case "smiley": {
      const r=Math.min(w,h)/2, g=svgEl("g");
      g.appendChild(mkEl("circle",{cx,cy,r}));
      g.appendChild(mkEl("ellipse",{cx:cx-r*.35,cy:cy-r*.15,rx:r*.09,ry:r*.13,fill:"currentColor"}));
      g.appendChild(mkEl("ellipse",{cx:cx+r*.35,cy:cy-r*.15,rx:r*.09,ry:r*.13,fill:"currentColor"}));
      g.appendChild(mkEl("path",{d:`M${cx-r*.45} ${cy+r*.15}Q${cx} ${cy+r*.65} ${cx+r*.45} ${cy+r*.15}`,fill:"none"}));
      return g;
    }
    case "elbow": {
      const g=svgEl("g"), ax=x+w*.1, ay=y+h*.95, mx=x+w*.45, my=y+h*.95, bx=x+w*.95, by=y+h*.08;
      g.appendChild(mkEl("path",{d:`M${ax} ${ay}H${mx}L${bx} ${by}`,fill:"none"}));
      g.appendChild(mkEl("circle",{cx:bx,cy:by,r:3,fill:"none"}));
      return g;
    }
    case "relationship": {
      const g=svgEl("g"), dw=w*.5, half=h/2;
      g.appendChild(mkEl("line",{x1:x,y1:cy,x2:x+w,y2:cy}));
      g.appendChild(mkEl("polygon",{points:`${cx-dw/2},${cy} ${cx},${y} ${cx+dw/2},${cy} ${cx},${y+h}`}));
      return g;
    }
    case "envelope": { const g=svgEl("g"); g.appendChild(mkEl("rect",{x,y,width:w,height:h,rx:2})); g.appendChild(mkEl("path",{d:`M${x} ${y}L${cx} ${y+h*.55}L${x+w} ${y}`,fill:"none"})); return g; }
    case "check":         return mkEl("path",{d:`M${x+w*.12} ${y+h*.55}L${x+w*.4} ${y+h*.85}L${x+w*.9} ${y+h*.12}`,fill:"none"});
    case "doubleArrow": {
      const g=svgEl("g"), tw=Math.min(h*.45,26), hx=Math.min(w*.18,34);
      g.appendChild(mkEl("line",{x1:x+hx,y1:cy,x2:x+w-hx,y2:cy}));
      g.appendChild(mkEl("polygon",{points:`${x+hx},${y} ${x},${cy} ${x+hx},${y+h}`}));
      g.appendChild(mkEl("polygon",{points:`${x+w-hx},${y} ${x+w},${cy} ${x+w-hx},${y+h}`}));
      return g;
    }
    case "banner": {
      const bh=h*.8;
      const d=`M${x} ${y}H${x+w}V${y+bh}C${x+w*.75} ${y+h} ${x+w*.6} ${y+bh-h*.12} ${x+w*.42} ${y+bh}C${x+w*.28} ${y+bh+h*.1} ${x+w*.12} ${y+h} ${x} ${y+bh}Z`;
      return mkEl("path",{d});
    }
    default:              return mkEl("rect",{x,y,width:w,height:h,rx:6});
  }
}

// ================================================================
// CONNECTOR PATH
// ================================================================

function buildPath(p1, p2, style, wp, radius) {
  const pts = [p1, ...(wp||[]), p2];
  if (style === "curved") {
    return curvedPath(pts);
  }
  if (style === "orthogonal") {
    const corners = [pts[0]];
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],mx=a.x+(b.x-a.x)/2;
      corners.push({x:mx,y:a.y}, {x:mx,y:b.y}, b);
    }
    return roundedPath(corners, radius || 0);
  }
  return `M${pts[0].x} ${pts[0].y} `+pts.slice(1).map(p=>`L${p.x} ${p.y}`).join(" ");
}

/** Smooth spline through every point (endpoints + any dragged waypoints). Unlike a
 *  purely-horizontal S-curve, this bends based on the full 2D position of each
 *  waypoint — so a single waypoint dragged to the side is enough to route a
 *  connector around an obstacle in between, even when the two endpoints are
 *  vertically (or diagonally) aligned. Falls back to a gentle horizontal S-curve
 *  when there are no waypoints, matching the previous look for plain two-point lines. */
function curvedPath(pts, tension = 6) {
  if (pts.length < 2) return "";
  if (pts.length === 2) {
    const a = pts[0], b = pts[1], dx = b.x - a.x;
    return `M${a.x} ${a.y} C${a.x+dx*.5} ${a.y},${a.x+dx*.5} ${b.y},${b.x} ${b.y}`;
  }
  let d = `M${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / tension, c1y = p1.y + (p2.y - p0.y) / tension;
    const c2x = p2.x - (p3.x - p1.x) / tension, c2y = p2.y - (p3.y - p1.y) / tension;
    d += ` C${c1x} ${c1y},${c2x} ${c2y},${p2.x} ${p2.y}`;
  }
  return d;
}

/** Builds a polyline path with rounded (arc-style) interior corners — used to give
 *  orthogonal/right-angle connectors Miro-style adjustable corner radii. Falls back
 *  to plain straight segments when radius is 0. */
function roundedPath(rawPoints, radius) {
  // Drop consecutive duplicate points (common when a segment has zero length)
  const points = rawPoints.filter((p, i) => i === 0 || Math.hypot(p.x-rawPoints[i-1].x, p.y-rawPoints[i-1].y) > 0.5);
  if (!points.length) return "";
  if (!radius || points.length < 3) {
    return `M${points[0].x} ${points[0].y} ` + points.slice(1).map(p=>`L${p.x} ${p.y}`).join(" ");
  }
  let d = `M${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i-1], cur = points[i], next = points[i+1];
    const d1 = Math.hypot(cur.x-prev.x, cur.y-prev.y);
    const d2 = Math.hypot(next.x-cur.x, next.y-cur.y);
    const r = Math.min(radius, d1/2, d2/2);
    if (r <= 0.5) { d += ` L${cur.x} ${cur.y}`; continue; }
    const inX = cur.x + (prev.x-cur.x)/d1*r, inY = cur.y + (prev.y-cur.y)/d1*r;
    const outX = cur.x + (next.x-cur.x)/d2*r, outY = cur.y + (next.y-cur.y)/d2*r;
    d += ` L${inX} ${inY} Q${cur.x} ${cur.y} ${outX} ${outY}`;
  }
  const last = points[points.length-1];
  d += ` L${last.x} ${last.y}`;
  return d;
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
  if (S.exportBorder) {
    const bw = 3;
    svg += `<rect x="${bw/2}" y="${bw/2}" width="${w-bw}" height="${h-bw}" fill="none" stroke="${t.stroke}" stroke-width="${bw}"/>`;
  }
  svg += `<defs><marker id="ea" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="ea-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>`;
  svg += `<marker id="ea-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="ea-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-arrow" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><path d="M9 0L0 4.5L9 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>`;
  svg += `<marker id="es-filled" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><polygon points="9 0,0 4.5,9 9" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>`;
  svg += `<marker id="es-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>`;
  svg += `</defs>`;

  // Custom-colored connectors need their own arrowhead markers so exported PNGs
  // match what's shown on the canvas instead of falling back to the theme color.
  let extraMarkers = "";
  const seenMarkerIds = new Set();
  function exportMarkerId(arrowType, color, isStart) {
    const safeColor = color.replace(/[^a-zA-Z0-9]/g, "");
    const id = `ea-c-${safeColor}-${isStart ? "s-" : ""}${arrowType}`;
    if (!seenMarkerIds.has(id)) {
      seenMarkerIds.add(id);
      const orient = isStart ? "auto-start-reverse" : "auto";
      if (arrowType === "arrow") {
        extraMarkers += `<marker id="${id}" markerWidth="9" markerHeight="9" refX="${isStart?2:7}" refY="4.5" orient="${orient}">${isStart?`<path d="M9 0L0 4.5L9 9" fill="none" stroke="${color}" stroke-width="1.5"/>`:`<path d="M0 0L9 4.5L0 9" fill="none" stroke="${color}" stroke-width="1.5"/>`}</marker>`;
      } else if (arrowType === "diamond") {
        extraMarkers += `<marker id="${id}" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="${orient}"><polygon points="0,5 5,0 10,5 5,10" fill="${color}"/></marker>`;
      } else if (arrowType === "circle") {
        extraMarkers += `<marker id="${id}" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="${orient}"><circle cx="4" cy="4" r="3" fill="${color}"/></marker>`;
      } else {
        extraMarkers += `<marker id="${id}" markerWidth="9" markerHeight="9" refX="${isStart?2:7}" refY="4.5" orient="${orient}">${isStart?`<polygon points="9 0,0 4.5,9 9" fill="${color}"/>`:`<polygon points="0 0,9 4.5,0 9" fill="${color}"/>`}</marker>`;
      }
    }
    return id;
  }
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
    if (c.color) {
      if (endA !== "none") markers += ` marker-end="url(#${exportMarkerId(endA, c.color, false)})"`;
      if (startA !== "none") markers += ` marker-start="url(#${exportMarkerId(startA, c.color, true)})"`;
    } else {
      if (endA === "filled") markers += ` marker-end="url(#ea)"`;
      else if (endA !== "none") markers += ` marker-end="url(#ea-${endA})"`;
      if (startA !== "none") markers += ` marker-start="url(#es-${startA})"`;
    }
    const cStyle = c.style || "straight";
    const cLsDef = LINE_STYLES.find(ls => ls.key === cStyle);
    const cPathStyle = cLsDef && cLsDef.base ? cLsDef.base : cStyle;
    const dashAttr = cLsDef && cLsDef.dash ? ` stroke-dasharray="${cLsDef.dash}"` : "";
    const cColor = c.color || t.stroke;
    const cWidth = c.width || 2;
    const cOpacity = (c.opacity != null ? c.opacity : 100) / 100;
    svg += `<path d="${buildPath(p1,p2,cPathStyle,wp,c.radius||0)}" fill="none" stroke="${cColor}" stroke-width="${cWidth}" opacity="${cOpacity}"${markers}${dashAttr}/>`;
  });

  S.nodes.forEach(n => {
    const fill = (n.type==="text" || n.type==="group") ? "transparent" : (n.fill||t.fill);
    const stroke = (n.type==="text") ? "none" : t.stroke;
    const rot = n.rotate ? `rotate(${n.rotate},${n.x+n.w/2},${n.y+n.h/2})` : null;
    if (rot) svg += `<g transform="${rot}">`;
    svg += shapeToSvgStr(n, fill, stroke);
    const fontSize = n.fontSize || 12;
    const tc = n.textColor || (lightOrDark(fill)==="dark"?t.text:"#0c0b09");
    svg += `<text x="${labelX(n)}" y="${labelY(n)}" text-anchor="${labelAnchor(n)}" fill="${tc}" font-size="${fontSize}" font-family="JetBrains Mono,monospace">${escXml(n.label)}</text>`;
    if (rot) svg += `</g>`;
  });

  svg += "</g>";
  if (extraMarkers) svg += `<defs>${extraMarkers}</defs>`;
  svg += "</svg>";

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
  // Per-node stroke color override
  const effectiveStroke = node.strokeColor || stroke;
  // Per-node border dash
  const bsDef = BORDER_STYLES.find(b => b.key === node.borderStyle);
  const dashAttr = (bsDef && bsDef.dash) ? ` stroke-dasharray="${bsDef.dash}"` : "";
  const fa=`fill="${fill}"`;
  const sa = effectiveStroke === "none" ? "" : `stroke="${effectiveStroke}" stroke-width="1.5"${dashAttr}`;
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
    case "group":   return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="transparent" stroke="${effectiveStroke}" stroke-width="2" stroke-dasharray="${(bsDef && bsDef.dash) ? bsDef.dash : "8 4"}"/>`;
    case "text": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="transparent"/>`;
    case "image": return node.imageData ? `<image href="${node.imageData}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>` : "";
    case "sync": { const r=Math.min(w,h)*.35; return `<g ${sa} fill="none"><path d="M${cx+r} ${cy} A${r} ${r} 0 1 1 ${cx} ${cy-r}"/><polygon points="${cx-4},${cy-r-5} ${cx},${cy-r} ${cx-4},${cy-r+5}" ${fa}/><path d="M${cx-r} ${cy} A${r} ${r} 0 1 1 ${cx} ${cy+r}"/><polygon points="${cx+4},${cy+r-5} ${cx},${cy+r} ${cx+4},${cy+r+5}" ${fa}/></g>`; }
    case "key": { const r=Math.min(w,h)*.22; return `<g ${fa} ${sa}><circle cx="${x+r+w*.08}" cy="${cy}" r="${r}"/><line x1="${x+r*2+w*.08}" y1="${cy}" x2="${x+w*.92}" y2="${cy}"/><line x1="${x+w*.72}" y1="${cy-h*.18}" x2="${x+w*.72}" y2="${cy+h*.18}"/><line x1="${x+w*.85}" y1="${cy-h*.18}" x2="${x+w*.85}" y2="${cy+h*.18}"/></g>`; }
    case "server": { let s=""; const sh=(h-8)/3; for(let i=0;i<3;i++) s+=`<rect x="${x+2}" y="${y+2+i*(sh+2)}" width="${w-4}" height="${sh}" rx="4" ${fa} ${sa}/>`; return s; }
    case "shield": return `<path d="M${cx} ${y}L${x+w} ${y+h*.25}V${y+h*.55}C${x+w} ${y+h*.8} ${cx} ${y+h} ${cx} ${y+h}C${cx} ${y+h} ${x} ${y+h*.8} ${x} ${y+h*.55}V${y+h*.25}Z" ${fa} ${sa}/>`;
    case "lock": { const bw=w*.7,bh=h*.45,bx=x+(w-bw)/2,by=y+h*.5; return `<g ${fa} ${sa}><rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="5"/><path d="M${bx+bw*.18} ${by}V${y+h*.3}A${bw*.32} ${bw*.32} 0 0 1 ${bx+bw*.82} ${y+h*.3}V${by}" fill="none"/></g>`; }
    case "play": return `<polygon points="${x+w*.2},${y+h*.1} ${x+w*.85},${cy} ${x+w*.2},${y+h*.9}" ${fa} ${sa}/>`;
    case "api": return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" ${fa} ${sa}/>`;
    case "chevron": { const c=Math.min(w*.28,40); return `<polygon points="${x},${y} ${x+w-c},${y} ${x+w},${cy} ${x+w-c},${y+h} ${x},${y+h} ${x+c},${cy}" ${fa} ${sa}/>`; }
    case "arrowUp": { const tw=w*.32, ax=x+w*.05, ay=y+h*.95, bx=x+w*.95, by=y+h*.05; return `<g ${sa} fill="none"><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/><polyline points="${bx-tw},${by} ${bx},${by} ${bx},${by+tw}"/></g>`; }
    case "list": {
      const hh=Math.min(h*.22,32), rows=3, rh=(h-hh)/rows;
      let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" ${fa} ${sa}/><line x1="${x}" y1="${y+hh}" x2="${x+w}" y2="${y+hh}" ${sa}/>`;
      for(let i=1;i<rows;i++) s+=`<line x1="${x}" y1="${y+hh+rh*i}" x2="${x+w}" y2="${y+hh+rh*i}" stroke="${stroke}" stroke-width="0.75" opacity="0.5"/>`;
      for(let i=0;i<rows;i++) s+=`<text x="${x+14}" y="${y+hh+rh*i+rh/2+4}" font-size="11" font-family="JetBrains Mono,monospace" fill="${stroke}">Item ${i+1}</text>`;
      return s;
    }
    case "speechRect": { const bH=h*.78, tw=w*.16, tx=x+w*.22; return `<path d="M${x} ${y}H${x+w}V${y+bH}H${tx+tw}L${tx} ${y+h}V${y+bH}H${x}Z" ${fa} ${sa}/>`; }
    case "smiley": { const r=Math.min(w,h)/2; return `<g ${sa}><circle cx="${cx}" cy="${cy}" r="${r}" ${fa}/><ellipse cx="${cx-r*.35}" cy="${cy-r*.15}" rx="${r*.09}" ry="${r*.13}" fill="${stroke}" stroke="none"/><ellipse cx="${cx+r*.35}" cy="${cy-r*.15}" rx="${r*.09}" ry="${r*.13}" fill="${stroke}" stroke="none"/><path d="M${cx-r*.45} ${cy+r*.15}Q${cx} ${cy+r*.65} ${cx+r*.45} ${cy+r*.15}" fill="none"/></g>`; }
    case "elbow": { const ax=x+w*.1, ay=y+h*.95, mx=x+w*.45, my=y+h*.95, bx=x+w*.95, by=y+h*.08; return `<g ${sa} fill="none"><path d="M${ax} ${ay}H${mx}L${bx} ${by}"/><circle cx="${bx}" cy="${by}" r="3"/></g>`; }
    case "relationship": { const dw=w*.5; return `<g ${fa} ${sa}><line x1="${x}" y1="${cy}" x2="${x+w}" y2="${cy}"/><polygon points="${cx-dw/2},${cy} ${cx},${y} ${cx+dw/2},${cy} ${cx},${y+h}"/></g>`; }
    case "envelope": return `<g ${fa} ${sa}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/><path d="M${x} ${y}L${cx} ${y+h*.55}L${x+w} ${y}" fill="none"/></g>`;
    case "check": return `<path d="M${x+w*.12} ${y+h*.55}L${x+w*.4} ${y+h*.85}L${x+w*.9} ${y+h*.12}" fill="none" ${sa}/>`;
    case "doubleArrow": { const tw2=Math.min(h*.45,26), hx=Math.min(w*.18,34); return `<g ${fa} ${sa}><line x1="${x+hx}" y1="${cy}" x2="${x+w-hx}" y2="${cy}"/><polygon points="${x+hx},${y} ${x},${cy} ${x+hx},${y+h}"/><polygon points="${x+w-hx},${y} ${x+w},${cy} ${x+w-hx},${y+h}"/></g>`; }
    case "banner": {
      const bh=h*.8;
      const d=`M${x} ${y}H${x+w}V${y+bh}C${x+w*.75} ${y+h} ${x+w*.6} ${y+bh-h*.12} ${x+w*.42} ${y+bh}C${x+w*.28} ${y+bh+h*.1} ${x+w*.12} ${y+h} ${x} ${y+bh}Z`;
      return `<path d="${d}" ${fa} ${sa}/>`;
    }
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
    connectors: S.conns.map(({id,from,to,style,wp,startArrow,endArrow,fromPt,toPt,color,width,opacity,radius})=>({id,from,to,style,wp:wp||[],startArrow:startArrow||"none",endArrow:endArrow||"filled",fromPt:fromPt||null,toPt:toPt||null,color:color||null,width:width||2,opacity:opacity!=null?opacity:100,radius:radius||0})),
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
  S.conns = (d.connectors || []).map(normConn);
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

/** Lazily creates (and caches) an arrowhead marker matching a custom connector color,
 *  appending it to the canvas <defs> the first time it's needed. Returns the marker id. */
const _colorMarkerCache = new Set();
function ensureColorMarker(arrowType, color, isStart) {
  const safeColor = color.replace(/[^a-zA-Z0-9]/g, "");
  const id = `ah-c-${safeColor}-${isStart ? "s-" : ""}${arrowType}`;
  if (_colorMarkerCache.has(id)) return id;
  const defs = el.svg.querySelector("defs");
  const orient = isStart ? "auto-start-reverse" : "auto";
  const marker = svgEl("marker");
  marker.setAttribute("id", id);
  marker.setAttribute("markerWidth", arrowType === "diamond" || arrowType === "circle" ? "10" : "9");
  marker.setAttribute("markerHeight", arrowType === "diamond" || arrowType === "circle" ? "10" : "9");
  marker.setAttribute("orient", orient);
  let inner;
  if (arrowType === "arrow") {
    marker.setAttribute("refX", isStart ? "2" : "7"); marker.setAttribute("refY", "4.5");
    inner = isStart
      ? `<path d="M9 0L0 4.5L9 9" fill="none" stroke="${color}" stroke-width="1.5"/>`
      : `<path d="M0 0L9 4.5L0 9" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  } else if (arrowType === "diamond") {
    marker.setAttribute("refX", "5"); marker.setAttribute("refY", "5");
    inner = `<polygon points="0,5 5,0 10,5 5,10" fill="${color}"/>`;
  } else if (arrowType === "circle") {
    marker.setAttribute("refX", "4"); marker.setAttribute("refY", "4");
    inner = `<circle cx="4" cy="4" r="3" fill="${color}"/>`;
  } else {
    // filled (default)
    marker.setAttribute("refX", isStart ? "2" : "7"); marker.setAttribute("refY", "4.5");
    inner = isStart ? `<polygon points="9 0,0 4.5,9 9" fill="${color}"/>` : `<polygon points="0 0,9 4.5,0 9" fill="${color}"/>`;
  }
  marker.innerHTML = inner;
  defs.appendChild(marker);
  _colorMarkerCache.add(id);
  return id;
}
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

/** Exported: renders any diagram object to a PNG data URL using the full shape engine */
export async function renderDiagramToPng(diagram) {
  const nodes = diagram.nodes || [];
  const conns  = diagram.conns  || [];
  if (!nodes.length && !conns.length) return null;

  const themeKey = diagram.theme || "dark";
  const t = THEMES.find(th => th.key === themeKey) || THEMES[0];

  // Compute bounding box
  const PAD = 40;
  const xs = nodes.flatMap(n=>[n.x,n.x+n.w]);
  const ys = nodes.flatMap(n=>[n.y,n.y+n.h]);
  const minX=Math.min(...xs), minY=Math.min(...ys);
  const maxX=Math.max(...xs), maxY=Math.max(...ys);
  const w=maxX-minX+PAD*2, h=maxY-minY+PAD*2;
  const ox=PAD-minX, oy=PAD-minY;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">`;
  svg += `<rect width="${w}" height="${h}" fill="${t.bg}"/>`;
  svg += `<defs>
    <marker id="ea" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><polygon points="0 0,9 4.5,0 9" fill="${t.stroke}"/></marker>
    <marker id="ea-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L9 4.5L0 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>
    <marker id="ea-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>
    <marker id="ea-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>
    <marker id="es-arrow" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><path d="M9 0L0 4.5L9 9" fill="none" stroke="${t.stroke}" stroke-width="1.5"/></marker>
    <marker id="es-filled" markerWidth="9" markerHeight="9" refX="2" refY="4.5" orient="auto-start-reverse"><polygon points="9 0,0 4.5,9 9" fill="${t.stroke}"/></marker>
    <marker id="es-diamond" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse"><polygon points="0,5 5,0 10,5 5,10" fill="${t.stroke}"/></marker>
    <marker id="es-circle" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto-start-reverse"><circle cx="4" cy="4" r="3" fill="${t.stroke}"/></marker>
  </defs>`;
  svg += `<g transform="translate(${ox},${oy})">`;

  conns.forEach(c => {
    const fn = c.from ? nodes.find(n=>n.id===c.from) : null;
    const tn = c.to   ? nodes.find(n=>n.id===c.to)   : null;
    if (c.from&&!fn) return; if (c.to&&!tn) return;
    const wp = c.wp||[];
    let p1, p2;
    if (fn) { const aim=wp.length?wp[0]:(tn?center(tn):(c.toPt||{x:0,y:0}));   p1=edgePt(fn,aim.x,aim.y); } else { p1=c.fromPt||{x:0,y:0}; }
    if (tn) { const aim=wp.length?wp[wp.length-1]:(fn?center(fn):(c.fromPt||{x:0,y:0})); p2=edgePt(tn,aim.x,aim.y); } else { p2=c.toPt||{x:0,y:0}; }
    let markers="";
    const endA=c.endArrow||"filled", startA=c.startArrow||"none";
    if (endA==="filled") markers+=` marker-end="url(#ea)"`;
    else if (endA!=="none") markers+=` marker-end="url(#ea-${endA})"`;
    if (startA!=="none") markers+=` marker-start="url(#es-${startA})"`;
    const cStyle=c.style||"straight";
    const cLsDef=LINE_STYLES.find(ls=>ls.key===cStyle);
    const cPathStyle=cLsDef&&cLsDef.base?cLsDef.base:cStyle;
    const dashAttr=cLsDef&&cLsDef.dash?` stroke-dasharray="${cLsDef.dash}"`:"";
    svg += `<path d="${buildPath(p1,p2,cPathStyle,wp)}" fill="none" stroke="${t.stroke}" stroke-width="1.5"${markers}${dashAttr}/>`;
    if (c.label) {
      const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
      svg += `<text x="${mx}" y="${my-6}" text-anchor="middle" fill="${t.text}" font-size="11" font-family="JetBrains Mono,monospace">${escXml(c.label)}</text>`;
    }
  });

  nodes.forEach(n => {
    const fill=(n.type==="text"||n.type==="group")?"transparent":(n.fill||t.fill);
    const stroke=(n.type==="text")?"none":(n.strokeColor||t.stroke);
    const rot=n.rotate?`rotate(${n.rotate},${n.x+n.w/2},${n.y+n.h/2})`:null;
    if (rot) svg+=`<g transform="${rot}">`;
    svg+=shapeToSvgStr(n,fill,stroke);
    const fontSize=n.fontSize||12;
    const tc=n.textColor||(lightOrDark(fill)==="dark"?t.text:"#0c0b09");
    svg+=`<text x="${labelX(n)}" y="${labelY(n)}" text-anchor="${labelAnchor(n)}" fill="${tc}" font-size="${fontSize}" font-family="JetBrains Mono,monospace">${escXml(n.label)}</text>`;
    if (rot) svg+=`</g>`;
  });

  svg+="</g></svg>";
  return svg2png(svg, w, h);
}

function toast(msg) {
  let t = document.getElementById("dd-toast");
  if(!t){t=document.createElement("div");t.id="dd-toast";t.className="toast";document.body.appendChild(t);}
  t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2000);
}
