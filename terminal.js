// terminal.js
(function() {
  // Wait for AUTH to be loaded
  const checkAuth = setInterval(function() {
    if (window.AUTH) {
      clearInterval(checkAuth);
      init();
    }
  }, 10);

  function init() {
    const CORRECT_PASSWORD = window.AUTH.getPassword();
    const REDIRECT_URL = window.AUTH.getRedirectUrl();

    // Matrix rain setup
    const canvas = document.getElementById('matrixCanvas');
    const ctx = canvas.getContext('2d');
    const terminalEl = document.getElementById('terminalWindow');

    let width, height;
    let columns, drops = [];
    const fontSize = 18;

    function resizeCanvas() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      columns = Math.floor(width / fontSize);
      drops = new Array(columns).fill(1);
    }

    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲンABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    
    function drawMatrix() {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#7ab7ef';
      ctx.font = fontSize + 'px monospace';

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (drops[i] * fontSize > height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i]++;
      }
    }

    let matrixInterval;
    function startMatrix() {
      resizeCanvas();
      matrixInterval = setInterval(drawMatrix, 45);

      setTimeout(() => {
        clearInterval(matrixInterval);
        canvas.classList.add('fade-out');

        setTimeout(() => {
          canvas.style.display = 'none';
          terminalEl.classList.add('visible');
          initTerminal();
        }, 1200);
      }, 5000);
    }

    function initTerminal() {
      terminalEl.innerHTML = '';

      const bootLines = [
        { type: 'output', text: '© nexus kernel 7.1.2-tty · secure boot', className: 'dim' },
        { type: 'output', text: '> cpu: virtual · mem: 512M · entropy: ready', className: '' },
        { type: 'output', text: '> network: wireguard · tunnel established', className: '' },
        { type: 'output', text: '> crypto: hardware seed · avalanche mix done', className: '' },
        { type: 'output', text: '> firewall: strict · inbound filtered', className: '' },
        { type: 'output', text: '> time: synced · offset < 1ms', className: '' },
        { type: 'output', text: ' ', className: '' },
        { type: 'output', text: '┌─────────────────────────────────────────┐', className: 'accent-blue' },
        { type: 'output', text: '│         TERMINAL GATEWAY · SKY v2        │', className: 'accent-blue' },
        { type: 'output', text: '└─────────────────────────────────────────┘', className: 'accent-blue' },
        { type: 'output', text: ' ', className: '' },
        { type: 'output', text: 'session: ephemeral · encryption: sky-xchacha', className: 'dim' },
        { type: 'output', text: ' ', className: '' },
      ];

      bootLines.forEach(line => {
        const div = document.createElement('div');
        div.className = 'line';
        div.innerHTML = `<span class="prompt">>>></span><span class="output ${line.className || ''}">${line.text}</span>`;
        terminalEl.appendChild(div);
      });

      const cursorLine = document.createElement('div');
      cursorLine.className = 'line';
      cursorLine.id = 'cursorLine';
      cursorLine.innerHTML = `<span class="prompt">>>></span><span class="output">_<span class="blink"></span></span>`;
      terminalEl.appendChild(cursorLine);

      setTimeout(() => {
        document.getElementById('cursorLine')?.remove();

        const inputRow = document.createElement('div');
        inputRow.className = 'input-area';
        inputRow.id = 'interactiveRow';
        inputRow.innerHTML = `
          <span class="input-prompt">🔒 password:</span>
          <input type="password" id="password-field" placeholder="········" autofocus />
          <button id="hidden-submit" style="display:none"></button>
        `;
        terminalEl.appendChild(inputRow);

        const pwdInput = document.getElementById('password-field');
        pwdInput.focus();

        function attemptLogin() {
          const entered = pwdInput.value;
          if (entered === CORRECT_PASSWORD) {
            const successLine = document.createElement('div');
            successLine.className = 'line';
            successLine.innerHTML = `<span class="prompt">>>></span><span class="output accent-blue">✓ access granted · redirecting to vault...</span>`;
            terminalEl.insertBefore(successLine, document.getElementById('interactiveRow'));

            pwdInput.disabled = true;
            pwdInput.style.opacity = '0.6';

            setTimeout(() => {
              window.location.href = REDIRECT_URL;
            }, 800);
          } else {
            const errorLine = document.createElement('div');
            errorLine.className = 'line';
            errorLine.id = 'tempError';
            errorLine.innerHTML = `<span class="prompt">>>></span><span class="output" style="color:#f08ca0;">✗ invalid · try again</span>`;

            const oldError = document.getElementById('tempError');
            if (oldError) oldError.remove();

            terminalEl.insertBefore(errorLine, document.getElementById('interactiveRow'));

            pwdInput.value = '';
            pwdInput.focus();
          }
        }

        pwdInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attemptLogin();
          }
        });
      }, 700);
    }

    window.addEventListener('resize', () => {
      if (canvas.style.display !== 'none') {
        resizeCanvas();
      }
    });

    startMatrix();
  }
})();
