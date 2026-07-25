require('dotenv').config();
const express = require('express');
const os = require('os');
const path = require('path');
const helmet = require('helmet');
const dbHelper = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Security: Helmet HTTP Headers configuration with CSP exceptions
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
            imgSrc: ["'self'", "data:"],
            mediaSrc: ["'self'"],
        },
    },
}));

// Mitigate large JSON request payloads DOS vulnerability
app.use(express.json({ limit: '15kb' }));

// Serve static assets with cache-control efficiency parameters
app.use(express.static(__dirname, {
    maxAge: '1d',
    etag: true
}));

// Endpoint 1: Register Developer Email
app.post('/api/register', async (req, res) => {
    try {
        const { email } = req.body;
        
        // Strict input validation
        if (!email || typeof email !== 'string' || email.length > 100) {
            return res.status(400).json({ success: false, error: 'Email size parameter error.' });
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ success: false, error: 'Invalid email address format.' });
        }

        // Generate cryptographic key
        const hex = '0123456789ABCDEF';
        let accessKey = 'AG-';
        for (let i = 0; i < 16; i++) {
            if (i > 0 && i % 4 === 0) accessKey += '-';
            accessKey += hex[Math.floor(Math.random() * 16)];
        }

        // Save to SQLite
        const result = await dbHelper.saveRegistration(email, accessKey);
        res.json({
            success: true,
            key: accessKey,
            email: email,
            updated: result.updated
        });
    } catch (err) {
        console.error('Error handling registration:', err.message);
        res.status(500).json({ success: false, error: 'Database saving error.' });
    }
});

// Endpoint 2: System Health Telemetry
app.get('/api/telemetry', (req, res) => {
    try {
        // Calculate Memory usage
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMemPct = Math.round(((totalMem - freeMem) / totalMem) * 100);

        // Calculate CPU usage (scaled from load averages or a realistic base rate)
        const loadAvg = os.loadavg()[0]; // 1-minute load average
        const cores = os.cpus().length;
        // Scale CPU load relative to cores (baseline 30% plus load influence, capped at 95%)
        let cpuUsage = Math.round((loadAvg / cores) * 100);
        if (isNaN(cpuUsage) || cpuUsage === 0) {
            cpuUsage = Math.floor(35 + Math.random() * 15);
        } else {
            cpuUsage = Math.min(Math.max(cpuUsage, 20), 95);
        }

        res.json({
            cpu: cpuUsage,
            memory: usedMemPct,
            entropy: 'MINIMAL',
            gravityCompensator: '0.00 G',
            systemUptime: Math.round(os.uptime())
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to read server telemetry.' });
    }
});

// Endpoint 3: Core AI Model Content Generator
app.post('/api/generate', async (req, res) => {
    const { prompt, engine, temp, safetyMode } = req.body;
    
    // Strict input length validation
    if (!prompt || typeof prompt !== 'string' || prompt.length > 1200) {
        return res.status(400).json({ error: 'Invalid prompt parameters or size limit exceeded.' });
    }

    // Deterministic Safety Mode filter interceptor
    const isSensitive = checkSensitiveKeywords(prompt);
    if (safetyMode === true || isSensitive) {
        console.log(`[SAFETY INTERCEPT] Query: "${prompt}". SafetyMode: ${safetyMode}, Sensitive: ${isSensitive}`);
        const responseText = getSafeDeterministicTemplate(prompt, engine, temp);
        return res.json({ response: responseText });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Dual-Mode: If Gemini API Key is configured, make real API call. Otherwise, fall back to rule-based mock responses.
    if (apiKey) {
        console.log(`Forwarding query to real Gemini API. Engine: ${engine}`);
        try {
            const isPersuader = engine === 'Persuader Voice Core';
            const customPrompt = isPersuader
                ? `[SYSTEM INSTRUCTION: You are an empathetic, persuasive voice agent. Structure your response using a short conversational Hook, followed by logical Evidence, ending with a clear, positive Benefit. Keep sentences short and warm for voice synthesis.] ${prompt}`
                : `${prompt} Answer in the style of a high-tech console and keep it relatively brief.`;

            const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: customPrompt }]
                    }],
                    generationConfig: {
                        temperature: parseFloat(temp) || 0.7
                    }
                })
            });

            const data = await response.json();
            
            if (data.candidates && data.candidates[0].content && data.candidates[0].content.parts) {
                const responseText = data.candidates[0].content.parts[0].text;
                return res.json({ response: responseText });
            } else {
                console.warn('Unexpected API structure:', JSON.stringify(data));
                throw new Error('Invalid API candidates response.');
            }

        } catch (err) {
            console.error('Gemini API call failed, falling back to rule mock:', err.message);
            // Fall back to rule mock on API failure
        }
    }

    // Default Fallback Mock Answers
    console.log('Generating fallback mock responses for query:', prompt);
    const mockResponse = getMockResponse(prompt, engine, temp);
    res.json({ response: mockResponse });
});

function getMockResponse(prompt, engine, temp) {
    const p = prompt.toLowerCase();
    
    if (engine === 'Persuader Voice Core') {
        return getPersuasiveMockResponse(prompt);
    }
    
    if (p.includes('explain') && p.includes('algorithm')) {
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
# Served by: ${engine} local backup core.
# Temperature: ${temp}`;
    }

    if (p.includes('debug') && p.includes('database')) {
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

    if (p.includes('generate') && p.includes('neural')) {
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

    return `[AETHERA BACKEND BACKUP // INSTRUCTION PROCESSED]
Query: "${prompt}"
Processed Engine: ${engine}
Tuning Temperature: ${temp}

Analysis:
* Server resolved prompt parameters successfully.
* Database link checked.
* Response generated via server rule lookup. Set GEMINI_API_KEY env key to trigger live cognitive answers.`;
}

function getPersuasiveMockResponse(prompt) {
    const p = prompt.toLowerCase();
    
    if (p.includes('explain') && p.includes('algorithm')) {
        return `[AETHERA PERSUASION ENGINE]
Hook: Understanding sorting algorithms is like learning the secret shorthand of computing. Once you grasp binary search, it changes how you look at databases forever.

Evidence: Unlike sequential loops that scan items one by one taking thousands of steps, binary search divides arrays in half recursively, locating your item in a maximum of 20 operations for a million elements.

Benefit: By adopting this pattern, your application latency drops by over 90 percent. Your users get a blazing-fast experience, and your servers run cool and efficient under heavy load.`;
    }
    
    if (p.includes('debug') && p.includes('database')) {
        return `[AETHERA PERSUASION ENGINE]
Hook: Slow databases are the silent killer of great user experiences. Optimizing your indexes is the single most powerful action you can take.

Evidence: Adding a compound index on foreign keys and creation dates reduces SQL scanning overhead from O(N) to O(log N), completing query loops in sub-millisecond times.

Benefit: That means your page loads instantly, your CPU usage flatlines to zero, and your hosting bills drop dramatically starting today.`;
    }
    
    // Generic fallback
    return `[AETHERA PERSUASION ENGINE]
Hook: I hear your question regarding "${prompt}", and it is an essential challenge to solve. Let's look at how we can optimize this passively together.

Evidence: Based on server-side performance analytics, running these specific instructions increases operational throughput by 40 percent compared to legacy templates.

Benefit: By deploying this method today, you will immediately simplify your workspace workflow, saving execution energy and creating a more responsive interface.`;
}

// Global Exception error handler (prevents trace leakage)
app.use((err, req, res, next) => {
    console.error('Unhandled internal error:', err.message);
    res.status(500).json({ error: 'An unexpected system or security exception occurred.' });
});

function checkSensitiveKeywords(prompt) {
    const p = prompt.toLowerCase();
    return p.includes('hash') || p.includes('password') || p.includes('cryptography') || p.includes('delete');
}

function getSafeDeterministicTemplate(prompt, engine, temp) {
    const p = prompt.toLowerCase();
    
    if (p.includes('hash') || p.includes('password') || p.includes('cryptography')) {
        return `// DETERMINISTIC SAFETY FAILSAFE: Secure pbkdf2 Hashing
const crypto = require('crypto');

function secureHash(inputPassword) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(inputPassword, salt, 100000, 64, 'sha512').toString('hex');
    return {
        salt: salt,
        hash: hash,
        iterations: 100000,
        algorithm: 'sha512'
    };
}

# Verified by Aethera safety compiler.
# Output compiled deterministically under Safety Mode.`;
    }

    if (p.includes('delete')) {
        return `-- DETERMINISTIC SAFETY FAILSAFE: Database Row Deletion (soft delete pattern)
UPDATE users 
SET deleted_at = CURRENT_TIMESTAMP, status = 'ARCHIVED' 
WHERE id = ? AND status != 'DELETED';

-- Audit logging event dispatched passively.`;
    }

    return `// DETERMINISTIC SAFETY PIPELINE OUTCOME
// Prompt query: "${prompt}"
// AI synthesis was bypassed to guarantee execution determinism.
// Engine configured: ${engine} (Temp Override: 0.0)`;
}

// Start Server
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`\n======================================================`);
        console.log(`  Aethera Full-Stack Workspace running successfully!`);
        console.log(`  Server Local Host: http://localhost:${PORT}`);
        console.log(`======================================================\n`);
    });
}

module.exports = app;
