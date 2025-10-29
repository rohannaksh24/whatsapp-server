const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require('qrcode-terminal');
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
let connectionStatus = "Initializing...";
let qrCode = null;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection setup - SIMPLE AND RELIABLE
const initializeWhatsApp = async () => {
  try {
    console.log('🚀 Starting WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    MznKing = makeWASocket({
      logger: pino({ level: 'fatal' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['Chrome', 'Windows', '10.0.0'],
    });

    MznKing.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // QR Code Handler
      if (qr) {
        qrCode = qr;
        connectionStatus = "QR Code Ready";
        console.log('\n✨ SCAN THIS QR CODE WITH YOUR WHATSAPP:');
        qrcode.generate(qr, { small: true });
        console.log('\n📱 Open WhatsApp → Settings → Linked Devices → Scan QR Code\n');
      }
      
      // Connection Open
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ CONNECTED";
        qrCode = null;
        console.log("🎉 WHATSAPP CONNECTED SUCCESSFULLY!");
        console.log("✅ You can now send messages");
      }
      
      // Connection Close
      if (connection === "close") {
        isConnected = false;
        connectionStatus = "❌ DISCONNECTED";
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log("🔄 Reconnecting...");
          connectionStatus = "🔄 RECONNECTING";
          setTimeout(() => initializeWhatsApp(), 3000);
        } else {
          console.log("❌ Logged out. Restart required.");
          connectionStatus = "❌ LOGGED OUT";
        }
      }
    });

    MznKing.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ Connection error:', error.message);
    connectionStatus = "❌ CONNECTION FAILED";
    setTimeout(() => initializeWhatsApp(), 5000);
  }
};

// Start WhatsApp
initializeWhatsApp();

function generateStopKey() {
  return 'AAHAN-' + Math.floor(100000 + Math.random() * 900000);
}

// SIMPLE PAIR CODE - REMOVED COMPLEX LOGIC
app.post('/generate-pairing-code', async (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  
  if (!phoneNumber) {
    return res.send({ 
      status: 'error', 
      message: 'Phone number is required' 
    });
  }

  // Clean number
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  
  if (cleanNumber.length < 10) {
    return res.send({ 
      status: 'error', 
      message: 'Enter valid phone number' 
    });
  }

  console.log('🔑 Requesting pair code for:', cleanNumber);

  // If already connected
  if (isConnected) {
    return res.send({ 
      status: 'success', 
      message: '✅ Already connected! No pair code needed.' 
    });
  }

  // If QR code available, suggest scanning
  if (qrCode) {
    return res.send({ 
      status: 'info', 
      message: '📱 QR Code available in terminal. Please scan it for faster connection.' 
    });
  }

  // Simple pair code request
  try {
    const pairCode = await MznKing.requestPairingCode(cleanNumber);
    console.log('✅ Pair code generated:', pairCode);
    
    res.send({ 
      status: 'success', 
      pairCode: pairCode,
      message: `Pair Code: ${pairCode} - Enter in WhatsApp Linked Devices`
    });
  } catch (error) {
    console.error('❌ Pair code failed:', error.message);
    res.send({ 
      status: 'error', 
      message: 'Pair code failed. Please use QR code method from terminal.' 
    });
  }
});

app.get('/', (req, res) => {
  const showStopKey = sendingActive && stopKey;

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>WhatsApp Server</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
      }
      .container {
        max-width: 500px;
        margin: 0 auto;
        background: white;
        padding: 25px;
        border-radius: 15px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      }
      .header {
        text-align: center;
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 2px solid #eee;
      }
      .header h1 {
        color: #333;
        font-size: 22px;
        margin-bottom: 5px;
      }
      .status {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
        font-weight: bold;
        border-left: 4px solid ${isConnected ? '#28a745' : (!qrCode ? '#dc3545' : '#ffc107')};
      }
      .form-group {
        margin-bottom: 15px;
      }
      label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
        color: #333;
      }
      input, button {
        width: 100%;
        padding: 10px 12px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 14px;
      }
      input:focus {
        outline: none;
        border-color: #667eea;
      }
      button {
        background: #667eea;
        color: white;
        border: none;
        cursor: pointer;
        font-weight: bold;
        margin-top: 8px;
      }
      button:hover {
        background: #5a6fd8;
      }
      .btn-pair { background: #ffa500; }
      .btn-start { background: #28a745; }
      .btn-stop { background: #dc3545; }
      .btn-pair:hover { background: #e59400; }
      .btn-start:hover { background: #218838; }
      .btn-stop:hover { background: #c82333; }
      .stop-key {
        background: #fff3cd;
        padding: 12px;
        border-radius: 8px;
        margin-top: 15px;
        border-left: 4px solid #ffc107;
      }
      .info-box {
        background: #d1ecf1;
        padding: 12px;
        border-radius: 8px;
        margin: 12px 0;
        font-size: 14px;
        border-left: 4px solid #17a2b8;
      }
      .success-box {
        background: #d4edda;
        padding: 12px;
        border-radius: 8px;
        margin: 12px 0;
        border-left: 4px solid #28a745;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌷 MR AAHAN WP SERVER 🌷</h1>
        <p>WhatsApp Messaging Server</p>
      </div>

      <div class="status">
        🔄 Status: ${connectionStatus}
      </div>

      <div class="info-box">
        <strong>💡 CONNECTION GUIDE:</strong><br>
        1. Check TERMINAL for QR Code<br>
        2. Scan QR with WhatsApp<br>
        3. OR Use Pair Code method<br>
        4. Wait for "CONNECTED" status
      </div>

      <form action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label>📱 Phone Number:</label>
          <input type="text" name="phoneNumber" placeholder="91XXXXXXXXXX" required />
        </div>
        <button type="submit" class="btn-pair">🔗 GET PAIR CODE</button>
      </form>

      <form action="/send-messages" method="post" enctype="multipart/form-data">
        <div class="form-group">
          <label>🎯 Target Numbers:</label>
          <input type="text" name="targetsInput" placeholder="91XXXXXXXXXX, group-id@g.us" required />
        </div>
        
        <div class="form-group">
          <label>📄 Message File (TXT):</label>
          <input type="file" name="messageFile" accept=".txt" required />
        </div>
        
        <div class="form-group">
          <label>👤 Hater Name:</label>
          <input type="text" name="haterNameInput" placeholder="Enter name" required />
        </div>
        
        <div class="form-group">
          <label>⏰ Delay (seconds):</label>
          <input type="number" name="delayTime" min="5" value="10" required />
        </div>
        
        <button type="submit" class="btn-start" ${!isConnected ? 'disabled style="opacity:0.5;"' : ''}>
          🚀 START SENDING ${!isConnected ? '(Connect First)' : ''}
        </button>
      </form>

      <form action="/stop" method="post">
        <div class="form-group">
          <label>🛑 Stop Key:</label>
          <input type="text" name="stopKeyInput" placeholder="Enter stop key" />
        </div>
        <button type="submit" class="btn-stop">⏹️ STOP SENDING</button>
      </form>

      ${showStopKey ? `
      <div class="stop-key">
        <label>🔑 Your Stop Key:</label>
        <input type="text" value="${stopKey}" readonly style="background:white; font-weight:bold;" />
        <small>Copy this to stop sending</small>
      </div>` : ''}

      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
        © 2024 MR AAHAN
      </div>
    </div>

    <script>
      // Simple refresh every 10 seconds
      setTimeout(() => { location.reload(); }, 10000);
      
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
      });
    </script>
  </body>
  </html>
  `);
});

app.post('/send-messages', upload.single('messageFile'), async (req, res) => {
  try {
    const { targetsInput, delayTime, haterNameInput } = req.body;

    // Basic validation
    if (!targetsInput || !delayTime || !haterNameInput || !req.file) {
      throw new Error('All fields are required');
    }

    if (parseInt(delayTime) < 5) {
      throw new Error('Delay must be at least 5 seconds');
    }

    if (!isConnected) {
      throw new Error('WhatsApp not connected. Please connect first.');
    }

    // Read messages
    messages = req.file.buffer.toString('utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (messages.length === 0) {
      throw new Error('Message file is empty');
    }

    // Process targets
    targets = targetsInput.split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    if (targets.length === 0) {
      throw new Error('No valid targets');
    }

    haterName = haterNameInput;
    intervalTime = parseInt(delayTime);
    stopKey = generateStopKey();
    sendingActive = true;

    // Clear previous interval
    if (currentInterval) clearInterval(currentInterval);

    console.log(`\n🚀 STARTING MESSAGE BLAST:
    📱 Targets: ${targets.length}
    💬 Messages: ${messages.length}
    ⏰ Delay: ${intervalTime}s
    🔑 Stop Key: ${stopKey}\n`);

    let msgIndex = 0;

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        console.log('✅ MESSAGE SENDING COMPLETED');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      console.log(`📤 Sending ${msgIndex + 1}/${messages.length}: "${fullMessage}"`);
      
      for (const target of targets) {
        try {
          let targetJid = target.includes('@g.us') ? target : `${target.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
          await MznKing.sendMessage(targetJid, { text: fullMessage });
          console.log(`   ✅ Sent to ${target}`);
        } catch (err) {
          console.log(`   ❌ Failed ${target}: ${err.message}`);
        }
        await delay(1000);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    console.error('❌ Error:', error.message);
    res.send(`<script>alert("Error: ${error.message}"); window.location.href="/";</script>`);
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    console.log('🛑 MESSAGES STOPPED BY USER');
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:green;">✅ STOPPED SUCCESSFULLY</h2>
        <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">← Back</a>
      </div>
    `);
  } else {
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:red;">❌ WRONG STOP KEY</h2>
        <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">← Back</a>
      </div>
    `);
  }
});

app.listen(port, () => {
  console.log(`\n✨ SERVER STARTED: http://localhost:${port}`);
  console.log(`📱 WHATSAPP CONNECTION STARTING...`);
  console.log(`💡 Check terminal for QR Code to connect\n`);
});
