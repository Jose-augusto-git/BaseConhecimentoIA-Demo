/**
 * Logic for Hybrid Intelligence Tab
 * Handles Neural classification, manual override, and real-time graph updates.
 */

const HYBRID_THRESHOLD = 0.6;
let currentHybridMode = 'test'; // 'test' | 'override'
let lastClassificationResult = null;
let hybridChart = null;

// Helper to encapsulate UI dependencies and avoid global pollution issues
const HybridUI = {
    notify: (msg, type = 'info') => {
        if (typeof window.showNotification === 'function') {
            window.showNotification(msg, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${msg}`);
            if (type === 'error' || type === 'warning') alert(msg);
        }
    },
    confirm: async (title, msg, btnText, type) => {
        if (typeof window.showConfirmation === 'function') {
            return await window.showConfirmation(title, msg, btnText, type);
        }
        return confirm(`${title}\n\n${msg}`);
    },
    switchView: (view) => {
        if (typeof window.switchView === 'function') window.switchView(view);
    },
    spawnNeuron: (title, category, text) => {
        if (typeof window.spawnLearningNeuron === 'function') {
            window.spawnLearningNeuron(title, category, text);
        }
    }
};

function setHybridMode(mode) {
    currentHybridMode = mode;

    // Update Buttons
    const btnTest = document.getElementById('btnTestMode');
    const btnOverride = document.getElementById('btnOverrideMode');
    if (btnTest) btnTest.classList.toggle('active', mode === 'test');
    if (btnOverride) btnOverride.classList.toggle('active', mode === 'override');

    // Update Styles
    const inputArea = document.getElementById('hybridInput');
    const actions = document.getElementById('overrideActions');

    if (inputArea && actions) {
        if (mode === 'override') {
            inputArea.style.borderColor = '#FFD700'; // Gold warning
            if (lastClassificationResult) {
                actions.style.display = 'block';
            }
        } else {
            inputArea.style.borderColor = 'rgba(255,255,255,0.1)';
            actions.style.display = 'none';
        }
    }
}

/**
 * Smart Title Generator
 * Extracts the first sentence and truncates intelligently.
 */
function generateTitle(text) {
    if (!text) return "Sem Título";
    // Split by common sentence terminators, take the first one
    const firstSentence = text.split(/[.!?\n]/)[0].trim();
    // Truncate if too long
    return firstSentence.length > 80
        ? firstSentence.substring(0, 77) + '...'
        : firstSentence;
}

async function runHybridAnalysis() {
    const inputEl = document.getElementById('hybridInput');
    const text = inputEl ? inputEl.value.trim() : '';

    if (!text) {
        HybridUI.notify("Por favor, insira um texto para análise.", "warning");
        return;
    }

    const btn = document.getElementById('btnRunAnalysis');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Analisando...';
    btn.disabled = true;

    // Reset UI
    const resultContainer = document.getElementById('inferenceResult');
    if (resultContainer) resultContainer.style.display = 'none';

    // Timeout Controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
        const response = await fetch('/api/hybrid/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: controller.signal
        });

        // HTTP Error Handling
        if (!response.ok) {
            if (response.status === 429) {
                throw new Error("Muitas requisições. Aguarde um momento.");
            } else if (response.status >= 500) {
                throw new Error("Erro interno do servidor.");
            }
            const errData = await response.json();
            throw new Error(errData.error || "Erro na análise.");
        }

        const data = await response.json();

        if (validateApiResponse(data)) {
            displayInferenceResult(data);
            logDecision(data, text);
        } else {
            throw new Error("Formato de resposta inválido.");
        }

    } catch (e) {
        console.error("Hybrid Inference Error:", e);
        if (e.name === 'AbortError') {
            HybridUI.notify("Tempo limite esgotado. Tente novamente.", "error");
        } else {
            HybridUI.notify(e.message, "error");
        }
    } finally {
        clearTimeout(timeoutId);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function validateApiResponse(data) {
    return (
        data.predictions &&
        typeof data.predictions.is_concept === 'number' &&
        typeof data.predictions.is_definition === 'number' &&
        typeof data.predictions.is_article === 'number'
    );
}

function displayInferenceResult(data) {
    lastClassificationResult = data;
    const preds = data.predictions;
    const decisionData = data.decision || {};

    const resultContainer = document.getElementById('inferenceResult');
    if (resultContainer) resultContainer.style.display = 'block';

    // Update Progress Bars
    updateBar('barConcept', 'probConcept', preds.is_concept);
    updateBar('barDefinition', 'probDefinition', preds.is_definition);
    updateBar('barArticle', 'probArticle', preds.is_article);

    // Update Radar Chart
    renderRadarChart(preds);

    // Meta Info
    const metaModel = document.getElementById('metaModel');
    if (metaModel) metaModel.innerText = data.metadata.model_version || 'Unknown';

    const metaConf = document.getElementById('metaConfidence');
    if (metaConf) metaConf.innerText = `${decisionData.confidence_level || 'Medium'} (Limiar: ${HYBRID_THRESHOLD})`;

    const metaCat = document.getElementById('metaSuggestedCategory');
    if (metaCat) metaCat.value = (data.derived_context && data.derived_context.suggested_category) || 'Geral';

    // Suporte para tags sugeridas
    const suggestedTags = (data.derived_context && data.derived_context.suggested_tags) || [];
    const metaTags = document.getElementById('metaSuggestedTags');
    if (metaTags) metaTags.value = suggestedTags.join(', ');

    // Determine Decision Display from Backend
    const decisionEl = document.getElementById('metaDecision');
    if (decisionEl) {
        decisionEl.innerText = `${decisionData.action} (${decisionData.reason})`;

        // Color coding based on Action
        if (decisionData.action === 'AUTO_UPDATE') decisionEl.style.color = '#00f3ff'; // Cyan
        else if (decisionData.action === 'SUGGEST_REVIEW') decisionEl.style.color = '#ff9900'; // Orange
        else decisionEl.style.color = '#ff0055'; // Red/Discard
    }

    // Show actions if in override mode
    const actions = document.getElementById('overrideActions');
    if (actions && currentHybridMode === 'override') {
        actions.style.display = 'block';

        // Enable Apply button now that we have a result
        const applyBtn = actions.querySelector('button');
        if (applyBtn) applyBtn.disabled = false;
    }
}

function renderRadarChart(predictions) {
    const canvas = document.getElementById('hybridRadarChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    if (hybridChart) {
        hybridChart.destroy();
    }

    hybridChart = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Conceito', 'Definição', 'Artigo/Outros'],
            datasets: [{
                label: 'Probabilidade Neural',
                data: [predictions.is_concept, predictions.is_definition, predictions.is_article],
                backgroundColor: 'rgba(0, 243, 255, 0.2)',
                borderColor: '#00f3ff',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: '#00f3ff'
            }]
        },
        options: {
            maintainAspectRatio: false,
            scales: {
                r: {
                    angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    pointLabels: { color: '#fff', font: { size: 12 } },
                    suggestedMin: 0,
                    suggestedMax: 1,
                    ticks: { display: false, backdropColor: 'transparent' }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateBar(barId, labelId, value) {
    const bar = document.getElementById(barId);
    const label = document.getElementById(labelId);
    if (!bar || !label) return;

    const percent = Math.round(value * 100);
    bar.style.width = `${percent}%`;
    label.innerText = `${percent}%`;
}

function logDecision(data, text) {
    const container = document.getElementById('decisionLog');
    if (!container) return;

    const emptyState = container.querySelector('.log-empty');
    if (emptyState) emptyState.remove();

    const preds = data.predictions;
    const meta = data.metadata;
    const decision = data.decision || {};

    const entry = document.createElement('div');
    entry.style.background = 'transparent';
    entry.style.padding = '10px';
    entry.style.borderRadius = '0';
    entry.style.border = '1px dotted rgba(163,255,0,0.5)';
    entry.style.borderLeft = '4px solid #a3ff00';
    entry.style.fontFamily = "'Courier New', monospace";
    entry.style.fontSize = '0.85rem';
    entry.style.marginBottom = '10px';

    const snippet = text.length > 50 ? text.substring(0, 50) + "..." : text;
    const time = new Date().toLocaleTimeString();

    entry.innerHTML = `
        <div style="display:flex; justify-content:space-between; color: rgba(163,255,0,0.7); margin-bottom: 5px; font-weight: bold;">
            <span>[ ${time} ]</span>
            <span>${meta.model_version || 'N/A'}</span>
        </div>
        <div style="color: #fff; font-weight: bold; margin-bottom: 5px; border-bottom: 1px dashed rgba(163,255,0,0.2); padding-bottom: 5px;">
            > ${snippet.replace(/</g, '&lt;')}
        </div>
        <div style="color: #a3ff00; margin-bottom: 5px;">
            C: ${(preds.is_concept * 100).toFixed(0)}% | 
            D: ${(preds.is_definition * 100).toFixed(0)}% | 
            A: ${(preds.is_article * 100).toFixed(0)}%
        </div>
        <div style="color: rgba(255,255,255,0.5); font-style: italic;">
            ACT: <span style="color:#fff; background:rgba(163,255,0,0.2); padding:2px 4px;">${decision.action}</span>
        </div>
    `;

    container.prepend(entry);
}

// === REAL ACTION IMPLEMENTATION ===

async function applyHybridDecision() {
    if (!lastClassificationResult) {
        HybridUI.notify("Nenhum resultado de análise encontrado para processar.", "error");
        return;
    }

    const inputEl = document.getElementById('hybridInput');
    const text = inputEl ? inputEl.value.trim() : '';

    if (!text) {
        HybridUI.notify("Texto de análise não encontrado.", "warning");
        return;
    }

    const confirmed = await HybridUI.confirm(
        "Confirmar Inteligência Híbrida",
        "Deseja criar este novo conhecimento no grafo neural e na base de dados?",
        "Confirmar & Criar",
        "success"
    );

    if (!confirmed) return;

    const btn = document.querySelector('#overrideActions button');
    let originalText = '';

    if (btn) {
        originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando...';
        btn.disabled = true;
    }

    // Timeout Controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
        const preds = lastClassificationResult.predictions;
        const context = lastClassificationResult.derived_context || {};

        // 1. Generate Smart Title
        const title = generateTitle(text);

        // 2. Determine Category
        let category = 'Geral';
        const userCategory = document.getElementById('metaSuggestedCategory') ? document.getElementById('metaSuggestedCategory').value.trim() : '';

        if (userCategory) {
            category = userCategory;
        } else if (context.suggested_category && context.suggested_category !== "Ignored") {
            category = context.suggested_category;
        } else if (preds.is_concept > HYBRID_THRESHOLD) {
            category = 'Conceitos';
        } else if (preds.is_definition > HYBRID_THRESHOLD) {
            category = 'Glossário';
        }

        // 3. Robust Tag Logic (Array-based + Stricter Validation)
        const tagsArray = ['hybrid_auto'];

        // Neural Tags
        if (preds.is_concept > HYBRID_THRESHOLD) tagsArray.push('conceito');
        if (preds.is_definition > HYBRID_THRESHOLD) tagsArray.push('definição');

        // User/AI Suggested Tags (Sanitized)
        const safeTagRegex = /^[a-zA-Z0-9áéíóúãõç\-_ ]{1,30}$/i;
        const userTagsInput = document.getElementById('metaSuggestedTags') ? document.getElementById('metaSuggestedTags').value : '';
        const userTags = userTagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => safeTagRegex.test(t) && t.length >= 2); // Strict filter

        // Add valid unique tags
        if (userTags.length > 0) {
            userTags.forEach(t => { if (!tagsArray.includes(t)) tagsArray.push(t); });
        } else if (context.suggested_tags && context.suggested_tags.length > 0) {
            context.suggested_tags
                .filter(t => safeTagRegex.test(t))
                .forEach(t => { if (!tagsArray.includes(t)) tagsArray.push(t); });
        }

        const tags = tagsArray.join(', ');

        // 4. Create Article via API
        const articleData = {
            title: title,
            category: category,
            tags: tags,
            content: text
        };

        const response = await fetch('/api/articles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(articleData),
            signal: controller.signal
        });

        if (response.ok) {
            const result = await response.json();
            HybridUI.notify(`✅ Conhecimento criado com sucesso! ID: ${result.id}`, "success");

            // 5. Visual Feedback & Navigation
            HybridUI.switchView('neural');

            setTimeout(() => {
                HybridUI.spawnNeuron(title, category, text);
            }, 800);

            // 6. Send Training Feedback Log
            await sendFeedbackLog(text, lastClassificationResult, "Confirmed by User");

        } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || "Erro ao criar artigo.");
        }

    } catch (e) {
        console.error("Erro na aplicação:", e);
        if (e.name === 'AbortError') {
            HybridUI.notify("Tempo limite esgotado. Tente novamente.", "error");
        } else {
            HybridUI.notify(e.message, "error");
        }
    } finally {
        clearTimeout(timeoutId);
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }
}

async function sendFeedbackLog(text, neuralOutput, userAction) {
    // Feedback is fire-and-forget, but good to have a short timeout too
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5000);

    try {
        await fetch('/api/hybrid/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text,
                neural_output: neuralOutput,
                final_decision: userAction,
                user_correction: currentHybridMode === 'override' ? 'User Override' : 'Test'
            }),
            signal: controller.signal
        });
        console.log("Training feedback saved.");
    } catch (e) {
        console.warn("Failed to save feedback:", e);
    }
}
