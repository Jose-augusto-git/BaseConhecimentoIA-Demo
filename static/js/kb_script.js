// ==================== CONFIGURAÇÃO ====================

const API_URL = '/api';

// Estado da aplicação
const state = {
    currentView: 'chat',
    categories: [],
    articles: [],
    currentArticle: null,
    chatHistory: [],
    user: null, // Adicionado para armazenar info do usuário (username, role)
    typoCount: 0, // Contador de erros ortográficos
    initialCategoryCounts: {}, // Rastrear contagem inicial para diff visual
    tags: [] // Tags cadastradas
};

// Globalizar appState para acesso do neural_network.js
window.appState = state;

// ==================== INICIALIZAÇÃO ====================

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    loadSession(); // Verifica quem está logado
    loadInitialData();

    // Iniciar verificação de updates
    initVersionCheck();
});

// ==================== UPDATE SYSTEM ====================
let currentVersion = null;

async function initVersionCheck() {
    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            currentVersion = data.version;
            console.log(`📦 Versão atual: ${currentVersion}`);

            // Poll every 60 seconds
            setInterval(checkForUpdates, 60000);
        }
    } catch (e) {
        console.warn("Falha ao obter versão inicial:", e);
    }

    // Setup click listener
    const notification = document.getElementById('updateNotification');
    if (notification) {
        notification.addEventListener('click', () => {
            window.location.reload();
        });
    }
}

async function checkForUpdates() {
    if (!currentVersion) return;

    try {
        const response = await fetch('/api/version');
        if (response.ok) {
            const data = await response.json();
            if (data.version !== currentVersion) {
                console.log(`🚀 Nova versão detectada: ${data.version}`);
                const notification = document.getElementById('updateNotification');
                if (notification) {
                    notification.style.display = 'block';
                    // Optional: Play sound or animate
                }
            }
        }
    } catch (e) {
        // Silent fail on network error
    }
}

function initializeApp() {
    console.log('🚀 Inicializando Base de Conhecimento IA...');
    startMatrixIntro();
}

function startMatrixIntro() {
    const canvas = document.getElementById('matrixIntroCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const drops = Array(Math.floor(columns)).fill(1);

    const draw = () => {
        ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#0F0"; // Green text
        ctx.font = fontSize + "px 'Courier New'";

        for (let i = 0; i < drops.length; i++) {
            const text = letters[Math.floor(Math.random() * letters.length)];
            ctx.fillText(text, i * fontSize, drops[i] * fontSize);

            if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                drops[i] = 0;
            }
            drops[i]++;
        }
    };

    const interval = setInterval(draw, 33);

    // Efeito de "Desfazer" (Disintegrate/Fade Out) após 3 segundos
    setTimeout(() => {
        clearInterval(interval);

        // Animação de dissolução
        canvas.style.transition = 'opacity 1s ease, transform 1s ease';
        canvas.style.opacity = '0';
        canvas.style.transform = 'scale(1.1)'; // Leve zoom para efeito de "ir embora"

        setTimeout(() => {
            canvas.remove(); // Remove do DOM
        }, 1000);
    }, 2500); // Tempo da chuva Matrix antes de sumir
}

async function loadSession() {
    try {
        const response = await fetch('/api/me');
        if (response.ok) {
            state.user = await response.json();
            console.log('👤 Usuário identificado:', state.user);
            applyRoleRestrictions();
            updateUserUI();
        } else {
            // Se falhar ao carregar sessão, provavelmente expirou
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Erro ao carregar sessão:', error);
    }
}

function updateUserUI() {
    const userNameElems = document.querySelectorAll('.user-name');
    const userRoleElems = document.querySelectorAll('.user-role');

    if (state.user) {
        let roleText = 'SUPORTE';
        if (state.user.role === 'admin') roleText = 'ADMINISTRADOR';
        if (state.user.role === 'super_admin') roleText = 'SUPER ADMIN';

        // Função auxiliar para o efeito
        const runHackerEffect = (element, finalText) => {
            if (!element) return;

            const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            let iterations = 0;

            clearInterval(element.dataset.intervalId); // Limpa intervalo anterior da animação se houver

            const interval = setInterval(() => {
                element.innerText = finalText
                    .split("")
                    .map((letter, index) => {
                        if (index < iterations) {
                            return finalText[index];
                        }
                        return letters[Math.floor(Math.random() * 36)];
                    })
                    .join("");

                if (iterations >= finalText.length) {
                    clearInterval(interval);
                    element.innerText = finalText;
                }

                iterations += 1 / 3;
            }, 30);

            element.dataset.intervalId = interval; // Salva ID para limpeza
        };

        // 1. Aplica nos Nomes
        userNameElems.forEach(el => runHackerEffect(el, state.user.username));

        // 2. Aplica nos Cargos
        userRoleElems.forEach(el => runHackerEffect(el, roleText));

        // Repetir efeito nos cargos a cada 10 segundos
        if (window.roleEffectInterval) clearInterval(window.roleEffectInterval);
        window.roleEffectInterval = setInterval(() => {
            userRoleElems.forEach(el => runHackerEffect(el, roleText));
        }, 10000);

        // Mostrar elementos de admin se for o caso
        if (state.user.role === 'admin' || state.user.role === 'super_admin') {
            document.querySelectorAll('.admin-only').forEach(el => {
                el.style.display = 'flex';
            });
            // Carregar contagem de pendentes
            if (typeof loadPendingArticles === 'function') {
                loadPendingArticles(true);
            }
        }
    }
}

function applyRoleRestrictions() {
    if (!state.user) return;

    const role = state.user.role;

    // 1. Perfil SUPORTE (Já existe, mantém restrições severas)
    if (role === 'suporte') {
        console.log('🔒 Restringindo acesso para perfil SUPORTE');
        ['btn-delete-all', 'btn-import-word', 'duplicateArticleButton'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        document.querySelectorAll('.admin-hint').forEach(h => h.style.display = 'none');
    }

    // 2. Perfil ADMINISTRADOR (Restrições parciais - Novo RBAC)
    if (role === 'admin') {
        console.log('🔒 Restringindo acesso para perfil ADMIN (Não-Super)');

        // Ocultar Botão "Limpar Tudo" (Cadastro)
        const btnDeleteAll = document.getElementById('btn-delete-all');
        if (btnDeleteAll) {
            btnDeleteAll.style.display = 'none'; // Apenas Super Admin pode deletar tudo
        }

        // Ocultar Abas específicas (Hybrid, Settings, Analytics)
        const restrictedViews = ['hybrid', 'settings', 'analytics'];
        document.querySelectorAll('.nav-item').forEach(item => {
            const view = item.dataset.view;
            if (restrictedViews.includes(view)) {
                item.style.display = 'none'; // Remove da navegação
            }
        });

        // Neural Network: Modo Leitura (Desabilita controles de edição se existirem)
        // (Visualização é permitida, então não ocultamos a aba 'neural')
    }

    // 3. Perfil SUPER ADMIN (Acesso Total)
    if (role === 'super_admin') {
        console.log('🔓 Acesso Total SUPER ADMIN concedido.');
        // Garante que tudo esteja visível (caso tenha sido ocultado por padrão)
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'flex');

        // Exibir abas especiais que poderiam estar ocultas
        ['hybrid', 'settings', 'analytics'].forEach(view => {
            const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
            if (btn) btn.style.display = 'flex';
        });
    }
}

// ==================== EVENT LISTENERS ====================

function setupEventListeners() {
    // Navegação
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const view = e.currentTarget.dataset.view;
            switchView(view);
        });
    });

    // Chat
    const chatInput = document.getElementById('chatInput');
    const sendButton = document.getElementById('sendButton');

    sendButton.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Custom AI Dropdown
    initCustomDropdown();

    // Busca de artigos
    const searchInput = document.getElementById('searchArticles');
    const categoryFilter = document.getElementById('categoryFilter');

    searchInput.addEventListener('input', debounce(filterArticles, 300));
    categoryFilter.addEventListener('change', filterArticles);

    // Formulário de artigo
    const articleForm = document.getElementById('articleForm');
    articleForm.addEventListener('submit', saveArticle);

    document.getElementById('cancelButton').addEventListener('click', resetArticleForm);

    // Formulário de categoria
    const categoryForm = document.getElementById('categoryForm');
    categoryForm.addEventListener('submit', saveCategory);

    // Tabs administrativas
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchAdminTab(tabName, e.currentTarget);
        });
    });

    // Formulário de usuário
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', saveUser);
    }

    // Modal
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('editArticleButton').addEventListener('click', editArticle);
    document.getElementById('deleteArticleButton').addEventListener('click', deleteArticle);
    document.getElementById('duplicateArticleButton').addEventListener('click', duplicateArticle);

    // Importação Word
    const btnImport = document.getElementById('btn-import-word');
    const modalImport = document.getElementById('modal-import');
    const formImport = document.getElementById('form-import-word');
    const closeImport = modalImport.querySelector('.close');

    if (btnImport) {
        btnImport.addEventListener('click', () => {
            modalImport.style.display = 'block';
            // Reset modal state on open
            resetImportModal();
        });
    }

    if (closeImport) {
        closeImport.addEventListener('click', () => {
            modalImport.style.display = 'none';
        });
    }

    if (formImport) {
        formImport.addEventListener('submit', handleImportWord);
    }

    // Initialize Drag & Drop
    setupImportDragAndDrop();

    // Botão Deletar Tudo
    const btnDeleteAll = document.getElementById('btn-delete-all');
    if (btnDeleteAll) {
        btnDeleteAll.addEventListener('click', handleDeleteAllArticles);
    }

    // Logout
    document.querySelectorAll('.btn-logout').forEach(btn => {
        btn.addEventListener('click', handleLogout);
    });

    // Configurações de Usuário (Header)
    document.querySelectorAll('.user-settings-button').forEach(btn => {
        btn.addEventListener('click', openPersonalSettings);
    });

    const changePwdForm = document.getElementById('changePasswordForm');
    if (changePwdForm) {
        changePwdForm.addEventListener('submit', handleChangePassword);
    }

    // Fechar modal ao clicar fora
    document.getElementById('articleModal').addEventListener('click', (e) => {
        if (e.target.id === 'articleModal') {
            closeModal();
        }
    });

    // Image Upload
    const btnUploadImage = document.getElementById('btnUploadImage');
    const imageInput = document.getElementById('imageInput');

    if (btnUploadImage && imageInput) {
        btnUploadImage.addEventListener('click', () => imageInput.click());
        imageInput.addEventListener('change', handleImageUpload);
    }

    const btnTogglePreview = document.getElementById('btnTogglePreview');
    const articleContent = document.getElementById('articleContent');
    const articlePreview = document.getElementById('articlePreview');

    if (btnTogglePreview && articleContent && articlePreview) {
        btnTogglePreview.addEventListener('click', () => {
            const isPreviewing = articlePreview.style.display !== 'none';

            if (isPreviewing) {
                // Sair do preview
                articlePreview.style.display = 'none';
                articleContent.style.visibility = 'visible';
                btnTogglePreview.innerHTML = '<i class="fas fa-eye"></i> Visualizar';
            } else {
                // Entrar no preview
                const text = articleContent.value;
                articlePreview.innerHTML = marked.parse(text);
                // Estilizar imagens no preview também
                const images = articlePreview.getElementsByTagName('img');
                for (let img of images) {
                    img.style.maxWidth = '100%';
                    img.style.borderRadius = '8px';
                    img.style.border = '1px solid #444';
                }

                articlePreview.style.display = 'block';
                articleContent.style.visibility = 'hidden'; // Hide textarea but keep layout
                btnTogglePreview.innerHTML = '<i class="fas fa-edit"></i> Editar';
            };
        });
    }

    // ==================== MOBILE MENU ====================
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const sidebar = document.getElementById('mainSidebar');

    if (sidebarToggle && sidebar && sidebarOverlay) {
        // Toggle Menu
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('mobile-open');
            sidebarOverlay.classList.toggle('active');
        });

        // Fechar ao clicar no overlay
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('active');
        });

        // Fechar ao clicar em item de navegação (apenas mobile)
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 900) {
                    sidebar.classList.remove('mobile-open');
                    sidebarOverlay.classList.remove('active');
                }
            });
        });
    }

    // ==================== DESKTOP MENU ====================
    const desktopSidebarToggle = document.getElementById('desktopSidebarToggle');
    if (desktopSidebarToggle && sidebar) {
        desktopSidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
}

async function handleLogout() {
    try {
        const response = await fetch(`${API_URL}/logout`, {
            method: 'POST'
        });

        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/login'; // Forçar redirect mesmo com erro
    }
}

async function duplicateArticle() {
    console.log("Tentando duplicar artigo...", state.currentArticle);
    if (!state.currentArticle) return;

    try {
        const response = await fetch(`${API_URL}/articles/${state.currentArticle.id}/duplicate`, {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Artigo duplicado com sucesso!', 'success');
            closeModal();
            await checkStatus();
            if (state.currentView === 'articles') {
                await loadArticles();
            }
            // Reload graph if applicable
            if (state.currentView === 'neural' && typeof initNeuralNetwork === 'function') {
                initNeuralNetwork();
            }
        } else {
            showNotification(data.error || 'Erro ao duplicar artigo', 'error');
        }
    } catch (error) {
        console.error('Erro ao duplicar:', error);
        showNotification('Erro de conexão com o servidor', 'error');
    }
}

async function handleDeleteAllArticles() {
    const confirmation = await showConfirmation(
        '⚠️ ATENÇÃO: Excluir Tudo',
        'Deseja realmente excluir TODOS os artigos da base de conhecimento? Esta ação não pode ser desfeita!',
        'Sim, Excluir Tudo',
        'danger'
    );

    if (!confirmation) return;

    try {
        const response = await fetch(`${API_URL}/articles/delete-all`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('Todos os artigos foram excluídos!', 'success');
            // Atualizar interface
            await checkStatus();
            if (state.currentView === 'articles') {
                await loadArticles();
            }
        } else {
            showNotification(data.error || 'Erro ao excluir artigos', 'error');
        }
    } catch (error) {
        console.error('Erro ao deletar tudo:', error);
        showNotification('Erro de conexão com o servidor', 'error');
    }
}

// ==================== NAVEGAÇÃO ====================

function switchView(viewName) {
    state.currentView = viewName;

    // Atualizar menu
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    // Atualizar views
    document.querySelectorAll('.view-container').forEach(view => {
        view.classList.remove('active');
    });

    // Mapeamento correto de views
    let viewId;
    if (viewName === 'dashboard') viewId = 'dashboardView';
    else if (viewName === 'chat') viewId = 'chatView';
    else if (viewName === 'articles') viewId = 'articlesView';
    else if (viewName === 'admin') viewId = 'adminView';
    else if (viewName === 'validation') viewId = 'validationView';
    else if (viewName === 'neural') viewId = 'neuralView';
    else if (viewName === 'hybrid') viewId = 'hybridView';
    else if (viewName === 'settings') viewId = 'settingsView';
    else if (viewName === 'analytics') viewId = 'analyticsView';

    const viewEl = document.getElementById(viewId);
    if (viewEl) viewEl.classList.add('active');

    // Inicialização específica da view
    if (viewName === 'dashboard') {
        checkStatus();
        loadCategories();
    } else if (viewName === 'admin') {
        loadCategories();
    } else if (viewName === 'validation') {
        loadPendingArticles();
    } else if (viewName === 'neural') {
        // Chamar inicialização da Rede Neural (definida em neural_network.js)
        if (typeof initNeuralNetwork === 'function') {
            initNeuralNetwork();
        }
    } else if (viewName === 'settings') {
        // Default target for settings
        loadUsersList();
    } else if (viewName === 'analytics') {
        if (typeof loadAnalyticsData === 'function') {
            loadAnalyticsData();
        }
    }
}

function switchAdminTab(tabName, element = null) {
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    if (element) {
        element.classList.add('active');
    } else {
        // Tentar encontrar o botão pelo data-tab se não for passado o elemento
        const tabBtn = document.querySelector(`.admin-tab[data-tab="${tabName}"]`);
        if (tabBtn) tabBtn.classList.add('active');
    }

    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabMap = {
        'new-article': 'newArticleTab',
        'categories': 'categoriesTab',
        'dictionary': 'dictionaryTab',
        'users': 'usersTab'
    };

    const targetId = tabMap[tabName];
    if (targetId) {
        document.getElementById(targetId).classList.add('active');

        // Load content if specific tab
        if (tabName === 'dictionary') {
            loadLearnedWordsList();
        } else if (tabName === 'categories') {
            loadCategoriesList();
        } else if (tabName === 'users') {
            loadUsersList();
        }
    }
}

// ==================== DADOS INICIAIS ====================

async function loadInitialData() {
    try {
        await Promise.all([
            checkStatus(),
            loadCategories(),
            loadArticles(), // Pre-load articles for all views
            loadPendingArticles(true), // Check count only
            loadTags() // Carregar tags para a rede neural
        ]);
    } catch (error) {
        console.error('Erro ao carregar dados iniciais:', error);
    }
}

async function checkStatus() {
    try {
        const response = await fetch(`${API_URL}/status`);
        const data = await response.json();

        // Update user state and UI if user info is returned from status check
        if (data.user) {
            state.user = data.user;
            updateUserUI();
            applyRoleRestrictions();
        }

        // Salvar palavras aprendidas no estado para a rede neural usar
        if (data.learned_words) {
            state.learnedWords = data.learned_words;
        }

        // Atualizar status da IA (Global)
        const statusDot = document.getElementById('aiStatus');
        const statusText = document.getElementById('aiStatusText');

        if (statusDot && statusText) {
            if (data.ai_configured) {
                statusDot.classList.add('online');
                statusDot.classList.remove('offline');
                statusText.textContent = data.ai_model || 'IA Online';
            } else {
                statusDot.classList.add('offline');
                statusDot.classList.remove('online');
                statusText.textContent = data.ai_model || 'IA Offline';
            }
        }

        // Atualizar estatísticas (Dashboard e All elements)
        document.querySelectorAll('.article-count-text').forEach(el => {
            el.textContent = data.articles_count;
        });
        document.querySelectorAll('.category-count-text').forEach(el => {
            el.textContent = data.categories_count;
        });

        // Dashboard category breakdown
        const breakdownContainer = document.getElementById('categoryBreakdown');
        if (breakdownContainer && data.category_stats) {
            breakdownContainer.innerHTML = data.category_stats.slice(0, 5).map(cat => `
                <div class="breakdown-item">
                    <span class="breakdown-name">${cat.name}</span>
                    <span class="breakdown-count">${cat.count}</span>
                </div>
            `).join('');
        }

        // AI Usage Stats (New)
        const usageContainer = document.getElementById('aiUsageStats');
        if (usageContainer && data.ai_usage) {
            usageContainer.innerHTML = Object.entries(data.ai_usage).map(([key, stats]) => {
                const percent = Math.min(100, Math.round((stats.count / stats.limit) * 100));

                // Color Logic
                let colorClass = 'usage-bar-success';
                if (percent > 75) colorClass = 'usage-bar-warning';
                if (percent > 90) colorClass = 'usage-bar-danger';

                const hasTokens = stats.tokens && stats.tokens.total > 0;

                // Cost Estimation (Approximate Public Pricing)
                // Groq Llama3-70b: ~$0.79/1M tokens (Blended)
                // Gemini 1.5 Flash: Free tier or low cost
                // Mistral Small: ~$0.20/1M tokens
                let costEstimate = 0;
                let costDisplay = "";

                if (hasTokens) {
                    const totalTokens = stats.tokens.total;
                    if (key.includes('groq')) costEstimate = (totalTokens / 1000000) * 0.79;
                    else if (key.includes('mistral')) costEstimate = (totalTokens / 1000000) * 0.20;
                    else if (key.includes('gemini')) costEstimate = 0; // Free tier assumed for now

                    if (costEstimate > 0) {
                        costDisplay = `<span class="usage-cost">~$${costEstimate.toFixed(4)}</span>`;
                    } else {
                        costDisplay = `<span class="usage-cost" style="color: #ccc;">Grátis</span>`;
                    }
                }

                // Provider Icon
                let providerIcon = '🤖';
                if (key.includes('groq')) providerIcon = '⚡';
                else if (key.includes('gemini')) providerIcon = '✨';
                else if (key.includes('mistral')) providerIcon = '🛡️';
                else if (key.includes('claude')) providerIcon = '🧠';

                return `
                <div class="usage-item">
                    <div class="usage-tooltip">
                        Reseta diariamente
                    </div>
                    
                    <div class="usage-header">
                        <div class="usage-provider">
                            <span>${providerIcon}</span>
                            <span>${stats.name || key.toUpperCase()}</span>
                        </div>
                        <div class="usage-limit">
                            ${percent}% de ${stats.limit}
                        </div>
                    </div>

                    <div class="usage-progress-track">
                        <div class="usage-progress-bar ${colorClass}" style="width: ${percent}%"></div>
                    </div>

                    <div class="usage-breakdown">
                        <div class="usage-metric">
                            <span>Requisições</span>
                            <span style="color: #fff;">${stats.count} / ${stats.limit}</span>
                        </div>
                        <div class="usage-metric" style="text-align: right;">
                            <span>Tokens</span>
                            <span style="color: #fff;">${hasTokens ? (stats.tokens.total / 1000).toFixed(1) + 'k' : 'N/A'}</span>
                        </div>
                    </div>
                    
                    ${hasTokens ? `
                    <div class="usage-breakdown" style="border-top: none; margin-top: 0; padding-top: 2px;">
                        <div class="usage-metric">
                            <span style="font-size: 0.65rem; opacity: 0.5;">Input/Output</span>
                            <span style="font-size: 0.7rem; color: #aaa;">${(stats.tokens.input / 1000).toFixed(1)}k / ${(stats.tokens.output / 1000).toFixed(1)}k</span>
                        </div>
                        <div class="usage-metric" style="text-align: right;">
                             <span style="font-size: 0.65rem; opacity: 0.5;">Custo Est.</span>
                             ${costDisplay}
                        </div>
                    </div>
                    ` : ''}
                </div>
                `;
            }).join('');

            // Render Chart
            if (typeof renderUsageChart === 'function') {
                renderUsageChart(data.ai_usage);
            }
        }

    } catch (error) {
        console.error('Erro ao verificar status:', error);
        const statusText = document.getElementById('aiStatusText');
        if (statusText) statusText.textContent = 'Erro de conexão';
    }
}

async function loadTags() {
    try {
        const response = await fetch(`${API_URL}/tags`);
        if (response.ok) {
            const tags = await response.json();
            state.tags = tags;
            console.log(`🏷️ ${tags.length} tags carregadas.`);
        }
    } catch (error) {
        console.error('Erro ao carregar tags:', error);
    }
}

// ==================== CHAT ====================

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const question = input.value.trim();

    if (!question) return;

    // Limpar input
    input.value = '';

    // Adicionar mensagem do usuário
    addMessage('user', question);

    // Desabilitar botão de envio
    const sendButton = document.getElementById('sendButton');
    sendButton.disabled = true;

    // Adicionar indicador de digitação
    const typingId = addTypingIndicator();

    try {
        const model = document.getElementById('modelSelectorValue')?.value || 'auto';

        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                question,
                model: model
            })
        });

        const data = await response.json();
        console.log("DEBUG: API Response:", data);

        // Remover indicador de digitação
        removeTypingIndicator(typingId);

        // NOVA LÓGICA: Aprendizado Visual
        if (data.learned_term) {
            console.log("🧠 Nova palavra aprendida:", data.learned_term);

            // Forçar troca para a aba Neural para visualizar o efeito
            if (window.switchView) {
                switchView('neural');
            }

            // Pequeno delay para garantir que a rede renderizou antes de spawnar
            setTimeout(() => {
                if (window.spawnLearningNeuron) {
                    const category = data.new_knowledge ? data.new_knowledge.category : 'Aprendizado';
                    const definition = data.new_knowledge ? data.new_knowledge.definition : null;
                    window.spawnLearningNeuron(data.learned_term, category, definition);
                }
            }, 500);

            // Tocar som de sucesso se houver (opcional)
        }

        // Processar erros ortográficos (Aggressive AI & Redemption Arc)
        if (data.typo_count > 0) {
            updateTypoCounter(data.typo_count);
        } else {
            // REDENÇÃO: Se não houve erros nesta mensagem, perdoar um pecado passado
            if (state.typoCount > 0) {
                updateTypoCounter(-1);
            }
        }

        // Adicionar resposta da IA com estilo agressivo se necessário
        let msgType = 'ai';
        let customContent = data.answer;

        // Lógica Refinada: Só ser agressivo SE houve erro na mensagem ATUAL ou se já estamos no nível crítico
        // Se o usuário digitou corretamente, não mostramos a ameaça (alívio imediato),
        // a menos que estejamos no nível 5 (onde o sistema já está comprometido).

        const isCritical = state.typoCount >= 5;
        const currentError = data.typo_count > 0;

        if (isCritical) {
            initiateDestruction();
            return;
        } else if (currentError && state.typoCount >= 3) {
            // Nível 3-4: Ameaça (Só mostra se errou agora)
            customContent = `**Vou exterminar Você, corrija a sua ortografia, ou você vai se arrepender**\n\n${data.answer}`;
            addMessage('ai aggressive-danger', customContent, data.sources);
            document.body.classList.add('shake-violent');
            setTimeout(() => document.body.classList.remove('shake-violent'), 500);
        } else if (currentError && state.typoCount >= 1) {
            // Nível 1-2: Aviso (Só mostra se errou agora)
            customContent = `*Por favor, corrija a sua ortografia.*\n\n${data.answer}`;
            addMessage('ai aggressive-warning', customContent, data.sources);
            document.body.classList.add('shake-warning');
            setTimeout(() => document.body.classList.remove('shake-warning'), 500);
        } else {
            // Normal (Se digitou certo, recebe resposta normal, mesmo com contador alto)
            addMessage('ai', data.answer, data.sources);
        }

        // Atualizar estatísticas e STATUS DA IA
        await checkStatus();

        // ATUALIZAÇÃO IMEDIATA DO STATUS VISUAL DA IA
        // Se o backend retornou qual modelo usou, atualizamos o rodapé
        if (data.model_used) {
            const statusDot = document.getElementById('aiStatus');
            const statusText = document.getElementById('aiStatusText');

            if (statusDot && statusText) {
                statusText.textContent = data.model_used;

                // Indicar cor diferente para Fallback (Amarelo/Laranja) vs Normal (Verde)
                if (data.model_used.includes("Groq")) {
                    statusDot.className = 'status-dot online'; // Verde
                } else if (data.model_used.includes("Offline")) {
                    statusDot.className = 'status-dot offline'; // Vermelho
                } else {
                    // Fallback (Gemini) ou outro
                    statusDot.className = 'status-dot online';
                    statusDot.style.backgroundColor = '#f1c40f'; // Amarelo para indicar Atenção/Fallback
                }
            }

            // Atualizar o HUD Neural também se estiver visível
            const hudVal = document.querySelector('.hud-value.active');
            if (hudVal) hudVal.textContent = data.model_used;
        }

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        removeTypingIndicator(typingId);
        addMessage('ai', 'Desculpe, ocorreu um erro ao processar sua pergunta. Verifique se o servidor está rodando.');
    } finally {
        sendButton.disabled = false;
        input.focus();
    }
}

function updateTypoCounter(newTypos) {
    state.typoCount += newTypos;

    document.querySelectorAll('.typo-counter').forEach(counterEl => {
        const valueEl = counterEl.querySelector('.typo-value');
        if (state.typoCount > 0) {
            counterEl.style.display = 'flex';
            setTimeout(() => counterEl.classList.add('visible'), 10);
            if (valueEl) valueEl.textContent = state.typoCount;
        } else {
            counterEl.classList.remove('visible');
            setTimeout(() => counterEl.style.display = 'none', 500);
        }
    });
}

function initiateDestruction() {
    // 1. Tocar som se houvesse, mas vamos usar efeitos visuais pesados
    document.body.classList.add('destruction-mode');

    const messagesContainer = document.getElementById('chatMessages');
    messagesContainer.innerHTML = ''; // Limpa tudo

    // Mensagem Final
    addMessage('ai aggressive-final', "EU AVISEI SISTEMA COMPROMETIDO DEVIDO À INCOMPETÊNCIA. INICIANDO A DESTRUIÇÃO.");

    // Efeito de contagem regressiva visual ou apenas delay
    setTimeout(() => {
        // Logout forçado
        fetch('/api/logout', { method: 'POST' })
            .then(() => {
                window.location.href = '/login';
            });
    }, 5000); // 5 segundos de pânico
}

function addMessage(type, text, sources = []) {
    const messagesContainer = document.getElementById('chatMessages');

    // Remover mensagem de boas-vindas se existir
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (type === 'user') {
        avatar.innerHTML = `<img src="static/img/avatarUser.png" alt="User" class="avatar-img">`;
    } else {
        avatar.innerHTML = `<img src="static/img/avatarIA.png" alt="IA" class="avatar-img">`;
    }

    const content = document.createElement('div');
    content.className = 'message-content';

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';

    if (type === 'ai') {
        // Parse Markdown for AI responses
        textDiv.innerHTML = marked.parse(text);
    } else {
        // Plain text for user messages (prevent XSS)
        textDiv.textContent = text;
    }

    content.appendChild(textDiv);
    // Adicionar fontes se houver
    if (sources && sources.length > 0) {
        const sourcesContainer = document.createElement('details');
        sourcesContainer.className = 'source-list-container';
        sourcesContainer.open = false; // Default to closed

        // Summary (Header)
        const summary = document.createElement('summary');
        summary.className = 'source-list-label';
        summary.innerHTML = `
            <span>Sugestão de Fontes Similares (${sources.length})</span>
            <svg class="source-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
        `;
        sourcesContainer.appendChild(summary);

        const list = document.createElement('div');
        list.style.display = 'flex';
        list.style.flexDirection = 'column';
        list.style.gap = '4px';

        sources.forEach(source => {
            const item = document.createElement('div');
            item.className = 'source-list-item';

            item.innerHTML = `
                <div class="source-item-content">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                    <span style="font-weight: 500;">${escapeHtml(source.title)}</span>
                </div>
                <div class="source-item-arrow">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"></polyline>
                    </svg>
                </div>
            `;

            item.onclick = () => loadArticleById(source.id);
            list.appendChild(item);
        });

        sourcesContainer.appendChild(list);
        content.appendChild(sourcesContainer);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addTypingIndicator() {
    const messagesContainer = document.getElementById('chatMessages');
    const typingDiv = document.createElement('div');
    const id = 'typing-' + Date.now();
    typingDiv.id = id;
    typingDiv.className = 'message ai';
    typingDiv.innerHTML = `
        <div class="message-avatar">
            <img src="static/img/avatarIA.png" alt="IA" class="avatar-img">
        </div>
        <div class="message-content">
            <div class="message-text">Pensando...</div>
        </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const indicator = document.getElementById(id);
    if (indicator) {
        indicator.remove();
    }
}

// ==================== ARTIGOS ====================

async function loadArticles(search = '', categoryId = '') {
    const grid = document.getElementById('articlesGrid');
    grid.innerHTML = '<div class="loading">Carregando artigos</div>';

    try {
        let url = `${API_URL}/articles?`;
        if (search) url += `search=${encodeURIComponent(search)}&`;
        if (categoryId) url += `category_id=${categoryId}`;

        const response = await fetch(url);
        const articles = await response.json();

        state.articles = articles;
        renderArticles(articles);

    } catch (error) {
        console.error('Erro ao carregar artigos:', error);
        grid.innerHTML = '<div class="loading">Erro ao carregar artigos</div>';
    }
}

function renderArticles(articles) {
    const grid = document.getElementById('articlesGrid');

    if (articles.length === 0) {
        grid.innerHTML = '<div class="loading">Nenhum artigo encontrado</div>';
        return;
    }

    grid.innerHTML = articles.map(article => `
        <div class="article-card" onclick="openArticleModal(${article.id})">
            <div class="article-card-header">
                <h3 class="article-card-title">${escapeHtml(article.title)}</h3>
                <div class="article-card-meta">
                    ${article.category_name ? `<span class="category-badge">${escapeHtml(article.category_name)}</span>` : ''}
                    <span>${formatDate(article.updated_at)}</span>
                </div>
            </div>
            <div class="article-card-content">
                ${escapeHtml(article.content.substring(0, 200))}...
            </div>
            ${article.tags && article.tags.length > 0 ? `
                <div class="article-card-footer">
                    ${article.tags.map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join('')}
                </div>
            ` : ''}
        </div>
    `).join('');
}

window.loadArticles = loadArticles;

function filterArticles() {
    const search = document.getElementById('searchArticles').value;
    const categoryId = document.getElementById('categoryFilter').value;
    loadArticles(search, categoryId);
}

function filterByTag(tagName) {
    const searchInput = document.getElementById('searchArticles');
    if (searchInput) {
        searchInput.value = tagName;
        switchView('articles');
        loadArticles(tagName);
        showNotification(`Filtrando por tag: ${tagName}`, 'info');
    }
}
window.filterByTag = filterByTag;

async function loadArticleById(id) {
    try {
        const response = await fetch(`${API_URL}/articles/${id}`);
        const article = await response.json();
        state.currentArticle = article;
        openArticleModal(id);
    } catch (error) {
        console.error('Erro ao carregar artigo:', error);
    }
}

function openArticleModal(articleId) {
    const article = state.articles.find(a => a.id === articleId) || state.currentArticle;
    if (!article) return;

    state.currentArticle = article;

    document.getElementById('modalTitle').textContent = article.title;
    document.getElementById('modalMeta').innerHTML = `
        ${article.category_name ? `<span class="category-badge">${escapeHtml(article.category_name)}</span>` : ''}
        <span style="color: var(--text-secondary)">Atualizado em ${formatDate(article.updated_at)}</span>
        ${article.tags && article.tags.length > 0 ? article.tags.map(tag => `<span class="tag">${escapeHtml(tag.trim())}</span>`).join('') : ''}
    `;

    // Render Markdown if available, else text
    const contentHtml = (typeof marked !== 'undefined') ? marked.parse(article.content) : escapeHtml(article.content);

    // Add Feedback Section
    const feedbackHtml = `
        <div class="article-feedback-container">
            <span class="feedback-label">Este conteúdo foi útil para você?</span>
            <div class="feedback-buttons" id="feedbackButtons-${article.id}">
                <button onclick="handleFeedback(event, 'like', ${article.id})" class="feedback-btn feedback-btn-yes" title="Sim, ajudou">
                    <i class="fas fa-thumbs-up"></i> Sim
                </button>
                <button onclick="handleFeedback(event, 'dislike', ${article.id})" class="feedback-btn feedback-btn-no" title="Não, precisa melhorar">
                    <i class="fas fa-thumbs-down"></i> Não
                </button>
                <span class="feedback-thanks" id="feedbackThanks-${article.id}"></span>
            </div>
        </div>
    `;

    document.getElementById('modalContent').innerHTML = contentHtml + feedbackHtml;

    document.getElementById('articleModal').classList.add('active');

    // Log View
    if (window.logInteraction) {
        window.logInteraction('view', article.id);
    }
}

// Globalizar função para acesso externo
window.loadArticleById = loadArticleById;

function closeModal() {
    document.getElementById('articleModal').classList.remove('active');
}

function handleFeedback(event, type, id) {
    const btn = event.currentTarget;
    const group = document.getElementById(`feedbackButtons-${id}`);
    const thanks = document.getElementById(`feedbackThanks-${id}`);

    if (group && group.classList.contains('voted')) return;

    // Marca botão ativo
    if (group) {
        group.querySelectorAll('.feedback-btn').forEach(b => b.classList.remove('active'));
        group.classList.add('voted');
    }
    btn.classList.add('active');

    // Mensagem de retorno
    if (thanks) {
        if (type === 'like') {
            thanks.textContent = '✓ Obrigado pelo feedback!';
            thanks.className = 'feedback-thanks show success';
        } else {
            thanks.textContent = '✓ Vamos melhorar!';
            thanks.className = 'feedback-thanks show danger';
        }
    }

    // Chama o log original do analytics
    if (window.logInteraction) {
        window.logInteraction(type, id);
    } else {
        console.log(`Interaction: ${type} | Article: ${id}`);
    }
}
window.handleFeedback = handleFeedback;

// ==================== CATEGORIAS ====================

async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        const categories = await response.json();

        state.categories = categories;

        // Atualizar selects
        updateCategorySelects(categories);

        // Renderizar lista de categorias
        renderCategoriesList(categories);

        // Renderizar lista de categorias
        renderCategoriesList(categories);

        // Update Header Details
        const detailsElems = document.querySelectorAll('.category-details-text');
        if (detailsElems.length > 0) {

            // Populate initial counts on first load
            if (Object.keys(state.initialCategoryCounts).length === 0) {
                categories.forEach(c => {
                    state.initialCategoryCounts[c.id] = c.article_count || 0;
                });
            }

            const detailText = categories.map(c => {
                const count = c.article_count || 0;
                const initial = state.initialCategoryCounts[c.id] || 0;
                const diff = count - initial;

                let diffHtml = '';
                if (diff > 0) diffHtml = `<span class="diff-positive">+${diff}</span>`;
                else if (diff < 0) diffHtml = `<span class="diff-negative">${diff}</span>`;

                return `${escapeHtml(c.name)} (${count}${diffHtml})`;
            }).join(', ');

            detailsElems.forEach(el => {
                el.innerHTML = detailText;
                el.style.display = 'block';
            });
        }

    } catch (error) {
        console.error('Erro ao carregar categorias:', error);
    }
}

function updateCategorySelects(categories) {
    const selects = [
        document.getElementById('articleCategory'),
        document.getElementById('categoryFilter'),
        document.getElementById('import-category')
    ];

    selects.forEach(select => {
        const currentValue = select.value;
        const isFilter = select.id === 'categoryFilter';

        select.innerHTML = isFilter
            ? '<option value="">Todas as categorias</option>'
            : '<option value="">Selecione uma categoria</option>';

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    });
}

function renderCategoriesList(categories) {
    const list = document.getElementById('categoriesList');

    if (categories.length === 0) {
        list.innerHTML = '<div class="loading">Nenhuma categoria cadastrada</div>';
        return;
    }

    list.innerHTML = categories.map(cat => `
        <div class="category-item">
            <div class="category-info">
                <h4 style="display: flex; align-items: center; gap: 8px;">
                    > ${escapeHtml(cat.name)} 
                    <span style="font-size: 0.75rem; background: rgba(163,255,0,0.1); color: #a3ff00; padding: 2px 6px; border-radius: 0; border: 1px dotted #a3ff00;" title="${cat.article_count || 0} artigos vinculados">
                        [ ${cat.article_count || 0} ]
                    </span>
                </h4>
                ${cat.description ? `<p>${escapeHtml(cat.description)}</p>` : ''}
            </div>
            <div class="category-actions" style="display: flex; gap: 5px; align-items: start;">
                 <button class="btn-secondary" onclick="editCategory(${cat.id}, '${escapeHtml(cat.name)}', '${escapeHtml(cat.description || '')}')" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-danger" onclick="deleteCategory(${cat.id})" title="Excluir">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

function editCategory(id, name, description) {
    document.getElementById('categoryId').value = id;
    document.getElementById('categoryName').value = name;
    document.getElementById('categoryDescription').value = description;

    // Change button text
    const btnSubmit = document.querySelector('#categoryForm button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = 'Salvar Alterações';

    // Create cancel button if it doesn't exist
    if (!document.getElementById('btnCancelCategory')) {
        const btnCancel = document.createElement('button');
        btnCancel.type = 'button';
        btnCancel.id = 'btnCancelCategory';
        btnCancel.className = 'btn-secondary';
        btnCancel.textContent = 'Cancelar';
        btnCancel.style.marginLeft = '10px';
        btnCancel.onclick = resetCategoryForm;
        document.querySelector('#categoryForm').appendChild(btnCancel);
    }
}

async function deleteCategory(id) {
    if (!await showConfirmation('Excluir Categoria', 'Tem certeza que deseja excluir esta categoria? Isso só será possível se não houver artigos nela.', 'Excluir', 'danger')) return;

    try {
        const response = await fetch(`${API_URL}/categories/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✅ Categoria excluída com sucesso!', 'success');
            await loadCategories();
            await checkStatus();
        } else {
            const error = await response.json();
            showNotification('❌ Erro: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir categoria:', error);
        showNotification('❌ Erro ao excluir categoria', 'error');
    }
}

function resetCategoryForm() {
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryId').value = '';

    const btnSubmit = document.querySelector('#categoryForm button[type="submit"]');
    if (btnSubmit) btnSubmit.textContent = 'Adicionar Categoria';

    const btnCancel = document.getElementById('btnCancelCategory');
    if (btnCancel) btnCancel.remove();
}

// Make globally available
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;

function selectCategory(id, name) {
    const articleCategory = document.getElementById('articleCategory');
    articleCategory.value = id;

    // Switch to new article tab
    switchAdminTab('new-article');

    showNotification(`Categoria "${name}" selecionada para o novo artigo`, 'success');
}

async function saveCategory(e) {
    e.preventDefault();

    const id = document.getElementById('categoryId').value;
    const name = document.getElementById('categoryName').value.trim();
    const description = document.getElementById('categoryDescription').value.trim();

    try {
        const url = id ? `${API_URL}/categories/${id}` : `${API_URL}/categories`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name, description })
        });

        if (response.ok) {
            const data = await response.json();
            resetCategoryForm();
            await loadCategories();
            await checkStatus();

            showNotification(id ? '✅ Categoria atualizada!' : '✅ Categoria criada!', 'success');
        } else {
            const error = await response.json();
            showNotification('❌ Erro: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar categoria:', error);
        showNotification('❌ Erro ao salvar categoria', 'error');
    }
}

// ==================== ADMIN - ARTIGOS ====================

async function saveArticle(e) {
    e.preventDefault();

    const id = document.getElementById('articleId').value;
    const title = document.getElementById('articleTitle').value.trim();
    const content = document.getElementById('articleContent').value.trim();
    const categoryId = document.getElementById('articleCategory').value;
    const tags = document.getElementById('articleTags').value.split(',').map(t => t.trim()).filter(t => t);

    const articleData = {
        title,
        content,
        category_id: categoryId || null,
        tags
    };

    // Check if we are in "Review/Approve" mode
    const btnSave = document.getElementById('btnSaveArticle');
    if (btnSave && btnSave.dataset.mode === 'approve') {
        articleData.status = 'approved';
    }

    try {
        const url = id ? `${API_URL}/articles/${id}` : `${API_URL}/articles`;
        const method = id ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(articleData)
        });

        if (response.ok) {
            resetArticleForm();
            await checkStatus();
            showNotification(id ? '✅ Artigo atualizado com sucesso!' : 'Artigo criado com sucesso!', 'success');
        } else {
            const error = await response.json();
            showNotification('❌ Erro: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar artigo:', error);
        showNotification('❌ Erro ao salvar artigo', 'error');
    }
}

function resetArticleForm() {
    document.getElementById('articleForm').reset();
    document.getElementById('articleId').value = '';

    // Reset button state
    const btnSave = document.getElementById('btnSaveArticle');
    if (btnSave) {
        btnSave.textContent = 'Salvar Artigo';
        delete btnSave.dataset.mode;
        // Keep standard styling
    }
}

function editArticle() {
    console.log("Tentando editar artigo...", state.currentArticle);
    if (!state.currentArticle) return;

    const article = state.currentArticle;

    document.getElementById('articleId').value = article.id;
    document.getElementById('articleTitle').value = article.title;
    document.getElementById('articleContent').value = article.content;
    document.getElementById('articleCategory').value = article.category_id || '';

    // Safety check for tags
    const tagsVal = Array.isArray(article.tags) ? article.tags.join(', ') : (article.tags || '');
    document.getElementById('articleTags').value = tagsVal;

    closeModal();
    switchView('admin');
    switchAdminTab('new-article');
}

async function deleteArticle() {
    console.log("Tentando excluir artigo...", state.currentArticle);
    if (!state.currentArticle) {
        console.error("Nenhum artigo selecionado no state.");
        return;
    }

    if (!await showConfirmation('Excluir Artigo', 'Tem certeza que deseja excluir este artigo? \n\n⚠️ TODO o histórico de interações (likes/views) será perdido permanentemente!', 'Excluir', 'danger')) return;

    try {
        console.log(`Enviando DELETE para /articles/${state.currentArticle.id}`);
        const response = await fetch(`${API_URL}/articles/${state.currentArticle.id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            closeModal();
            await checkStatus();
            if (state.currentView === 'articles') {
                await loadArticles();
            }
            // Force reload network too if active
            if (state.currentView === 'neural' && typeof initNeuralNetwork === 'function') {
                initNeuralNetwork();
            }
            showNotification('✅ Artigo excluído com sucesso!', 'success');
        } else {
            const error = await response.json();
            showNotification('❌ Erro: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir artigo:', error);
        showNotification('❌ Erro ao excluir artigo', 'error');
    }
}

// ==================== VALIDAÇÃO DE ARTIGOS ====================

async function loadPendingArticles(countOnly = false) {
    if (!state.user || (state.user.role !== 'admin' && state.user.role !== 'super_admin')) return;

    try {
        const response = await fetch(`${API_URL}/articles?status=pending`);
        if (!response.ok) throw new Error('Erro ao buscar artigos pendentes');

        const articles = await response.json();

        // Atualizar Badge
        const pendingCount = articles.length;
        const badge = document.getElementById('pendingCount');
        if (badge) {
            badge.textContent = pendingCount;
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        // Toggle Bulk Buttons
        const btnApproveAll = document.getElementById('btnApproveAll');
        const btnRejectAll = document.getElementById('btnRejectAll');

        if (btnApproveAll) {
            btnApproveAll.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }
        if (btnRejectAll) {
            btnRejectAll.style.display = pendingCount > 0 ? 'inline-flex' : 'none';
        }

        if (countOnly) return;

        const grid = document.getElementById('pendingArticlesGrid');
        grid.innerHTML = '';

        if (articles.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>Nenhum artigo pendente de validação.</p>
                </div>
            `;
            return;
        }

        articles.forEach(article => {
            const card = document.createElement('div');
            card.className = 'article-card pending-card';
            card.style.background = 'transparent';
            card.style.border = '1px solid #f1c40f'; // Yellow indicating pending
            card.style.borderRadius = '0';
            card.style.boxShadow = 'none';

            const contentPreview = article.content ? article.content.substring(0, 150) : '';
            const categoryName = article.category_name || 'Sem Categoria';

            card.innerHTML = `
                <div class="article-header" style="border-bottom: 1px dashed rgba(241,196,15,0.3); padding-bottom: 5px; margin-bottom: 10px;">
                    <span class="article-category" style="color: #f1c40f; font-family: 'Courier New', monospace; font-weight: bold; text-transform: uppercase;">[ ${escapeHtml(categoryName)} ]</span>
                    <span class="article-date" style="color: rgba(241,196,15,0.6); font-family: 'Courier New', monospace;">[ ${formatDate(article.created_at)} ]</span>
                </div>
                <h3 style="color: #fff; font-family: 'Courier New', monospace; text-transform: uppercase;">> ${escapeHtml(article.title)}</h3>
                <p style="color: rgba(255,255,255,0.7); font-family: 'Courier New', monospace;">${escapeHtml(contentPreview)}...</p>
                <div class="article-actions" style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn-success" onclick="approveArticle(${article.id})" style="background: #a3ff00; color: #020202; border: 1px solid #a3ff00; font-family: 'Courier New', monospace; border-radius: 0; padding: 8px 10px; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: all 0.2s; flex: 1; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.boxShadow='3px 3px 0px rgba(163,255,0,0.3)'; this.style.transform='translate(-2px, -2px)';" onmouseout="this.style.boxShadow='none'; this.style.transform='none';">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg> [ APROVAR ]
                    </button>
                    <button class="btn-secondary" onclick="reviewArticle(${article.id})" style="background: transparent; border: 1px dotted rgba(255,255,255,0.5); color: #fff; font-family: 'Courier New', monospace; border-radius: 0; padding: 8px 10px; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: all 0.2s; flex: 1;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.borderColor='#fff';" onmouseout="this.style.background='transparent'; this.style.borderColor='rgba(255,255,255,0.5)';">
                        [ REVISAR ]
                    </button>
                    <button class="btn-danger" onclick="rejectArticle(${article.id})" style="background: transparent; color: #ff0055; border: 1px dashed #ff0055; font-family: 'Courier New', monospace; border-radius: 0; padding: 8px 10px; font-weight: bold; text-transform: uppercase; cursor: pointer; transition: all 0.2s; flex: 1; display: flex; align-items: center; justify-content: center;" onmouseover="this.style.background='rgba(255,0,85,0.1)';" onmouseout="this.style.background='transparent';">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 5px;">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg> [ REJEITAR ]
                    </button>
                </div>
            `;
            grid.appendChild(card);
        });

    } catch (error) {
        console.error('Erro ao carregar pendentes:', error);
        showNotification('Erro ao carregar lista: ' + error.message, 'error');
    }
}

async function approveArticle(id) {
    if (!await showConfirmation('Aprovar Artigo', 'Confirmar aprovação deste artigo? Ele ficará visível para a IA.', 'Aprovar', 'success')) return;

    try {
        const response = await fetch(`${API_URL}/articles/${id}/approve`, {
            method: 'PUT'
        });

        if (response.ok) {
            showNotification('Artigo aprovado com sucesso!', 'success');
            loadPendingArticles(); // Atualizar lista pendente
            loadArticles(); // Atualizar lista oficial e IA
        } else {
            throw new Error('Falha ao aprovar');
        }
    } catch (error) {
        console.error(error);
        showNotification('Erro ao aprovar artigo', 'error');
    }
}

async function rejectArticle(id) {
    if (!await showConfirmation('Rejeitar Artigo', 'Tem certeza que deseja REJEITAR e EXCLUIR este artigo?', 'Rejeitar', 'danger')) return;

    try {
        // Usamos a mesma rota de delete
        const response = await fetch(`${API_URL}/articles/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('Artigo rejeitado e excluído.', 'info');
            loadPendingArticles();
        } else {
            throw new Error('Falha ao rejeitar');
        }
    } catch (error) {
        console.error(error);
        showNotification('Erro ao rejeitar artigo', 'error');
    }
}

async function rejectAllArticles() {
    if (!await showConfirmation('Rejeitar Todos', 'ATENÇÃO: Isso excluirá TODOS os artigos pendentes. Tem certeza?', 'Rejeitar Tudo', 'danger')) return;

    try {
        const response = await fetch(`${API_URL}/articles/reject-all-pending`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (response.ok) {
            showNotification(data.message, 'success');
            loadPendingArticles();
        } else {
            showNotification(data.error || 'Erro ao rejeitar artigos', 'error');
        }
    } catch (error) {
        console.error('Erro ao rejeitar tudo:', error);
        showNotification('Erro de conexão com o servidor', 'error');
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}
// --- Funções de Importação ---

async function handleImportWord(e) {
    e.preventDefault();

    const fileInput = document.getElementById('import-file');
    const categoryId = document.getElementById('import-category').value;
    const btn = document.getElementById('btn-start-import');

    // UI Elements
    const dropZone = document.getElementById('drop-zone');
    const uploadProgress = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressPercent = document.getElementById('progress-percent');

    if (!fileInput.files[0]) {
        showNotification('Por favor, selecione um arquivo .docx', 'info');
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('category_id', categoryId);

    // Lock UI
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';
    dropZone.style.pointerEvents = 'none';
    uploadProgress.style.display = 'block';

    // Simulate Progress (Indeterminate/Fake)
    progressBar.style.width = '0%';
    progressBar.classList.add('indeterminate');
    progressText.textContent = 'Enviando e processando...';
    progressPercent.textContent = '';

    try {
        const response = await fetch(`${API_URL}/articles/import/word`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            progressBar.classList.remove('indeterminate');
            progressBar.style.width = '100%';
            progressText.textContent = 'Concluído!';

            showNotification('✅ Documento importado com sucesso!', 'success');

            setTimeout(() => {
                document.getElementById('modal-import').style.display = 'none';
                resetImportModal();
                loadArticles();
                checkStatus();
            }, 1000);
        } else {
            progressBar.classList.remove('indeterminate');
            progressBar.style.width = '0%';
            uploadProgress.style.display = 'none';
            showNotification('❌ Erro: ' + data.error, 'error');
        }
    } catch (error) {
        console.error('Erro na importação:', error);
        showNotification('❌ Erro de conexão com o servidor', 'error');
        uploadProgress.style.display = 'none';
    } finally {
        if (uploadProgress.style.display === 'none') {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-file-import"></i> Iniciar Importação';
            dropZone.style.pointerEvents = 'auto';
        }
    }
}

function setupImportDragAndDrop() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('import-file');
    const filePreview = document.getElementById('file-preview');
    const dropContent = dropZone.querySelector('.drop-zone-content');
    const browseBtn = dropZone.querySelector('.btn-browse');
    const removeBtn = document.getElementById('btn-remove-file');
    const startBtn = document.getElementById('btn-start-import');

    if (!dropZone || !fileInput) return;

    // Trigger file input on click
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling if parent has listener
        fileInput.click();
    });

    dropZone.addEventListener('click', () => {
        if (filePreview.style.display === 'none') {
            fileInput.click();
        }
    });

    // Drag Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        dropZone.classList.add('dragover');
    }

    function unhighlight(e) {
        dropZone.classList.remove('dragover');
    }

    // Handle Drop
    dropZone.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;

        if (files.length) {
            handleFiles(files);
        }
    }

    // Handle Input Change
    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;

        const file = files[0];

        // Validation (Simple extension check)
        if (!file.name.toLowerCase().endsWith('.docx')) {
            showNotification('Apenas arquivos .docx são permitidos', 'warning');
            return;
        }

        // Update IO
        fileInput.files = files; // Sync drop with input if needed (though DataTransfer is read-only usually, simpler to just use state or manual sync if needed, but for FormData input is best source)

        // Manually setting files property of file input is tricky/impossible in some browsers for security, 
        // but for Drop, we usually process data directly. 
        // BUT, since we use `fileInput.files[0]` in submit handler, we need to ensure input has files.
        // Modern browsers allow setting input.files from DataTransfer.
        if (fileInput.files !== files) {
            fileInput.files = files; // Try to sync
        }

        updatePreview(file);
    }

    function updatePreview(file) {
        document.getElementById('preview-filename').textContent = file.name;
        document.getElementById('preview-filesize').textContent = formatBytes(file.size);

        dropContent.style.display = 'none';
        filePreview.style.display = 'flex';
        startBtn.disabled = false;
    }

    // Remove File
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetImportModal();
    });
}

function resetImportModal() {
    const fileInput = document.getElementById('import-file');
    const filePreview = document.getElementById('file-preview');
    const dropContent = document.querySelector('.drop-zone-content');
    const startBtn = document.getElementById('btn-start-import');
    const uploadProgress = document.getElementById('upload-progress');
    const progressBar = document.getElementById('progress-bar');
    const dropZone = document.getElementById('drop-zone');

    fileInput.value = '';
    filePreview.style.display = 'none';
    dropContent.style.display = 'flex';
    startBtn.disabled = true;
    startBtn.innerHTML = '<i class="fas fa-file-import"></i> Iniciar Importação';

    uploadProgress.style.display = 'none';
    progressBar.classList.remove('indeterminate');
    dropZone.style.pointerEvents = 'auto';
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const icon = type === 'success' ? '✅' : (type === 'error' ? '❌' : 'ℹ️');

    notification.innerHTML = `
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
    `;

    document.body.appendChild(notification);

    // Forçar reflow para animação
    notification.offsetHeight;
    notification.classList.add('active');

    setTimeout(() => {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function showConfirmation(title, message, confirmText = 'Confirmar', type = 'primary') {
    return new Promise((resolve) => {
        const modal = document.getElementById('confirmationModal');
        const titleEl = document.getElementById('confirmTitle');
        const messageEl = document.getElementById('confirmMessage');
        const btnCancel = document.getElementById('btnConfirmCancel');
        const btnConfirm = document.getElementById('btnConfirmOk');

        titleEl.textContent = title;
        messageEl.textContent = message;
        btnConfirm.textContent = confirmText;

        // Reset classes
        btnConfirm.className = 'btn-modal btn-modal-confirm';
        if (type !== 'primary') {
            btnConfirm.classList.add(type); // danger, success
        }

        modal.classList.add('active');

        // Handlers
        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        const cleanup = () => {
            modal.classList.remove('active');
            btnConfirm.removeEventListener('click', handleConfirm);
            btnCancel.removeEventListener('click', handleCancel);
        };

        btnConfirm.addEventListener('click', handleConfirm, { once: true });
        btnCancel.addEventListener('click', handleCancel, { once: true });
    });
}


async function reviewArticle(id) {
    try {
        const response = await fetch(`${API_URL}/articles/${id}`);
        if (!response.ok) throw new Error('Erro ao carregar artigo para revisão');

        const article = await response.json();

        // Preencher formulário de edição
        document.getElementById('articleId').value = article.id;
        document.getElementById('articleTitle').value = article.title;
        document.getElementById('articleContent').value = article.content;
        document.getElementById('articleCategory').value = article.category_id || '';

        const tagsVal = Array.isArray(article.tags) ? article.tags.join(', ') : (article.tags || '');
        document.getElementById('articleTags').value = tagsVal;

        // Trocar para aba de edição (Admin)
        switchView('admin');
        switchAdminTab('new-article');

        // Change button to "Aprovar"
        const btnSave = document.getElementById('btnSaveArticle');
        if (btnSave) {
            btnSave.textContent = 'Aprovar';
            btnSave.dataset.mode = 'approve';
        }

        showNotification('Modo de revisão ativado. Faça as alterações e clique em Aprovar.', 'info');

        showNotification('Modo de revisão ativado. Faça as alterações e clique em Salvar.', 'info');

    } catch (error) {
        console.error(error);
        showNotification('Erro ao abrir revisão: ' + error.message, 'error');
    }
}


async function approveAllArticles() {
    if (!state.user || state.user.role !== 'admin') {
        showNotification('Apenas administradores podem realizar esta ação.', 'error');
        return;
    }

    if (!await showConfirmation('Aprovar Tudo', 'Tem certeza que deseja APROVAR TODOS os artigos pendentes de uma vez?', 'Sim, Aprovar Tudo', 'success')) return;

    try {
        // Buscar lista atualizada para garantir
        const response = await fetch(`${API_URL}/articles?status=pending`);
        const articles = await response.json();

        if (articles.length === 0) {
            showNotification('Não há artigos pendentes para aprovar.', 'info');
            loadPendingArticles();
            return;
        }

        showNotification(`Processando aprovação de ${articles.length} artigos...`, 'info');

        let successCount = 0;
        let errors = 0;

        // Executar em série para não sobrecarregar o backend/banco
        for (const article of articles) {
            try {
                const res = await fetch(`${API_URL}/articles/${article.id}/approve`, { method: 'PUT' });
                if (res.ok) {
                    successCount++;
                } else {
                    errors++;
                }
            } catch (err) {
                console.error(`Erro ao aprovar artigo ${article.id}`, err);
                errors++;
            }
        }

        if (successCount > 0) {
            showNotification(`${successCount} artigos aprovados com sucesso!`, 'success');
        }

        if (errors > 0) {
            showNotification(`${errors} falhas durante a aprovação.`, 'warning');
        }

        loadPendingArticles();
    } catch (error) {
        console.error('Erro ao aprovar em massa:', error);
        showNotification('Erro ao processar aprovação em massa.', 'error');
    }
}

// ==================== DICIONÁRIO (GERENCIAMENTO) ====================

async function loadLearnedWordsList() {
    const listContainer = document.getElementById('learnedWordsList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading">Carregando dicionário...</div>';

    try {
        const response = await fetch(`${API_URL}/learned-words`);
        const words = await response.json();

        if (words.length === 0) {
            listContainer.innerHTML = '<div class="no-data">Nenhuma palavra aprendida ainda.</div>';
            return;
        }

        let html = '';
        words.forEach(word => {
            html += `
                <div class="category-item">
                    <div class="category-info">
                        <h4 style="display: flex; align-items: center; gap: 8px; margin:0; font-family: 'Courier New', monospace; color: #fff; text-transform: uppercase;">> ${word}</h4>
                    </div>
                    <div class="category-actions">
                        <button class="btn-danger" onclick="deleteLearnedWord('${word}')" title="Excluir">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        listContainer.innerHTML = html;

    } catch (error) {
        console.error('Erro ao carregar dicionário:', error);
        listContainer.innerHTML = '<div class="error-message">Erro ao carregar palavras.</div>';
    }
}

window.deleteLearnedWord = async function (word) {
    if (!await showConfirmation('Excluir Palavra', `Tem certeza que deseja esquecer a palavra "${word}"?`)) return;

    try {
        const response = await fetch(`${API_URL}/learned-words/${encodeURIComponent(word)}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification(`Palavra "${word}" removida!`, 'success');
            loadLearnedWordsList();
        } else {
            showNotification('Erro ao excluir palavra.', 'error');
        }
    } catch (error) {
        console.error("Erro ao excluir:", error);
        showNotification('Erro de conexão.', 'error');
    }
};

window.addLearnedWord = async function () {
    const input = document.getElementById('newLearnedWord');
    const word = input.value.trim();

    if (!word) {
        showNotification('Digite uma palavra para adicionar.', 'warning');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/learned-words`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ word })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Palavra adicionada com sucesso!', 'success');
            input.value = ''; // Limpar input
            loadLearnedWordsList(); // Recarregar lista
        } else {
            showNotification('❌ Erro: ' + (data.error || 'Falha ao adicionar'), 'error');
        }
    } catch (error) {
        console.error("Erro ao adicionar palavra:", error);
        showNotification('Erro de conexão.', 'error');
    }
}

async function loadUsersList() {
    const listContainer = document.getElementById('usersList');
    if (!listContainer) return;

    listContainer.innerHTML = '<div class="loading">Carregando usuários...</div>';

    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();

        if (users.length === 0) {
            listContainer.innerHTML = '<div class="loading">Nenhum usuário cadastrado</div>';
            return;
        }

        listContainer.innerHTML = users.map(user => `
            <div class="category-item">
                <div class="category-info">
                    <h4 style="display: flex; align-items: center; gap: 8px; margin:0; font-family: 'Courier New', monospace; color: #fff; text-transform: uppercase;">
                        > ${escapeHtml(user.username)}
                        <span style="font-size: 0.75rem; background: rgba(163,255,0,0.1); color: #a3ff00; padding: 2px 6px; border-radius: 0; border: 1px dotted #a3ff00;">
                            [ ${user.role === 'super_admin' ? 'SUPER ADMIN' : (user.role === 'admin' ? 'ADMIN' : 'SUPORTE')} ]
                        </span>
                    </h4>
                    <p style="font-size: 0.8rem; opacity: 0.6; font-family: 'Courier New', monospace; margin-top:5px;">Criado em: ${formatDate(user.created_at)}</p>
                </div>
                <div class="category-actions">
                    <button class="btn-danger" onclick="deleteUser(${user.id}, '${escapeHtml(user.username)}')" title="Excluir">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
        listContainer.innerHTML = '<div class="loading">Erro ao carregar usuários</div>';
    }
}

async function saveUser(e) {
    e.preventDefault();

    const username = document.getElementById('userUsername').value.trim();
    const password = document.getElementById('userPassword').value;
    const role = document.getElementById('userRole').value;

    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password, role })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Usuário criado com sucesso!', 'success');
            document.getElementById('userForm').reset();
            loadUsersList();
        } else {
            showNotification('❌ Erro: ' + (data.error || 'Falha ao criar usuário'), 'error');
        }
    } catch (error) {
        console.error('Erro ao salvar usuário:', error);
        showNotification('❌ Erro de conexão', 'error');
    }
}

async function deleteUser(id, username) {
    if (state.user && username === state.user.username) {
        showNotification('❌ Você não pode excluir seu próprio usuário.', 'error');
        return;
    }

    if (!await showConfirmation('Excluir Usuário', `Tem certeza que deseja excluir o usuário ${username}?`, 'Excluir', 'danger')) return;

    try {
        const response = await fetch(`${API_URL}/users/${id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            showNotification('✅ Usuário excluído.', 'success');
            loadUsersList();
        } else {
            const data = await response.json();
            showNotification('❌ Erro: ' + (data.error || 'Falha ao excluir'), 'error');
        }
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        showNotification('❌ Erro de conexão', 'error');
    }
}

function openPersonalSettings() {
    document.getElementById('personalSettingsModal').classList.add('active');
}

function closePersonalSettings() {
    document.getElementById('personalSettingsModal').classList.remove('active');
    document.getElementById('changePasswordForm').reset();
}

async function handleChangePassword(e) {
    e.preventDefault();

    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmNewPassword').value;

    if (newPassword !== confirmPassword) {
        showNotification('As novas senhas não coincidem!', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/change-password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ old_password: oldPassword, new_password: newPassword })
        });

        const data = await response.json();

        if (response.ok) {
            showNotification('✅ Senha alterada com sucesso!', 'success');
            closePersonalSettings();
        } else {
            showNotification('❌ Erro: ' + (data.error || 'Falha ao alterar senha'), 'error');
        }
    } catch (error) {
        console.error('Erro ao alterar senha:', error);
        showNotification('❌ Erro de conexão', 'error');
    }
}

window.openPersonalSettings = openPersonalSettings;
window.closePersonalSettings = closePersonalSettings;



// ==================== IMAGE UPLOADS ====================

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    // Show loading state
    const btnUpload = document.getElementById('btnUploadImage');
    const originalText = btnUpload.innerHTML;
    btnUpload.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    btnUpload.disabled = true;

    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            const textArea = document.getElementById('articleContent');
            const cursorPos = textArea.selectionStart;
            const textBefore = textArea.value.substring(0, cursorPos);
            const textAfter = textArea.value.substring(cursorPos, textArea.value.length);

            // Insert markdown at cursor
            const imageMarkdown = `\n![Imagem](${data.url})\n`;
            textArea.value = textBefore + imageMarkdown + textAfter;

            showNotification('Imagem enviada com sucesso!', 'success');
        } else {
            showNotification(data.error || 'Erro ao enviar imagem', 'error');
        }
    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('Erro de conexão ao enviar imagem', 'error');
    } finally {
        // Reset button
        btnUpload.innerHTML = originalText;
        btnUpload.disabled = false;
        e.target.value = ''; // Reset input so same file can be selected again
    }
}

let usageChartInstance = null;

function renderUsageChart(aiUsageData) {
    const ctx = document.getElementById('aiUsageChart');
    if (!ctx) return;

    // Process Data
    const labels = [];
    const datasets = [];

    // Colors for different metrics
    const colors = {
        'groq': { input: '#f35045', output: '#faa09a' }, // Red/Pink
        'mistral': { input: '#ffb03b', output: '#ffe0b2' }, // Yellow/Light Yellow
        'gemini': { input: '#4285f4', output: '#abcbf7' }  // Blue/Light Blue
    };

    // Aggregate daily totals across providers
    const dailyMap = {};

    Object.entries(aiUsageData).forEach(([provider, stats]) => {
        if (stats.history) {
            Object.entries(stats.history).forEach(([date, dayStats]) => {
                if (!dailyMap[date]) dailyMap[date] = {};
                if (!dailyMap[date][provider]) dailyMap[date][provider] = { input: 0, output: 0 };

                dailyMap[date][provider].input = dayStats.tokens_in || 0;
                dailyMap[date][provider].output = dayStats.tokens_out || 0;
            });
        }
    });

    // Sort dates (Last 7 days)
    const sortedDates = Object.keys(dailyMap).sort().slice(-7);

    // Fallback if no history yet
    if (sortedDates.length === 0) {
        const today = new Date().toISOString().split('T')[0];
        labels.push(today);
        Object.keys(aiUsageData).forEach(p => {
            const stats = aiUsageData[p];
            if (stats.tokens && stats.tokens.total > 0) {
                // Mocking split for current day if unknown
                const input = stats.tokens.input || Math.floor(stats.tokens.total * 0.7);
                const output = stats.tokens.output || (stats.tokens.total - input);

                datasets.push({
                    label: `${stats.name} (Input)`,
                    data: [input],
                    backgroundColor: colors[p]?.input || '#666',
                    stack: p
                });
                datasets.push({
                    label: `${stats.name} (Output)`,
                    data: [output],
                    backgroundColor: colors[p]?.output || '#999',
                    stack: p
                });
            }
        });
    } else {
        labels.push(...sortedDates);

        // Build Datasets for History
        Object.keys(aiUsageData).forEach(provider => {
            const inputData = labels.map(date => dailyMap[date]?.[provider]?.input || 0);
            const outputData = labels.map(date => dailyMap[date]?.[provider]?.output || 0);

            // Only add if there is data anywhere
            if (inputData.some(v => v > 0) || outputData.some(v => v > 0)) {
                datasets.push({
                    label: `${aiUsageData[provider].name || provider} (Entrada)`,
                    data: inputData,
                    backgroundColor: colors[provider]?.input || '#666',
                    stack: provider
                });
                datasets.push({
                    label: `(Saída)`, // Short label to save space
                    data: outputData,
                    backgroundColor: colors[provider]?.output || '#999',
                    stack: provider
                });
            }
        });
    }

    if (usageChartInstance) {
        usageChartInstance.destroy();
    }

    usageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    stacked: true,
                    grid: { display: false, color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888', font: { size: 10 } }
                },
                y: {
                    stacked: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: {
                        color: '#888',
                        font: { size: 10 },
                        callback: function (value) {
                            if (value >= 1000) return (value / 1000) + 'k';
                            return value;
                        }
                    },
                    beginAtZero: true
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: { color: '#ccc', font: { size: 10 }, boxWidth: 10 }
                },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.9)',
                    titleColor: '#fff',
                    bodyColor: '#ccc',
                    borderColor: 'rgba(255,255,255,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toLocaleString() + ' tokens';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

// ==================== CUSTOM AI DROPDOWN ====================
function initCustomDropdown() {
    const dropdown = document.getElementById('aiModelDropdown');
    const trigger = document.getElementById('modelTrigger');
    const menu = document.getElementById('modelMenu');
    const hiddenInput = document.getElementById('modelSelectorValue');
    const currentIcon = dropdown.querySelector('.current-model-icon');
    const currentName = dropdown.querySelector('.current-model-name');

    if (!trigger || !menu) return;

    // Toggle Menu
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('active');
    });

    // Select Item
    menu.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            const value = item.dataset.value;
            const icon = item.dataset.icon;
            const name = item.querySelector('.item-name').textContent.replace(icon, '').trim();

            // Update Visuals
            currentIcon.textContent = icon;
            currentName.textContent = name;
            hiddenInput.value = value;

            // Update Active State
            menu.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');

            // Close Menu
            dropdown.classList.remove('active');

            console.log(' AI Model selected:', value);
        });
    });

    // Click outside to close
    document.addEventListener('click', () => {
        dropdown.classList.remove('active');
    });
}
