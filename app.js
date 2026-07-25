document.addEventListener('DOMContentLoaded', () => {
    // --- Mobile Menu Toggle ---
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('mobile-active');
            mobileMenuBtn.classList.toggle('mobile-active-toggle');
        });
    }

    // --- Header Scroll Effect ---
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // --- Scroll Reveal Animation ---
    const revealElements = document.querySelectorAll('.scroll-reveal');
    const revealOnScroll = () => {
        revealElements.forEach(el => {
            const rect = el.getBoundingClientRect();
            const viewHeight = window.innerHeight;
            if (rect.top <= viewHeight * 0.85) {
                el.classList.add('revealed');
            }
        });
    };
    window.addEventListener('scroll', revealOnScroll);
    revealOnScroll(); // Trigger initial check

    // --- Tab Switching Logic (Workspace) ---
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    const screenTitle = document.getElementById('screen-title');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            // Remove active states
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // Add active states to selected
            button.classList.add('active');
            const targetContent = document.getElementById(`tab-${targetTab}`);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            // Update header title
            if (screenTitle) {
                screenTitle.textContent = `workspace://${targetTab.replace('-', '_')}`;
            }

            // Trigger Canvas resize if switching to matrix tab
            if (targetTab === 'matrix-sim') {
                resizeCanvas();
            }
        });
    });

    // --- System Health Gauge Mock Updates ---
    const cpuGauge = document.getElementById('cpu-gauge');
    const memGauge = document.getElementById('mem-gauge');
    const cpuPctText = document.getElementById('cpu-percentage');
    const memPctText = document.getElementById('mem-percentage');

    let hasWarnedHighCPU = false;

    const updateGauges = () => {
        if (cpuGauge && memGauge) {
            fetch('/api/telemetry')
                .then(res => res.json())
                .then(data => {
                    cpuGauge.setAttribute('stroke-dasharray', `${data.cpu}, 100`);
                    memGauge.setAttribute('stroke-dasharray', `${data.memory}, 100`);
                    cpuPctText.textContent = `${data.cpu}%`;
                    memPctText.textContent = `${data.memory}%`;

                    // Telemetry Throttling Trigger
                    if (data.cpu > 80) {
                        isMatrixPaused = true;
                        if (!hasWarnedHighCPU) {
                            alertLog("High server load detected. Passively throttling matrix canvas renders.");
                            hasWarnedHighCPU = true;
                        }
                    } else {
                        isMatrixPaused = false;
                        hasWarnedHighCPU = false;
                    }
                })
                .catch(err => {
                    // Fallback to random flux if backend is offline
                    const cpuVal = Math.floor(40 + Math.random() * 15);
                    const memVal = Math.floor(70 + Math.random() * 8);
                    cpuGauge.setAttribute('stroke-dasharray', `${cpuVal}, 100`);
                    memGauge.setAttribute('stroke-dasharray', `${memVal}, 100`);
                    cpuPctText.textContent = `${cpuVal}%`;
                    memPctText.textContent = `${memVal}%`;
                    isMatrixPaused = false;
                });
        }
    };
    setInterval(updateGauges, 2500);

    // --- Matrix Animation Effect ---
    const canvas = document.getElementById('matrix-canvas');
    let ctx = null;
    let matrixInterval = null;
    let columns = [];
    let isMatrixPaused = false;
    let matrixColor = '#00f0ff'; // Default Neon Cyan
    const matrixChars = "01▲✦❂⚡▼XYZ◇◆○●□■⚇⚟".split("");
    const fontSize = 14;

    if (canvas) {
        ctx = canvas.getContext('2d');
        
        const initMatrix = () => {
            columns = [];
            const colCount = Math.floor(canvas.width / fontSize) + 1;
            for (let i = 0; i < colCount; i++) {
                columns[i] = Math.random() * -100;
            }
        };

        const drawMatrix = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = matrixColor;
            ctx.font = `${fontSize}px var(--font-title)`;

            for (let i = 0; i < columns.length; i++) {
                const char = matrixChars[Math.floor(Math.random() * matrixChars.length)];
                const x = i * fontSize;
                const y = columns[i] * fontSize;

                ctx.fillText(char, x, y);

                // Reset drop to top if it reaches canvas bottom
                if (y > canvas.height && Math.random() > 0.985) {
                    columns[i] = 0;
                }
                columns[i]++;
            }
        };

        const resizeCanvas = () => {
            const rect = canvas.parentElement.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height || 300;
            initMatrix();
        };

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const startMatrixStream = () => {
            if (matrixInterval) clearInterval(matrixInterval);
            matrixInterval = setInterval(() => {
                if (!isMatrixPaused) drawMatrix();
            }, 45);
        };
        startMatrixStream();

        // Control handlers
        const freezeBtn = document.getElementById('matrix-freeze-btn');
        const colorBtn = document.getElementById('matrix-color-btn');

        if (freezeBtn) {
            freezeBtn.addEventListener('click', () => {
                isMatrixPaused = !isMatrixPaused;
                freezeBtn.textContent = isMatrixPaused ? 'Resume Stream' : 'Pause Stream';
                freezeBtn.classList.toggle('btn-glow');
            });
        }

        if (colorBtn) {
            colorBtn.addEventListener('click', () => {
                // cycle color: cyan -> purple -> green -> cyan
                if (matrixColor === '#00f0ff') {
                    matrixColor = '#bd00ff'; // Purple
                } else if (matrixColor === '#bd00ff') {
                    matrixColor = '#39ff14'; // Green
                } else {
                    matrixColor = '#00f0ff';
                }
            });
        }
    }

    // --- Interactive Telemetry Pulse Button ---
    const pingBtn = document.getElementById('ping-nodes-btn');
    const ringOuter = document.querySelector('.ring-outer');
    const ringMid = document.querySelector('.ring-mid');

    if (pingBtn) {
        pingBtn.addEventListener('click', () => {
            // Temporarily amplify rotational speed and opacity
            if (ringOuter && ringMid) {
                ringOuter.style.animationDuration = '4s';
                ringMid.style.animationDuration = '2s';
                ringOuter.style.borderColor = 'var(--accent-cyan)';
                ringMid.style.borderColor = 'var(--accent-pink)';

                setTimeout(() => {
                    ringOuter.style.animationDuration = '20s';
                    ringMid.style.animationDuration = '12s';
                    ringOuter.style.borderColor = '';
                    ringMid.style.borderColor = '';
                }, 4000);
            }
            alertLog('System diagnostic pulse dispatched. Neural latency optimized.');
        });
    }

    function alertLog(msg) {
        // Output custom message directly in the interactive command terminal as system event
        appendTerminalOutput(`[SYSTEM EVENT] ${msg}`, 'success-line');
    }

    // --- Interactive Developer Terminal CLI ---
    const terminalInput = document.getElementById('terminal-input');
    const terminalOutput = document.getElementById('terminal-output');
    const terminalBody = document.getElementById('terminal-body');

    if (terminalInput && terminalOutput) {
        // Keep focus inside console on wrapper click
        document.querySelector('.terminal-container').addEventListener('click', () => {
            terminalInput.focus();
        });

        terminalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const commandText = terminalInput.value.trim();
                terminalInput.value = '';

                if (commandText) {
                    appendTerminalOutput(`guest@antigravity ~ % ${commandText}`, 'cmd-highlight');
                    processCommand(commandText);
                }
            }
        });
    }

    function appendTerminalOutput(text, className = '') {
        const line = document.createElement('p');
        line.className = `terminal-line ${className}`;
        line.innerHTML = text;
        terminalOutput.appendChild(line);

        // Auto Scroll to bottom
        terminalBody.scrollTop = terminalBody.scrollHeight;
    }

    function processCommand(rawCmd) {
        const parts = rawCmd.toLowerCase().split(' ');
        const cmd = parts[0];
        const arg = parts.slice(1).join(' ');

        switch (cmd) {
            case 'help':
                appendTerminalOutput('Available systems diagnostics commands:');
                appendTerminalOutput('  <span class="cmd-highlight">sysinfo</span>      - Render current kernel parameters.');
                appendTerminalOutput('  <span class="cmd-highlight">gravity</span>      - Toggle workspace micro-gravity physics simulation.');
                appendTerminalOutput('  <span class="cmd-highlight">matrix</span>       - Auto-route workspace view to the Sandbox simulator.');
                appendTerminalOutput('  <span class="cmd-highlight">neon</span>         - Inject localized custom neon pulses.');
                appendTerminalOutput('  <span class="cmd-highlight">clear</span>        - Clear shell console screen.');
                break;
            case 'clear':
                terminalOutput.innerHTML = '';
                break;
            case 'sysinfo':
                const memoryStr = '8192 YottaBytes Quantum Memory';
                const timeStr = new Date().toLocaleString();
                appendTerminalOutput(`System Core: Antigravity-v2.0-Alpha`);
                appendTerminalOutput(`Host Kernel: WebBrowser Core OS`);
                appendTerminalOutput(`Platform Integration: Neural Bridge v1.2`);
                appendTerminalOutput(`Memory Alloc: ${memoryStr}`);
                appendTerminalOutput(`System Epoch: ${timeStr}`);
                break;
            case 'gravity':
                const body = document.body;
                const isZeroG = body.classList.toggle('zero-gravity');
                const gravityVal = document.getElementById('gravity-val');

                if (isZeroG) {
                    appendTerminalOutput('[WARN] Gravity engines disengaged. Micro-gravity simulation enabled.', 'error-line');
                    if (gravityVal) {
                        gravityVal.textContent = '-0.08G';
                        gravityVal.classList.add('cyan-text');
                    }
                } else {
                    appendTerminalOutput('[OK] Gravitational core parameters restored to default.', 'success-line');
                    if (gravityVal) {
                        gravityVal.textContent = '0.00G';
                        gravityVal.classList.remove('cyan-text');
                    }
                }
                break;
            case 'matrix':
                appendTerminalOutput('Navigating to workspace core sandbox...', 'success-line');
                const matrixTab = document.querySelector('.tab-btn[data-tab="matrix-sim"]');
                if (matrixTab) matrixTab.click();
                break;
            case 'neon':
                appendTerminalOutput('Pulse theme overrides triggered.');
                const mainGlow = document.querySelector('.glow-primary');
                if (mainGlow) {
                    mainGlow.style.background = 'radial-gradient(circle, var(--accent-pink), transparent)';
                    setTimeout(() => {
                        mainGlow.style.background = 'radial-gradient(circle, var(--accent-cyan), transparent)';
                    }, 5000);
                }
                break;
            default:
                appendTerminalOutput(`Shell command not recognized: "${cmd}". Type <span class="cmd-highlight">help</span> for assistance.`, 'error-line');
        }
    }

    // --- Access Form Handling ---
    const accessForm = document.getElementById('access-form');
    const formFeedback = document.getElementById('form-feedback');
    const submitBtn = document.getElementById('submit-btn');

    if (accessForm) {
        accessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('user-email');
            const email = emailInput.value.trim();

            if (!email) return;

            // Visual loading state
            submitBtn.textContent = 'Decrypting...';
            submitBtn.disabled = true;
            formFeedback.style.color = 'var(--text-muted)';
            formFeedback.textContent = 'Generating custom spatial cryptography access tokens...';

            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            })
            .then(res => res.json())
            .then(data => {
                submitBtn.textContent = 'Request Keys';
                submitBtn.disabled = false;
                emailInput.value = '';

                if (data.success) {
                    formFeedback.style.color = '#39ff14';
                    formFeedback.innerHTML = `Success! Database Record ${data.updated ? 'Updated' : 'Created'}.<br>Secret ID: <span class="text-glow">${data.key}</span> stored for ${data.email}.`;
                    alertLog(`Spatial core client registry expanded: ${email}`);
                } else {
                    formFeedback.style.color = 'var(--accent-pink)';
                    formFeedback.textContent = `Error: ${data.error}`;
                }
            })
            .catch(err => {
                submitBtn.textContent = 'Request Keys';
                submitBtn.disabled = false;
                emailInput.value = '';
                // Fallback to local offline generation if backend is unavailable
                formFeedback.style.color = '#39ff14';
                formFeedback.innerHTML = `Success! Credentials generated offline.<br>Secret ID: <span class="text-glow">${generateMockKey()}</span> sent to ${email}.`;
                alertLog(`Spatial core client registry expanded offline: ${email}`);
            });
        });
    }

    function generateMockKey() {
        const hex = '0123456789ABCDEF';
        let key = 'AG-';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) key += '-';
            key += hex[Math.floor(Math.random() * 16)];
        }
        return key;
    }

    // --- 9. Scroll Focus Context Trigger ---
    const terminalContainer = document.getElementById('terminal');
    if (terminalContainer && terminalInput) {
        const scrollObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    terminalInput.focus();
                    appendTerminalOutput("[PASSIVE CONTEXT] Terminal in view. Keyboard input focused.", "system-line");
                }
            });
        }, { threshold: 0.6 });
        scrollObserver.observe(terminalContainer);
    }

    // --- 10. Behavioral Inactivity Dimmer ---
    let idleTimer = null;
    const idleDuration = 45000; // 45 seconds

    function triggerIdleState() {
        document.body.style.transition = 'filter 2s ease, opacity 2s ease';
        document.body.style.filter = 'contrast(0.7) brightness(0.6)';
        
        // Show dimming eco-mode HUD overlay badge if it doesn't exist
        if (!document.getElementById('eco-mode-badge')) {
            const badge = document.createElement('div');
            badge.id = 'eco-mode-badge';
            badge.style.position = 'fixed';
            badge.style.bottom = '20px';
            badge.style.right = '20px';
            badge.style.background = 'rgba(255, 0, 122, 0.2)';
            badge.style.border = '1px solid var(--accent-pink)';
            badge.style.color = 'var(--accent-pink)';
            badge.style.padding = '8px 16px';
            badge.style.borderRadius = '4px';
            badge.style.fontFamily = 'monospace';
            badge.style.fontSize = '0.75rem';
            badge.style.zIndex = '9999';
            badge.style.pointerEvents = 'none';
            badge.textContent = '[HOLOGRAPHIC ECO-MODE ACTIVE]';
            document.body.appendChild(badge);
        }
    }

    function resetIdleTimer() {
        if (idleTimer) clearTimeout(idleTimer);
        document.body.style.filter = '';
        const badge = document.getElementById('eco-mode-badge');
        if (badge) badge.remove();
        
        idleTimer = setTimeout(triggerIdleState, idleDuration);
    }

    ['mousemove', 'click', 'scroll', 'keydown', 'touchstart'].forEach(eventName => {
        window.addEventListener(eventName, resetIdleTimer);
    });
    resetIdleTimer();
});
