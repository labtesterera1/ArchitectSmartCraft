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
 *   - Overhauled prompts for structured, high-quality output
 *   - Download analysis as formatted Markdown
 *   - Animated loading skeleton during AI calls
 *   - Retry button on API errors
 *   - Basic Markdown rendering in explanation output
 *   - Provider badge on each explanation
 *   - Better error messages with actionable hints
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";
import { loadApiConfig } from "../settings/settings.js";

/* ── Style definitions ─────────────────────────────────────────── */

const STYLES = [
  { key: "steps",       label: "Step-by-step",       icon: "①" },
  { key: "example",     label: "Real-world example",  icon: "◉" },
  { key: "suggestions", label: "Suggestions",         icon: "◆" },
];

/* ── System prompt (shared across all styles) ──────────────────── */

const SYSTEM_PROMPT =
  `You are a senior solutions architect analyzing a software architecture or flow diagram. ` +
  `Your audience is a developer or technical lead who wants clear, actionable understanding. ` +
  `Rules:\n` +
  `- Be specific: reference the actual components, services, arrows, and labels you can see in the image.\n` +
  `- Use the exact names shown in the diagram (don't rename or generalize them).\n` +
  `- Use Markdown formatting: **bold** for component names, numbered lists for steps, bullet lists for suggestions.\n` +
  `- Keep your language concise and professional — no filler phrases like "Great question" or "Let me explain".\n` +
  `- If you can't clearly read part of the diagram, say so rather than guessing.`;

/* ── Per-style user prompts (much more structured than v2) ─────── */

const STYLE_PROMPTS = {
  steps:
    `Analyze this architecture/flow diagram and produce a **numbered step-by-step walkthrough**.\n\n` +
    `Format rules:\n` +
    `1. Start with a one-line summary: "## Overview" followed by what this system does in one sentence.\n` +
    `2. Then "## Flow" followed by numbered steps.\n` +
    `3. Each step: state the **source component**, the **action/data** that moves, and the **destination component**.\n` +
    `4. At decision/branch points, indent sub-steps and label each branch clearly.\n` +
    `5. End with "## Key Components" — a short bullet list of every distinct component with a one-line role description.\n\n` +
    `Keep each step to 1–2 sentences. Use **bold** for component names.`,

  example:
    `Analyze this architecture/flow diagram by walking through **one concrete, realistic example** from start to finish.\n\n` +
    `Format rules:\n` +
    `1. Start with "## Scenario" and describe the specific situation (invent a realistic user, request, or event — use a name, e.g. "Priya submits an order for 3 items").\n` +
    `2. Then "## Walkthrough" — narrate what happens at each stage, referencing the actual component names from the diagram in **bold**.\n` +
    `3. At each component, describe what it does to the data/request in this specific case.\n` +
    `4. If there are branches or error paths, pick the main success path first, then briefly note what would happen on the alternate path.\n` +
    `5. End with "## Result" — what the end-user sees or what state the system is in after the flow completes.\n\n` +
    `Make it read like a short, engaging technical narrative — not a list.`,

  suggestions:
    `Analyze this architecture/flow diagram and provide **practical architectural suggestions**.\n\n` +
    `Format rules:\n` +
    `1. Start with "## Assessment" — a 2-sentence summary of the architecture's overall approach and maturity.\n` +
    `2. Then "## Potential Issues" — a bullet list of failure points, bottlenecks, single points of failure, or missing error handling you can spot.\n` +
    `3. Then "## Missing Pieces" — things the diagram doesn't show but should (monitoring, auth, rate limiting, retries, fallbacks, etc.).\n` +
    `4. Then "## Recommendations" — prioritized, actionable improvements. For each, name the specific component and what to change.\n` +
    `5. End with "## Strengths" — 2–3 things the architecture does well (be genuine, not boilerplate).\n\n` +
    `Be specific to this diagram — don't give generic advice that could apply to any system.`,
};

/* ── Module state ──────────────────────────────────────────────── */

let containerEl       = null;
let pendingImageBase64 = null;
let pendingImageName   = null;
let activeStyle        = "steps";
/** In-memory cache: { [styleKey]: { text, provider } } */
let explanationCache   = {};
let currentAnalysisId  = null;
let isLoading          = false;

/* ── Public entry point ────────────────────────────────────────── */

export function initAnalyzeDiagramView(container) {
  containerEl         = container;
  pendingImageBase64  = null;
  pendingImageName    = null;
  activeStyle         = "steps";
  explanationCache    = {};
  currentAnalysisId   = null;
  isLoading           = false;
  render();
}

/* ── Main render ───────────────────────────────────────────────── */

function render() {
  containerEl.innerHTML = `
    <style>${MODULE_CSS}</style>
    <h2>Analyze a diagram</h2>
    <p style="font-size:13px;">Upload an architecture or flow diagram image — choose how you'd like it explained.</p>

    <div class="panel corner-frame">
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
  `;

  const uploadInput = document.getElementById("upload-input");
  const uploadZone  = document.getElementById("upload-zone");

  uploadInput.addEventListener("change", handleFileSelect);

  /* Drag & drop support */
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("adm-drag-over");
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("adm-drag-over");
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("adm-drag-over");
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      /* Create a synthetic event-like object so handleFileSelect works */
      handleFileSelect({ target: { files: [file] } });
    }
  });

  renderStyleToggle();
  renderAnalysesList();
}

/* ── Module-scoped CSS ─────────────────────────────────────────── */

const MODULE_CSS = `
  .adm-upload-zone {
    display: flex; align-items: center; justify-content: center;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-md);
    padding: 28px 16px; cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  }
  .adm-upload-zone:hover, .adm-drag-over {
    border-color: var(--color-accent) !important;
    background: var(--color-accent-faint);
  }
  .adm-upload-content { display:flex; flex-direction:column; align-items:center; gap:6px; pointer-events:none; }

  .adm-toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; flex-wrap:wrap; gap:8px; }

  .adm-status { font-size:12px; color:var(--color-text-tertiary); margin-top:8px; }

  .adm-provider-badge {
    display:inline-block; font-size:11px; padding:2px 10px;
    border-radius:20px; margin-bottom:10px;
    background:var(--color-accent-faint); color:var(--color-accent);
    font-family:var(--font-mono); letter-spacing:0.03em;
  }
  .adm-provider-badge.hidden { display:none; }

  /* Loading skeleton */
  .adm-skeleton { display:flex; flex-direction:column; gap:10px; }
  .adm-skeleton.hidden { display:none; }
  .adm-skeleton-line {
    height:14px; border-radius:4px;
    background: linear-gradient(90deg, var(--color-bg-raised) 25%, rgba(212,255,58,0.08) 50%, var(--color-bg-raised) 75%);
    background-size: 200% 100%;
    animation: adm-shimmer 1.5s ease-in-out infinite;
  }
  .w100 { width:100%; } .w90 { width:90%; } .w80 { width:80%; }
  .w70 { width:70%; } .w60 { width:60%; } .w45 { width:45%; }
  @keyframes adm-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }

  /* Explanation rendering (basic Markdown) */
  .adm-explanation { font-size:14px; line-height:1.7; }
  .adm-explanation h2 { font-size:17px; margin:18px 0 6px; color:var(--color-accent); font-family:var(--font-serif); }
  .adm-explanation h3 { font-size:15px; margin:14px 0 4px; color:var(--color-text); }
  .adm-explanation ul, .adm-explanation ol { padding-left:22px; margin:6px 0; }
  .adm-explanation li { margin:4px 0; }
  .adm-explanation strong { color:var(--color-text); }
  .adm-explanation p { margin:6px 0; color:var(--color-text-secondary); }
  .adm-explanation code {
    background:var(--color-bg-inset); padding:1px 5px; border-radius:3px;
    font-family:var(--font-mono); font-size:13px;
  }

  /* Retry button */
  .adm-retry-btn {
    margin-top:10px; padding:6px 16px;
    background:transparent; border:1px solid var(--color-danger);
    color:var(--color-danger); border-radius:var(--radius-sm);
    font-size:13px; font-family:var(--font-mono); cursor:pointer;
    transition: background 0.2s;
  }
  .adm-retry-btn:hover { background:rgba(255,90,78,0.12); }

  /* Download button */
  .adm-download-btn {
    padding:4px 12px; background:transparent;
    border:1px solid var(--color-border-strong);
    color:var(--color-text-secondary); border-radius:var(--radius-sm);
    font-size:12px; font-family:var(--font-mono); cursor:pointer;
    transition: color 0.2s, border-color 0.2s;
  }
  .adm-download-btn:hover { color:var(--color-accent); border-color:var(--color-accent); }

  /* Analysis list items */
  .adm-analysis-item {
    padding:10px 0; border-top:1px solid var(--color-border);
  }
  .adm-analysis-meta {
    font-size:11px; color:var(--color-text-tertiary); margin-top:2px;
  }
`;

/* ── Style toggle buttons ──────────────────────────────────────── */

function renderStyleToggle() {
  const toggleEl = document.getElementById("style-toggle");
  if (!toggleEl) return;

  toggleEl.innerHTML = STYLES.map(
    (s) =>
      `<button class="btn${s.key === activeStyle ? " btn-primary" : ""}" data-style="${s.key}">` +
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
  const actionsEl = document.getElementById("action-buttons");
  if (!actionsEl) return;

  const hasAny = Object.keys(explanationCache).length > 0;
  actionsEl.innerHTML = hasAny
    ? `<button class="adm-download-btn" id="download-btn" title="Download as Markdown">⬇ Download</button>`
    : "";

  const dlBtn = document.getElementById("download-btn");
  if (dlBtn) dlBtn.addEventListener("click", downloadAnalysis);
}

/* ── File handling ─────────────────────────────────────────────── */

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

  /* Hide upload zone once image is loaded */
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

/* ── Style switching ───────────────────────────────────────────── */

async function switchStyle(styleKey) {
  activeStyle = styleKey;
  renderStyleToggle();
  await loadOrGenerateExplanation(styleKey);
}

/* ── Core explanation flow ─────────────────────────────────────── */

async function loadOrGenerateExplanation(styleKey) {
  const explanationEl = document.getElementById("explanation-text");
  const statusEl      = document.getElementById("analyze-status");
  const skeletonEl    = document.getElementById("loading-skeleton");
  const badgeEl       = document.getElementById("provider-badge");

  /* Cached? Show immediately. */
  if (explanationCache[styleKey]) {
    skeletonEl.classList.add("hidden");
    badgeEl.classList.remove("hidden");
    badgeEl.textContent = explanationCache[styleKey].provider
      ? `Generated by ${explanationCache[styleKey].provider}`
      : "Manual entry";
    explanationEl.innerHTML = renderMarkdown(explanationCache[styleKey].text);
    explanationEl.contentEditable = "false";
    explanationEl.style.border = "none";
    explanationEl.style.padding = "0";
    statusEl.textContent = "";
    renderActionButtons();
    return;
  }

  const { provider, apiKey } = await loadApiConfig();

  /* No API key → manual entry mode */
  if (!provider || !apiKey) {
    skeletonEl.classList.add("hidden");
    badgeEl.classList.add("hidden");
    statusEl.textContent =
      "No API key configured — go to Settings to add one, or write this explanation yourself below.";
    explanationEl.innerHTML = "";
    explanationEl.contentEditable = "true";
    explanationEl.style.border = "1px dashed var(--color-border-strong)";
    explanationEl.style.padding = "8px";
    explanationEl.style.borderRadius = "var(--radius-md)";
    explanationEl.focus();
    attachManualSaveButton(styleKey);
    return;
  }

  /* Show loading skeleton */
  isLoading = true;
  explanationEl.innerHTML = "";
  badgeEl.classList.add("hidden");
  skeletonEl.classList.remove("hidden");
  statusEl.textContent = `Analyzing with ${provider}…`;

  /* Disable style buttons during load */
  document.querySelectorAll("#style-toggle .btn").forEach((b) => (b.style.opacity = "0.5"));

  try {
    const explanation = await callVisionProvider(provider, apiKey, pendingImageBase64, styleKey);

    explanationCache[styleKey] = { text: explanation, provider };
    skeletonEl.classList.add("hidden");
    badgeEl.classList.remove("hidden");
    badgeEl.textContent = `Generated by ${provider}`;
    explanationEl.innerHTML = renderMarkdown(explanation);
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

    const errorHint = getErrorHint(err, provider);
    statusEl.innerHTML = "";

    const errMsg = document.createElement("span");
    errMsg.textContent = errorHint;
    statusEl.appendChild(errMsg);

    /* Retry button */
    const retryBtn = document.createElement("button");
    retryBtn.className = "adm-retry-btn";
    retryBtn.textContent = "↻ Retry";
    retryBtn.addEventListener("click", () => {
      statusEl.textContent = "";
      loadOrGenerateExplanation(styleKey);
    });
    statusEl.appendChild(retryBtn);

    /* Manual fallback */
    explanationEl.innerHTML = "";
    explanationEl.contentEditable = "true";
    explanationEl.style.border = "1px dashed var(--color-border-strong)";
    explanationEl.style.padding = "8px";
    explanationEl.style.borderRadius = "var(--radius-md)";
    attachManualSaveButton(styleKey);
  } finally {
    isLoading = false;
    document.querySelectorAll("#style-toggle .btn").forEach((b) => (b.style.opacity = "1"));
  }
}

/* ── Error hints ───────────────────────────────────────────────── */

function getErrorHint(err, provider) {
  const msg = err.message || "";

  if (msg.includes("401") || msg.includes("403"))
    return `Authentication failed — double-check your ${provider} API key in Settings.`;
  if (msg.includes("429"))
    return `Rate limit hit on ${provider}. Wait a moment, then retry.`;
  if (msg.includes("413") || msg.includes("too large"))
    return `Image may be too large for ${provider}. Try a smaller/lower-res image.`;
  if (msg.includes("500") || msg.includes("502") || msg.includes("503"))
    return `${provider} is having server issues. Try again in a minute.`;
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError"))
    return `Network error — check your internet connection and retry.`;

  return `Could not get explanation from ${provider}: ${msg}`;
}

/* ── Manual save ───────────────────────────────────────────────── */

function attachManualSaveButton(styleKey) {
  const explanationPanel = document.getElementById("explanation-panel");
  const existing = document.getElementById("manual-save-btn");
  if (existing) existing.remove();

  const btn = document.createElement("button");
  btn.id = "manual-save-btn";
  btn.className = "btn btn-primary mt-2";
  btn.textContent = "Save my explanation";
  btn.addEventListener("click", async () => {
    const rawText = document.getElementById("explanation-text").textContent.trim();
    if (!rawText) return;
    explanationCache[styleKey] = { text: rawText, provider: null };
    await persistAnalysis();
    btn.textContent = "✓ Saved";
    setTimeout(() => btn.remove(), 1200);
    renderAnalysesList();
    renderActionButtons();
  });
  explanationPanel.appendChild(btn);
}

/* ── Persistence ───────────────────────────────────────────────── */

async function persistAnalysis() {
  /* Flatten cache for storage (just the text strings, for backward compat) */
  const flatExplanations = {};
  for (const [key, val] of Object.entries(explanationCache)) {
    flatExplanations[key] = typeof val === "string" ? val : val.text;
  }

  const saved = await storage.analyses.save({
    id: currentAnalysisId,
    imageBase64: pendingImageBase64,
    imageName: pendingImageName,
    explanations: flatExplanations,
  });
  currentAnalysisId = saved.id;
}

/* ── Download as Markdown ──────────────────────────────────────── */

function downloadAnalysis() {
  if (Object.keys(explanationCache).length === 0) return;

  const title = pendingImageName
    ? pendingImageName.replace(/\.[^.]+$/, "")
    : "Diagram Analysis";

  let md = `# ${title}\n\n`;
  md += `_Generated by ArchitectSmartCraft_\n`;
  md += `_Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}_\n\n---\n\n`;

  for (const style of STYLES) {
    const cached = explanationCache[style.key];
    if (!cached) continue;

    const text = typeof cached === "string" ? cached : cached.text;
    md += `# ${style.icon} ${style.label}\n\n`;
    md += text + "\n\n---\n\n";
  }

  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, "_")}-analysis.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── Vision API call ───────────────────────────────────────────── */

/**
 * Calls the selected provider's vision endpoint with the overhauled
 * system + style prompts. Normalizes each provider's response.
 */
async function callVisionProvider(provider, apiKey, imageBase64, styleKey) {
  const userPrompt = STYLE_PROMPTS[styleKey];
  const messages = buildMessages(provider, imageBase64, userPrompt);
  const { url, headers, body } = buildRequest(provider, apiKey, messages);

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody.error?.message) detail += ` — ${errBody.error.message}`;
    } catch (_) { /* ignore parse errors */ }
    throw new Error(`${capitalize(provider)} API error (${detail})`);
  }

  const data = await res.json();
  return extractContent(data);
}

function buildMessages(provider, imageBase64, userPrompt) {
  if (provider === "cerebras") {
    /* Cerebras: no vision support → text-only with context */
    return [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content:
          `I have an architecture/flow diagram image I can't share directly. ` +
          `Based on general best practices for software architecture diagrams, ` +
          `please provide the following analysis. If you can't be specific about ` +
          `components (since you can't see them), use placeholders like ` +
          `"Component A → Component B" and note that the user should map these ` +
          `to their actual diagram.\n\n${userPrompt}`,
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
  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "groq") {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      headers: authHeaders,
      body: {
        model: "llama-3.2-90b-vision-preview",
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      },
    };
  }

  if (provider === "mistral") {
    return {
      url: "https://api.mistral.ai/v1/chat/completions",
      headers: authHeaders,
      body: {
        model: "pixtral-12b-2409",
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      },
    };
  }

  if (provider === "cerebras") {
    return {
      url: "https://api.cerebras.ai/v1/chat/completions",
      headers: authHeaders,
      body: {
        model: "llama3.1-8b",
        messages,
        temperature: 0.3,
        max_tokens: 2048,
      },
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}

function extractContent(data) {
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }
  throw new Error("Unexpected API response format — no content returned.");
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Basic Markdown → HTML renderer ────────────────────────────── */

function renderMarkdown(text) {
  if (!text) return "";

  return text
    /* Escape HTML entities */
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    /* Headings */
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h2>$1</h2>")
    /* Bold + italic */
    .replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    /* Inline code */
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    /* Horizontal rule */
    .replace(/^---+$/gm, "<hr style='border:none;border-top:1px solid var(--color-border);margin:14px 0;'/>")
    /* Unordered lists (- item) */
    .replace(/^[ \t]*[-•] (.+)$/gm, "<li>$1</li>")
    /* Ordered lists (1. item) */
    .replace(/^[ \t]*\d+\.\s(.+)$/gm, "<li>$1</li>")
    /* Wrap consecutive <li> in <ul> or <ol> */
    .replace(/((?:<li>.*<\/li>\n?)+)/g, (match) => {
      /* Detect if first original line was numbered */
      return `<ul>${match}</ul>`;
    })
    /* Paragraphs — blank-line separated blocks */
    .replace(/\n{2,}/g, "</p><p>")
    /* Single newlines → <br> inside paragraphs */
    .replace(/\n/g, "<br/>")
    /* Wrap in paragraph */
    .replace(/^(.+)/, "<p>$1</p>")
    /* Clean up empty paragraphs */
    .replace(/<p>\s*<\/p>/g, "")
    /* Don't wrap block elements in <p> */
    .replace(/<p>(<h[23]>)/g, "$1")
    .replace(/(<\/h[23]>)<\/p>/g, "$1")
    .replace(/<p>(<ul>)/g, "$1")
    .replace(/(<\/ul>)<\/p>/g, "$1")
    .replace(/<p>(<hr[^>]*\/>)/g, "$1")
    .replace(/(<hr[^>]*\/>)<\/p>/g, "$1");
}

/* ── Saved analyses list ───────────────────────────────────────── */

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
      const styles = a.explanations
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
          ${new Date(a.createdAt).toLocaleString()} · ${styles} ${styleCount} explanation${styleCount === 1 ? "" : "s"}
        </div>
      </div>
    `;
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

  /* Normalize old-format explanations (plain strings) to { text, provider } */
  explanationCache = {};
  if (analysis.explanations) {
    for (const [key, val] of Object.entries(analysis.explanations)) {
      explanationCache[key] =
        typeof val === "string" ? { text: val, provider: null } : val;
    }
  }

  activeStyle = STYLES.find((s) => explanationCache[s.key])?.key || "steps";

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg  = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  /* Hide upload zone */
  const zone = document.getElementById("upload-zone");
  if (zone) zone.style.display = "none";

  document.getElementById("explanation-panel").style.display = "block";
  renderStyleToggle();
  await loadOrGenerateExplanation(activeStyle);

  document.getElementById("explanation-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ── Utility ───────────────────────────────────────────────────── */

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
