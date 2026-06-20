/**
 * modules/analyze-diagram/analyze-diagram.js
 * ----------------------------------------------------------------
 * AnalyzeDiagram module — user uploads an existing architecture
 * diagram image, optionally calls a configured AI provider
 * (Groq / Cerebras / Mistral) to generate a plain-language,
 * step-by-step explanation, and the result is saved via storage.js.
 *
 * Fully independent of CreateDiagram and Settings, except it reads
 * the saved API config through settings.js's exported functions.
 * ----------------------------------------------------------------
 */

import storage from "../../js/storage.js";
import { loadApiConfig } from "../settings/settings.js";

let containerEl = null;
let pendingImageBase64 = null;
let pendingImageName = null;

export function initAnalyzeDiagramView(container) {
  containerEl = container;
  pendingImageBase64 = null;
  pendingImageName = null;
  render();
}

function render() {
  if (!containerEl) return;

  containerEl.innerHTML = `
    <h2>Analyze a diagram</h2>
    <p style="font-size:13px;">Upload an existing architecture or flow diagram image. Get a plain-language explanation, step by step.</p>

    <div class="panel corner-frame">
      <span class="label">Upload image</span>
      <input type="file" id="upload-input" accept="image/*" />
      <div id="image-preview-wrap" class="mt-2 hidden">
        <img id="image-preview" style="max-width:100%; border-radius: var(--radius-md); border:1px solid var(--color-border);" />
      </div>
      <button class="btn btn-primary mt-2" id="analyze-btn" disabled>Explain this diagram</button>
      <p id="analyze-status" style="font-size:12px; color: var(--color-text-tertiary); margin-top:8px;"></p>
    </div>

    <div class="panel mt-2" id="explanation-panel" style="display:none;">
      <span class="label">Explanation</span>
      <div id="explanation-text" style="font-size:14px; white-space:pre-wrap;"></div>
    </div>

    <div class="panel mt-2">
      <span class="label">Previous analyses</span>
      <div id="analyses-list"></div>
    </div>
  `;

  document.getElementById("upload-input").addEventListener("change", handleFileSelect);
  document.getElementById("analyze-btn").addEventListener("click", handleAnalyze);

  renderAnalysesList();
}

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  pendingImageName = file.name;
  pendingImageBase64 = await fileToBase64(file);

  const previewWrap = document.getElementById("image-preview-wrap");
  const previewImg = document.getElementById("image-preview");
  previewImg.src = pendingImageBase64;
  previewWrap.classList.remove("hidden");

  document.getElementById("analyze-btn").disabled = false;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function handleAnalyze() {
  const statusEl = document.getElementById("analyze-status");
  const explanationPanel = document.getElementById("explanation-panel");
  const explanationText = document.getElementById("explanation-text");
  const analyzeBtn = document.getElementById("analyze-btn");

  if (!pendingImageBase64) return;

  const { provider, apiKey } = await loadApiConfig();

  if (!provider || !apiKey) {
    statusEl.textContent = "No API key configured. Go to Settings to add a Groq, Cerebras, or Mistral key, or add your explanation manually below.";
    explanationPanel.style.display = "block";
    explanationText.contentEditable = "true";
    explanationText.textContent = "";
    explanationText.style.border = "1px dashed var(--color-border-strong)";
    explanationText.style.padding = "8px";
    explanationText.style.borderRadius = "var(--radius-md)";
    explanationText.focus();
    attachManualSaveButton();
    return;
  }

  analyzeBtn.disabled = true;
  statusEl.textContent = `Asking ${provider}...`;

  try {
    const explanation = await callVisionProvider(provider, apiKey, pendingImageBase64);
    explanationText.contentEditable = "false";
    explanationText.style.border = "none";
    explanationText.textContent = explanation;
    explanationPanel.style.display = "block";
    statusEl.textContent = "";

    await storage.analyses.save({
      imageBase64: pendingImageBase64,
      imageName: pendingImageName,
      explanation,
      steps: [],
    });
    renderAnalysesList();
  } catch (err) {
    statusEl.textContent = `Could not get explanation: ${err.message}. You can write one manually below instead.`;
    explanationPanel.style.display = "block";
    explanationText.contentEditable = "true";
    explanationText.textContent = "";
    explanationText.style.border = "1px dashed var(--color-border-strong)";
    explanationText.style.padding = "8px";
    explanationText.style.borderRadius = "var(--radius-md)";
    attachManualSaveButton();
  } finally {
    analyzeBtn.disabled = false;
  }
}

function attachManualSaveButton() {
  const explanationPanel = document.getElementById("explanation-panel");
  if (document.getElementById("manual-save-btn")) return;

  const btn = document.createElement("button");
  btn.id = "manual-save-btn";
  btn.className = "btn btn-primary mt-2";
  btn.textContent = "Save my explanation";
  btn.addEventListener("click", async () => {
    const text = document.getElementById("explanation-text").textContent.trim();
    if (!text) return;
    await storage.analyses.save({
      imageBase64: pendingImageBase64,
      imageName: pendingImageName,
      explanation: text,
      steps: [],
    });
    btn.textContent = "Saved";
    setTimeout(() => btn.remove(), 1200);
    renderAnalysesList();
  });
  explanationPanel.appendChild(btn);
}

/**
 * Calls the selected provider's chat-completions-with-vision endpoint.
 * NOTE: each provider has a different request/response shape. This
 * function normalizes them into a single returned explanation string.
 * API keys are read from local storage only — never hardcoded, never
 * sent anywhere except the chosen provider's own API endpoint.
 */
async function callVisionProvider(provider, apiKey, imageBase64) {
  const prompt =
    "Explain this architecture or flow diagram in plain language. " +
    "Describe it step by step, in the order the flow happens, including each decision point and outcome.";

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
    // Cerebras does not currently support vision input as of this app's
    // last update — this app sends a text-only fallback prompt instead.
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
              "Give general guidance on how to explain a typical onboarding/automation flow diagram step by step.",
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

async function renderAnalysesList() {
  const listEl = document.getElementById("analyses-list");
  if (!listEl) return;

  const analyses = await storage.analyses.list();

  if (analyses.length === 0) {
    listEl.innerHTML = `<p style="font-size:13px; color: var(--color-text-tertiary); margin:0;">No analyses yet.</p>`;
    return;
  }

  listEl.innerHTML = analyses
    .map(
      (a) => `
      <div style="padding:10px 0; border-top:1px solid var(--color-border);">
        <div class="flex-between">
          <div style="font-size:14px;">${escapeHtml(a.imageName || "Untitled image")}</div>
          <button class="btn btn-danger" data-delete="${a.id}">Delete</button>
        </div>
        <div style="font-size:11px; color: var(--color-text-tertiary); margin-bottom:6px;">${new Date(a.createdAt).toLocaleString()}</div>
        <div style="font-size:13px; color: var(--color-text-secondary);">${escapeHtml((a.explanation || "").slice(0, 140))}${a.explanation && a.explanation.length > 140 ? "..." : ""}</div>
      </div>
    `
    )
    .join("");

  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (confirm("Delete this analysis?")) {
        await storage.analyses.delete(btn.dataset.delete);
        renderAnalysesList();
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
