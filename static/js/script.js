const ids = [
    'i_multipleRequests', 'i_generationTime', 'i_header', 'i_address', 'i_phone', 'i_version', 'i_spelling', 'i_docs', 'i_layout', 'i_abbrev', 'i_headerBold', 'i_totalsBold', 'i_clarity', 'i_filters', 'i_databased', 'i_filteredData', 'i_totals', 'i_nulls', 'i_grouping', 'i_consistency', 'i_devAgreement', 'i_functionality', 'i_excel', 'i_approved', 'i_attachPdf'
];
const validationCounterKey = 'validation_report_counter';

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3500);
}

// --- LÓGICA ATUALIZADA PARA O CHECKLIST DA SOLICITAÇÃO ---

function renderSolicitacaoChecklist() {
    const textarea = document.getElementById('solicitacao');
    const checklistContainer = document.getElementById('solicitacao-checklist');
    const editBtn = document.getElementById('edit-solicitacao-btn');
    let text = textarea.value;

    // Pré-processamento: Converte formatos especiais para Markdown padrão
    const solicitacaoMarker = "Solicitação:";
    if (text.toLowerCase().includes(solicitacaoMarker.toLowerCase())) {
        const parts = text.split(new RegExp(solicitacaoMarker, 'i'));
        const descriptionPart = parts[0].trim();
        let tasksPart = parts.slice(1).join(solicitacaoMarker).trim();

        const taskLines = tasksPart.split('\n').map(line => {
            const match = line.trim().match(/^\s*\d+\s*[-.)]?\s*(.*)/); // Aceita '01 -', '1.', '2)' etc.
            if (match && match[1]) {
                return `- [ ] ${match[1].trim()}`;
            }
            return line;
        }).join('\n');

        text = `${descriptionPart}\n\n${taskLines}`;
    }

    const taskRegex = /^\s*-\s*\[\s*([xX ]?)\s*\]\s*(.*)/;
    const lines = text.split('\n');
    const hasChecklistItems = lines.some(line => taskRegex.test(line.trim()));

    if (!hasChecklistItems && !text.includes("Descrição do Atendimento")) {
        editSolicitacao(true);
        return;
    }

    checklistContainer.innerHTML = '';
    let isChecklistSection = false;
    lines.forEach((line, index) => {
        const match = line.match(taskRegex);
        if (match) {
            isChecklistSection = true;
            const isChecked = match[1].toLowerCase() === 'x';
            const description = match[2];

            const itemDiv = document.createElement('div');
            itemDiv.className = 'item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `solicitacao-task-${index}`;
            checkbox.checked = isChecked;
            checkbox.addEventListener('change', () => updateItemClass(checkbox));

            const label = document.createElement('label');
            label.htmlFor = `solicitacao-task-${index}`;
            label.innerHTML = `<strong>${description}</strong>`;

            itemDiv.appendChild(checkbox);
            itemDiv.appendChild(label);
            checklistContainer.appendChild(itemDiv);
            updateItemClass(checkbox);
        } else if (line.trim() !== '') {
            // Trata linhas que não são tasks, como a descrição
            if (!isChecklistSection) {
                const descDiv = document.createElement('div');
                descDiv.className = 'solicitacao-description';
                descDiv.innerHTML = `<p>${line.replace(/Descrição do Atendimento:/i, '').trim()}</p>`;
                checklistContainer.appendChild(descDiv);
            } else {
                const textDiv = document.createElement('div');
                textDiv.textContent = line;
                textDiv.style.padding = '0.5rem 0';
                checklistContainer.appendChild(textDiv);
            }
        }
    });

    textarea.style.display = 'none';
    checklistContainer.style.display = 'block';
    editBtn.style.display = 'inline-block';
}

function getSolicitacaoAsText() {
    const checklistContainer = document.getElementById('solicitacao-checklist');
    if (checklistContainer.style.display === 'none') {
        return document.getElementById('solicitacao').value;
    }

    let lines = [];
    checklistContainer.childNodes.forEach(node => {
        if (node.classList && node.classList.contains('item')) {
            const checkbox = node.querySelector('input[type="checkbox"]');
            const label = node.querySelector('label strong');
            const status = checkbox.checked ? '- [x]' : '- [ ]';
            lines.push(`${status} ${label.textContent}`);
        } else if (node.classList && node.classList.contains('solicitacao-description')) {
            lines.push(`Descrição do Atendimento: ${node.textContent.trim()}`);
        } else {
            lines.push(node.textContent);
        }
    });
    return lines.join('\n');
}

function editSolicitacao(forceShowTextarea = false) {
    const textarea = document.getElementById('solicitacao');
    const checklistContainer = document.getElementById('solicitacao-checklist');
    const editBtn = document.getElementById('edit-solicitacao-btn');

    if (!forceShowTextarea) {
        textarea.value = getSolicitacaoAsText();
    }

    textarea.style.display = 'block';
    checklistContainer.style.display = 'none';
    editBtn.style.display = 'none';
}

// --- FUNÇÕES DE ESTADO ATUALIZADAS ---

function applyState(st) {
    if (!st) return;
    document.getElementById('solicitacao').value = st.solicitacao || '';
    renderSolicitacaoChecklist();
    document.getElementById('documentacao').value = st.documentacao || '';
    document.getElementById('tempoGeracao').value = st.tempo || '';
    const items = st.items || {};
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.checked = !!items[id]; updateItemClass(el); }
    });
    applyGenerationTime();
}

function saveState() {
    const state = {
        solicitacao: getSolicitacaoAsText(),
        documentacao: document.getElementById('documentacao').value,
        tempo: document.getElementById('tempoGeracao').value,
        items: {}
    };
    ids.forEach(id => state.items[id] = document.getElementById(id).checked);
    localStorage.setItem('checklist_validacao', JSON.stringify(state));
    showToast('Estado salvo localmente!', 'success');
}

function exportJSON() {
    const out = {
        solicitacao: getSolicitacaoAsText(),
        documentacao: document.getElementById('documentacao').value,
        tempo: document.getElementById('tempoGeracao').value,
        items: {}
    };
    ids.forEach(id => out.items[id] = document.getElementById(id).checked);
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'checklist_validacao_relatorio.json';
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

function generateMarkdown() {
    let md = ['## ✅ Relatório Validado (Itens Verificados)', '---'];
    const solicitacaoText = getSolicitacaoAsText();
    md.push('### 📝 Solicitação');

    const lines = solicitacaoText.split('\n');
    lines.forEach(line => {
        if (line.toLowerCase().startsWith('descrição do atendimento:')) {
            md.push(`> ${line}`);
        } else if (line.trim().startsWith('- [')) {
            md.push(line);
        }
    });
    md.push('');

    let totalChecked = 0;
    document.querySelectorAll('main > section.card').forEach(card => {
        const titleEl = card.querySelector('.section-title');
        const items = card.querySelectorAll('.item');
        if (titleEl && items.length > 0) {
            const checkedItemsMd = [];
            items.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    totalChecked++;
                    const label = item.querySelector('label strong').textContent;
                    checkedItemsMd.push(`- [x] ${label}`);
                    if (checkbox.id === 'i_generationTime') {
                        const time = document.getElementById('displayTime').textContent;
                        const statusText = document.getElementById('status').textContent;
                        checkedItemsMd.push(`  - **Resultado:** O relatório demorou **${time} segundos** para abrir.`, `  - **Status:** *${statusText}*`);
                    }
                }
            });
            if (checkedItemsMd.length > 0) { md.push(`### ${titleEl.textContent}`, ...checkedItemsMd, ''); }
        }
    });
    if (totalChecked === 0) { md.push('**Nenhum item principal foi marcado como verificado.**', ''); }
    const documentacao = document.getElementById('documentacao').value.trim();
    md.push('### 💬 Documentação e Erros Encontrados', documentacao ? `> ${documentacao.replace(/\n/g, '\n> ')}` : '> Nenhuma observação adicional.');
    return md.join('\n');
}

// --- Demais funções (sem alterações significativas) ---
function clearState(forceClear = false) {
    const confirmation = forceClear || confirm('Tem certeza que deseja limpar todo o checklist? Esta ação não pode ser desfeita.');
    if (confirmation) {
        localStorage.removeItem('checklist_validacao');
        markAll(false);
        document.getElementById('solicitacao').value = '';
        document.getElementById('documentacao').value = '';
        document.getElementById('tempoGeracao').value = '';
        applyGenerationTime();
        editSolicitacao(true); // Garante que a UI da solicitação seja limpa
        if (!forceClear) { showToast('Checklist limpo.', 'info'); }
    }
}
function importReport() {
    document.getElementById('report-importer').click();
}

function processReport(htmlContent) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');
    let markedCount = 0;

    // 1. Tempo de Geração
    // Procura por "Tempo de execução: X.XXs" ou similar no texto do corpo
    const bodyText = doc.body.innerText || "";
    const timeMatch = bodyText.match(/Tempo de execução:\s*([\d.,]+)\s*s/i) || bodyText.match(/Tempo de geração:\s*([\d.,]+)\s*s/i);

    if (timeMatch && timeMatch[1]) {
        const seconds = parseFloat(timeMatch[1].replace(',', '.'));
        const tempoInput = document.getElementById('tempoGeracao');
        tempoInput.value = seconds;
        applyGenerationTime(); // Isso já marca o checkbox de tempo
        markedCount++;
    }

    // 2. Telefones e Endereços
    // Procura por padrões de telefone
    const phoneRegex = /\(\d{2}\)\s*\d{4,5}-\d{4}/;
    if (phoneRegex.test(bodyText)) {
        const chk = document.getElementById('i_phone');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // Procura por indícios de endereço (CEP, Rua, Av, Bairro)
    const addressKeywords = ['CEP:', 'Rua ', 'Avenida ', 'Bairro:'];
    if (addressKeywords.some(kw => bodyText.includes(kw))) {
        const chk = document.getElementById('i_address');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 3. Documentos (CPF/CNPJ)
    // Regex simplificado para detectar presença
    const docRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
    if (docRegex.test(bodyText)) {
        const chk = document.getElementById('i_docs');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 4. Cabeçalho (Header)
    // Se encontrar tabelas com TH, assume que tem cabeçalho
    if (doc.querySelectorAll('th').length > 0) {
        const chk = document.getElementById('i_header');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 5. Layout (Genérico - se o arquivo abriu e tem conteudo, marca layout basics)
    if (bodyText.length > 100) {
        ['i_layout', 'i_clarity'].forEach(id => {
            const chk = document.getElementById(id);
            if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
        });
    }

    showToast(`Relatório processado. ${markedCount} itens marcados automaticamente.`, 'success');
}

function importReport() {
    document.getElementById('report-importer').click();
}

async function processReport(file) {
    // FileReader para ler como ArrayBuffer (exigido pelo PDF.js)
    const fileReader = new FileReader();

    fileReader.onload = async function () {
        const typedarray = new Uint8Array(this.result);

        try {
            showToast("Processando PDF...", "info");
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";

            // Itera por todas as páginas para extrair texto
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(" ");
                fullText += pageText + "\n";
            }

            analyzeText(fullText);

        } catch (error) {
            console.error("Erro ao processar PDF:", error);
            showToast("Erro ao ler o arquivo PDF. Verifique se o arquivo é válido.", "error");
        }
    };

    fileReader.readAsArrayBuffer(file);
}

function analyzeText(bodyText) {
    let markedCount = 0;

    // 1. Tempo de Geração
    // Procura por "Tempo de execução: X.XXs" ou similar no texto do corpo
    // No PDF o texto pode vir quebrado, então usamos regex mais flexível ou removemos espaços excessivos
    // \s* matches spaces, tabs, newlines
    const timeMatch = bodyText.match(/Tempo de execução:?\s*([\d.,]+)\s*s/i) || bodyText.match(/Tempo de geração:?\s*([\d.,]+)\s*s/i);

    if (timeMatch && timeMatch[1]) {
        const seconds = parseFloat(timeMatch[1].replace(',', '.'));
        const tempoInput = document.getElementById('tempoGeracao');
        tempoInput.value = seconds;
        applyGenerationTime(); // Isso já marca o checkbox de tempo
        markedCount++;
    }

    // 2. Telefones e Endereços
    // Procura por padrões de telefone (xxx) xxxx-xxxx
    const phoneRegex = /\(\d{2}\)\s*\d{4,5}-\d{4}/;
    if (phoneRegex.test(bodyText)) {
        const chk = document.getElementById('i_phone');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // Procura por indícios de endereço (CEP, Rua, Av, Bairro)
    const addressKeywords = ['CEP', 'Rua ', 'Avenida ', 'Bairro'];
    // Verifica se pelo menos um aparece
    if (addressKeywords.some(kw => bodyText.includes(kw))) {
        const chk = document.getElementById('i_address');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 3. Documentos (CPF/CNPJ)
    // Regex simplificado para detectar presença
    const docRegex = /\d{3}\.\d{3}\.\d{3}-\d{2}|\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/;
    if (docRegex.test(bodyText)) {
        const chk = document.getElementById('i_docs');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 4. Cabeçalho (Header)
    // Difícil garantir cabeçalho em PDF text only, mas vamos procurar por palavras chave comuns de relatório
    const headerKeywords = ['Relatório', 'Página', 'Data', 'Emissão'];
    let foundHeader = 0;
    headerKeywords.forEach(kw => { if (bodyText.includes(kw)) foundHeader++; });

    if (foundHeader >= 2) {
        const chk = document.getElementById('i_header');
        if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
    }

    // 5. Layout (Genérico - se extraiu texto suficiente, assume que layout básico ok)
    if (bodyText.length > 50) {
        ['i_layout', 'i_clarity'].forEach(id => {
            const chk = document.getElementById(id);
            if (chk && !chk.checked) { chk.checked = true; updateItemClass(chk); markedCount++; }
        });
    }

    showToast(`Relatório processado. ${markedCount} itens marcados automaticamente.`, 'success');
}

function loadState() { const raw = localStorage.getItem("checklist_validacao"); if (!raw) { showToast("Nenhum estado salvo para carregar.", "error"); return } try { const st = JSON.parse(raw); applyState(st); showToast("Estado carregado com sucesso.", "success") } catch (e) { showToast("Erro ao carregar estado salvo. Os dados podem estar corrompidos.", "error") } } function importJSON() { document.getElementById("json-importer").click() } function markAll(e) { ids.forEach(t => { const o = document.getElementById(t); o && (o.checked = e, updateItemClass(o)) }) } function applyGenerationTime() { const e = Number(document.getElementById("tempoGeracao").value) || 0; document.getElementById("displayTime").innerText = e > 0 ? e : "XXX"; const t = document.getElementById("status"); 0 === e ? (t.innerText = "Não definido", t.style.color = "var(--text-muted)") : e >= 10 ? (t.innerText = "Potencial demora a investigar", t.style.color = "var(--danger)", document.getElementById("i_generationTime").checked = !0) : (t.innerText = "Dentro do esperado", t.style.color = "var(--success)", document.getElementById("i_generationTime").checked = !0), updateItemClass(document.getElementById("i_generationTime")) } function autoMarkAll() { const e = Number(document.getElementById("tempoGeracao").value) || 0; e > 0 && applyGenerationTime();["i_header", "i_address", "i_phone", "i_layout", "i_headerBold", "i_clarity", "i_filteredData"].forEach(e => { const t = document.getElementById(e); t.checked = !0, updateItemClass(t) }), showToast("Regras automáticas aplicadas.", "info") } function updateItemClass(e) { const t = e.closest(".item"); t && (e.checked ? t.classList.add("checked") : t.classList.remove("checked")) } function showMarkdownOutput() { document.getElementById("markdownOutput").value = generateMarkdown(), document.getElementById("markdownModal").classList.add("visible") } function closeMarkdownModal() { document.getElementById("markdownModal").classList.remove("visible") } function copyMarkdownToClipboard(e) { const t = document.getElementById("markdownOutput"); navigator.clipboard.writeText(t.value).then(() => { showToast("Texto copiado para a área de transferência!", "success"), e.textContent = "Copiado!", setTimeout(() => { e.textContent = "Copiar Texto" }, 2e3) }).catch(e => { showToast("Falha ao copiar o texto.", "error"), console.error("Erro ao copiar: ", e) }) } function resetValidationCounter() { const e = confirm("Tem certeza que deseja ZERAR o contador de validações totais? Esta ação não pode ser desfeita."); e && (localStorage.setItem(validationCounterKey, "0"), loadValidationCounter(), showToast("Contador total zerado.", "info")) } function loadValidationCounter() { const e = localStorage.getItem(validationCounterKey) || 0; document.getElementById("validationCounter").textContent = e } function finalizeAndClear() { const e = confirm("Você tem certeza que deseja finalizar esta validação? Isso irá contar +1 e limpar o formulário."); if (e) { let e = Number(localStorage.getItem(validationCounterKey)) || 0; e++, localStorage.setItem(validationCounterKey, e), document.getElementById("validationCounter").textContent = e, clearState(!0), showToast(`Validação #${e} concluída com sucesso!`, "success") } } document.addEventListener("DOMContentLoaded", () => {
    loadValidationCounter(), document.querySelectorAll('.item input[type="checkbox"]').forEach(e => { updateItemClass(e), e.addEventListener("change", () => updateItemClass(e)) }), localStorage.getItem("checklist_validacao") && showToast('Dados salvos encontrados. Clique em "Carregar" para restaurar.', "info"); const e = document.getElementById("markdownModal"); e.addEventListener("click", t => { t.target === e && closeMarkdownModal() }); const t = document.getElementById("json-importer"); t.addEventListener("change", e => { const o = e.target.files[0]; if (o) { const n = new FileReader; n.onload = e => { try { const o = JSON.parse(e.target.result); applyState(o), showToast("Checklist importado com sucesso!", "success") } catch (e) { showToast("Erro: O arquivo selecionado não é um JSON válido.", "error"), console.error("Erro ao importar JSON:", e) } }, n.readAsText(o), e.target.value = null } });

    const rpt = document.getElementById("report-importer"); rpt.addEventListener("change", e => { const o = e.target.files[0]; if (o) { processReport(o); } e.target.value = null; });
});