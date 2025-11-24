const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require("path");

// Initialize app FIRST
const app = express();

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Accept large base64 images

// Serve static files (correct position)
app.use(express.static(__dirname));

// API Route
app.post('/api/generate-exam', async (req, res) => {
    try {
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ 
                error: { message: 'Server configuration error: API Key missing' } 
            });
        }

        const apiURL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent`;

        const response = await fetch(apiURL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(req.body)
        });

        if (!response.ok) {
            const errorData = await response.json();
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Proxy Error:', error);
        res.status(500).json({ error: { message: 'Internal Server Error' } });
    }
});

// Serve index.html on root
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
