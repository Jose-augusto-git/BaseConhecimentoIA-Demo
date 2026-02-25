function handleLogin(event) {
    event.preventDefault();

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorDiv = document.getElementById('errorMessage');
    const btn = document.querySelector('.btn-login');

    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();

    // Reset erro
    errorDiv.textContent = '';
    errorDiv.style.opacity = '0';

    // Loading state
    btn.textContent = 'Autenticando...';
    btn.disabled = true;

    fetch('/api/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
    })
        .then(response => {
            if (response.ok) {
                return response.json();
            }
            throw new Error('Usuário ou senha inválidos');
        })
        .then(data => {
            // Sucesso
            btn.textContent = 'Acesso Liberado';
            btn.style.background = '#10b981';

            // Efeito Matrix nos inputs antes de redirecionar
            const inputs = [usernameInput, passwordInput];

            inputs.forEach(input => {
                input.classList.add('matrix-input'); // Muda fonte e cor
                const originalValue = input.value;
                const isPassword = input.id === 'password';

                // Se for password, mostra caracteres aleatórios em vez de bolinhas
                if (isPassword) input.type = 'text';

                const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@%&*";
                // Meta final: Para senha, mostramos asteriscos ou uma hash falsa. Para usuário, o nome real.
                const finalValue = isPassword ? '*'.repeat(originalValue.length) : originalValue;

                let iterations = 0;

                const interval = setInterval(() => {
                    input.value = finalValue
                        .split("")
                        .map((char, index) => {
                            if (index < iterations) {
                                return finalValue[index];
                            }
                            return letters[Math.floor(Math.random() * letters.length)];
                        })
                        .join("");

                    if (iterations >= finalValue.length) {
                        clearInterval(interval);
                        input.value = finalValue;
                    }

                    iterations += 1 / 3;
                }, 30);
            });

            // Salvar token/sessão se necessário (simulado aqui)
            localStorage.setItem('auth_token', 'logged_in');

            // Redirecionar (Tempo maior para ver o efeito)
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        })
        .catch(error => {
            errorDiv.textContent = error.message;
            errorDiv.style.opacity = '1';

            // Shake animation
            const box = document.querySelector('.login-box');
            box.style.animation = 'shake 0.5s ease';
            setTimeout(() => box.style.animation = '', 500);

            btn.textContent = 'Entrar';
            btn.disabled = false;
            btn.style.background = ''; // reset
        });
}
