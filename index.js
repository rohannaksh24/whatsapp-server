const express = require('express');
const { makeWASocket, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const multer = require('multer');
const app = express();
const port = process.env.PORT || 5000;

let MznKing = null;
let messages = null;
let targets = [];
let intervalTime = null;
let haterName = null;
let currentInterval = null;
let stopKey = null;
let sendingActive = false;
let isConnected = false;
let connectionStatus = "SYSTEM BOOTING...";
let pairCodeData = null;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simple WhatsApp connection
const initializeWhatsApp = async () => {
    try {
        console.log('🟢 INITIALIZING MATRIX SYSTEM...');
        connectionStatus = "CONNECTING TO MATRIX...";
        
        const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
        
        MznKing = makeWASocket({
            logger: { level: 'silent' },
            printQRInTerminal: false,
            auth: state,
        });

        MznKing.ev.on('connection.update', (update) => {
            const { connection } = update;
            
            if (connection === "open") {
                isConnected = true;
                connectionStatus = "🟢 MATRIX CONNECTED";
                pairCodeData = null;
                console.log("✅ MATRIX ACCESS GRANTED");
            }
            
            if (connection === "close") {
                isConnected = false;
                connectionStatus = "🔴 MATRIX DISCONNECTED";
                console.log("❌ MATRIX CONNECTION LOST");
                setTimeout(() => initializeWhatsApp(), 5000);
            }
        });

        MznKing.ev.on('creds.update', saveCreds);

    } catch (error) {
        console.log('❌ MATRIX INIT FAILED:', error.message);
        connectionStatus = "🔴 SYSTEM ERROR";
        setTimeout(() => initializeWhatsApp(), 10000);
    }
};

// Start system
initializeWhatsApp();

function generateStopKey() {
    return 'MATRIX-' + Math.floor(100000 + Math.random() * 900000);
}

// Pair code function
app.post('/generate-pairing-code', async (req, res) => {
    try {
        const phoneNumber = req.body.phoneNumber;
        
        if (!phoneNumber) {
            return res.send({ 
                status: 'error', 
                message: '❌ PHONE NUMBER REQUIRED' 
            });
        }

        const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        
        if (cleanNumber.length < 10) {
            return res.send({ 
                status: 'error', 
                message: '❌ INVALID PHONE NUMBER' 
            });
        }

        console.log('🔑 REQUESTING ACCESS CODE FOR:', cleanNumber);

        if (!MznKing) {
            return res.send({ 
                status: 'error', 
                message: '⏳ SYSTEM INITIALIZING' 
            });
        }

        if (isConnected) {
            return res.send({ 
                status: 'success', 
                message: '✅ MATRIX ACCESS ACTIVE' 
            });
        }

        const pairCode = await MznKing.requestPairingCode(cleanNumber);
        
        console.log('✅ ACCESS CODE GENERATED:', pairCode);
        
        pairCodeData = {
            pairCode: pairCode,
            phoneNumber: cleanNumber,
            timestamp: new Date()
        };
        
        res.send({ 
            status: 'success', 
            pairCode: pairCode,
            message: `ACCESS CODE: ${pairCode}`
        });
        
    } catch (error) {
        console.error('❌ ACCESS CODE FAILED:', error.message);
        res.send({ 
            status: 'error', 
            message: '❌ ACCESS DENIED - TRY AGAIN' 
        });
    }
});

// HTML Template
const htmlTemplate = (showStopKey) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>MATRIX CONTROL SYSTEM</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
        
        * { 
            margin: 0; 
            padding: 0; 
            box-sizing: border-box; 
        }
        
        body {
            font-family: 'Orbitron', monospace;
            background: #000;
            color: #0f0;
            min-height: 100vh;
            overflow-x: hidden;
            position: relative;
        }
        
        .matrix-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(180deg, #001100 0%, #000 100%);
            z-index: -2;
        }
        
        .matrix-rain {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: repeating-linear-gradient(
                0deg,
                transparent,
                transparent 2px,
                rgba(0, 255, 0, 0.1) 2px,
                rgba(0, 255, 0, 0.1) 4px
            );
            animation: matrixMove 20s linear infinite;
            z-index: -1;
        }
        
        @keyframes matrixMove {
            0% { background-position: 0 0; }
            100% { background-position: 0 100%; }
        }
        
        .glow {
            text-shadow: 
                0 0 5px #0f0,
                0 0 10px #0f0,
                0 0 15px #0f0,
                0 0 20px #0f0;
        }
        
        .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            position: relative;
            z-index: 1;
        }
        
        .header {
            text-align: center;
            margin-bottom: 30px;
            padding: 20px;
            background: rgba(0, 20, 0, 0.8);
            border: 2px solid #0f0;
            border-radius: 10px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.5);
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.5); }
            50% { box-shadow: 0 0 30px rgba(0, 255, 0, 0.8); }
        }
        
        .header h1 {
            font-size: 2.5em;
            font-weight: 900;
            margin-bottom: 10px;
            background: linear-gradient(45deg, #0f0, #0a0, #0f0);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
            letter-spacing: 3px;
        }
        
        .status {
            background: rgba(0, 20, 0, 0.9);
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
            border: 1px solid #0f0;
            font-weight: bold;
            font-size: 1.1em;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.3);
        }
        
        .form-group {
            margin-bottom: 20px;
            background: rgba(0, 20, 0, 0.8);
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #0f0;
            box-shadow: 0 0 10px rgba(0, 255, 0, 0.2);
        }
        
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: bold;
            color: #0f0;
            font-size: 1.1em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        input, button {
            width: 100%;
            padding: 15px;
            border: 2px solid #0f0;
            border-radius: 5px;
            font-size: 16px;
            font-family: 'Orbitron', monospace;
            background: rgba(0, 10, 0, 0.9);
            color: #0f0;
            transition: all 0.3s ease;
        }
        
        input:focus {
            outline: none;
            border-color: #0f0;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.5);
            background: rgba(0, 15, 0, 0.9);
        }
        
        input::placeholder {
            color: #060;
            font-style: italic;
        }
        
        button {
            background: linear-gradient(45deg, #001100, #003300);
            color: #0f0;
            border: 2px solid #0f0;
            cursor: pointer;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            margin-top: 10px;
            position: relative;
            overflow: hidden;
        }
        
        button:hover {
            background: linear-gradient(45deg, #002200, #004400);
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.7);
            transform: translateY(-2px);
        }
        
        button:active {
            transform: translateY(0);
        }
        
        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .btn-pair { 
            background: linear-gradient(45deg, #330000, #660000);
            border-color: #f00;
        }
        
        .btn-pair:hover {
            background: linear-gradient(45deg, #440000, #770000);
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.7);
        }
        
        .btn-start { 
            background: linear-gradient(45deg, #003300, #006600);
            border-color: #0f0;
        }
        
        .btn-start:hover {
            background: linear-gradient(45deg, #004400, #007700);
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.7);
        }
        
        .btn-stop { 
            background: linear-gradient(45deg, #330000, #660000);
            border-color: #f00;
        }
        
        .btn-stop:hover {
            background: linear-gradient(45deg, #440000, #770000);
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.7);
        }
        
        .pair-code-box {
            background: rgba(0, 30, 0, 0.9);
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            text-align: center;
            border: 2px solid #0f0;
            box-shadow: 0 0 25px rgba(0, 255, 0, 0.6);
            animation: glow 1.5s ease-in-out infinite alternate;
        }
        
        @keyframes glow {
            from { box-shadow: 0 0 25px rgba(0, 255, 0, 0.6); }
            to { box-shadow: 0 0 35px rgba(0, 255, 0, 0.9); }
        }
        
        .stop-key-box {
            background: rgba(30, 0, 0, 0.9);
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
            border: 2px solid #f00;
            box-shadow: 0 0 25px rgba(255, 0, 0, 0.6);
        }
        
        .code-display {
            font-size: 2.5em;
            font-weight: 900;
            color: #0f0;
            background: rgba(0, 10, 0, 0.9);
            padding: 15px;
            border-radius: 5px;
            margin: 15px 0;
            border: 2px dashed #0f0;
            font-family: 'Courier New', monospace;
            letter-spacing: 5px;
        }
        
        .instructions {
            background: rgba(0, 20, 0, 0.8);
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
            border: 1px solid #0f0;
            font-size: 0.9em;
            line-height: 1.4;
        }
        
        .terminal-text {
            color: #0f0;
            font-family: 'Courier New', monospace;
            background: rgba(0, 10, 0, 0.9);
            padding: 10px;
            border-radius: 5px;
            border: 1px solid #0f0;
            margin: 5px 0;
        }
        
        .blink {
            animation: blink 1s infinite;
        }
        
        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0.3; }
        }
        
        .footer {
            text-align: center;
            margin-top: 30px;
            padding: 15px;
            background: rgba(0, 20, 0, 0.8);
            border-radius: 8px;
            border: 1px solid #0f0;
            font-size: 0.8em;
            color: #060;
        }
        
        .scanlines {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(
                to bottom,
                transparent 50%,
                rgba(0, 255, 0, 0.03) 50%
            );
            background-size: 100% 4px;
            z-index: 0;
            pointer-events: none;
        }
    </style>
</head>
<body>
    <div class="matrix-bg"></div>
    <div class="matrix-rain"></div>
    <div class="scanlines"></div>
    
    <div class="container">
        <div class="header">
            <h1 class="glow">MATRIX CONTROL SYSTEM</h1>
            <div class="terminal-text">
                > WELCOME TO THE MATRIX SERVER v2.0
            </div>
        </div>

        <div class="status blink">
            ⚡ SYSTEM STATUS: ${connectionStatus}
        </div>

        <div class="instructions">
            <div class="terminal-text">
                > ENTER CREDENTIALS TO ACCESS MATRIX
            </div>
        </div>

        <form action="/generate-pairing-code" method="post">
            <div class="form-group">
                <label>📱 TARGET PHONE NUMBER</label>
                <input type="text" name="phoneNumber" placeholder="ENTER 91XXXXXXXXXX" required />
            </div>
            <button type="submit" class="btn-pair">🔐 GENERATE ACCESS CODE</button>
        </form>

        ${pairCodeData ? `
        <div class="pair-code-box">
            <div class="terminal-text">> ACCESS CODE GENERATED</div>
            <div class="code-display glow">${pairCodeData.pairCode}</div>
            <div class="terminal-text">
                > ENTER CODE IN WHATSAPP LINKED DEVICES
            </div>
        </div>
        ` : ''}

        <form action="/send-messages" method="post" enctype="multipart/form-data">
            <div class="form-group">
                <label>🎯 TARGET LIST</label>
                <input type="text" name="targetsInput" placeholder="91XXXXXXXXXX, GROUP-ID" required />
            </div>
            
            <div class="form-group">
                <label>📄 MESSAGE DATA FILE</label>
                <input type="file" name="messageFile" accept=".txt" required />
            </div>
            
            <div class="form-group">
                <label>👤 SENDER IDENTITY</label>
                <input type="text" name="haterNameInput" placeholder="ENTER IDENTITY" required />
            </div>
            
            <div class="form-group">
                <label>⏰ TRANSMISSION DELAY</label>
                <input type="number" name="delayTime" min="5" value="10" required />
            </div>
            
            <button type="submit" class="btn-start" ${!isConnected ? 'disabled' : ''}>
                🚀 INITIATE DATA STREAM ${!isConnected ? '(AWAITING MATRIX ACCESS)' : ''}
            </button>
        </form>

        <form action="/stop" method="post">
            <div class="form-group">
                <label>🛑 TERMINATION KEY</label>
                <input type="text" name="stopKeyInput" placeholder="ENTER TERMINATION CODE" />
            </div>
            <button type="submit" class="btn-stop">⏹️ ABORT TRANSMISSION</button>
        </form>

        ${showStopKey ? `
        <div class="stop-key-box">
            <label>🔑 ACTIVE TERMINATION KEY</label>
            <input type="text" value="${stopKey}" readonly 
                   style="background:rgba(10,0,0,0.9); font-weight:bold; font-size: 18px; text-align: center; color: #f00;" 
                   onclick="this.select(); document.execCommand('copy');" />
            <div class="terminal-text">> CLICK TO COPY TERMINATION CODE</div>
        </div>
        ` : ''}

        <div class="footer">
            <div class="terminal-text">
                > MATRIX SERVER v2.0 | ENCRYPTED TRANSMISSION ACTIVE
            </div>
        </div>
    </div>

    <script>
        // Auto refresh every 5 seconds
        setTimeout(() => {
            location.reload();
        }, 5000);

        // Save form data
        document.addEventListener('DOMContentLoaded', function() {
            const inputs = document.querySelectorAll('input[type="text"], input[type="number"]');
            inputs.forEach(input => {
                const saved = localStorage.getItem(input.name);
                if (saved) input.value = saved;
                input.addEventListener('input', () => {
                    localStorage.setItem(input.name, input.value);
                });
            });

            // Terminal typing effect
            const elements = document.querySelectorAll('.terminal-text');
            elements.forEach(el => {
                const text = el.textContent;
                el.textContent = '';
                let i = 0;
                const typeWriter = () => {
                    if (i < text.length) {
                        el.textContent += text.charAt(i);
                        i++;
                        setTimeout(typeWriter, 50);
                    }
                };
                setTimeout(typeWriter, 1000);
            });
        });

        // Add matrix code rain effect
        function createMatrixRain() {
            const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン";
            const container = document.querySelector('.matrix-bg');
            
            for (let i = 0; i < 50; i++) {
                const span = document.createElement('span');
                span.style.position = 'fixed';
                span.style.left = Math.random() * 100 + 'vw';
                span.style.top = '-20px';
                span.style.color = '#0f0';
                span.style.fontSize = (Math.random() * 10 + 10) + 'px';
                span.style.fontFamily = 'Courier New, monospace';
                span.style.opacity = Math.random() * 0.5 + 0.1;
                span.textContent = chars[Math.floor(Math.random() * chars.length)];
                span.style.animation = 'fall ' + (Math.random() * 10 + 5) + 's linear infinite';
                container.appendChild(span);
            }
            
            const style = document.createElement('style');
            style.textContent = '@keyframes fall { to { transform: translateY(100vh) rotate(360deg); opacity: 0; } }';
            document.head.appendChild(style);
        }
        
        createMatrixRain();
    </script>
</body>
</html>
`;

app.get('/', (req, res) => {
    const showStopKey = sendingActive && stopKey;
    res.send(htmlTemplate(showStopKey));
});

app.post('/send-messages', upload.single('messageFile'), async (req, res) => {
    try {
        const { targetsInput, delayTime, haterNameInput } = req.body;

        if (!targetsInput || !delayTime || !haterNameInput || !req.file) {
            throw new Error('MISSING PARAMETERS');
        }

        const delayNum = parseInt(delayTime);
        if (delayNum < 5) throw new Error('DELAY TOO SHORT');

        if (!isConnected) throw new Error('MATRIX ACCESS REQUIRED');

        // Read messages
        messages = req.file.buffer.toString('utf-8')
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (messages.length === 0) throw new Error('EMPTY DATA FILE');

        // Process targets
        targets = targetsInput.split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        if (targets.length === 0) throw new Error('NO VALID TARGETS');

        haterName = haterNameInput;
        intervalTime = delayNum;
        stopKey = generateStopKey();
        sendingActive = true;

        // Clear previous interval
        if (currentInterval) clearInterval(currentInterval);

        console.log(`\n🚀 INITIATING DATA STREAM:
        TARGETS: ${targets.length}
        MESSAGES: ${messages.length}
        DELAY: ${intervalTime}s
        STOP KEY: ${stopKey}\n`);

        let msgIndex = 0;

        currentInterval = setInterval(async () => {
            if (!sendingActive || msgIndex >= messages.length) {
                clearInterval(currentInterval);
                sendingActive = false;
                console.log('✅ DATA STREAM COMPLETE');
                return;
            }

            const fullMessage = `${haterName} ${messages[msgIndex]}`;
            console.log(`📤 TRANSMITTING ${msgIndex + 1}/${messages.length}`);
            
            for (const target of targets) {
                try {
                    let targetJid = target.includes('@g.us') ? target : `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
                    await MznKing.sendMessage(targetJid, { text: fullMessage });
                    console.log(`   ✅ TARGET: ${target}`);
                } catch (err) {
                    console.log(`   ❌ FAILED: ${target}`);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            msgIndex++;
        }, intervalTime * 1000);

        res.redirect('/');
    } catch (error) {
        console.error('❌ TRANSMISSION FAILED:', error.message);
        res.send(`<script>alert("ERROR: ${error.message}"); location.href="/";</script>`);
    }
});

app.post('/stop', (req, res) => {
    const userKey = req.body.stopKeyInput;
    
    if (userKey === stopKey) {
        sendingActive = false;
        if (currentInterval) clearInterval(currentInterval);
        console.log('🛑 DATA STREAM TERMINATED');
        res.send(`
            <div style="font-family: 'Orbitron', monospace; background: #000; color: #0f0; text-align: center; padding: 50px;">
                <h1 style="color: #f00; text-shadow: 0 0 10px #f00;">⚡ TRANSMISSION TERMINATED</h1>
                <p style="margin: 20px 0;">DATA STREAM SUCCESSFULLY ABORTED</p>
                <a href="/" style="color: #0f0; text-decoration: none; border: 2px solid #0f0; padding: 10px 20px; display: inline-block;">
                    ↻ RETURN TO CONTROL PANEL
                </a>
            </div>
        `);
    } else {
        res.send(`
            <div style="font-family: 'Orbitron', monospace; background: #000; color: #f00; text-align: center; padding: 50px;">
                <h1 style="text-shadow: 0 0 10px #f00;">❌ INVALID TERMINATION CODE</h1>
                <a href="/" style="color: #0f0; text-decoration: none; border: 2px solid #0f0; padding: 10px 20px; display: inline-block;">
                    ↻ RETURN TO CONTROL PANEL
                </a>
            </div>
        `);
    }
});

app.listen(port, () => {
    console.log(`\n⚡ MATRIX CONTROL SYSTEM ACTIVE: http://localhost:${port}`);
    console.log(`🔮 SYSTEM READY FOR MATRIX ACCESS\n`);
});
