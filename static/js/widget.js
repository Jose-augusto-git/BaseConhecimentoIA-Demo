(function () {
    // Configuração
    const KB_API_URL = document.currentScript.src.replace('/static/js/widget.js', ''); // Detecta URL base automaticamente

    // Injetar CSS
    const style = document.createElement('style');
    style.innerHTML = `
        .kb-widget-launcher {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 60px;
            height: 60px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            border-radius: 50%;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 999998;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s ease;
        }
        .kb-widget-launcher:hover { transform: scale(1.1); }
        .kb-widget-launcher svg { color: white; width: 30px; height: 30px; }
        
        .kb-widget-container {
            position: fixed;
            bottom: 90px;
            right: 20px;
            width: 380px;
            height: 600px;
            max-height: calc(100vh - 120px);
            background: #1a1a1a;
            border-radius: 16px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            z-index: 999999;
            display: none;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid rgba(255,255,255,0.1);
            font-family: 'Segoe UI', sans-serif;
            color: white;
        }
        .kb-widget-container.active { display: flex; animation: slideUp 0.3s ease; }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .kb-header {
            padding: 20px;
            background: linear-gradient(135deg, #000000ff, #764ba2);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .kb-header h3 { margin: 0; font-size: 1.1rem; }
        .kb-close { background: none; border: none; color: white; cursor: pointer; font-size: 1.2rem; }

        .kb-messages {
            flex: 1;
            padding: 20px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 15px;
            background: #0f0f0f;
        }

        .kb-message {
            max-width: 85%;
            padding: 10px 15px;
            border-radius: 12px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .kb-message.user {
            align-self: flex-end;
            background: #000000ff;
            color: white;
        }
        .kb-message.ai {
            align-self: flex-start;
            background: #2a2a2a;
            color: #ddd;
            border: 1px solid #444;
        }

        .kb-input-area {
            padding: 15px;
            border-top: 1px solid #333;
            background: #1a1a1a;
            display: flex;
            gap: 10px;
        }
        .kb-input {
            flex: 1;
            padding: 10px;
            border-radius: 20px;
            border: 1px solid #444;
            background: #2a2a2a;
            color: white;
            outline: none;
        }
        .kb-send {
            background: #667eea;
            border: none;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
        }
    `;
    document.head.appendChild(style);

    // Injetar HTML
    const launcher = document.createElement('div');
    launcher.className = 'kb-widget-launcher';
    launcher.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`;

    const container = document.createElement('div');
    container.className = 'kb-widget-container';
    container.innerHTML = `
        <div class="kb-header">
            <h3>Skynet Suporte IA</h3>
            <button class="kb-close">&times;</button>
        </div>
        <div class="kb-messages" id="kbMessages">
            <div class="kb-message ai">Olá! Como posso ajudar você hoje?</div>
        </div>
        <div class="kb-input-area">
            <input type="text" class="kb-input" placeholder="Digite sua pergunta..." id="kbInput">
            <button class="kb-send" id="kbSend">➤</button>
        </div>
    `;

    document.body.appendChild(launcher);
    document.body.appendChild(container);

    // Lógica
    const messagesDiv = document.getElementById('kbMessages');
    const input = document.getElementById('kbInput');
    const sendBtn = document.getElementById('kbSend');

    launcher.onclick = () => container.classList.add('active');
    container.querySelector('.kb-close').onclick = () => container.classList.remove('active');

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // User Message
        addMessage(text, 'user');
        input.value = '';

        // Loaging
        const loadingId = addMessage('Digitando...', 'ai');

        try {
            const response = await fetch(`${KB_API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question: text })
            });

            const data = await response.json();

            // Remove loading
            document.getElementById(loadingId).remove();

            if (data.answer) {
                addMessage(data.answer, 'ai');
            } else {
                addMessage('Desculpe, tive um erro ao processar sua pergunta.', 'ai');
            }

        } catch (error) {
            document.getElementById(loadingId).remove();
            addMessage('Erro de conexão com o servidor.', 'ai');
        }
    }

    function addMessage(text, type) {
        const div = document.createElement('div');
        div.className = `kb-message ${type}`;
        div.id = 'msg-' + Date.now();
        // Converter quebras de linha simples
        div.innerHTML = text.replace(/\n/g, '<br>');
        messagesDiv.appendChild(div);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return div.id;
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); }

})();
