document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    const activeTokens = {
        action: '',
        subject: '',
        modifier: '',
        target: ''
    };
    
    let activeEngine = 'Aethera LLM v4';
    let activeTemp = '0.7';
    let userSpeechInput = '';
    let isPipelineRunning = false;

    // --- DOM Elements ---
    const tokenButtons = document.querySelectorAll('.token-btn');
    const promptDisplay = document.getElementById('prompt-output-display');
    const runBtn = document.getElementById('run-pipeline-btn');
    const resetBtn = document.getElementById('clear-prompt-btn');
    const outputDisplay = document.getElementById('model-output-display');
    
    // Metrics
    const speedMetric = document.getElementById('metric-speed');
    const latencyMetric = document.getElementById('metric-latency');
    const energyMetric = document.getElementById('metric-energy');

    // Engine & Parameter selectors
    const engineCards = document.querySelectorAll('.engine-card');
    const tempButtons = document.querySelectorAll('#selector-temp .capsule-btn');

    // Pipeline nodes
    const pipelineCanvas = document.getElementById('pipeline-canvas-container');
    const nodeSpeech = document.getElementById('node-input-speech');
    const nodeModel = document.getElementById('node-core-model');
    const nodeSpeaker = document.getElementById('node-output-speaker');

    // Speech synthesis & dictation
    const micBtn = document.getElementById('mic-toggle-btn');
    const voiceStatus = document.getElementById('voice-status');
    const ttsSpeakBtn = document.getElementById('tts-speak-btn');
    const ttsStopBtn = document.getElementById('tts-stop-btn');

    let recognition = null;
    let isListening = false;
    let voiceWaveInterval = null;

    // --- 1. Token Selection Matrix Handling ---
    tokenButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (isPipelineRunning) return;

            const tokenType = button.getAttribute('data-type');
            const tokenValue = button.getAttribute('data-value');

            // If already selected, deselect it
            if (activeTokens[tokenType] === tokenValue) {
                activeTokens[tokenType] = '';
                button.classList.remove('selected');
            } else {
                // Remove selected class from sibling tokens in the same group
                document.querySelectorAll(`.token-btn[data-type="${tokenType}"]`).forEach(btn => {
                    btn.classList.remove('selected');
                });
                // Select this token
                activeTokens[tokenType] = tokenValue;
                button.classList.add('selected');
            }

            // Clear user speech if they start clicking buttons instead
            userSpeechInput = '';

            updatePromptText();
        });
    });

    function updatePromptText() {
        if (userSpeechInput) {
            promptDisplay.textContent = `[Voice Prompt]: "${userSpeechInput}"`;
            return;
        }

        const parts = [];
        if (activeTokens.action) parts.push(activeTokens.action);
        if (activeTokens.subject) parts.push(activeTokens.subject);
        if (activeTokens.modifier) parts.push(activeTokens.modifier);
        if (activeTokens.target) parts.push(activeTokens.target);

        if (parts.length > 0) {
            promptDisplay.textContent = parts.join(' ') + '.';
        } else {
            promptDisplay.textContent = 'Click tokens above or speak to begin...';
        }
    }

    // --- 2. Engine and Parameter Configurations ---
    engineCards.forEach(card => {
        card.addEventListener('click', () => {
            if (isPipelineRunning) return;
            engineCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            activeEngine = card.getAttribute('data-engine');
            
            // Switch model label in pipeline node
            const engineLabel = nodeModel.querySelector('.node-label');
            if (engineLabel) {
                engineLabel.textContent = card.querySelector('.engine-name').textContent;
            }
        });
    });

    tempButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            if (isPipelineRunning) return;
            tempButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTemp = btn.getAttribute('data-value');
        });
    });

    // --- 2.5 Safety Mode Toggle Listener ---
    const safetyCheckbox = document.getElementById('safety-mode-checkbox');
    const safetyStatus = document.getElementById('safety-status-text');
    if (safetyCheckbox && safetyStatus) {
        safetyCheckbox.addEventListener('change', () => {
            if (safetyCheckbox.checked) {
                safetyStatus.textContent = 'DET-SAFETY';
                safetyStatus.classList.add('active');
                alertLog('Deterministic Safety Mode activated. All probabilistic AI generation bypassed.');
            } else {
                safetyStatus.textContent = 'OFFLINE MOCKS';
                safetyStatus.classList.remove('active');
                alertLog('Safety Mode disengaged. Standard backup rules loaded.');
            }
        });
    }

    // --- 3. Web Speech API (Dictation Input) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        let silenceTimer = null;

        recognition.onstart = () => {
            isListening = true;
            micBtn.classList.add('active');
            voiceStatus.textContent = 'Listening... Speak clearly into microphone';
            nodeSpeech.classList.add('running');
            startVoiceWaveAnimation();

            // Passive silence timeout: stops if no vocal data received for 5 seconds
            silenceTimer = setTimeout(() => {
                if (isListening && !userSpeechInput) {
                    recognition.stop();
                    voiceStatus.textContent = 'Passively stopped recording due to silence.';
                    alertLog('Voice recording auto-stopped due to inactive speech.');
                }
            }, 5000);
        };

        recognition.onend = () => {
            if (silenceTimer) clearTimeout(silenceTimer);
            isListening = false;
            micBtn.classList.remove('active');
            nodeSpeech.classList.remove('running');
            stopVoiceWaveAnimation();
            if (!userSpeechInput && voiceStatus.textContent.includes('Listening')) {
                voiceStatus.textContent = 'No voice detected. Tap mic to try again.';
            }
        };

        recognition.onerror = (event) => {
            if (silenceTimer) clearTimeout(silenceTimer);
            console.error('Speech error:', event.error);
            voiceStatus.textContent = `Error: ${event.error}. Click mic to retry.`;
            isListening = false;
            micBtn.classList.remove('active');
            nodeSpeech.classList.remove('running');
            stopVoiceWaveAnimation();
        };

        recognition.onresult = (event) => {
            if (silenceTimer) clearTimeout(silenceTimer);
            const resultText = event.results[0][0].transcript;
            userSpeechInput = resultText;
            
            // Clear selections
            clearSelectedTokens();
            
            updatePromptText();
            voiceStatus.textContent = 'Voice captured successfully!';
            
            // Distress Word Detection
            const triggerWords = ['help', 'emergency', 'pain', 'fell', 'hurt'];
            const lower = resultText.toLowerCase();
            const matchesDistress = triggerWords.some(word => lower.includes(word));
            if (matchesDistress) {
                triggerCaregiverPanicDispatch(`Vocal distress detected: "${resultText}"`);
            }

            console.log('Voice prompt:', resultText);
        };
    } else {
        voiceStatus.textContent = 'Speech interface unsupported in this browser.';
        micBtn.style.opacity = '0.5';
        micBtn.style.cursor = 'not-allowed';
    }

    // --- 3.5 Panic Trigger Button & Voice Dispatcher ---
    const panicBtn = document.getElementById('panic-trigger-btn');
    if (panicBtn) {
        panicBtn.addEventListener('click', () => {
            triggerCaregiverPanicDispatch('Manual Panic Button pressed.');
        });
    }

    function triggerCaregiverPanicDispatch(reason) {
        alertLog(`[EMERGENCY TRIGGER] ${reason}`);
        
        const layout = document.querySelector('.workspace-layout');
        if (layout) {
            layout.classList.add('emergency-alarm-active');
        }
        
        voiceStatus.textContent = 'ROUTING CAREGIVER IN REAL-TIME...';
        
        // Mock Patient Location (San Francisco Center)
        fetch('/api/dispatch-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                patientLat: 37.7749,
                patientLon: -122.4194
            })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                const cg = data.caregiver;
                const statusMsg = `CRITICAL ASSIST ROUTED: ${cg.name} (${cg.specialty}) dispatched to coordinates. Transit: ${data.transitTime} mins. Distance: ${data.distance.toFixed(2)} mi.`;
                alertLog(statusMsg);
                voiceStatus.textContent = `Dispatched: ${cg.name}`;
                
                // Read assurance passively to patient via TTS
                const speakMsg = `Emergency alert received. Caregiver ${cg.name}, a ${cg.specialty}, is routing to your location. Distance is ${data.distance.toFixed(1)} miles. Expected arrival in ${data.transitTime} minutes. Please stay calm.`;
                
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(speakMsg);
                    utterance.rate = 0.9;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                }
            } else {
                alertLog(`[DISPATCH FAIL] ${data.error || 'Unknown error'}`);
                voiceStatus.textContent = 'Caregivers unavailable.';
            }
        })
        .catch(err => {
            console.error('Panic routing request failed:', err);
            alertLog('[DISPATCH ERROR] Failed to connect to server routing system.');
        });
    }

    micBtn.addEventListener('click', () => {
        if (!SpeechRecognition || isPipelineRunning) return;

        if (isListening) {
            recognition.stop();
        } else {
            userSpeechInput = '';
            recognition.start();
        }
    });

    function clearSelectedTokens() {
        for (let key in activeTokens) {
            activeTokens[key] = '';
        }
        tokenButtons.forEach(btn => btn.classList.remove('selected'));
    }

    // Voice Waveform Simulation on Canvas
    const waveCanvas = document.getElementById('voice-wave-canvas');
    let waveCtx = null;
    if (waveCanvas) {
        waveCtx = waveCanvas.getContext('2d');
        const resizeWaveCanvas = () => {
            waveCanvas.width = waveCanvas.parentElement.clientWidth;
            waveCanvas.height = waveCanvas.parentElement.clientHeight || 70;
            drawStaticBaseline();
        };
        window.addEventListener('resize', resizeWaveCanvas);
        resizeWaveCanvas();
    }

    function drawStaticBaseline() {
        if (!waveCtx) return;
        waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
        waveCtx.strokeStyle = 'rgba(255, 158, 0, 0.2)';
        waveCtx.lineWidth = 2;
        waveCtx.beginPath();
        waveCtx.moveTo(0, waveCanvas.height / 2);
        waveCtx.lineTo(waveCanvas.width, waveCanvas.height / 2);
        waveCtx.stroke();
    }

    function startVoiceWaveAnimation() {
        if (!waveCtx) return;
        let offset = 0;
        
        if (voiceWaveInterval) clearInterval(voiceWaveInterval);
        
        voiceWaveInterval = setInterval(() => {
            waveCtx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
            
            // Draw baseline
            waveCtx.strokeStyle = 'rgba(255, 158, 0, 0.15)';
            waveCtx.lineWidth = 1;
            waveCtx.beginPath();
            waveCtx.moveTo(0, waveCanvas.height / 2);
            waveCtx.lineTo(waveCanvas.width, waveCanvas.height / 2);
            waveCtx.stroke();

            // Draw primary moving sine wave
            waveCtx.strokeStyle = 'var(--accent-amber)';
            waveCtx.lineWidth = 2;
            waveCtx.beginPath();
            for (let x = 0; x < waveCanvas.width; x++) {
                // Add some random scaling factor representing vocal amplitude
                const noise = 8 + Math.sin(offset * 0.05) * 6; 
                const y = waveCanvas.height / 2 + Math.sin(x * 0.04 + offset) * noise * Math.sin(x * Math.PI / waveCanvas.width);
                if (x === 0) waveCtx.moveTo(x, y);
                else waveCtx.lineTo(x, y);
            }
            waveCtx.stroke();

            // Draw secondary wave
            waveCtx.strokeStyle = 'rgba(0, 255, 133, 0.4)';
            waveCtx.lineWidth = 1.5;
            waveCtx.beginPath();
            for (let x = 0; x < waveCanvas.width; x++) {
                const noise = 4 + Math.cos(offset * 0.03) * 3;
                const y = waveCanvas.height / 2 + Math.sin(x * 0.06 - offset) * noise * Math.sin(x * Math.PI / waveCanvas.width);
                if (x === 0) waveCtx.moveTo(x, y);
                else waveCtx.lineTo(x, y);
            }
            waveCtx.stroke();

            offset += 0.15;
        }, 30);
    }

    function stopVoiceWaveAnimation() {
        if (voiceWaveInterval) {
            clearInterval(voiceWaveInterval);
            voiceWaveInterval = null;
        }
        drawStaticBaseline();
    }

    // --- 4. Pipeline Execution Simulator ---
    runBtn.addEventListener('click', () => {
        const prompt = promptDisplay.textContent;
        if (isPipelineRunning || prompt.includes('Click tokens') || prompt.includes('Reset Workspace')) {
            return;
        }

        isPipelineRunning = true;
        runBtn.disabled = true;
        outputDisplay.textContent = 'Allocating neurons...';
        
        // Start streaming animations in pipeline
        pipelineCanvas.classList.add('streaming');
        
        // Animate pipeline nodes sequentially
        animatePipelineExecution(prompt);
    });

    function animatePipelineExecution(prompt) {
        // Node 1: Input active
        nodeSpeech.classList.add('running');
        nodeSpeech.querySelector('.node-status').textContent = 'ROUTING DATA';

        // Start backend fetch in parallel
        const startTime = Date.now();
        const fetchPromise = fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                engine: activeEngine,
                temp: activeTemp,
                safetyMode: safetyCheckbox ? safetyCheckbox.checked : false
            })
        })
        .then(res => res.json())
        .then(data => data.response)
        .catch(err => {
            console.warn('Backend offline, calling fallback local engine.');
            return getModelOutputResponse(prompt);
        });

        // Stage 1: Reading input
        setTimeout(() => {
            nodeSpeech.classList.remove('running');
            nodeSpeech.querySelector('.node-status').textContent = 'TRANSFERRED';

            // Node 2: Core processing
            nodeModel.classList.add('running');
            nodeModel.querySelector('.node-status').textContent = 'INFERENCING';
            outputDisplay.textContent = 'Synthesizing response weights...';

            // Wait for both the minimum transition timer (1.8s) and the API fetch
            Promise.all([
                fetchPromise,
                new Promise(resolve => setTimeout(resolve, 1800))
            ])
            .then(([responseText]) => {
                nodeModel.classList.remove('running');
                nodeModel.querySelector('.node-status').textContent = 'COMPLETE';

                // Node 3: Audio reader outputting
                nodeSpeaker.classList.add('running');
                nodeSpeaker.querySelector('.node-status').textContent = 'SYNTHESIZING';

                // Typing text print speed simulation
                typeWriteResponse(responseText, Date.now() - startTime);
            });

        }, 1000);
    }

    function typeWriteResponse(text, elapsedMs = 0) {
        outputDisplay.textContent = '';
        let index = 0;
        
        // Metrics calculations
        const latency = elapsedMs || Math.floor(600 + Math.random() * 400);
        const speed = Math.floor(40 + Math.random() * 15);
        const energy = (latency * 0.003).toFixed(3);

        latencyMetric.textContent = `${latency} ms`;
        speedMetric.textContent = `${speed} tokens/sec`;
        energyMetric.textContent = `${energy} J`;

        const typeInterval = setInterval(() => {
            if (index < text.length) {
                // If it's a code block formatting backtick, display it instantly to avoid syntax visual clutter
                if (text[index] === '`') {
                    outputDisplay.textContent += text.substr(index, 3);
                    index += 3;
                } else {
                    outputDisplay.textContent += text[index];
                    index++;
                }
                outputDisplay.scrollTop = outputDisplay.scrollHeight;
            } else {
                clearInterval(typeInterval);
                finishExecution();
            }
        }, 12);
    }

    function finishExecution() {
        isPipelineRunning = false;
        runBtn.disabled = false;
        pipelineCanvas.classList.remove('streaming');
        nodeSpeaker.classList.remove('running');
        nodeSpeaker.querySelector('.node-status').textContent = 'ONLINE';
        nodeSpeech.querySelector('.node-status').textContent = 'ONLINE';
        nodeModel.querySelector('.node-status').textContent = 'READY';

        // Proactively read response output aloud if the reader node is active
        if (nodeSpeaker.classList.contains('active')) {
            speakOutput();
        }
    }

    // --- 5. Custom Response Generator Resolver ---
    function getModelOutputResponse(prompt) {
        // If voice input override
        if (userSpeechInput) {
            return `[Spectra Speech Model v1.0.4] Input Dictation Registered.
Speech transcript: "${userSpeechInput}"

Response Summary:
I have processed your spoken inquiry regarding "${userSpeechInput}".
As an intelligent agent, I would recommend mapping this command directly into your pipeline workflow variables to trigger specific automated macros. No physical typing actions were required to execute this cognitive request.`;
        }

        const action = activeTokens.action;
        const subject = activeTokens.subject;
        const format = activeTokens.target;

        // Custom template outputs
        if (action === 'Explain' && subject === 'the algorithm') {
            if (format.includes('Python')) {
                return `def binary_search(arr, target):
    # Explain: A highly efficient search algorithm (O(log n))
    low = 0
    high = len(arr) - 1
    
    while low <= high:
        mid = (low + high) // 2
        guess = arr[mid]
        if guess == target:
            return mid
        if guess > target:
            high = mid - 1
        else:
            low = mid + 1
    return None

# Workspace Analysis:
# Compiled with Balanced Temp parameters (0.7)
# Validated against Aethera core memory indexes.`;
            }
            return `// Binary Search Algorithm
function binarySearch(arr, target) {
    let low = 0;
    let high = arr.length - 1;
    while(low <= high) {
        let mid = Math.floor((low + high) / 2);
        if(arr[mid] === target) return mid;
        if(arr[mid] > target) high = mid - 1;
        else low = mid + 1;
    }
    return -1;
}`;
        }

        if (action === 'Debug' && subject === 'the database query') {
            return `-- Debug parameters applied. Index optimization requested.
EXPLAIN ANALYZE
SELECT u.id, u.username, o.amount
FROM users u
INNER JOIN orders o ON u.id = o.user_id
WHERE o.created_at >= NOW() - INTERVAL '30 days'
ORDER BY o.amount DESC;

-- OPTIMIZATION PATH:
-- Create compound index: CREATE INDEX idx_orders_user_created ON orders(user_id, created_at);`;
        }

        if (action === 'Generate' && subject === 'the neural network layers') {
            return `import torch.nn as nn

class ConvBlock(nn.Module):
    # Generated via Aethera Neural Net builder
    def __init__(self, in_channels, out_channels):
        super(ConvBlock, self).__init__()
        self.conv = nn.Conv2d(in_channels, out_channels, kernel_size=3, padding=1)
        self.bn = nn.BatchNorm2d(out_channels)
        self.relu = nn.ReLU(inplace=True)
        
    def forward(self, x):
        return self.relu(self.bn(self.conv(x)))`;
        }

        // Generic fallback generator
        return `[AETHERA LOGS // INSTRUCTION DISPATCHED]
Instruction: "${prompt}"
Active Model: ${activeEngine} (Temp: ${activeTemp})

Analysis Summary:
1. Target action "${action || 'Request'}" has been processed.
2. Verified subject parameters matching "${subject || 'AI prompt core'}".
3. Formatted outputs optimized using modifiers "${activeTokens.modifier || 'Standard default'}".
4. Compiled code structure outputting as requested.`;
    }

    // --- 6. Speech Synthesis Reader (TTS) ---
    function speakOutput() {
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported.');
            return;
        }

        // Stop current speaking
        window.speechSynthesis.cancel();

        const text = outputDisplay.textContent;
        if (!text || text.includes('Output values will print')) return;

        // Clean code formatting tags from speech reading for pleasant audio output
        const cleanText = text.replace(/[`{}[\]()=;/\-#]/g, ' ')
                              .replace(/def /g, 'define ')
                              .replace(/arr/g, 'array');

        const utterance = new SpeechSynthesisUtterance(cleanText);
        
        if (activeEngine === 'Persuader Voice Core') {
            utterance.rate = 0.93;
            utterance.pitch = 0.96;
            
            const voices = window.speechSynthesis.getVoices();
            const premiumVoice = voices.find(v => 
                (v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Zira') || v.name.includes('David')) 
                && v.lang.startsWith('en')
            );
            if (premiumVoice) {
                utterance.voice = premiumVoice;
            }
        } else {
            utterance.rate = 1.0;
            utterance.pitch = 1.0;
        }

        utterance.onstart = () => {
            ttsSpeakBtn.textContent = '🔊 Reading...';
            ttsSpeakBtn.classList.add('text-glow');
        };

        utterance.onend = () => {
            ttsSpeakBtn.textContent = '🔊 Speak';
            ttsSpeakBtn.classList.remove('text-glow');
        };

        window.speechSynthesis.speak(utterance);
    }

    if (ttsSpeakBtn) {
        ttsSpeakBtn.addEventListener('click', speakOutput);
    }

    if (ttsStopBtn) {
        ttsStopBtn.addEventListener('click', () => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                ttsSpeakBtn.textContent = '🔊 Speak';
                ttsSpeakBtn.classList.remove('text-glow');
            }
        });
    }

    // --- 7. Reset / Clear Workspace ---
    resetBtn.addEventListener('click', () => {
        if (isPipelineRunning) return;
        
        const layout = document.querySelector('.workspace-layout');
        if (layout) {
            layout.classList.remove('emergency-alarm-active');
        }
        
        clearSelectedTokens();
        userSpeechInput = '';
        updatePromptText();
        
        outputDisplay.textContent = 'Output values will print here in real-time once the compiled instruction is executed.';
        
        // Stop audio
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            ttsSpeakBtn.textContent = '🔊 Speak';
            ttsSpeakBtn.classList.remove('text-glow');
        }

        // Reset metrics
        latencyMetric.textContent = '-- ms';
        speedMetric.textContent = '-- t/s';
        energyMetric.textContent = '-- J';

        voiceStatus.textContent = 'Tap microphone to dictate prompt verbally';
        // Reset adaptive shortcuts
        updateAdaptiveShortcuts('');
    });

    // Node toggling click responses
    const pipelineNodes = document.querySelectorAll('.pipeline-node');
    pipelineNodes.forEach(node => {
        node.addEventListener('click', () => {
            if (isPipelineRunning) return;
            node.classList.toggle('active');
            
            // Handle output reader node toggles
            if (node.id === 'node-output-speaker') {
                const status = node.querySelector('.node-status');
                if (node.classList.contains('active')) {
                    status.textContent = 'ONLINE';
                } else {
                    status.textContent = 'MUTED';
                }
            }
        });
    });

    // --- 8. Adaptive One-Tap Interface Controller ---
    const presets = {
        'debug-sql': { action: 'Debug', subject: 'the database query', modifier: 'with strict safety focus', target: 'formatted as optimized SQL schema', engine: 'Aethera LLM v4', temp: '0.2' },
        'explain-python': { action: 'Explain', subject: 'the algorithm', modifier: 'with line-by-line comments', target: 'formatted as Python code', engine: 'Aethera LLM v4', temp: '0.7' },
        'generate-nn': { action: 'Generate', subject: 'the neural network layers', modifier: 'using modern best practices', target: 'formatted as Python code', engine: 'Aethera LLM v4', temp: '1.2' },
        // Context-driven updates
        'explain-a11y': { action: 'Explain', subject: 'the CSS layout', modifier: 'using modern best practices', target: 'formatted as a Markdown list', engine: 'Aethera LLM v4', temp: '0.7' },
        'explain-hash': { action: 'Explain', subject: 'the security protocol', modifier: 'with strict safety focus', target: 'formatted as raw JSON data', engine: 'Aethera LLM v4', temp: '0.2' },
        'debug-flexbox': { action: 'Debug', subject: 'the CSS layout', modifier: 'using modern best practices', target: 'formatted as JavaScript code', engine: 'Aethera LLM v4', temp: '0.7' },
        'debug-csp': { action: 'Debug', subject: 'the security protocol', modifier: 'with strict safety focus', target: 'formatted as raw JSON data', engine: 'Aethera LLM v4', temp: '0.2' },
        'generate-table': { action: 'Generate', subject: 'the database query', modifier: 'with line-by-line comments', target: 'formatted as structured HTML table', engine: 'Aethera LLM v4', temp: '0.7' },
        'generate-axios': { action: 'Generate', subject: 'the API endpoint', modifier: 'using modern best practices', target: 'formatted as JavaScript code', engine: 'Aethera LLM v4', temp: '0.7' }
    };

    const oneTapContainer = document.getElementById('one-tap-shortcuts');

    function updateAdaptiveShortcuts(actionType) {
        if (!oneTapContainer) return;
        
        let html = '';
        if (actionType === 'Explain') {
            html = `
                <button class="one-tap-pill" data-preset="explain-python">✦ Explain Binary Search</button>
                <button class="one-tap-pill" data-preset="explain-a11y">✦ Explain Accessibility Grid</button>
                <button class="one-tap-pill" data-preset="explain-hash">✦ Explain Hashing Protocol</button>
            `;
        } else if (actionType === 'Debug') {
            html = `
                <button class="one-tap-pill" data-preset="debug-sql">⚡ Optimize SQL Query</button>
                <button class="one-tap-pill" data-preset="debug-flexbox">⚡ Debug CSS Alignment</button>
                <button class="one-tap-pill" data-preset="debug-csp">⚡ Debug Security CSP</button>
            `;
        } else if (actionType === 'Generate') {
            html = `
                <button class="one-tap-pill" data-preset="generate-nn">🧠 Generate CNN Layer</button>
                <button class="one-tap-pill" data-preset="generate-table">🧠 Generate DB Schema HTML</button>
                <button class="one-tap-pill" data-preset="generate-axios">🧠 Generate Axios Endpoint</button>
            `;
        } else {
            // General recommendations
            html = `
                <button class="one-tap-pill" data-preset="debug-sql">⚡ Optimize SQL Query</button>
                <button class="one-tap-pill" data-preset="explain-python">✦ Explain Binary Search</button>
                <button class="one-tap-pill" data-preset="generate-nn">🧠 Generate CNN Layer</button>
            `;
        }
        
        oneTapContainer.innerHTML = html;
    }

    if (oneTapContainer) {
        oneTapContainer.addEventListener('click', (e) => {
            const pill = e.target.closest('.one-tap-pill');
            if (!pill || isPipelineRunning) return;

            const presetKey = pill.getAttribute('data-preset');
            const config = presets[presetKey];

            if (config) {
                // 1. Clear existing inputs
                clearSelectedTokens();

                // 2. Select tokens visually & logically
                Object.keys(activeTokens).forEach(key => {
                    activeTokens[key] = config[key];
                    const btn = document.querySelector(`.token-btn[data-type="${key}"][data-value="${config[key]}"]`);
                    if (btn) btn.classList.add('selected');
                });

                // 3. Update prompt display text
                userSpeechInput = '';
                updatePromptText();

                // 4. Set sliders/engine state
                activeTemp = config.temp;
                document.querySelectorAll('#selector-temp .capsule-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.getAttribute('data-value') === activeTemp);
                });

                // 5. Fire pipeline execution instantly! (One-Tap!)
                runBtn.click();
            }
        });
    }

    // Wrap token matrix buttons click listener to passively trigger shortcut updates
    tokenButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (button.getAttribute('data-type') === 'action') {
                const isSelected = button.classList.contains('selected');
                const actionValue = isSelected ? button.getAttribute('data-value') : '';
                updateAdaptiveShortcuts(actionValue);
            }
        });
    });
});
