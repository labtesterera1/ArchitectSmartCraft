/**
 * modules/analyze-diagram/analyze-diagram.js
 * ----------------------------------------------------------------
 * AnalyzeDiagram module v3 — upload an existing diagram image and
 * get an explanation in one of three styles, chosen via toggle
 * buttons:
 *   - steps      : plain step-by-step walkthrough
 *   - example    : a real-world worked example following the flow
 *   - suggestions: best-practice notes / things to watch for
 *
 * v3 changes (v2.9.0):
 *   - Overhauled prompts — structured output, zero filler
 *   - Download analysis as PDF (styled print page) or text file
 *   - Animated loading skeleton during AI calls
 *   - Retry button on API errors with smart hints
 *   - Markdown → HTML rendering (headings, bold, lists, code)
 *   - Provider badge on each explanation
 *   - Drag-and-drop image upload
 *   - Backward-compatible with old saved analyses
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";
import { loadApiConfig } from "../settings/settings.js";
import { renderDiagramToPng } from "../create-diagram/create-diagram.js";

/* ── Style definitions ─────────────────────────────────────────── */

const STYLES = [
  { key: "steps",       label: "Step-by-step",       icon: "①" },
  { key: "example",     label: "Real-world example",  icon: "◉" },
  { key: "suggestions", label: "Suggestions",         icon: "◆" },
  { key: "live",        label: "Live Diagram",        icon: "⬡" },
];

/* ── System prompt (shared across all styles) ──────────────────── */

const SYSTEM_PROMPT =
  `You are a senior solutions architect analyzing a software architecture or flow diagram. ` +
  `Your audience is a developer or technical lead who wants clear, actionable understanding.\n\n` +
  `STRICT RULES — follow every one:\n` +
  `1. Jump straight into the analysis. NEVER start with filler like "Sure!", "Great question", ` +
     `"Let me explain", "Here are some", "Let's walk through", or any greeting/preamble.\n` +
  `2. Start your response with a Markdown heading (## heading).\n` +
  `3. Reference the ACTUAL component names, service names, labels, and arrows visible in the image.\n` +
  `4. Use the EXACT names shown in the diagram — do not rename or generalize them.\n` +
  `5. Use Markdown formatting throughout: ## for section headings, **bold** for component names, ` +
     `numbered lists for steps, bullet lists (- item) for suggestions.\n` +
  `6. If you cannot clearly read a label or part of the diagram, say so — do not guess.\n` +
  `7. Be concise and professional. Every sentence should add information.`;

/* ── Per-style user prompts ────────────────────────────────────── */

const STYLE_PROMPTS = {
  steps:
    `Analyze this architecture/flow diagram and produce a **numbered step-by-step walkthrough**.\n\n` +
    `Required structure (use these exact headings):\n\n` +
    `## Overview\n` +
    `One sentence: what this system does.\n\n` +
    `## Flow\n` +
    `Numbered steps. Each step must name the **source component**, the action/data that moves, ` +
    `and the **destination component**. At decision/branch points, use indented sub-steps and ` +
    `label each branch. Keep each step to 1–2 sentences.\n\n` +
    `## Key Components\n` +
    `Bullet list of every distinct component with a one-line role description.\n\n` +
    `IMPORTANT: Start immediately with "## Overview" — no preamble.`,

  example:
    `Analyze this architecture/flow diagram by walking through **one concrete, realistic example** ` +
    `from start to finish.\n\n` +
    `Required structure (use these exact headings):\n\n` +
    `## Scenario\n` +
    `Describe the specific situation — invent a realistic user/request/event with a name ` +
    `(e.g. "Priya submits an order for 3 items").\n\n` +
    `## Walkthrough\n` +
    `Narrate what happens at each stage. Reference actual component names from the diagram in **bold**. ` +
    `At each component, describe what it does to the data/request. Pick the main success path, ` +
    `then briefly note alternate/error paths.\n\n` +
    `## Result\n` +
    `What the end-user sees or what state the system reaches when the flow completes.\n\n` +
    `IMPORTANT: Start immediately with "## Scenario" — no preamble. Write as a technical narrative, not a list.`,

  suggestions:
    `Analyze this architecture/flow diagram and provide **practical architectural suggestions**.\n\n` +
    `Required structure (use these exact headings):\n\n` +
    `## Assessment\n` +
    `2-sentence summary of the architecture's overall approach and maturity level.\n\n` +
    `## Potential Issues\n` +
    `Bullet list: failure points, bottlenecks, single points of failure, or missing error handling.\n\n` +
    `## Missing Pieces\n` +
    `Things the diagram doesn't show but probably should (monitoring, auth, rate limiting, retries, fallbacks, etc.).\n\n` +
    `## Recommendations\n` +
    `Prioritized, actionable improvements. For each, name the specific component and what to change.\n\n` +
    `## Strengths\n` +
    `2–3 things the architecture does well (be genuine, not boilerplate).\n\n` +
    `IMPORTANT: Start immediately with "## Assessment" — no preamble. Be specific to THIS diagram.`,
};

/* ── Module state ──────────────────────────────────────────────── */

let containerEl        = null;
let pendingImageBase64 = null;
let pendingImageName   = null;
let activeStyle        = "steps";
/** In-memory cache: { [styleKey]: { text, provider } } */
let explanationCache   = {};
let currentAnalysisId  = null;
let isLoading          = false;
/** Live diagram sub-tab state */
let liveSubTab         = "explain";   // "explain" | "visualize"
let liveSummaryCache   = null;        // { data, pngUrl, provider }

/* ── Public entry point ────────────────────────────────────────── */

export function initAnalyzeDiagramView(container) {
  containerEl        = container;
  // Make container scrollable and fill viewport height
  container.style.display        = "flex";
  container.style.flexDirection  = "column";
  container.style.flex           = "1";
  container.style.minHeight      = "0";
  container.style.overflowY      = "auto";
  container.style.padding        = "12px 16px 24px";
  pendingImageBase64 = null;
  pendingImageName   = null;
  activeStyle        = "steps";
  explanationCache   = {};
  currentAnalysisId  = null;
  isLoading          = false;
  render();
}

/* ════════════════════════════════════════════════════════════════
   RENDER
   ════════════════════════════════════════════════════════════════ */

function render() {
  containerEl.innerHTML = `
    <style>${MODULE_CSS}</style>

    <!-- Tab bar: Upload-based tabs + Live Diagram -->
    <div class="adm-tab-bar" id="adm-tab-bar">
      <button class="adm-tab${activeStyle!=="live"?" adm-tab-active":""}" data-tab="upload">⬆ Upload & Analyze</button>
      <button class="adm-tab${activeStyle==="live"?" adm-tab-active":""}" data-tab="live">⬡ Live Diagram</button>
    </div>

    <!-- Upload panel -->
    <div id="adm-upload-panel" style="display:${activeStyle!=="live"?"block":"none"}">
      <div class="panel corner-frame" style="margin-top:8px">
        <span class="label">Upload image</span>
        <label class="adm-upload-zone" id="upload-zone">
          <input type="file" id="upload-input" accept="image/*" style="display:none;" />
          <div class="adm-upload-content">
            <span style="font-size:28px; opacity:0.5;">⬆</span>
            <span style="font-size:13px; color:var(--color-text-secondary);">Click or drag an image here</span>
          </div>
        </label>
        <div id="image-preview-wrap" class="mt-2 hidden">
          <img id="image-preview" style="max-width:100%; border-radius:var(--radius-md); border:1px solid var(--color-border);" />
          <button class="btn mt-1" id="change-image-btn" style="font-size:12px;">Change image</button>
        </div>
        <p id="analyze-status" class="adm-status"></p>
      </div>

      <div class="panel mt-2" id="explanation-panel" style="display:none;">
        <div class="adm-toolbar">
          <div class="flex gap-1" id="style-toggle" style="flex-wrap:wrap;"></div>
          <div class="flex gap-1" id="action-buttons"></div>
        </div>
        <div id="provider-badge" class="adm-provider-badge hidden"></div>
        <div id="loading-skeleton" class="adm-skeleton hidden">
          <div class="adm-skeleton-line w80"></div>
          <div class="adm-skeleton-line w100"></div>
          <div class="adm-skeleton-line w60"></div>
          <div class="adm-skeleton-line w90"></div>
          <div class="adm-skeleton-line w70"></div>
          <div class="adm-skeleton-line w100"></div>
          <div class="adm-skeleton-line w45"></div>
        </div>
        <div id="explanation-text" class="adm-explanation"></div>
      </div>

      <div class="panel mt-2">
        <span class="label">Previous analyses</span>
        <div id="analyses-list"></div>
      </div>
    </div>

    <!-- Live Diagram panel -->
    <div id="adm-live-panel" style="display:${activeStyle==="live"?"block":"none"};margin-top:8px">
      <div id="adm-live-content"></div>
    </div>
  `;

  /* Tab switching */
  document.querySelectorAll(".adm-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".adm-tab").forEach(b => b.classList.remove("adm-tab-active"));
      btn.classList.add("adm-tab-active");
      if (btn.dataset.tab === "live") {
        activeStyle = "live";
        document.getElementById("adm-upload-panel").style.display = "none";
        document.getElementById("adm-live-panel").style.display = "block";
        renderLiveDiagram();
      } else {
        activeStyle = "steps";
        document.getElementById("adm-upload-panel").style.display = "block";
        document.getElementById("adm-live-panel").style.display = "none";
      }
    });
  });

  /* Upload input */
  document.getElementById("upload-input").addEventListener("change", handleFileSelect);

  /* Change-image button */
  const changeBtn = document.getElementById("change-image-btn");
  if (changeBtn) {
    changeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      document.getElementById("upload-input").click();
    });
  }

  /* Drag & drop */
  const zone = document.getElementById("upload-zone");
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("adm-drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("adm-drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("adm-drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFileSelect({ target: { files: [file] } });
  });

  renderStyleToggle();
  renderAnalysesList();

  if (activeStyle === "live") renderLiveDiagram();
}

/* ════════════════════════════════════════════════════════════════
   MODULE CSS
   ════════════════════════════════════════════════════════════════ */

const MODULE_CSS = `
  /* Tab bar */
  .adm-tab-bar {
    display:flex; gap:4px; border-bottom:1px solid var(--color-border);
    margin-bottom:0; padding-bottom:0;
  }
  .adm-tab {
    padding:8px 18px; background:transparent; border:none; border-bottom:2px solid transparent;
    color:var(--color-text-tertiary); font-family:var(--font-mono); font-size:12px;
    letter-spacing:.06em; text-transform:uppercase; cursor:pointer;
    transition:color .15s, border-color .15s; margin-bottom:-1px;
  }
  .adm-tab:hover { color:var(--color-text); }
  .adm-tab.adm-tab-active { color:var(--color-accent); border-bottom-color:var(--color-accent); }

  /* Upload zone */
  .adm-upload-zone {
    display:flex; align-items:center; justify-content:center;
    border:2px dashed var(--color-border); border-radius:var(--radius-md);
    padding:28px 16px; cursor:pointer;
    transition:border-color .2s, background .2s;
  }
  .adm-upload-zone:hover, .adm-drag-over {
    border-color:var(--color-accent) !important;
    background:var(--color-accent-faint);
  }
  .adm-upload-content { display:flex; flex-direction:column; align-items:center; gap:6px; pointer-events:none; }

  /* Toolbar */
  .adm-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px; }

  /* Status line */
  .adm-status { font-size:12px; color:var(--color-text-tertiary); margin-top:8px; }

  /* Provider badge */
  .adm-provider-badge {
    display:inline-block; font-size:11px; padding:2px 10px;
    border-radius:20px; margin-bottom:10px;
    background:var(--color-accent-faint); color:var(--color-accent);
    font-family:var(--font-mono); letter-spacing:.03em;
  }
  .adm-provider-badge.hidden { display:none; }

  /* Loading skeleton */
  .adm-skeleton { display:flex; flex-direction:column; gap:10px; }
  .adm-skeleton.hidden { display:none; }
  .adm-skeleton-line {
    height:14px; border-radius:4px;
    background:linear-gradient(90deg,var(--color-bg-raised) 25%,rgba(212,255,58,.08) 50%,var(--color-bg-raised) 75%);
    background-size:200% 100%;
    animation:adm-shimmer 1.5s ease-in-out infinite;
  }
  .w100{width:100%} .w90{width:90%} .w80{width:80%}
  .w70{width:70%} .w60{width:60%} .w45{width:45%}
  @keyframes adm-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }

  /* ── Explanation text — rendered Markdown ────────────── */
  .adm-explanation { font-size:14px; line-height:1.75; }
  .adm-explanation h2 {
    font-size:17px; margin:20px 0 8px 0; padding-bottom:4px;
    color:var(--color-accent); font-family:var(--font-serif);
    border-bottom:1px solid var(--color-border);
  }
  .adm-explanation h3 {
    font-size:15px; margin:16px 0 6px 0;
    color:var(--color-text); font-family:var(--font-serif);
  }
  .adm-explanation ul, .adm-explanation ol {
    padding-left:22px; margin:8px 0;
  }
  .adm-explanation li { margin:5px 0; color:var(--color-text-secondary); }
  .adm-explanation li strong { color:var(--color-text); }
  .adm-explanation strong { color:var(--color-text); }
  .adm-explanation p { margin:8px 0; color:var(--color-text-secondary); }
  .adm-explanation code {
    background:var(--color-bg-inset); padding:1px 5px; border-radius:3px;
    font-family:var(--font-mono); font-size:13px; color:var(--color-accent);
  }
  .adm-explanation hr {
    border:none; border-top:1px solid var(--color-border); margin:16px 0;
  }

  /* Action buttons */
  .adm-action-btn {
    padding:5px 14px; background:transparent;
    border:1px solid var(--color-border-strong);
    color:var(--color-text-secondary); border-radius:var(--radius-sm);
    font-size:12px; font-family:var(--font-mono); cursor:pointer;
    transition:color .2s, border-color .2s;
  }
  .adm-action-btn:hover { color:var(--color-accent); border-color:var(--color-accent); }

  /* Retry button */
  .adm-retry-btn {
    display:inline-block; margin-top:10px; padding:6px 16px;
    background:transparent; border:1px solid var(--color-danger);
    color:var(--color-danger); border-radius:var(--radius-sm);
    font-size:13px; font-family:var(--font-mono); cursor:pointer;
    transition:background .2s;
  }
  .adm-retry-btn:hover { background:rgba(255,90,78,.12); }

  /* Sub-tab bar (inside Live Diagram) */
  .adm-subtab-bar {
    display:flex; gap:2px; border-bottom:1px solid var(--color-border);
    margin-bottom:0; padding-bottom:0; margin-top:4px;
  }
  .adm-subtab {
    padding:6px 14px; background:transparent; border:none; border-bottom:2px solid transparent;
    color:var(--color-text-tertiary); font-family:var(--font-mono); font-size:11px;
    letter-spacing:.05em; text-transform:uppercase; cursor:pointer;
    transition:color .15s, border-color .15s; margin-bottom:-1px;
  }
  .adm-subtab:hover { color:var(--color-text); }
  .adm-subtab.adm-subtab-active { color:var(--color-accent); border-bottom-color:var(--color-accent); }

  /* Analysis list */
  .adm-analysis-item { padding:10px 0; border-top:1px solid var(--color-border); }
  .adm-analysis-meta { font-size:11px; color:var(--color-text-tertiary); margin-top:2px; }
`;

/* ════════════════════════════════════════════════════════════════
   LIVE DIAGRAM — reads current diagram from storage and renders
   ════════════════════════════════════════════════════════════════ */

async function renderLiveDiagram() {
  const wrap = document.getElementById("adm-live-content");
  if (!wrap) return;

  wrap.innerHTML = `<div class="adm-skeleton" style="margin-top:8px">
    <div class="adm-skeleton-line w60"></div><div class="adm-skeleton-line w80"></div>
    <div class="adm-skeleton-line w40"></div>
  </div>`;

  const list = await storage.diagrams.list().catch(() => []);
  if (!list || !list.length) {
    wrap.innerHTML = `<div class="panel" style="margin-top:8px;text-align:center;padding:32px 16px">
      <div style="font-size:32px;opacity:.3;margin-bottom:8px">⬡</div>
      <p style="font-size:13px;color:var(--color-text-tertiary)">No saved diagrams yet.<br>Go to <strong>Create</strong>, build a diagram, then Save it.</p>
    </div>`;
    return;
  }

  const sorted = list.sort((a,b) => new Date(b.updatedAt||b.createdAt) - new Date(a.updatedAt||a.createdAt));
  let diagram = sorted[0];
  liveSummaryCache = null;

  wrap.innerHTML = `
    <!-- Diagram selector header -->
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px">
      <span class="label" style="flex-shrink:0">Diagram</span>
      <select id="adm-diag-select" style="background:var(--color-bg-raised);border:1px solid var(--color-border);
        border-radius:var(--radius-sm);color:var(--color-text);font-family:var(--font-mono);
        font-size:12px;padding:4px 8px;cursor:pointer;flex:1;min-width:0">
        ${sorted.map((d,i)=>`<option value="${i}">${escapeHtml(d.name||"Untitled")}</option>`).join("")}
      </select>
    </div>

    <!-- Sub-tab bar -->
    <div class="adm-subtab-bar">
      <button class="adm-subtab${liveSubTab==="explain"?" adm-subtab-active":""}" data-subtab="explain">⬡ Explain</button>
      <button class="adm-subtab${liveSubTab==="visualize"?" adm-subtab-active":""}" data-subtab="visualize">◈ Visualize Summary</button>
    </div>

    <!-- Explain sub-panel -->
    <div id="adm-sub-explain" style="display:${liveSubTab==="explain"?"block":"none"}">
      <div class="panel" style="margin-top:8px">
        <div id="adm-live-png-wrap" style="border:1px solid var(--color-border);border-radius:var(--radius-md);
          overflow:hidden;background:var(--color-bg);text-align:center;margin-bottom:12px;min-height:120px;
          display:flex;align-items:center;justify-content:center">
          <span style="font-size:12px;color:var(--color-text-tertiary);opacity:.5">Rendering diagram…</span>
        </div>
        <div style="text-align:center">
          <button class="btn btn-primary" id="adm-live-explain-btn" style="font-size:12px;padding:6px 18px">⬡ Explain this</button>
        </div>
      </div>
      <div class="panel mt-2" id="adm-live-explanation-panel" style="display:none">
        <div id="adm-live-badge" class="adm-provider-badge hidden"></div>
        <div id="adm-live-skeleton" class="adm-skeleton hidden">
          <div class="adm-skeleton-line w80"></div><div class="adm-skeleton-line w100"></div>
          <div class="adm-skeleton-line w60"></div><div class="adm-skeleton-line w90"></div>
        </div>
        <div id="adm-live-text" class="adm-explanation"></div>
      </div>
    </div>

    <!-- Visualize Summary sub-panel -->
    <div id="adm-sub-visualize" style="display:${liveSubTab==="visualize"?"block":"none"}">
      <div id="adm-vis-content"></div>
    </div>
  `;

  // Render the PNG immediately
  renderLivePng(diagram);

  // Diagram selector
  document.getElementById("adm-diag-select").addEventListener("change", e => {
    diagram = sorted[parseInt(e.target.value)];
    liveSummaryCache = null;
    renderLivePng(diagram);
    const ep = document.getElementById("adm-live-explanation-panel");
    if (ep) ep.style.display = "none";
    if (liveSubTab === "visualize") renderVisualizeSummaryPanel(diagram, false);
  });

  // Sub-tab switching
  wrap.querySelectorAll(".adm-subtab").forEach(btn => {
    btn.addEventListener("click", () => {
      liveSubTab = btn.dataset.subtab;
      wrap.querySelectorAll(".adm-subtab").forEach(b => b.classList.remove("adm-subtab-active"));
      btn.classList.add("adm-subtab-active");
      document.getElementById("adm-sub-explain").style.display    = liveSubTab==="explain"    ? "block":"none";
      document.getElementById("adm-sub-visualize").style.display  = liveSubTab==="visualize"  ? "block":"none";
      if (liveSubTab === "visualize") renderVisualizeSummaryPanel(diagram, false);
    });
  });

  // Explain button
  document.getElementById("adm-live-explain-btn").addEventListener("click", () => explainLiveDiagram(diagram));

  // If already on visualize tab
  if (liveSubTab === "visualize") renderVisualizeSummaryPanel(diagram, false);
}

async function renderLivePng(diagram) {
  const wrap = document.getElementById("adm-live-png-wrap");
  if (!wrap) return;
  wrap.innerHTML = `<span style="font-size:12px;color:var(--color-text-tertiary);opacity:.5">Rendering…</span>`;
  try {
    const pngUrl = await renderDiagramToPng(diagram);
    if (!pngUrl) {
      wrap.innerHTML = `<p style="font-size:13px;color:var(--color-text-tertiary);padding:16px">No shapes in this diagram.</p>`;
      return;
    }
    wrap.innerHTML = `<img src="${pngUrl}" style="max-width:100%;display:block;border-radius:var(--radius-md)" alt="${escapeHtml(diagram.name||"Diagram")}"/>`;
  } catch(e) {
    wrap.innerHTML = `<p style="font-size:13px;color:var(--color-danger,#ff5a4e);padding:16px">Could not render diagram: ${escapeHtml(e.message)}</p>`;
  }
}

function renderVisualizeSummaryPanel(diagram, autoGenerate) {
  const wrap = document.getElementById("adm-vis-content");
  if (!wrap) return;

  // If cached, show it
  if (liveSummaryCache) { renderSummaryCards(liveSummaryCache, diagram); return; }

  wrap.innerHTML = `
    <div style="display:flex;gap:12px;margin-top:8px;flex-wrap:wrap">
      <!-- Left: PNG preview -->
      <div class="panel" style="flex:1;min-width:280px;max-width:50%">
        <span class="label">Diagram</span>
        <div id="adm-vis-png-wrap" style="border:1px solid var(--color-border);border-radius:var(--radius-md);
          overflow:hidden;margin-top:8px;min-height:100px;display:flex;align-items:center;justify-content:center">
          <span style="font-size:12px;color:var(--color-text-tertiary);opacity:.5">Rendering…</span>
        </div>
      </div>
      <!-- Right: Summary placeholder -->
      <div class="panel" style="flex:1;min-width:280px">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
          <span class="label">Visualize Summary</span>
          <div style="display:flex;gap:6px">
            <button class="adm-action-btn" id="adm-vis-dl-text" style="display:none">⬇ Text</button>
            <button class="adm-action-btn" id="adm-vis-dl-pdf"  style="display:none">⬇ PDF</button>
          </div>
        </div>
        <div id="adm-vis-summary-wrap">
          <div style="text-align:center;padding:32px 0">
            <div style="font-size:28px;opacity:.25;margin-bottom:10px">◈</div>
            <p style="font-size:13px;color:var(--color-text-tertiary)">Click the button to generate a visual summary of this diagram.</p>
            <button class="btn btn-primary" id="adm-vis-gen-btn" style="margin-top:14px;padding:7px 22px">◈ Generate Summary</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Render PNG on left
  (async () => {
    const pngWrap = document.getElementById("adm-vis-png-wrap");
    if (!pngWrap) return;
    try {
      const pngUrl = await renderDiagramToPng(diagram);
      if (pngUrl) pngWrap.innerHTML = `<img src="${pngUrl}" style="max-width:100%;display:block;border-radius:var(--radius-md)"/>`;
      else pngWrap.innerHTML = `<p style="font-size:12px;color:var(--color-text-tertiary);padding:12px">Empty diagram</p>`;
    } catch(e) { pngWrap.innerHTML = `<p style="font-size:12px;color:var(--color-danger,#f55);padding:12px">${escapeHtml(e.message)}</p>`; }
  })();

  document.getElementById("adm-vis-gen-btn")?.addEventListener("click", () => generateVisualizeSummary(diagram));

  if (autoGenerate) generateVisualizeSummary(diagram);
}

async function generateVisualizeSummary(diagram) {
  const summaryWrap = document.getElementById("adm-vis-summary-wrap");
  if (!summaryWrap) return;

  summaryWrap.innerHTML = `<div class="adm-skeleton" style="margin-top:4px">
    <div class="adm-skeleton-line w60"></div><div class="adm-skeleton-line w90"></div>
    <div class="adm-skeleton-line w50"></div><div class="adm-skeleton-line w80"></div>
    <div class="adm-skeleton-line w40"></div>
  </div>`;

  const { provider, apiKey } = await loadApiConfig();
  if (!provider || !apiKey) {
    summaryWrap.innerHTML = `<p style="font-size:13px;color:var(--color-text-tertiary);padding:12px 0">
      No API key — go to <strong>Settings</strong> to add one.</p>`;
    return;
  }

  const nodes = diagram.nodes || [];
  const conns  = diagram.conns  || [];
  const nodeDesc = nodes.map(n=>`- [${n.type}] "${n.label||"(unlabelled)"}"${n.fill?" fill="+n.fill:""}`).join("\n");
  const connDesc = conns.map(c=>{
    const f=nodes.find(n=>n.id===c.from), t2=nodes.find(n=>n.id===c.to);
    return `- "${f?.label||"?"}" → "${t2?.label||"?"}"${c.label?" ("+c.label+")":""}`;
  }).join("\n") || "(none)";

  const prompt =
    `Analyze this architecture diagram and respond ONLY with a valid JSON object — no markdown, no backticks, no prose before or after.\n\n` +
    `Diagram: "${diagram.name||"Untitled"}"\n` +
    `Components:\n${nodeDesc||"(none)"}\n` +
    `Connections:\n${connDesc}\n\n` +
    `Return this exact JSON shape:\n` +
    `{\n` +
    `  "title": "one sentence system title",\n` +
    `  "brief": "2-3 sentence plain English summary of what this system does",\n` +
    `  "components": [\n` +
    `    {"name":"exact label","type":"service|database|actor|gateway|queue|cache|other","role":"one line role"}\n` +
    `  ],\n` +
    `  "flow": [\n` +
    `    {"step":1,"from":"component name","to":"component name","action":"what happens"}\n` +
    `  ],\n` +
    `  "insights": [\n` +
    `    {"level":"info|warning|critical","text":"insight text"}\n` +
    `  ]\n` +
    `}\n\n` +
    `Rules: components max 8, flow max 6 steps, insights exactly 2-3. Only valid JSON, nothing else.`;

  try {
    const messages = [
      { role:"system", content:"You are a software architecture analyst. Respond only with valid JSON as instructed." },
      { role:"user",   content: prompt },
    ];
    const req = buildRequest(provider, apiKey, messages);
    req.body.messages = messages;
    const res = await fetch(req.url, { method:"POST", headers:req.headers, body:JSON.stringify(req.body) });
    if (!res.ok) { let d=`${res.status}`; try{const e=await res.json();if(e.error?.message)d+=` — ${e.error.message}`;}catch(_){} throw new Error(d); }
    const data = await res.json();
    const raw  = extractContent(data);

    // Parse JSON — strip any accidental fences
    const clean = raw.replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/,"").trim();
    const parsed = JSON.parse(clean);

    // Get PNG URL for download
    const pngUrl = await renderDiagramToPng(diagram).catch(()=>null);
    liveSummaryCache = { data: parsed, pngUrl, provider };
    renderSummaryCards(liveSummaryCache, diagram);
  } catch(e) {
    summaryWrap.innerHTML = `
      <p style="color:var(--color-danger,#ff5a4e);font-size:13px;margin-bottom:8px">Error: ${escapeHtml(e.message)}</p>
      <button class="adm-retry-btn" id="adm-vis-retry">↻ Retry</button>`;
    document.getElementById("adm-vis-retry")?.addEventListener("click", () => generateVisualizeSummary(diagram));
  }
}

const COMPONENT_COLORS = {
  service:  { bg:"rgba(90,184,255,.15)",  border:"#5ab8ff", text:"#5ab8ff" },
  database: { bg:"rgba(212,255,58,.12)",  border:"#d4ff3a", text:"#d4ff3a" },
  actor:    { bg:"rgba(78,224,138,.12)",  border:"#4ee08a", text:"#4ee08a" },
  gateway:  { bg:"rgba(201,143,255,.12)", border:"#c98fff", text:"#c98fff" },
  queue:    { bg:"rgba(255,138,92,.12)",  border:"#ff8a5c", text:"#ff8a5c" },
  cache:    { bg:"rgba(255,210,0,.12)",   border:"#ffd200", text:"#ffd200" },
  other:    { bg:"rgba(255,255,255,.06)", border:"rgba(255,255,255,.25)", text:"var(--color-text-secondary)" },
};
const INSIGHT_COLORS = {
  info:     { bg:"rgba(90,184,255,.12)",  border:"#5ab8ff", icon:"ℹ" },
  warning:  { bg:"rgba(255,210,0,.12)",   border:"#ffd200", icon:"⚠" },
  critical: { bg:"rgba(255,90,78,.12)",   border:"#ff5a4e", icon:"!" },
};

function renderSummaryCards(cache, diagram) {
  const summaryWrap = document.getElementById("adm-vis-summary-wrap");
  if (!summaryWrap) return;
  const { data, provider } = cache;

  // Show download buttons
  document.getElementById("adm-vis-dl-text")?.style && (document.getElementById("adm-vis-dl-text").style.display="inline-block");
  document.getElementById("adm-vis-dl-pdf")?.style  && (document.getElementById("adm-vis-dl-pdf").style.display="inline-block");

  // Flow steps HTML
  const flowHtml = (data.flow||[]).map((f,i) => `
    <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
      <div style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:var(--color-accent);
        color:var(--color-bg);font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center">${f.step||i+1}</div>
      <div style="font-size:12px;line-height:1.5;color:var(--color-text-secondary)">
        <strong style="color:var(--color-text)">${escapeHtml(f.from||"")}</strong>
        <span style="color:var(--color-accent);margin:0 4px">→</span>
        <strong style="color:var(--color-text)">${escapeHtml(f.to||"")}</strong>
        ${f.action ? `<span style="display:block;margin-top:1px;font-size:11px">${escapeHtml(f.action)}</span>` : ""}
      </div>
    </div>`).join("");

  // Component chips HTML
  const compHtml = (data.components||[]).map(c => {
    const col = COMPONENT_COLORS[c.type] || COMPONENT_COLORS.other;
    return `<div style="padding:6px 10px;border-radius:6px;border:1px solid ${col.border};
      background:${col.bg};margin-bottom:6px">
      <div style="font-size:11px;font-weight:bold;color:${col.text};margin-bottom:2px">${escapeHtml(c.name||"")}</div>
      <div style="font-size:11px;color:var(--color-text-secondary)">${escapeHtml(c.role||"")}</div>
    </div>`;
  }).join("");

  // Insight cards HTML
  const insightHtml = (data.insights||[]).map(ins => {
    const col = INSIGHT_COLORS[ins.level] || INSIGHT_COLORS.info;
    return `<div style="padding:8px 12px;border-left:3px solid ${col.border};
      background:${col.bg};border-radius:0 6px 6px 0;margin-bottom:8px;
      font-size:12px;color:var(--color-text-secondary);line-height:1.5">
      <span style="margin-right:6px;font-weight:bold">${col.icon}</span>${escapeHtml(ins.text||"")}
    </div>`;
  }).join("");

  summaryWrap.innerHTML = `
    <!-- Provider badge -->
    <div style="font-size:10px;color:var(--color-accent);opacity:.7;margin-bottom:10px;font-family:var(--font-mono)">
      Generated by ${escapeHtml(provider||"AI")}
    </div>

    <!-- Title + Brief -->
    <div style="margin-bottom:14px">
      <div style="font-size:15px;font-family:var(--font-serif);color:var(--color-text);margin-bottom:6px">${escapeHtml(data.title||diagram.name||"")}</div>
      <div style="font-size:13px;color:var(--color-text-secondary);line-height:1.6">${escapeHtml(data.brief||"")}</div>
    </div>

    <!-- Components -->
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-tertiary);margin-bottom:6px">Components</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:14px">${compHtml}</div>

    <!-- Flow -->
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-tertiary);margin-bottom:8px">Flow</div>
    <div style="margin-bottom:14px">${flowHtml}</div>

    <!-- Insights -->
    <div style="font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-tertiary);margin-bottom:8px">Key Insights</div>
    <div>${insightHtml}</div>

    <!-- Regenerate -->
    <div style="margin-top:14px;text-align:right">
      <button class="btn" id="adm-vis-regen" style="font-size:11px">↻ Regenerate</button>
    </div>
  `;

  document.getElementById("adm-vis-regen")?.addEventListener("click", () => {
    liveSummaryCache = null;
    generateVisualizeSummary(diagram);
  });

  // Wire download buttons
  document.getElementById("adm-vis-dl-text")?.addEventListener("click", () => downloadSummaryText(cache, diagram));
  document.getElementById("adm-vis-dl-pdf")?.addEventListener("click",  () => downloadSummaryPdf(cache, diagram));
}

function downloadSummaryText(cache, diagram) {
  const d = cache.data;
  const name = diagram.name || "Diagram";
  let out = `${name} — Visualize Summary\n${"=".repeat(50)}\n`;
  out += `Generated by ${cache.provider||"AI"} · ${new Date().toLocaleString()}\n\n`;
  out += `TITLE\n${d.title||""}\n\n`;
  out += `BRIEF\n${d.brief||""}\n\n`;
  out += `COMPONENTS\n${(d.components||[]).map(c=>`  [${c.type}] ${c.name} — ${c.role}`).join("\n")}\n\n`;
  out += `FLOW\n${(d.flow||[]).map(f=>`  ${f.step}. ${f.from} → ${f.to}: ${f.action}`).join("\n")}\n\n`;
  out += `KEY INSIGHTS\n${(d.insights||[]).map(i=>`  [${i.level.toUpperCase()}] ${i.text}`).join("\n")}\n`;
  const blob = new Blob([out],{type:"text/plain;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a"); a.href=url; a.download=`${slugify(name)}-summary.txt`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function downloadSummaryPdf(cache, diagram) {
  const d = cache.data;
  const name = diagram.name || "Diagram";

  const compRows = (d.components||[]).map(c => {
    const col = COMPONENT_COLORS[c.type] || COMPONENT_COLORS.other;
    return `<div style="padding:6px 10px;border-radius:6px;border:1px solid ${col.border};
      background:${col.bg};margin-bottom:6px">
      <div style="font-size:11px;font-weight:bold;color:${col.text}">${escapeHtml(c.name)}</div>
      <div style="font-size:11px;color:#666">${escapeHtml(c.role)}</div>
    </div>`;
  }).join("");

  const flowRows = (d.flow||[]).map(f =>
    `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:flex-start">
      <div style="flex-shrink:0;width:20px;height:20px;border-radius:50%;background:#d4ff3a;
        color:#000;font-size:10px;font-weight:bold;display:flex;align-items:center;justify-content:center">${f.step}</div>
      <div style="font-size:12px"><strong>${escapeHtml(f.from)}</strong> → <strong>${escapeHtml(f.to)}</strong>
        ${f.action?`<br><span style="color:#555;font-size:11px">${escapeHtml(f.action)}</span>`:""}
      </div>
    </div>`).join("");

  const insightRows = (d.insights||[]).map(i => {
    const col = INSIGHT_COLORS[i.level]||INSIGHT_COLORS.info;
    return `<div style="padding:8px 12px;border-left:3px solid ${col.border};
      background:${col.bg};border-radius:0 6px 6px 0;margin-bottom:8px;font-size:12px">${col.icon} ${escapeHtml(i.text)}</div>`;
  }).join("");

  const imgTag = cache.pngUrl
    ? `<img src="${cache.pngUrl}" style="max-width:100%;border-radius:8px;border:1px solid #ddd;margin-bottom:20px"/>`
    : "";

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<title>${escapeHtml(name)} — Summary</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;max-width:900px;margin:0 auto;padding:32px 20px}
  h1{font-size:22px;margin-bottom:4px}
  .meta{font-size:11px;color:#999;margin-bottom:20px}
  .brief{font-size:14px;color:#444;margin-bottom:24px;line-height:1.7;padding:12px;background:#f9f9f9;border-radius:6px}
  .layout{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .section-title{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#999;margin-bottom:8px;font-weight:bold}
  .hint{text-align:center;font-size:11px;color:#bbb;margin-top:32px}
  @media print{.hint{display:none}body{padding:16px}}
</style></head><body>
<h1>${escapeHtml(d.title||name)}</h1>
<div class="meta">ArchitectSmartCraft · ${new Date().toLocaleString()} · ${escapeHtml(cache.provider||"AI")}</div>
${imgTag}
<div class="brief">${escapeHtml(d.brief||"")}</div>
<div class="layout">
  <div>
    <div class="section-title">Components</div>${compRows}
    <div class="section-title" style="margin-top:16px">Key Insights</div>${insightRows}
  </div>
  <div>
    <div class="section-title">Flow</div>${flowRows}
  </div>
</div>
<div class="hint">Press Ctrl+P (or ⌘P) to save as PDF</div>
</body></html>`;

  const blob = new Blob([html],{type:"text/html;charset=utf-8"});
  const url  = URL.createObjectURL(blob);
  window.open(url,"_blank");
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}

function renderDiagramSvg(diagram) {
  const wrap = document.getElementById("adm-live-svg-wrap");
  if (!wrap || !diagram) return;

  const nodes = diagram.nodes || [];
  const conns = diagram.conns || [];

  if (!nodes.length) {
    wrap.innerHTML = `<p style="text-align:center;padding:24px;font-size:13px;color:var(--color-text-tertiary)">This diagram has no shapes yet.</p>`;
    return;
  }

  // Compute bounding box with padding
  const pad = 32;
  const minX = Math.min(...nodes.map(n=>n.x)) - pad;
  const minY = Math.min(...nodes.map(n=>n.y)) - pad;
  const maxX = Math.max(...nodes.map(n=>n.x+n.w)) + pad;
  const maxY = Math.max(...nodes.map(n=>n.y+n.h)) + pad;
  const vw = maxX - minX, vh = maxY - minY;

  const theme = diagram.theme || "dark";
  const THEMES = {
    dark:  { bg:"#0e1e2e", fill:"#0a1520", stroke:"#5ab8ff", text:"#e8f4ff", conn:"#5ab8ff" },
    light: { bg:"#f0f4f8", fill:"#ffffff", stroke:"#2563eb", text:"#1e293b", conn:"#2563eb" },
    mono:  { bg:"#111",    fill:"#1a1a1a", stroke:"#ffffff", text:"#ffffff", conn:"#ffffff" },
  };
  const t = THEMES[theme] || THEMES.dark;

  // Helper: compute best edge midpoint from node toward a target center
  function edgePt(n, tx, ty) {
    const cx = n.x + n.w/2 - minX, cy = n.y + n.h/2 - minY;
    const dx = tx - cx, dy = ty - cy;
    const x = n.x - minX, y = n.y - minY;
    if (Math.abs(dx) * n.h > Math.abs(dy) * n.w) {
      // exit left or right
      return dx > 0
        ? { x: x + n.w, y: cy }
        : { x: x,       y: cy };
    } else {
      // exit top or bottom
      return dy > 0
        ? { x: cx, y: y + n.h }
        : { x: cx, y: y };
    }
  }

  // Build connector paths with proper edge points and arrowheads
  let connSvg = "";
  conns.forEach(c => {
    const from = nodes.find(n=>n.id===c.from), to = nodes.find(n=>n.id===c.to);
    if (!from||!to) return;
    const fcx = from.x+from.w/2 - minX, fcy = from.y+from.h/2 - minY;
    const tcx = to.x+to.w/2   - minX,  tcy = to.y+to.h/2   - minY;
    const p1 = edgePt(from, tcx, tcy);
    const p2 = edgePt(to,   fcx, fcy);
    const dash = c.lineStyle==="dashed" ? "stroke-dasharray='6 3'" : c.lineStyle==="dotted" ? "stroke-dasharray='2 4'" : "";
    connSvg += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}"
      stroke="${t.conn}" stroke-width="1.5" opacity="0.75" ${dash}
      marker-end="url(#live-ah)"/>`;
    if (c.label) {
      const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
      connSvg += `<text x="${mx}" y="${my-5}" text-anchor="middle" font-size="10"
        font-family="monospace" fill="${t.text}" opacity="0.8">${escapeHtml(c.label)}</text>`;
    }
  });

  // Build node shapes
  let nodeSvg = "";
  nodes.forEach(n => {
    const x=n.x-minX, y=n.y-minY, w=n.w, h=n.h;
    const fill = n.fill || t.fill;
    const stroke = n.strokeColor || t.stroke;
    const dash = n.borderStyle==="dashed"?" stroke-dasharray='8 4'"
               : n.borderStyle==="dotted"?" stroke-dasharray='2 4'" : "";
    const rx = (n.type==="ellipse") ? w/2
             : (n.type==="rounded"||n.type==="group") ? Math.min(w,h)*0.18 : 4;
    nodeSvg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"
      fill="${fill}" stroke="${stroke}" stroke-width="1.5"${dash}/>`;
    if (n.label) {
      const labelY = n.type==="list" ? y+Math.min(h*.22,32)/2+4 : y+h/2+4;
      const anchor = n.type==="group" ? "start" : "middle";
      const lx     = n.type==="group" ? x+10 : x+w/2;
      const fs = Math.min(n.fontSize||12, 13);
      nodeSvg += `<text x="${lx}" y="${labelY}" text-anchor="${anchor}"
        font-size="${fs}" font-family="monospace"
        fill="${t.text}" style="pointer-events:none">${escapeHtml(n.label)}</text>`;
    }
  });

  wrap.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 ${vw} ${vh}" width="100%"
    style="max-height:460px;display:block;background:${t.bg}">
    <defs>
      <marker id="live-ah" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
        <polygon points="0 0,8 4,0 8" fill="${t.conn}" opacity="0.85"/>
      </marker>
    </defs>
    ${connSvg}${nodeSvg}
  </svg>`;
}

async function explainLiveDiagram(diagram) {
  const panel      = document.getElementById("adm-live-explanation-panel");
  const skeletonEl = document.getElementById("adm-live-skeleton");
  const textEl     = document.getElementById("adm-live-text");
  const badgeEl    = document.getElementById("adm-live-badge");
  const btn        = document.getElementById("adm-live-explain-btn");

  panel.style.display = "block";
  skeletonEl.classList.remove("hidden");
  textEl.innerHTML = "";
  badgeEl.classList.add("hidden");
  if (btn) { btn.disabled = true; btn.textContent = "Analyzing…"; }
  panel.scrollIntoView({ behavior: "smooth", block: "start" });

  const { provider, apiKey } = await loadApiConfig();
  if (!provider || !apiKey) {
    skeletonEl.classList.add("hidden");
    textEl.innerHTML = `<p style="color:var(--color-text-tertiary);font-size:13px">
      No API key configured — go to <strong>Settings</strong> to add one.</p>`;
    if (btn) { btn.disabled = false; btn.textContent = "⬡ Explain this"; }
    return;
  }

  // Build structured text description of the diagram
  const nodes = diagram.nodes || [];
  const conns  = diagram.conns  || [];
  const nodeDesc = nodes.map(n =>
    `- [${n.type}] "${n.label||"(unlabelled)"}"${n.fill?" fill="+n.fill:""}`
  ).join("\n");
  const connDesc = conns.map(c => {
    const f = nodes.find(n=>n.id===c.from), t2 = nodes.find(n=>n.id===c.to);
    return `- "${f?.label||"?"}" → "${t2?.label||"?"}"${c.label?" ("+c.label+")":""}`;
  }).join("\n") || "(no connections)";

  const userPrompt =
    `You are analyzing a software architecture diagram described in structured text.\n\n` +
    `Diagram name: "${diagram.name || "Untitled"}"\n\n` +
    `Components:\n${nodeDesc || "(none)"}\n\n` +
    `Connections:\n${connDesc}\n\n` +
    `Provide a clear, concise explanation:\n\n` +
    `## Overview\nOne sentence describing what this system/flow does.\n\n` +
    `## Components\nBrief role of each key component — use the exact names above in **bold**.\n\n` +
    `## Flow\nStep-by-step numbered walkthrough of how data/requests move through the system.\n\n` +
    `## Key Points\n2-3 notable design decisions or things to be aware of.\n\n` +
    `Start immediately with "## Overview" — no preamble.`;

  // Use the same API infrastructure as the upload-based tabs
  try {
    // Build a text-only message using the existing buildRequest pattern
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user",   content: userPrompt },
    ];
    const req = buildRequest(provider, apiKey, messages);
    // For text-only, keep the same body but ensure we're not sending image payload
    req.body.messages = messages;

    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });

    if (!res.ok) {
      let detail = `${res.status}`;
      try { const e = await res.json(); if (e.error?.message) detail += ` — ${e.error.message}`; } catch(_){}
      throw new Error(`${provider} API error (${detail})`);
    }

    const data = await res.json();
    const text = extractContent(data);

    skeletonEl.classList.add("hidden");
    badgeEl.classList.remove("hidden");
    badgeEl.textContent = `Generated by ${provider}`;
    textEl.innerHTML = renderMarkdown(stripFiller(text));
  } catch (err) {
    skeletonEl.classList.add("hidden");
    const hint = getErrorHint(err, provider);
    textEl.innerHTML = `<p style="color:var(--color-danger,#ff5a4e);font-size:13px">${escapeHtml(hint)}</p>
      <button class="adm-retry-btn" id="adm-live-retry">↻ Retry</button>`;
    document.getElementById("adm-live-retry")?.addEventListener("click", () => explainLiveDiagram(diagram));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "⬡ Explain this"; }
  }
}

/* ════════════════════════════════════════════════════════════════
   STYLE TOGGLE + ACTION BUTTONS
   ════════════════════════════════════════════════════════════════ */

function renderStyleToggle() {
  const toggleEl = document.getElementById("style-toggle");
  if (!toggleEl) return;

  // Only show upload-based styles (not live tab)
  const uploadStyles = STYLES.filter(s => s.key !== "live");

  toggleEl.innerHTML = uploadStyles.map(
    (s) =>
      `<button class="btn${s.key === activeStyle ? " btn-primary" : ""}" ` +
      `data-style="${s.key}" ${isLoading ? "disabled" : ""}>` +
      `<span style="margin-right:4px;">${s.icon}</span>${s.label}</button>`
  ).join("");

  toggleEl.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!isLoading) switchStyle(btn.dataset.style);
    });
  });

  renderActionButtons();
}

function renderActionButtons() {
  const wrap = document.getElementById("action-buttons");
  if (!wrap) return;

  const hasContent = Object.keys(explanationCache).length > 0;
  if (!hasContent) { wrap.innerHTML = ""; return; }

  wrap.innerHTML =
    `<button class="adm-action-btn" id="dl-text-btn" title="Download as text file">⬇ Text</button>` +
    `<button class="adm-action-btn" id="dl-pdf-btn" title="Open printable page (save as PDF)">⬇ PDF</button>`;

  document.getElementById("dl-text-btn").addEventListener("click", downloadAsText);
  document.getElementById("dl-pdf-btn").addEventListener("click", downloadAsPDF);
}

/* ════════════════════════════════════════════════════════════════
   FILE SELECT
   ════════════════════════════════════════════════════════════════ */

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  pendingImageName   = file.name;
  pendingImageBase64 = await fileToBase64(file);
  explanationCache   = {};
  currentAnalysisId  = null;
  activeStyle        = "steps";

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg  = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  /* Hide upload zone, show preview */
  const zone = document.getElementById("upload-zone");
  if (zone) zone.style.display = "none";

  document.getElementById("explanation-panel").style.display = "block";
  renderStyleToggle();
  await loadOrGenerateExplanation(activeStyle);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/* ════════════════════════════════════════════════════════════════
   STYLE SWITCHING
   ════════════════════════════════════════════════════════════════ */

async function switchStyle(styleKey) {
  activeStyle = styleKey;
  renderStyleToggle();
  await loadOrGenerateExplanation(styleKey);
}

/* ════════════════════════════════════════════════════════════════
   CORE: LOAD OR GENERATE EXPLANATION
   ════════════════════════════════════════════════════════════════ */

async function loadOrGenerateExplanation(styleKey) {
  const explanationEl = document.getElementById("explanation-text");
  const statusEl      = document.getElementById("analyze-status");
  const skeletonEl    = document.getElementById("loading-skeleton");
  const badgeEl       = document.getElementById("provider-badge");

  /* ── Cached? Show immediately (innerHTML for rendered Markdown) ── */
  if (explanationCache[styleKey]) {
    skeletonEl.classList.add("hidden");
    badgeEl.classList.remove("hidden");
    badgeEl.textContent = explanationCache[styleKey].provider
      ? `Generated by ${explanationCache[styleKey].provider}`
      : "Manual entry";
    /* KEY: use innerHTML + renderMarkdown — not textContent */
    explanationEl.innerHTML = renderMarkdown(explanationCache[styleKey].text);
    explanationEl.contentEditable = "false";
    explanationEl.style.border = "none";
    explanationEl.style.padding = "0";
    statusEl.textContent = "";
    renderActionButtons();
    return;
  }

  /* ── No API key → manual entry ── */
  const { provider, apiKey } = await loadApiConfig();

  if (!provider || !apiKey) {
    skeletonEl.classList.add("hidden");
    badgeEl.classList.add("hidden");
    statusEl.textContent =
      "No API key configured — go to Settings to add one, or write the explanation yourself below.";
    explanationEl.innerHTML = "";
    explanationEl.contentEditable = "true";
    explanationEl.style.border = "1px dashed var(--color-border-strong)";
    explanationEl.style.padding = "10px";
    explanationEl.style.borderRadius = "var(--radius-md)";
    explanationEl.focus();
    attachManualSaveButton(styleKey);
    return;
  }

  /* ── Call AI — show skeleton ── */
  isLoading = true;
  explanationEl.innerHTML = "";
  badgeEl.classList.add("hidden");
  skeletonEl.classList.remove("hidden");
  statusEl.textContent = `Analyzing with ${provider}…`;
  renderStyleToggle();                     /* dims/disables buttons */

  try {
    const explanation = await callVisionProvider(provider, apiKey, pendingImageBase64, styleKey);

    /* Strip any leading filler the model may still add despite the prompt */
    const cleaned = stripFiller(explanation);

    explanationCache[styleKey] = { text: cleaned, provider };

    skeletonEl.classList.add("hidden");
    badgeEl.classList.remove("hidden");
    badgeEl.textContent = `Generated by ${provider}`;
    /* KEY: innerHTML + renderMarkdown */
    explanationEl.innerHTML = renderMarkdown(cleaned);
    explanationEl.contentEditable = "false";
    explanationEl.style.border = "none";
    explanationEl.style.padding = "0";
    statusEl.textContent = "";

    await persistAnalysis();
    renderAnalysesList();
    renderActionButtons();
  } catch (err) {
    skeletonEl.classList.add("hidden");
    badgeEl.classList.add("hidden");

    const hint = getErrorHint(err, provider);
    statusEl.innerHTML = "";

    const errSpan = document.createElement("span");
    errSpan.textContent = hint;
    statusEl.appendChild(errSpan);

    /* Retry button */
    const retryBtn = document.createElement("button");
    retryBtn.className = "adm-retry-btn";
    retryBtn.textContent = "↻ Retry";
    retryBtn.addEventListener("click", () => {
      statusEl.textContent = "";
      loadOrGenerateExplanation(styleKey);
    });
    statusEl.appendChild(retryBtn);

    /* Still allow manual entry */
    explanationEl.innerHTML = "";
    explanationEl.contentEditable = "true";
    explanationEl.style.border = "1px dashed var(--color-border-strong)";
    explanationEl.style.padding = "10px";
    explanationEl.style.borderRadius = "var(--radius-md)";
    attachManualSaveButton(styleKey);
  } finally {
    isLoading = false;
    renderStyleToggle();                   /* re-enables buttons */
  }
}

/* ── Strip common AI filler openings ─────────────────────────── */

function stripFiller(text) {
  /* Remove lines that start with filler phrases before the first ## heading */
  return text.replace(
    /^(?:Sure[!,.]?\s*|Great[!,.]?\s*|Of course[!,.]?\s*|Absolutely[!,.]?\s*|Certainly[!,.]?\s*|Let me\s.*?\.\s*|Here (?:are|is)\s.*?\.\s*|Let's\s.*?\.\s*)+/i,
    ""
  ).trim();
}

/* ── Error hints ─────────────────────────────────────────────── */

function getErrorHint(err, provider) {
  const msg = err.message || "";
  if (msg.includes("401") || msg.includes("403"))
    return `Authentication failed — double-check your ${provider} API key in Settings.`;
  if (msg.includes("429"))
    return `Rate limit hit on ${provider}. Wait a moment, then retry.`;
  if (msg.includes("413") || msg.includes("too large"))
    return `Image may be too large for ${provider}. Try a smaller or lower-res image.`;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503"))
    return `${provider} is having server issues. Try again in a minute.`;
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError"))
    return `Network error — check your internet connection and retry.`;
  return `Could not get explanation from ${provider}: ${msg}`;
}

/* ── Manual-entry save ───────────────────────────────────────── */

function attachManualSaveButton(styleKey) {
  const panel = document.getElementById("explanation-panel");
  const old   = document.getElementById("manual-save-btn");
  if (old) old.remove();

  const btn = document.createElement("button");
  btn.id = "manual-save-btn";
  btn.className = "btn btn-primary mt-2";
  btn.textContent = "Save my explanation";
  btn.addEventListener("click", async () => {
    const raw = document.getElementById("explanation-text").textContent.trim();
    if (!raw) return;
    explanationCache[styleKey] = { text: raw, provider: null };
    /* Re-render with Markdown so formatting shows */
    document.getElementById("explanation-text").innerHTML = renderMarkdown(raw);
    document.getElementById("explanation-text").contentEditable = "false";
    document.getElementById("explanation-text").style.border = "none";
    document.getElementById("explanation-text").style.padding = "0";
    await persistAnalysis();
    btn.textContent = "✓ Saved";
    setTimeout(() => btn.remove(), 1200);
    renderAnalysesList();
    renderActionButtons();
  });
  panel.appendChild(btn);
}

/* ════════════════════════════════════════════════════════════════
   PERSISTENCE
   ════════════════════════════════════════════════════════════════ */

async function persistAnalysis() {
  const flat = {};
  for (const [key, val] of Object.entries(explanationCache)) {
    flat[key] = typeof val === "string" ? val : val.text;
  }
  const saved = await storage.analyses.save({
    id: currentAnalysisId,
    imageBase64: pendingImageBase64,
    imageName: pendingImageName,
    explanations: flat,
  });
  currentAnalysisId = saved.id;
}

/* ════════════════════════════════════════════════════════════════
   DOWNLOAD — TEXT FILE
   ════════════════════════════════════════════════════════════════ */

function downloadAsText() {
  if (Object.keys(explanationCache).length === 0) return;

  const title = cleanTitle();
  let content = `${title}\n${"=".repeat(title.length)}\n`;
  content += `Generated by ArchitectSmartCraft\n`;
  content += `Date: ${new Date().toLocaleString()}\n\n`;

  for (const style of STYLES) {
    const cached = explanationCache[style.key];
    if (!cached) continue;
    const text = typeof cached === "string" ? cached : cached.text;
    content += `${"─".repeat(50)}\n`;
    content += `${style.icon}  ${style.label.toUpperCase()}\n`;
    content += `${"─".repeat(50)}\n\n`;
    content += text + "\n\n";
  }

  downloadBlob(content, `${slugify(title)}-analysis.txt`, "text/plain;charset=utf-8");
}

/* ════════════════════════════════════════════════════════════════
   DOWNLOAD — PDF (opens styled HTML in new tab → user prints/saves)
   ════════════════════════════════════════════════════════════════ */

function downloadAsPDF() {
  if (Object.keys(explanationCache).length === 0) return;

  const title = cleanTitle();
  let sectionsHtml = "";

  for (const style of STYLES) {
    const cached = explanationCache[style.key];
    if (!cached) continue;
    const text = typeof cached === "string" ? cached : cached.text;
    sectionsHtml +=
      `<div class="section">` +
        `<div class="section-label">${style.icon} ${escapeHtml(style.label)}</div>` +
        `<div class="section-body">${renderMarkdown(text)}</div>` +
      `</div>`;
  }

  /* Include the diagram thumbnail if available */
  const imgTag = pendingImageBase64
    ? `<div class="diagram-preview"><img src="${pendingImageBase64}" /></div>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/>
<title>${escapeHtml(title)} — Analysis</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap');
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:'Inter',system-ui,sans-serif; font-size:14px; line-height:1.75;
         color:#1a1a1a; max-width:800px; margin:0 auto; padding:40px 24px; }
  h1 { font-size:24px; font-weight:600; margin-bottom:4px; }
  .meta { font-size:12px; color:#888; margin-bottom:24px; }
  .diagram-preview { margin-bottom:28px; }
  .diagram-preview img { max-width:100%; border:1px solid #ddd; border-radius:8px; }
  .section { margin-bottom:32px; page-break-inside:avoid; }
  .section-label { font-size:13px; font-weight:600; text-transform:uppercase;
                   letter-spacing:.06em; color:#555; border-bottom:2px solid #e0e0e0;
                   padding-bottom:4px; margin-bottom:12px; }
  .section-body h2 { font-size:16px; font-weight:600; margin:16px 0 6px; color:#111; }
  .section-body h3 { font-size:14px; font-weight:600; margin:12px 0 4px; color:#333; }
  .section-body p { margin:6px 0; color:#333; }
  .section-body ul, .section-body ol { padding-left:22px; margin:6px 0; }
  .section-body li { margin:4px 0; }
  .section-body strong { color:#000; }
  .section-body code { background:#f4f4f4; padding:1px 4px; border-radius:3px; font-size:13px; }
  .section-body hr { border:none; border-top:1px solid #ddd; margin:14px 0; }
  .print-hint { text-align:center; font-size:12px; color:#aaa; margin-top:40px; }
  @media print {
    .print-hint { display:none; }
    body { padding:20px; }
  }
</style>
</head><body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">ArchitectSmartCraft Analysis &middot; ${new Date().toLocaleString()}</div>
  ${imgTag}
  ${sectionsHtml}
  <div class="print-hint">Press Ctrl+P (or ⌘P) to save as PDF</div>
</body></html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  window.open(url, "_blank");
  /* Clean up after a delay so the new tab finishes loading */
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/* ── download helpers ────────────────────────────────────────── */

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function cleanTitle() {
  return pendingImageName
    ? pendingImageName.replace(/\.[^.]+$/, "")
    : "Diagram Analysis";
}

function slugify(str) {
  return str.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").substring(0, 60);
}

/* ════════════════════════════════════════════════════════════════
   VISION API CALL
   ════════════════════════════════════════════════════════════════ */

async function callVisionProvider(provider, apiKey, imageBase64, styleKey) {
  const userPrompt = STYLE_PROMPTS[styleKey];
  const messages   = buildMessages(provider, imageBase64, userPrompt);
  const req        = buildRequest(provider, apiKey, messages);

  const res = await fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body) });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody.error?.message) detail += ` — ${errBody.error.message}`;
    } catch (_) { /* ignore */ }
    throw new Error(`${capitalize(provider)} API error (${detail})`);
  }

  const data = await res.json();
  return extractContent(data);
}

function buildMessages(provider, imageBase64, userPrompt) {
  if (provider === "cerebras") {
    return [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `I have an architecture/flow diagram I cannot share directly. ` +
          `Provide the analysis below based on general best practices. ` +
          `If you can't be specific about component names (since you can't see them), ` +
          `use placeholders like **Component A → Component B** and note the user should ` +
          `map them to their diagram.\n\n${userPrompt}`,
      },
    ];
  }

  /* Groq + Mistral: vision-capable */
  const imagePayload =
    provider === "mistral"
      ? { type: "image_url", image_url: imageBase64 }
      : { type: "image_url", image_url: { url: imageBase64 } };

  return [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        { type: "text", text: userPrompt },
        imagePayload,
      ],
    },
  ];
}

function buildRequest(provider, apiKey, messages) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  const configs = {
    groq: {
      url: "https://api.groq.com/openai/v1/chat/completions",
      body: { model: "llama-3.2-90b-vision-preview", messages, temperature: 0.25, max_tokens: 2048 },
    },
    mistral: {
      url: "https://api.mistral.ai/v1/chat/completions",
      body: { model: "pixtral-12b-2409", messages, temperature: 0.25, max_tokens: 2048 },
    },
    cerebras: {
      url: "https://api.cerebras.ai/v1/chat/completions",
      body: { model: "llama3.1-8b", messages, temperature: 0.25, max_tokens: 2048 },
    },
  };

  if (!configs[provider]) throw new Error(`Unknown provider: ${provider}`);
  return { url: configs[provider].url, headers, body: configs[provider].body };
}

function extractContent(data) {
  if (data.choices?.[0]?.message?.content) return data.choices[0].message.content;
  throw new Error("Unexpected API response — no content returned.");
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ════════════════════════════════════════════════════════════════
   MARKDOWN → HTML RENDERER
   ════════════════════════════════════════════════════════════════ */

function renderMarkdown(raw) {
  if (!raw) return "";

  /* Work line-by-line for clean block-level handling */
  const lines = raw.split("\n");
  const out   = [];
  let inList  = false;
  let listTag = "ul";

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    /* Escape HTML */
    line = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    /* Headings */
    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) { closeList(); out.push(`<h3>${inline(h3[1])}</h3>`); continue; }
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) { closeList(); out.push(`<h2>${inline(h2[1])}</h2>`); continue; }
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) { closeList(); out.push(`<h2>${inline(h1[1])}</h2>`); continue; }

    /* Horizontal rule */
    if (/^-{3,}$/.test(line.trim())) { closeList(); out.push(`<hr/>`); continue; }

    /* Unordered list */
    const ul = line.match(/^[\s]*[-*•]\s+(.+)$/);
    if (ul) {
      if (!inList || listTag !== "ul") { closeList(); out.push("<ul>"); inList = true; listTag = "ul"; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    /* Ordered list */
    const ol = line.match(/^[\s]*\d+\.\s+(.+)$/);
    if (ol) {
      if (!inList || listTag !== "ol") { closeList(); out.push("<ol>"); inList = true; listTag = "ol"; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    /* Blank line → close list / paragraph break */
    if (line.trim() === "") {
      closeList();
      out.push("");
      continue;
    }

    /* Normal paragraph text */
    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  return out.join("\n");

  function closeList() {
    if (inList) { out.push(`</${listTag}>`); inList = false; }
  }

  /** Inline formatting: bold, italic, code */
  function inline(s) {
    return s
      .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g,     "<em>$1</em>")
      .replace(/`([^`]+)`/g,     "<code>$1</code>");
  }
}

/* ════════════════════════════════════════════════════════════════
   SAVED ANALYSES LIST
   ════════════════════════════════════════════════════════════════ */

async function renderAnalysesList() {
  const listEl = document.getElementById("analyses-list");
  if (!listEl) return;

  const analyses = await storage.analyses.list();

  if (analyses.length === 0) {
    listEl.innerHTML = `<p style="font-size:13px; color:var(--color-text-tertiary); margin:0;">No analyses yet.</p>`;
    return;
  }

  listEl.innerHTML = analyses
    .map((a) => {
      const styleCount = a.explanations ? Object.keys(a.explanations).length : 0;
      const icons = a.explanations
        ? STYLES.filter((s) => a.explanations[s.key]).map((s) => s.icon).join(" ")
        : "";
      return `
      <div class="adm-analysis-item">
        <div class="flex-between">
          <div style="font-size:14px;">${escapeHtml(a.imageName || "Untitled image")}</div>
          <div class="flex gap-1">
            <button class="btn" data-open="${a.id}">Open</button>
            <button class="btn btn-danger" data-delete="${a.id}">Delete</button>
          </div>
        </div>
        <div class="adm-analysis-meta">
          ${new Date(a.createdAt).toLocaleString()} · ${icons} ${styleCount} explanation${styleCount === 1 ? "" : "s"}
        </div>
      </div>`;
    })
    .join("");

  listEl.querySelectorAll("[data-open]").forEach((btn) => {
    btn.addEventListener("click", () => openSavedAnalysis(btn.dataset.open));
  });
  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this analysis?")) {
        await storage.analyses.delete(btn.dataset.delete);
        if (currentAnalysisId === btn.dataset.delete) {
          currentAnalysisId = null;
          explanationCache = {};
        }
        renderAnalysesList();
      }
    });
  });
}

async function openSavedAnalysis(id) {
  const analysis = await storage.analyses.get(id);
  if (!analysis) return;

  currentAnalysisId  = analysis.id;
  pendingImageBase64 = analysis.imageBase64;
  pendingImageName   = analysis.imageName;

  /* Normalize old-format (plain strings) → { text, provider } */
  explanationCache = {};
  if (analysis.explanations) {
    for (const [key, val] of Object.entries(analysis.explanations)) {
      explanationCache[key] = typeof val === "string" ? { text: val, provider: null } : val;
    }
  }

  activeStyle = STYLES.find((s) => explanationCache[s.key])?.key || "steps";

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg  = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  const zone = document.getElementById("upload-zone");
  if (zone) zone.style.display = "none";

  document.getElementById("explanation-panel").style.display = "block";
  renderStyleToggle();
  await loadOrGenerateExplanation(activeStyle);

  document.getElementById("explanation-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── Utility ─────────────────────────────────────────────────── */

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}
