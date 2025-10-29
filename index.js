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
let pairCodeData = null;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection setup - SIMPLIFIED AND FIXED
const initializeWhatsApp = async () => {
  try {
    console.log('🚀 Initializing WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    MznKing = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['Chrome', 'Windows', '10.0.0'],
    });

    MznKing.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;
      
      // Handle QR Code
      if (qr) {
        qrCode = qr;
        connectionStatus = "QR Code Ready - Scan with WhatsApp";
        console.log('\n📱 QR CODE RECEIVED - SCAN WITH WHATSAPP');
        qrcode.generate(qr, { small: true });
        console.log('Scan the QR code above with your WhatsApp mobile app\n');
      }
      
      // Handle connection open
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ Connected";
        qrCode = null;
        pairCodeData = null;
        console.log("✅ WhatsApp connected successfully!");
      }
      
      // Handle connection close
      if (connection === "close") {
        isConnected = false;
        connectionStatus = "❌ Disconnected";
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log("🔄 Reconnecting in 3 seconds...");
          connectionStatus = "🔄 Reconnecting...";
          setTimeout(() => initializeWhatsApp(), 3000);
        } else {
          console.log("❌ Connection closed. Manual restart required.");
          connectionStatus = "❌ Logged Out - Restart Required";
        }
      }
      
      // Handle connecting state
      if (connection === "connecting") {
        connectionStatus = "🔄 Connecting...";
      }
    });

    MznKing.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ Setup error:', error);
    connectionStatus = "❌ Connection Failed";
    setTimeout(() => initializeWhatsApp(), 5000);
  }
};

// Initialize WhatsApp
initializeWhatsApp();

function generateStopKey() {
  return 'AAHAN-' + Math.floor(100000 + Math.random() * 900000);
}

// Simple and reliable pairing code function
app.post('/generate-pairing-code', async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;
    
    if (!phoneNumber) {
      return res.send({ 
        status: 'error', 
        message: 'Phone number is required' 
      });
    }

    // Clean phone number
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // Basic validation
    if (cleanNumber.length < 10) {
      return res.send({ 
        status: 'error', 
        message: 'Please enter a valid phone number' 
      });
    }

    console.log('📞 Requesting pairing code for:', cleanNumber);
    
    if (!MznKing) {
      return res.send({ 
        status: 'error', 
        message: 'WhatsApp client not ready. Please wait...' 
      });
    }

    // If already connected, show message
    if (isConnected) {
      return res.send({ 
        status: 'success', 
        message: '✅ Already connected to WhatsApp! No pairing needed.' 
      });
    }

    // If QR code is available, suggest scanning instead
    if (qrCode) {
      return res.send({ 
        status: 'info', 
        message: '📱 QR Code is available. Please scan it instead of using pair code.' 
      });
    }

    // Try to get pairing code with simple approach
    try {
      const pairCode = await MznKing.requestPairingCode(cleanNumber);
      console.log('✅ Pairing code generated:', pairCode);
      
      pairCodeData = {
        pairCode: pairCode,
        phoneNumber: cleanNumber,
        timestamp: new Date()
      };
      
      res.send({ 
        status: 'success', 
        pairCode: pairCode,
        message: `Pair code: ${pairCode} - Enter in WhatsApp Linked Devices`
      });
      
    } catch (pairError) {
      console.error('Pair code error:', pairError);
      
      // If pair code fails, suggest QR code method
      return res.send({ 
        status: 'error', 
        message: 'Pair code failed. Please use QR code method from terminal.' 
      });
    }
    
  } catch (error) {
    console.error('❌ General error:', error);
    res.send({ 
      status: 'error', 
      message: 'System error. Please try QR code method.' 
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
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
        padding: 20px;
      }
      .container {
        max-width: 500px;
        margin: 0 auto;
        background: rgba(255, 255, 255, 0.95);
        padding: 30px;
        border-radius: 20px;
        box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #333;
        font-size: 24px;
        margin-bottom: 10px;
      }
      .status-container {
        background: #f8f9fa;
        padding: 15px;
        border-radius: 10px;
        margin-bottom: 20px;
        text-align: center;
        border-left: 4px solid #28a745;
      }
      .status-disconnected {
        border-left-color: #dc3545;
        background: #ffe6e6;
      }
      .status-connecting {
        border-left-color: #ffc107;
        background: #fff3cd;
      }
      .form-group {
        margin-bottom: 20px;
      }
      label {
        display: block;
        margin-bottom: 8px;
        font-weight: bold;
        color: #333;
      }
      input, button {
        width: 100%;
        padding: 12px 15px;
        border: 2px solid #e1e5e9;
        border-radius: 10px;
        font-size: 16px;
        transition: all 0.3s ease;
      }
      input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
      }
      button {
        background: linear-gradient(45deg, #667eea, #764ba2);
        color: white;
        border: none;
        cursor: pointer;
        font-weight: bold;
        margin-top: 10px;
      }
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
      }
      .btn-pair { background: linear-gradient(45deg, #ffd700, #ffa500); color: #000; }
      .btn-start { background: linear-gradient(45deg, #00b894, #00a085); }
      .btn-stop { background: linear-gradient(45deg, #ff7675, #d63031); }
      .stop-key {
        background: #fff3cd;
        padding: 15px;
        border-radius: 10px;
        margin-top: 20px;
        border-left: 4px solid #ffc107;
      }
      .pair-code-result {
        background: #d4edda;
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        text-align: center;
        border-left: 4px solid #28a745;
      }
      .error-message {
        background: #f8d7da;
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        text-align: center;
        border-left: 4px solid #dc3545;
      }
      .info-message {
        background: #d1ecf1;
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        text-align: center;
        border-left: 4px solid #17a2b8;
      }
      .instructions {
        background: #e2e3e5;
        padding: 15px;
        border-radius: 10px;
        margin: 15px 0;
        font-size: 14px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌷 MR AAHAN WP SERVER 🌷</h1>
        <p>WhatsApp Messaging Server</p>
      </div>

      <div class="status-container ${isConnected ? '' : !qrCode ? 'status-disconnected' : 'status-connecting'}">
        <strong>Status:</strong> ${connectionStatus}
        ${qrCode ? '<p>📱 QR Code available in terminal - Scan with WhatsApp</p>' : ''}
      </div>

      <div class="instructions">
        <strong>📝 Instructions:</strong><br>
        1. Check terminal for QR code and scan it<br>
        2. OR use pair code method below<br>
        3. Once connected, upload messages and start sending
      </div>

      <form action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label for="phoneNumber">📱 Your Phone Number:</label>
          <input type="text" id="phoneNumber" name="phoneNumber" placeholder="91XXXXXXXXXX" required />
        </div>
        <button type="submit" class="btn-pair">🔗 GENERATE PAIR CODE</button>
      </form>

      ${pairCodeData ? `
      <div class="pair-code-result">
        <h3>✅ Pair Code Generated!</h3>
        <p><strong>Code: ${pairCodeData.pairCode}</strong></p>
        <p>Go to WhatsApp → Settings → Linked Devices → Link a Device</p>
        <p>Enter this code when prompted</p>
      </div>
      ` : ''}

      <form action="/send-messages" method="post" enctype="multipart/form-data">
        <div class="form-group">
          <label for="targetsInput">🎯 Target Numbers/Groups:</label>
          <input type="text" id="targetsInput" name="targetsInput" placeholder="91XXXXXXXXXX, group-id@g.us" required />
        </div>
        
        <div class="form-group">
          <label for="messageFile">📄 Message File (TXT):</label>
          <input type="file" id="messageFile" name="messageFile" accept=".txt" required />
        </div>
        
        <div class="form-group">
          <label for="haterNameInput">👤 Hater's Name:</label>
          <input type="text" id="haterNameInput" name="haterNameInput" placeholder="Enter name" required />
        </div>
        
        <div class="form-group">
          <label for="delayTime">⏰ Delay (seconds):</label>
          <input type="number" id="delayTime" name="delayTime" min="5" value="10" required />
        </div>
        
        <button type="submit" class="btn-start" ${!isConnected ? 'disabled style="opacity:0.6;"' : ''}>🚀 START SENDING</button>
        ${!isConnected ? '<p style="color:red; text-align:center; margin-top:10px;">⚠️ Connect WhatsApp first</p>' : ''}
      </form>

      <form action="/stop" method="post">
        <div class="form-group">
          <label for="stopKeyInput">🛑 Stop Key:</label>
          <input type="text" id="stopKeyInput" name="stopKeyInput" placeholder="Enter stop key to cancel" />
        </div>
        <button type="submit" class="btn-stop">⏹️ STOP SENDING</button>
      </form>

      ${showStopKey ? `
      <div class="stop-key">
        <label>🔑 Current Stop Key:</label>
        <input type="text" value="${stopKey}" readonly style="background: #fff; cursor: copy;" onclick="this.select()" />
        <small>Copy this key to stop sending messages</small>
      </div>` : ''}

      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
        © 2024 MR AAHAN - WhatsApp Server
      </div>
    </div>

    <script>
      // Simple auto-refresh every 8 seconds
      setTimeout(() => {
        window.location.reload();
      }, 8000);

      // Focus management
      document.addEventListener('DOMContentLoaded', function() {
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          // Save value on input
          input.addEventListener('input', function() {
            localStorage.setItem(input.id, input.value);
          });
          
          // Load saved value
          const savedValue = localStorage.getItem(input.id);
          if (savedValue) {
            input.value = savedValue;
          }
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

    // Validation
    if (!targetsInput || !delayTime || !haterNameInput) {
      throw new Error('All fields are required');
    }

    const delayNum = parseInt(delayTime);
    if (delayNum < 5) {
      throw new Error('Delay must be at least 5 seconds');
    }

    if (!req.file) {
      throw new Error('Please upload a message file');
    }

    // Check connection
    if (!isConnected) {
      throw new Error('WhatsApp is not connected. Please connect first.');
    }

    // Read messages
    const fileContent = req.file.buffer.toString('utf-8');
    messages = fileContent.split('\n')
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
      throw new Error('No valid targets provided');
    }

    haterName = haterNameInput;
    intervalTime = delayNum;
    stopKey = generateStopKey();
    sendingActive = true;

    // Clear existing interval
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    console.log(`🚀 Starting message sending:
      Targets: ${targets.length}
      Messages: ${messages.length}
      Delay: ${intervalTime}s
      Stop Key: ${stopKey}`);

    let msgIndex = 0;

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        console.log('✅ Message sending completed');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      console.log(`📤 Sending ${msgIndex + 1}/${messages.length}: "${fullMessage}"`);
      
      for (const target of targets) {
        try {
          let targetJid;
          if (target.includes('@g.us')) {
            targetJid = target;
          } else {
            const cleanTarget = target.replace(/[^0-9]/g, '');
            targetJid = `${cleanTarget}@s.whatsapp.net`;
          }

          await MznKing.sendMessage(targetJid, { text: fullMessage });
          console.log(`✅ Sent to ${target}`);
        } catch (err) {
          console.log(`❌ Failed to send to ${target}: ${err.message}`);
        }
        await delay(1000);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    console.error('❌ Send messages error:', error);
    res.send(`<script>alert('Error: ${error.message}'); window.location.href='/';</script>`);
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    console.log('🛑 Message sending stopped by user');
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:green;">✅ Sending Stopped Successfully</h2>
        <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">← Back to Home</a>
      </div>
    `);
  } else {
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:red;">❌ Invalid Stop Key</h2>
        <p>Please check the stop key and try again</p>
        <a href="/" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#007bff; color:white; text-decoration:none; border-radius:5px;">← Back to Home</a>
      </div>
    `);
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 WhatsApp connection starting...`);
  console.log(`🌐 Open http://localhost:${port} to access the panel`);
  console.log(`\n💡 IMPORTANT: Check terminal for QR code to connect WhatsApp\n`);
});
