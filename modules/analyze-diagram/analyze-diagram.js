/**
 * modules/analyze-diagram/analyze-diagram.js
 * ----------------------------------------------------------------
 * AnalyzeDiagram module v2 — upload an existing diagram image and
 * get an explanation in one of three styles, chosen via toggle
 * buttons:
 *   - steps     : plain step-by-step walkthrough
 *   - example   : a real-world worked example following the flow
 *   - suggestions: best-practice notes / things to watch for
 *
 * Each style is its own API call (only fetched once per image,
 * then cached in memory + storage so switching tabs is instant on
 * revisit). Independent of CreateDiagram; reads API config from
 * settings.js only.
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";
import { loadApiConfig } from "../settings/settings.js";

const STYLES = [
  { key: "steps", label: "Step-by-step" },
  { key: "example", label: "Real-world example" },
  { key: "suggestions", label: "Suggestions" },
];

const STYLE_PROMPTS = {
  steps:
    "Explain this architecture or flow diagram as a plain numbered list of steps, " +
    "in the order the flow happens. Include each decision point and where each branch leads. " +
    "Keep each step to one or two sentences.",
  example:
    "Walk through this architecture or flow diagram using one concrete, realistic example " +
    "(invent a specific scenario, e.g. a named user or named request) moving through the system from start to finish. " +
    "Make it relatable, like a short story of one case going through the flow.",
  suggestions:
    "Look at this architecture or flow diagram and give practical suggestions: potential failure points, " +
    "edge cases the diagram might be missing, and best practices for a flow like this. " +
    "Keep it to a short bulleted list.",
};

let containerEl = null;
let pendingImageBase64 = null;
let pendingImageName = null;
let activeStyle = "steps";
/** In-memory cache of generated explanations for the current upload, keyed by style. */
let explanationCache = {};
let currentAnalysisId = null;

export function initAnalyzeDiagramView(container) {
  containerEl = container;
  pendingImageBase64 = null;
  pendingImageName = null;
  activeStyle = "steps";
  explanationCache = {};
  currentAnalysisId = null;
  render();
}

function render() {
  containerEl.innerHTML = `
    <h2>Analyze a diagram</h2>
    <p style="font-size:13px;">Upload an existing architecture or flow diagram image. Choose how you'd like it explained.</p>

    <div class="panel corner-frame">
      <span class="label">Upload image</span>
      <input type="file" id="upload-input" accept="image/*" />
      <div id="image-preview-wrap" class="mt-2 hidden">
        <img id="image-preview" style="max-width:100%; border-radius: var(--radius-md); border:1px solid var(--color-border);" />
      </div>
      <p id="analyze-status" style="font-size:12px; color: var(--color-text-tertiary); margin-top:8px;"></p>
    </div>

    <div class="panel mt-2" id="explanation-panel" style="display:none;">
      <div class="flex gap-1" id="style-toggle" style="margin-bottom:14px; flex-wrap:wrap;"></div>
      <div id="explanation-text" style="font-size:14px; white-space:pre-wrap;"></div>
    </div>

    <div class="panel mt-2">
      <span class="label">Previous analyses</span>
      <div id="analyses-list"></div>
    </div>
  `;

  document.getElementById("upload-input").addEventListener("change", handleFileSelect);
  renderStyleToggle();
  renderAnalysesList();
}

function renderStyleToggle() {
  const toggleEl = document.getElementById("style-toggle");
  if (!toggleEl) return;

  toggleEl.innerHTML = STYLES.map(
    (s) => `<button class="btn${s.key === activeStyle ? " btn-primary" : ""}" data-style="${s.key}">${s.label}</button>`
  ).join("");

  toggleEl.querySelectorAll("[data-style]").forEach((btn) => {
    btn.addEventListener("click", () => switchStyle(btn.dataset.style));
  });
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  pendingImageName = file.name;
  pendingImageBase64 = await fileToBase64(file);
  explanationCache = {};
  currentAnalysisId = null;
  activeStyle = "steps";

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  document.getElementById("explanation-panel").style.display = "block";
  renderStyleToggle();
  await loadOrGenerateExplanation(activeStyle);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function switchStyle(styleKey) {
  activeStyle = styleKey;
  renderStyleToggle();
  await loadOrGenerateExplanation(styleKey);
}

async function loadOrGenerateExplanation(styleKey) {
  const explanationText = document.getElementById("explanation-text");
  const statusEl = document.getElementById("analyze-status");

  if (explanationCache[styleKey]) {
    explanationText.contentEditable = "false";
    explanationText.style.border = "none";
    explanationText.textContent = explanationCache[styleKey];
    statusEl.textContent = "";
    return;
  }

  const { provider, apiKey } = await loadApiConfig();

  if (!provider || !apiKey) {
    statusEl.textContent = "No API key configured. Go to Settings to add a Groq, Cerebras, or Mistral key, or write this explanation yourself below.";
    explanationText.contentEditable = "true";
    explanationText.textContent = "";
    explanationText.style.border = "1px dashed var(--color-border-strong)";
    explanationText.style.padding = "8px";
    explanationText.style.borderRadius = "var(--radius-md)";
    explanationText.focus();
    attachManualSaveButton(styleKey);
    return;
  }

  explanationText.textContent = "";
  statusEl.textContent = `Asking ${provider} for the ${styleLabel(styleKey)} explanation...`;

  try {
    const explanation = await callVisionProvider(provider, apiKey, pendingImageBase64, STYLE_PROMPTS[styleKey]);
    explanationCache[styleKey] = explanation;
    explanationText.contentEditable = "false";
    explanationText.style.border = "none";
    explanationText.textContent = explanation;
    statusEl.textContent = "";

    await persistAnalysis();
    renderAnalysesList();
  } catch (err) {
    statusEl.textContent = `Could not get explanation: ${err.message}. You can write one manually below instead.`;
    explanationText.contentEditable = "true";
    explanationText.textContent = "";
    explanationText.style.border = "1px dashed var(--color-border-strong)";
    explanationText.style.padding = "8px";
    explanationText.style.borderRadius = "var(--radius-md)";
    attachManualSaveButton(styleKey);
  }
}

function styleLabel(key) {
  return STYLES.find((s) => s.key === key)?.label || key;
}

function attachManualSaveButton(styleKey) {
  const explanationPanel = document.getElementById("explanation-panel");
  const existing = document.getElementById("manual-save-btn");
  if (existing) existing.remove();

  const btn = document.createElement("button");
  btn.id = "manual-save-btn";
  btn.className = "btn btn-primary mt-2";
  btn.textContent = "Save my explanation";
  btn.addEventListener("click", async () => {
    const text = document.getElementById("explanation-text").textContent.trim();
    if (!text) return;
    explanationCache[styleKey] = text;
    await persistAnalysis();
    btn.textContent = "Saved";
    setTimeout(() => btn.remove(), 1200);
    renderAnalysesList();
  });
  explanationPanel.appendChild(btn);
}

/** Saves (or updates) the analysis record with whatever styles have been generated so far. */
async function persistAnalysis() {
  const saved = await storage.analyses.save({
    id: currentAnalysisId,
    imageBase64: pendingImageBase64,
    imageName: pendingImageName,
    explanations: { ...explanationCache },
  });
  currentAnalysisId = saved.id;
}

/**
 * Calls the selected provider's chat-completions-with-vision endpoint
 * with a given prompt. Normalizes each provider's response shape into
 * a single returned explanation string.
 */
async function callVisionProvider(provider, apiKey, imageBase64, prompt) {
  if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.2-90b-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: imageBase64 } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq API error (${res.status})`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === "mistral") {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "pixtral-12b-2409",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: imageBase64 },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Mistral API error (${res.status})`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  if (provider === "cerebras") {
    // Cerebras does not currently support vision input — falls back to
    // a text-only prompt describing the requested explanation style.
    const res = await fetch("https://api.cerebras.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama3.1-8b",
        messages: [
          {
            role: "user",
            content:
              "I have an architecture diagram image I can't show you directly. " +
              prompt +
              " Since you can't see the image, give general guidance for a typical onboarding/automation flow diagram instead.",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Cerebras API error (${res.status})`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  throw new Error(`Unknown provider: ${provider}`);
}

// ----------------------------------------------------------------
// Saved analyses list
// ----------------------------------------------------------------

async function renderAnalysesList() {
  const listEl = document.getElementById("analyses-list");
  if (!listEl) return;

  const analyses = await storage.analyses.list();

  if (analyses.length === 0) {
    listEl.innerHTML = `<p style="font-size:13px; color: var(--color-text-tertiary); margin:0;">No analyses yet.</p>`;
    return;
  }

  listEl.innerHTML = analyses
    .map((a) => {
      const styleCount = a.explanations ? Object.keys(a.explanations).length : 0;
      return `
      <div style="padding:10px 0; border-top:1px solid var(--color-border);">
        <div class="flex-between">
          <div style="font-size:14px;">${escapeHtml(a.imageName || "Untitled image")}</div>
          <div class="flex gap-1">
            <button class="btn" data-open="${a.id}">Open</button>
            <button class="btn btn-danger" data-delete="${a.id}">Delete</button>
          </div>
        </div>
        <div style="font-size:11px; color: var(--color-text-tertiary);">${new Date(a.createdAt).toLocaleString()} · ${styleCount} explanation${styleCount === 1 ? "" : "s"} saved</div>
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
        renderAnalysesList();
      }
    });
  });
}

async function openSavedAnalysis(id) {
  const analysis = await storage.analyses.get(id);
  if (!analysis) return;

  currentAnalysisId = analysis.id;
  pendingImageBase64 = analysis.imageBase64;
  pendingImageName = analysis.imageName;
  explanationCache = { ...(analysis.explanations || {}) };
  activeStyle = STYLES.find((s) => explanationCache[s.key])?.key || "steps";

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  document.getElementById("explanation-panel").style.display = "block";
  renderStyleToggle();
  await loadOrGenerateExplanation(activeStyle);

  document.getElementById("explanation-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
