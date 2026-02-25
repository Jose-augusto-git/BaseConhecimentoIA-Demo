/**
 * Logic for the "Rede Neural" (Knowledge Graph) Visualization
 * Updated for Cyberpunk/High-Tech Look
 * Refactored: Class-based structure with robust error handling.
 */

// ==================== CONSTANTS & CONFIG ====================
const NEURAL_CONFIG = {
    COLORS: {
        hub: { background: '#020202', border: '#a3ff00', text: '#a3ff00' },
        concept: { background: '#a3ff00', border: '#a3ff00', text: '#020202' },
        article: { background: '#1a1a1a', border: 'rgba(163, 255, 0, 0.5)', text: '#fff' },
        hybrid: { background: '#020202', border: '#a3ff00', text: '#fff' },
        def: { background: '#020202', border: 'rgba(163, 255, 0, 0.8)', text: '#fff' },
        hybridDef: { background: '#a3ff00', border: '#020202', text: '#020202' },
        tag: { background: 'rgba(163, 255, 0, 0.1)', border: '#a3ff00', text: '#a3ff00' }
    },
    PHYSICS: {
        stabilization: {
            enabled: true,
            iterations: 200,
            updateInterval: 50,
            onlyDynamicEdges: false,
            fit: true
        },
        barnesHut: {
            gravitationalConstant: -25000,
            centralGravity: 0.1,
            springLength: 250,
            springConstant: 0.04,
            damping: 0.09,
            avoidOverlap: 1
        },
        maxVelocity: 50,
        minVelocity: 0.1,
        solver: 'barnesHut'
    },
    GROUPS: {
        hub_category: {
            shape: 'box',
            borderWidth: 1,
            font: { size: 16, face: 'Courier New', strokeWidth: 0, color: '#a3ff00' }
        },
        concept_learned: {
            shape: 'square',
            borderWidth: 1,
            font: { size: 14, face: 'Courier New', strokeWidth: 0 },
            shadow: { enabled: true, size: 10 }
        },
        knowledge_article: {
            shape: 'square',
            borderWidth: 1,
            font: { size: 14, face: 'Courier New' }
        },
        hybrid_knowledge: {
            shape: 'square',
            borderWidth: 2,
            font: { size: 16, face: 'Courier New' },
            shadow: { enabled: true, size: 15 }
        },
        concept_definition: {
            shape: 'box',
            font: { size: 12, align: 'left', face: 'Courier New' },
            borderWidth: 1,
            shadow: { enabled: false, size: 0 }
        },
        hybrid_definition: {
            shape: 'box',
            font: { size: 12, align: 'left', face: 'Courier New' },
            borderWidth: 1,
            shadow: { enabled: true, size: 10 }
        },
        tag_node: {
            shape: 'box',
            font: { size: 11, face: 'Courier New' },
            shadow: { enabled: false, size: 0 }
        }
    }
};

// ==================== NEURAL NETWORK MANAGER ====================
class NeuralNetworkManager {
    constructor() {
        this.container = document.getElementById('networkContainer');
        this.hudNodeCount = document.getElementById('hudNodeCount');
        this.network = null;
        this.nodes = new vis.DataSet();
        this.edges = new vis.DataSet();
        this.categoryMap = {}; // Name -> ID
        this.isInitialized = false;
        this.saveTimeout = null;
    }

    /**
     * Initializes the neural network visualization.
     */
    init() {
        console.log("🚀 Initializing Neural Network Manager...");

        // Safety Checks
        if (!this.container) {
            console.error("❌ Network Container not found!");
            return;
        }

        // Cleanup existing network to prevent memory leaks/double-rendering
        if (this.network) {
            console.log("♻️ Destroying previous network instance...");
            this.network.destroy();
            this.network = null;
        }

        if (!window.appState || !window.appState.articles) {
            this.handleMissingData();
            return;
        }

        if (window.appState.articles.length === 0) {
            this.renderLoading("Sinal neural fraco. Nenhum dado encontrado.");
            return;
        }

        try {
            this.clearData();
            this.processData();
            this.renderNetwork();
            this.updateHUD();
            this.setupEvents();

            this.isInitialized = true;
            console.log("✅ Neural Network Initialized Successfully.");

            this.loadPositions();

            // Start Pulse Effect after a short delay
            setTimeout(() => this.simulateActivity(), 2000);

        } catch (error) {
            console.error("🔥 Critical Error initializing Neural Network:", error);
            this.container.innerHTML = `<div class="error-msg" style="color:red; padding:20px;">
                FALHA CRÍTICA NO NÚCLEO: ${error.message}
            </div>`;
        }
    }

    /**
     * Clears existing datasets.
     */
    clearData() {
        this.nodes.clear();
        this.edges.clear();
        this.categoryMap = {};
    }

    /**
     * Processes appState data into Nodes and Edges.
     */
    processData() {
        const { articles, learnedWords, tags } = window.appState;

        // 1. Process Categories (Hubs)
        const categories = new Set();
        articles.forEach(art => {
            const catName = art.category_name || 'Geral';
            if (!categories.has(catName)) {
                categories.add(catName);
                const catId = `cat_${catName}`;
                this.categoryMap[catName] = catId;

                this.nodes.add({
                    id: catId,
                    label: catName,
                    group: 'hub_category',
                    value: 40,
                    ...this.getGroupStyle('hub_category')
                });
            }
        });

        // 2. Process Articles (Synapses)
        articles.forEach(art => this.addArticleNode(art));

        // 3. Process Learned Words
        if (learnedWords && learnedWords.length > 0) {
            this.processLearnedWords(learnedWords);
        }

        // 4. Process Tags
        if (tags && tags.length > 0) {
            this.processTags(tags, articles);
        }
    }

    addArticleNode(art) {
        const catName = art.category_name || 'Geral';
        const catId = this.categoryMap[catName];

        // Concept Detection Logic
        const tags = Array.isArray(art.tags) ? art.tags.join(' ') : (art.tags || '');
        const isTagConcept = /conceito|definição|significado|glosário/i.test(tags);
        const isCatConcept = /aprendizado|conceitos|glossário/i.test(catName);
        const isConcept = isTagConcept || isCatConcept;
        const isHybrid = tags.includes('hybrid_auto');

        if (isConcept) {
            this.createConceptNode(art, catId, catName, isHybrid);
        } else {
            this.createStandardNode(art, catId, catName, isHybrid);
        }
    }

    createConceptNode(art, catId, catName, isHybrid) {
        const tooltipStyle = isHybrid ? "color:#00f3ff" : "#FFD700";
        const originPrefix = isHybrid ? "[ORIGEM HÍBRIDA]" : "[CONCEITO CHAVE]";
        const group = isHybrid ? 'hybrid_knowledge' : 'concept_learned';

        this.nodes.add({
            id: art.id,
            label: art.title,
            title: this.createTooltip(originPrefix, art.title, catName, tooltipStyle),
            group: group,
            value: 25,
            ...this.getGroupStyle(group)
        });

        this.edges.add({
            from: art.id,
            to: catId,
            color: { color: NEURAL_CONFIG.COLORS.concept.text, inherit: false, opacity: 0.6 },
            width: 3
        });

        // Definition Satellite
        const defText = this.extractDefinition(art.content);
        const defId = `${art.id}_def`;
        const defGroup = isHybrid ? 'hybrid_definition' : 'concept_definition';

        this.nodes.add({
            id: defId,
            label: 'Significado',
            title: `<div style="padding:8px; max-width:250px; line-height:1.4;">
                        <strong>Definição:</strong><br>${defText}
                    </div>`,
            group: defGroup,
            x: 50, y: 50, // Hint for physics
            ...this.getGroupStyle(defGroup)
        });

        this.edges.add({
            from: art.id,
            to: defId,
            color: { color: NEURAL_CONFIG.COLORS.concept.text, opacity: 0.5 },
            dashes: true,
            width: 1,
            label: 'define'
        });
    }

    createStandardNode(art, catId, catName, isHybrid) {
        const labelPrefix = isHybrid ? '[NÓ HÍBRIDO]' : '[NÓ DE CONHECIMENTO]';
        const color = isHybrid ? '#00f3ff' : '#bd00ff';
        const group = isHybrid ? 'hybrid_knowledge' : 'knowledge_article';

        this.nodes.add({
            id: art.id,
            label: ' ', // Keep clean
            title: this.createTooltip(labelPrefix, art.title, `Módulo: ${catName}`, `color:${color}`),
            group: group,
            value: 15,
            ...this.getGroupStyle(group)
        });

        this.edges.add({
            from: art.id,
            to: catId,
            color: { color: 'rgba(0, 243, 255, 0.15)', inherit: false },
            width: 1
        });
    }

    processLearnedWords(words) {
        const learningCatId = 'cat_Aprendizado';
        if (!this.nodes.get(learningCatId)) {
            this.nodes.add({
                id: learningCatId,
                label: 'Aprendizado',
                group: 'hub_category',
                value: 50,
                x: -200, y: -200,
                ...this.getGroupStyle('hub_category')
            });
        }

        words.forEach(word => {
            // Check existence by label (slow but necessary if IDs aren't consistent)
            const existing = this.nodes.get({
                filter: item => item.label === word
            });
            if (existing.length > 0) return;

            const nodeId = 'learned_' + word.replace(/\s+/g, '_');
            if (this.nodes.get(nodeId)) return;

            this.nodes.add({
                id: nodeId,
                label: word,
                title: this.createTooltip('[VOCABULÁRIO APRENDIDO]', word, 'Dicionário do Sistema', 'color:#FFD700'),
                group: 'concept_learned',
                value: 20,
                ...this.getGroupStyle('concept_learned')
            });

            this.edges.add({
                from: nodeId,
                to: learningCatId,
                color: { color: '#FFD700', inherit: false, opacity: 0.6 },
                width: 2
            });
        });
    }

    processTags(tags, articles) {
        tags.forEach(tag => {
            const tagId = `tag_${tag.name}`;
            if (!this.nodes.get(tagId)) {
                this.nodes.add({
                    id: tagId,
                    label: tag.name,
                    title: this.createTooltip('[TAG]', tag.name, `Artigos: ${tag.count}`, 'color:#ff00dd'),
                    group: 'tag_node',
                    value: 10 + Math.min(tag.count, 20),
                    ...this.getGroupStyle('tag_node')
                });
            }
        });

        // Link Articles -> Tags
        articles.forEach(art => {
            if (!art.tags) return;

            const artTags = this.parseTags(art.tags);
            artTags.forEach(tagName => {
                const tagId = `tag_${tagName}`;
                if (this.nodes.get(tagId)) {
                    this.edges.add({
                        from: art.id,
                        to: tagId,
                        color: { color: 'rgba(255, 0, 221, 0.15)', inherit: false },
                        width: 1,
                        dashes: true,
                        length: 250
                    });
                }
            });
        });
    }

    renderNetwork() {
        if (!NEURAL_CONFIG || !NEURAL_CONFIG.PHYSICS) {
            console.error("🔥 Configuration Error: NEURAL_CONFIG is missing!");
            return;
        }

        const options = {
            nodes: {
                borderWidth: 0,
                shadow: { enabled: true, color: 'rgba(0,243,255,0.5)', size: 10 }
            },
            groups: this.buildGroupsConfig(),
            edges: {
                smooth: { enabled: true, type: 'continuous', forceDirection: 'none' }
            },
            layout: {
                hierarchical: { enabled: false }
            },
            physics: NEURAL_CONFIG.PHYSICS,
            interaction: { hover: true, tooltipDelay: 100, zoomView: true },
            autoResize: true
        };

        console.log("🕸️ Network Options constructed:", JSON.parse(JSON.stringify(options)));

        try {
            this.network = new vis.Network(this.container, { nodes: this.nodes, edges: this.edges }, options);
        } catch (e) {
            console.error("🔥 Vis.Network Constructor Failed:", e);
            throw e;
        }
    }

    /**
     * Updates HUD statistics.
     */
    updateHUD() {
        if (this.hudNodeCount) {
            this.animateValue(this.hudNodeCount, 0, this.nodes.length, 1000);
        }
    }

    /**
     * Sets up network events.
     */
    setupEvents() {
        if (!this.network) return;

        this.network.on("click", (params) => {
            if (params.nodes.length > 0) {
                const nodeId = params.nodes[0];
                this.handleNodeClick(nodeId);
            }
        });

        // Persistence events with debounce
        this.network.on("dragEnd", () => this.debouncedSave());
        this.network.on("stabilized", () => this.debouncedSave());
    }

    /**
     * Debounced save wrapper.
     */
    debouncedSave() {
        // Permission check: Only Super Admin can save layout
        if (window.appState && window.appState.user && window.appState.user.role === 'super_admin') {
            if (this.saveTimeout) clearTimeout(this.saveTimeout);
            this.saveTimeout = setTimeout(() => {
                this.savePositions();
            }, 2000); // Save 2 seconds after activity stops
        }
    }

    handleNodeClick(nodeId) {
        // IDs numeric = Article ID. Strings (except cat_, tag_, learned_) = Potentially Legacy.
        // Simplified check: If it looks like an article ID (numeric or simple string not starting with prefixes)
        const isSpecialNode = typeof nodeId === 'string' && (nodeId.startsWith('cat_') || nodeId.includes('_def') || nodeId.startsWith('tag_') || nodeId.startsWith('learned_'));

        if (!isSpecialNode) {
            if (window.loadArticleById) {
                console.log("🖱️ Opening Article:", nodeId);
                window.loadArticleById(nodeId);
            }
        }
    }

    /**
     * Public Method: Spawns a new neuron visually.
     */
    spawnLearningNeuron(label, categoryName = 'Aprendizado', definitionText = null) {
        if (!this.network) {
            console.warn("⚠️ Network not initialized.");
            return;
        }

        const newId = 'learned_' + Date.now();
        const group = 'hybrid_knowledge';

        // 1. Add Main Node
        this.nodes.add({
            id: newId,
            label: label,
            title: this.createTooltip('[SÍNAPSE HÍBRIDA]', label, `Categoria: ${categoryName}`, 'color:#00f3ff'),
            group: group,
            value: 30,
            x: 0, y: 0,
            ...this.getGroupStyle(group)
        });

        // 2. Add Definition Node if exists
        if (definitionText) {
            const defId = newId + '_def';
            this.nodes.add({
                id: defId,
                label: 'Significado',
                title: `<div style="padding:8px; max-width:200px; line-height:1.4;">
                            <strong>Definição:</strong><br>${definitionText}
                        </div>`,
                group: 'hybrid_definition',
                x: 50, y: 50,
                ...this.getGroupStyle('hybrid_definition')
            });

            this.edges.add({
                from: newId,
                to: defId,
                color: { color: '#FFD700', opacity: 0.5 },
                dashes: true,
                label: 'define'
            });
        }

        // 3. Connect to Category
        const catId = `cat_${categoryName}`;
        if (!this.nodes.get(catId)) {
            this.nodes.add({
                id: catId,
                label: categoryName,
                group: 'hub_category',
                value: 50,
                x: -200, y: -200,
                ...this.getGroupStyle('hub_category')
            });
        }

        this.edges.add({
            from: newId,
            to: catId,
            color: { color: '#FFD700', inherit: false, opacity: 0.6 },
            width: 3
        });

        // Focus & Pulse
        this.network.focus(newId, { scale: 1.5, animation: { duration: 1500, easingFunction: 'easeInOutQuad' } });
        this.pulseNode(newId, '#FFD700', 40);

        console.log(`✨ Neuron Spawned: ${label}`);
    }

    /**
     * Filters nodes based on query string.
     * Highlights matches, standard nodes dimmed, others hidden or very dim.
     */
    filterNodes(query) {
        if (!this.network) return;

        const q = query.toLowerCase().trim();
        if (!q) {
            // Reset visibility
            const updates = this.nodes.map(n => ({ id: n.id, hidden: false, opacity: 1, color: undefined }));
            this.nodes.update(updates);
            return;
        }

        const updates = [];
        const matches = [];

        this.nodes.forEach(node => {
            const label = (node.label || '').toLowerCase();
            const title = (node.title || '').toLowerCase();
            // Check label or definition title inside tooltip
            const isMatch = label.includes(q) || title.includes(q);

            if (isMatch) {
                matches.push(node.id);
                updates.push({
                    id: node.id,
                    hidden: false,
                    opacity: 1,
                    // Optional: Highlight matching nodes
                    color: { border: '#fff', background: node.group === 'concept_learned' ? '#FFD700' : '#bd00ff' }
                });
            } else {
                updates.push({
                    id: node.id,
                    hidden: false,
                    opacity: 0.1, // Dim non-matches 
                    color: undefined
                });
            }
        });

        this.nodes.update(updates);

        if (matches.length > 0) {
            this.network.fit({ nodes: matches, animation: true });
        }
    }

    /**
     * Generates a simple hash for the current dataset to identify changes.
     * @returns {string} hash
     */
    getDatasetHash() {
        const ids = this.nodes.getIds().sort();
        return ids.length + '_' + (ids.length > 0 ? ids[0] : 'empty') + '_' + (ids.length > 0 ? ids[ids.length - 1] : 'empty');
    }

    /**
     * Persist positions to LocalStorage
     */
    savePositions() {
        if (!this.network) return;

        const positions = this.network.getPositions();
        const data = {
            timestamp: Date.now(),
            hash: this.getDatasetHash(), // Version control
            positions: positions
        };
        localStorage.setItem('neural_network_positions', JSON.stringify(data));
        console.log("💾 Neural positions saved (Debounced).");

        // Visual feedback (optional)
        // this.showToast("Layout da rede salvo.");
    }

    /**
     * Load positions from LocalStorage
     */
    loadPositions() {
        const raw = localStorage.getItem('neural_network_positions');
        if (!raw) return;

        try {
            const data = JSON.parse(raw);
            const currentHash = this.getDatasetHash();

            // Validate dataset version
            if (data.hash !== currentHash) {
                console.warn("⚠️ Saved layout matches a different dataset version. Resetting persistence.");
                this.resetLayout(); // Clear invalid data
                return;
            }

            const positions = data.positions;

            // Only apply to existing nodes
            const updates = [];
            Object.keys(positions).forEach(id => {
                if (this.nodes.get(id)) {
                    updates.push({
                        id: id,
                        x: positions[id].x,
                        y: positions[id].y
                    });
                }
            });

            if (updates.length > 0) {
                console.log(`📂 Loading positions for ${updates.length} nodes...`);
                this.nodes.update(updates);

                // Stabilize after loading positions to let physics settle slightly
                this.network.stabilize(50);
                this.network.fit();
                this.showToast("Layout restaurado.");
            }
        } catch (e) {
            console.warn("Error loading positions:", e);
        }
    }

    showToast(msg) {
        console.log(`Toast: ${msg}`);
        if (window.showNotification) window.showNotification(msg, 'success');
    }

    /**
     * Reset layout by clearing localStorage and stabilizing.
     */
    resetLayout() {
        localStorage.removeItem('neural_network_positions');
        console.log("🧹 Layout reset.");
        if (this.network) {
            this.network.stabilize(100);
            this.network.fit();
        }
        this.showToast("Layout redefinido.");
    }

    /**
     * Simulate random activity pulses.
     */
    simulateActivity() {
        if (!this.network) return;

        const nodeIds = this.nodes.getIds();
        if (nodeIds.length === 0) return;

        const randomNodes = [];
        for (let i = 0; i < 5; i++) {
            randomNodes.push(nodeIds[Math.floor(Math.random() * nodeIds.length)]);
        }

        const updates = [];
        randomNodes.forEach(id => {
            if (typeof id === 'string' && id.startsWith('cat_')) return;

            const isTag = typeof id === 'string' && id.startsWith('tag_');
            const color = isTag ? '#ff00dd' : '#ffffff';
            const size = isTag ? 15 : 30;

            updates.push({
                id: id,
                color: { background: color, border: '#ffffff' },
                shadow: { enabled: true, size: size, color: color }
            });
        });

        if (updates.length > 0) {
            this.nodes.update(updates);
            setTimeout(() => {
                // Revert to original group style by resetting to null/undefined or explicitly re-setting
                // Safe approach: disable specific shadow override, let group take over? 
                // Vis.js DataSet update with null usually clears the property.
                const resets = updates.map(u => ({
                    id: u.id,
                    color: null,
                    shadow: null
                }));
                this.nodes.update(resets);
            }, 300);
        }
    }

    // --- Helpers ---

    getGroupStyle(groupName) {
        const config = NEURAL_CONFIG.GROUPS[groupName];
        const colors = NEURAL_CONFIG.COLORS;

        // Assemble color object based on config mapping
        let colorConfig = {};
        if (groupName === 'hub_category') colorConfig = colors.hub;
        else if (groupName === 'concept_learned') colorConfig = colors.concept;
        else if (groupName === 'knowledge_article') colorConfig = colors.article;
        else if (groupName === 'hybrid_knowledge') colorConfig = colors.hybrid;
        else if (groupName === 'concept_definition') colorConfig = colors.def;
        else if (groupName === 'hybrid_definition') colorConfig = colors.hybridDef;
        else if (groupName === 'tag_node') colorConfig = colors.tag;

        return {
            color: {
                background: colorConfig.background,
                border: colorConfig.border,
                highlight: { background: '#fff', border: colorConfig.border }
            },
            font: { color: colorConfig.text, ...config.font }
        };
    }

    buildGroupsConfig() {
        // Needs to map NEURAL_CONFIG.GROUPS and merge with COLORS dynamically
        // Because Vis.JS groups logic is declarative, we can pre-build
        const groups = {};
        Object.keys(NEURAL_CONFIG.GROUPS).forEach(key => {
            const base = NEURAL_CONFIG.GROUPS[key];
            const styles = this.getGroupStyle(key);

            // Strictly define shadow to avoid "undefined property" crashes
            const safeShadow = base.shadow ? { enabled: true, ...base.shadow } : { enabled: false };

            groups[key] = {
                shape: base.shape,
                borderWidth: base.borderWidth,
                shadow: safeShadow,
                ...styles
            };
        });
        return groups;
    }

    handleMissingData() {
        this.renderLoading("Iniciando protocolo de conexão neural...");
        if (window.loadArticles) {
            console.log("Fluxo Neural: Artigos vazios, forçando carregamento...");
            window.loadArticles().then(() => {
                if (window.appState.articles && window.appState.articles.length > 0) {
                    this.init();
                } else {
                    this.renderLoading("Sinal neural fraco. Nenhum dado encontrado.");
                }
            });
        }
    }

    renderLoading(msg) {
        if (this.container) {
            this.container.innerHTML = `<div class="loading">${msg}</div>`;
        }
    }

    createTooltip(header, title, sub, headerStyle) {
        return `<div style="padding:8px; line-height:1.4;">
                    <strong style="${headerStyle}">${header}</strong><br>
                    ${title}<br>
                    <small style="color:#aaa">${sub}</small>
                </div>`;
    }

    extractDefinition(content) {
        const parts = content.split(/\n\s*\n/);
        for (let part of parts) {
            if (!part.startsWith('#') && part.length > 20) {
                return part.length > 100 ? part.substring(0, 100) + '...' : part;
            }
        }
        return "Definição não identificada.";
    }

    parseTags(tagsInput) {
        if (Array.isArray(tagsInput)) return tagsInput;
        if (typeof tagsInput === 'string') {
            return tagsInput.split(',').map(t => t.trim()).filter(t => t);
        }
        return [];
    }

    animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    pulseNode(id, color, size) {
        setTimeout(() => {
            this.nodes.update({ id: id, shadow: { enabled: true, size: size, color: color } });
            setTimeout(() => {
                this.nodes.update({ id: id, shadow: null });
            }, 1000);
        }, 500);
    }
}

// ==================== GLOBAL WRAPPERS (SINGLETON) ====================
let _neuralManager = null;

function getManager() {
    if (!_neuralManager) {
        _neuralManager = new NeuralNetworkManager();
    }
    return _neuralManager;
}

window.initNeuralNetwork = function () {
    getManager().init();
};

window.simulateActivity = function () {
    const manager = getManager();
    // Only simulate if initialized to avoid error logs before load
    if (manager.isInitialized) {
        manager.simulateActivity();
    }
};

window.spawnLearningNeuron = function (label, category, definition) {
    getManager().spawnLearningNeuron(label, category, definition);
};

window.debugNetwork = window.simulateActivity;
