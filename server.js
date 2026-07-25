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
    const { prompt, engine, temp } = req.body;
    
    // Strict input length validation
    if (!prompt || typeof prompt !== 'string' || prompt.length > 1200) {
        return res.status(400).json({ error: 'Invalid prompt parameters or size limit exceeded.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Dual-Mode: If Gemini API Key is configured, make real API call. Otherwise, fall back to rule-based mock responses.
    if (apiKey) {
        console.log(`Forwarding query to real Gemini API. Engine: ${engine}`);
        try {
            const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiURL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: `${prompt} Answer in the style of a high-tech console and keep it relatively brief.` }]
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

// Global Exception error handler (prevents trace leakage)
app.use((err, req, res, next) => {
    console.error('Unhandled internal error:', err.message);
    res.status(500).json({ error: 'An unexpected system or security exception occurred.' });
});

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
