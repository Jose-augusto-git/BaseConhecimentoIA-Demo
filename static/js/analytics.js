/**
 * Analytics BI Service
 * Handles data visualization and Power BI exports
 */

let searchTrendsChart = null;
let categoryDistChart = null;

async function loadAnalyticsData() {
    console.log("📊 Loading Analytics Data...");
    const topList = document.getElementById('topSearchesList');

    try {
        const response = await fetch('/api/monitor/stats');
        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 1. Render Top Searches List
        renderTopSearches(data.top_terms);

        // 2. Render Trends Chart
        renderTrendsChart(data.trends);

        // 3. Render Category Distribution
        renderCategoryDistChart(data.categories);

        // 4. Render Interaction Stats
        if (data.interactions) {
            renderInteractionStats(data.interactions);
        }

    } catch (error) {
        console.error("❌ Error loading analytics:", error);
        if (topList) topList.innerHTML = `<div class="error">Erro ao carregar dados: ${error.message}</div>`;
    }
}

function renderTopSearches(terms) {
    const list = document.getElementById('topSearchesList');
    if (!list) return;

    if (!terms || terms.length === 0) {
        list.innerHTML = '<div class="empty-state">Sem buscas registradas ainda.</div>';
        return;
    }

    list.innerHTML = terms.map((item, index) => `
        <div class="analytics-list-item">
            <div class="term-info">
                <span class="term-name">${item.term}</span>
                <span class="term-meta">Posição #${index + 1}</span>
            </div>
            <span class="term-count">${item.count} buscas</span>
        </div>
    `).join('');
}

function renderTrendsChart(trends) {
    const ctx = document.getElementById('searchTrendsChart');
    if (!ctx) return;

    // Destroy previous instance
    if (searchTrendsChart) searchTrendsChart.destroy();

    const labels = trends.map(t => t.date);
    const values = trends.map(t => t.count);

    searchTrendsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Volume de Buscas',
                data: values,
                borderColor: '#a3ff00',
                backgroundColor: 'rgba(163, 255, 0, 0.1)',
                borderWidth: 2,
                tension: 0, // Sharp brutalist angles
                fill: true,
                pointBackgroundColor: '#020202',
                pointBorderColor: '#a3ff00',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#a3ff00',
                stepped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(163, 255, 0, 0.1)', borderDash: [5, 5] },
                    ticks: { color: '#a3ff00', font: { family: "'Courier New', monospace" } }
                },
                x: {
                    grid: { color: 'rgba(163, 255, 0, 0.1)', borderDash: [5, 5] },
                    ticks: { color: '#a3ff00', font: { family: "'Courier New', monospace" } }
                }
            }
        }
    });
}

function renderCategoryDistChart(categories) {
    const ctx = document.getElementById('categoryDistChart');
    if (!ctx) return;

    if (categoryDistChart) categoryDistChart.destroy();

    const labels = categories.map(c => c.name);
    const values = categories.map(c => c.count);

    categoryDistChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#a3ff00', '#ffffff', 'rgba(163, 255, 0, 0.5)', '#00f3ff', 'rgba(255, 255, 255, 0.5)', 'rgba(0, 243, 255, 0.5)'
                ],
                borderColor: '#020202',
                borderWidth: 2,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { color: '#a3ff00', font: { family: "'Courier New', monospace", size: 11 }, usePointStyle: true, pointStyle: 'rect' }
                }
            },
            cutout: '80%'
        }
    });
}

// ... existing code ...

async function generateInsights() {
    const btn = document.querySelector('button[onclick="generateInsights()"]');
    const originalText = btn.innerHTML;
    const panel = document.getElementById('aiInsightsPanel');
    const content = document.getElementById('aiInsightsContent');

    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Gerando...';

        const response = await fetch('/api/monitor/insights');
        const data = await response.json();

        if (data.insights) {
            panel.style.display = 'block';
            // Simple markdown parsing (bold and newlines)
            let formatted = data.insights
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br>');
            content.innerHTML = formatted;
        } else {
            alert("Não foi possível gerar insights no momento.");
        }
    } catch (error) {
        console.error("Error generating insights:", error);
        alert("Erro ao conectar com a IA.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function copyPowerBILink() {
    const url = window.location.origin + '/api/monitor/powerbi';

    // Fallback for non-secure contexts (HTTP/Local IP) where navigator.clipboard is undefined
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            alert("Link copiado! Use 'Web Source' no Power BI:\n" + url);
        }).catch(err => {
            console.error('Failed to copy via clipboard API:', err);
            copyToClipboardFallback(url);
        });
    } else {
        copyToClipboardFallback(url);
    }
}

function copyToClipboardFallback(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
        document.execCommand('copy');
        alert("Link copiado (via fallback)! Use 'Web Source' no Power BI:\n" + text);
    } catch (err) {
        console.error('Fallback copy failed:', err);
        alert("Erro ao copiar link automaticamente. Por favor, copie manualmente:\n" + text);
    }
    document.body.removeChild(textArea);
}


function exportAnalyticsCSV() {
    window.location.href = '/api/monitor/export';
}


/**
 * Log user interactions
 * @param {string} eventType - 'view', 'like', 'dislike'
 * @param {number} articleId - ID of the article
 * @param {object} metadata - Optional extra data
 */
async function logInteraction(eventType, articleId, metadata = {}) {
    try {
        await fetch('/api/monitor/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                event_type: eventType,
                article_id: articleId,
                metadata: metadata
            })
        });
        console.log(`📡 Interaction logged: ${eventType} -> Article ${articleId}`);

        // UI Feedback
        if (eventType === 'like') {
            showNotification('Obrigado pelo feedback! 👍', 'success');
        } else if (eventType === 'dislike') {
            showNotification('Obrigado! Vamos trabalhar para melhorar. 👎', 'info');
        }
    } catch (e) {
        console.error("Failed to log interaction", e);
    }
}

// Escutar eventos globais se necessário
window.logInteraction = logInteraction;

function renderInteractionStats(stats) {
    // 1. Update Summary Cards
    const summary = stats.summary || {};
    const views = summary.view || 0;
    const likes = summary.like || 0;
    const dislikes = summary.dislike || 0;

    const kpiViews = document.getElementById('kpi-views');
    const kpiLikes = document.getElementById('kpi-likes');
    const kpiDislikes = document.getElementById('kpi-dislikes');

    if (kpiViews) kpiViews.textContent = views;
    if (kpiLikes) kpiLikes.textContent = likes;
    if (kpiDislikes) kpiDislikes.textContent = dislikes;

    // 2. Render Top Viewed/Liked Lists
    const topViewedList = document.getElementById('topViewedList');
    const topLikedList = document.getElementById('topLikedList');

    if (topViewedList && stats.top_viewed) {
        topViewedList.innerHTML = stats.top_viewed.map((item, index) => `
            <div class="analytics-list-item">
                <div class="term-info">
                    <span class="term-name">${item.title}</span>
                </div>
                <span class="term-count">${item.count} views</span>
            </div>
        `).join('');
    }

    if (topLikedList && stats.top_liked) {
        topLikedList.innerHTML = stats.top_liked.map((item, index) => `
            <div class="analytics-list-item">
                <div class="term-info">
                    <span class="term-name">${item.title}</span>
                </div>
                <span class="term-count">${item.count} likes</span>
            </div>
        `).join('');
    }
}
