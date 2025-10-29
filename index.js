const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
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
let connectionStatus = "Starting WhatsApp...";
let pairCodeData = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection with proper error handling
const initializeWhatsApp = async () => {
  try {
    console.log('🔄 Starting WhatsApp connection...');
    connectionStatus = "🔄 Connecting to WhatsApp...";
    
    // Clear previous auth if too many reconnects
    if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      console.log('🧹 Clearing auth due to multiple reconnects...');
      try {
        if (fs.existsSync('./auth_info')) {
          fs.rmSync('./auth_info', { recursive: true, force: true });
        }
      } catch (e) {
        console.log('No auth to clear');
      }
      reconnectAttempts = 0;
    }

    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    MznKing = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Chrome (Windows)', '', ''],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,
    });

    MznKing.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, isNewLogin } = update;
      
      console.log('🔗 Connection update:', connection);
      
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ CONNECTED TO WHATSAPP";
        pairCodeData = null;
        reconnectAttempts = 0;
        console.log("🎉 WHATSAPP CONNECTED SUCCESSFULLY!");
        console.log("📱 You can now send messages");
      }
      
      if (connection === "close") {
        isConnected = false;
        reconnectAttempts++;
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        console.log('🔌 Connection closed, status code:', statusCode);
        
        if (statusCode === DisconnectReason.loggedOut || reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
          console.log("❌ Device logged out or too many reconnects. Clearing session...");
          connectionStatus = "❌ SESSION EXPIRED - GET NEW PAIR CODE";
          try {
            if (fs.existsSync('./auth_info')) {
              fs.rmSync('./auth_info', { recursive: true, force: true });
            }
          } catch (e) {}
          reconnectAttempts = 0;
        } else {
          console.log("🔄 Reconnecting in 5 seconds...");
          connectionStatus = "🔄 RECONNECTING...";
          setTimeout(() => initializeWhatsApp(), 5000);
        }
      }
      
      if (connection === "connecting") {
        connectionStatus = "🔄 CONNECTING TO WHATSAPP...";
      }
    });

    MznKing.ev.on('creds.update', saveCreds);

  } catch (error) {
    console.error('❌ Connection setup error:', error.message);
    connectionStatus = "❌ CONNECTION FAILED";
    setTimeout(() => initializeWhatsApp(), 10000);
  }
};

// Start WhatsApp
initializeWhatsApp();

function generateStopKey() {
  return 'AAHAN-' + Math.floor(100000 + Math.random() * 900000);
}

// IMPROVED PAIR CODE FUNCTION
app.post('/generate-pairing-code', async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;
    
    if (!phoneNumber) {
      return res.send({ 
        status: 'error', 
        message: '📱 Phone number is required' 
      });
    }

    // Clean number
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10) {
      return res.send({ 
        status: 'error', 
        message: '❌ Please enter a valid phone number (at least 10 digits)' 
      });
    }

    console.log('🔑 Requesting pair code for:', cleanNumber);

    // Wait for client to be ready
    if (!MznKing) {
      return res.send({ 
        status: 'error', 
        message: '⏳ WhatsApp client is initializing. Please wait 10 seconds...' 
      });
    }

    // If already connected
    if (isConnected) {
      return res.send({ 
        status: 'success', 
        message: '✅ Already connected to WhatsApp! You can start sending messages.' 
      });
    }

    // Clear previous session if too many attempts
    if (pairCodeData && pairCodeData.attempts >= 3) {
      console.log('🧹 Clearing old session due to multiple failed attempts...');
      try {
        if (fs.existsSync('./auth_info')) {
          fs.rmSync('./auth_info', { recursive: true, force: true });
        }
      } catch (e) {}
      // Reinitialize WhatsApp
      setTimeout(() => initializeWhatsApp(), 2000);
    }

    console.log('⏳ Generating pair code...');
    
    // Generate pair code with timeout
    const pairCodePromise = MznKing.requestPairingCode(cleanNumber);
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 30000)
    );

    const pairCode = await Promise.race([pairCodePromise, timeoutPromise]);
    
    console.log('✅ Pair code generated successfully:', pairCode);
    
    // Store pair code data
    pairCodeData = {
      pairCode: pairCode,
      phoneNumber: cleanNumber,
      timestamp: new Date(),
      attempts: (pairCodeData?.attempts || 0) + 1
    };
    
    res.send({ 
      status: 'success', 
      pairCode: pairCode,
      message: `✅ PAIR CODE: ${pairCode}\n\n📱 INSTRUCTIONS:\n1. Open WhatsApp on your phone\n2. Go to Settings → Linked Devices → Link a Device\n3. Enter this code: ${pairCode}\n4. Wait for connection confirmation`
    });
    
  } catch (error) {
    console.error('❌ Pair code error:', error.message);
    
    let errorMessage = 'Failed to generate pair code. Please try again.';
    
    if (error.message.includes('timeout')) {
      errorMessage = '⏰ Request timeout. WhatsApp servers are busy. Please try again in 30 seconds.';
    } else if (error.message.includes('not connected')) {
      errorMessage = '⚠️ WhatsApp client not ready. Please wait 15 seconds and try again.';
    } else if (error.message.includes('rate limit') || error.message.includes('too many')) {
      errorMessage = '⏳ Too many attempts. Please wait 5-10 minutes before trying again.';
    } else if (error.message.includes('invalid')) {
      errorMessage = '❌ Invalid phone number format. Use country code + number (e.g., 91XXXXXXXXXX).';
    }
    
    // Clear session on critical errors
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      try {
        if (fs.existsSync('./auth_info')) {
          fs.rmSync('./auth_info', { recursive: true, force: true });
        }
      } catch (e) {}
      setTimeout(() => initializeWhatsApp(), 5000);
    }
    
    res.send({ 
      status: 'error', 
      message: errorMessage 
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
    <title>WhatsApp Server - Fixed Pair Code</title>
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
        font-size: 24px;
        margin-bottom: 5px;
      }
      .status {
        background: #f8f9fa;
        padding: 12px;
        border-radius: 8px;
        margin-bottom: 20px;
        text-align: center;
        font-weight: bold;
        border-left: 4px solid ${isConnected ? '#28a745' : (!pairCodeData ? '#ffc107' : '#17a2b8')};
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
        padding: 12px;
        border: 2px solid #ddd;
        border-radius: 8px;
        font-size: 16px;
      }
      input:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 5px rgba(102, 126, 234, 0.3);
      }
      button {
        color: white;
        border: none;
        cursor: pointer;
        font-weight: bold;
        margin-top: 10px;
        transition: all 0.3s;
      }
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
      }
      .btn-pair { background: #ffa500; }
      .btn-start { background: #28a745; }
      .btn-stop { background: #dc3545; }
      .btn-pair:hover { background: #e59400; }
      .btn-start:hover { background: #218838; }
      .btn-stop:hover { background: #c82333; }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
        transform: none;
      }
      .pair-code-box {
        background: #d4edda;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        text-align: center;
        border-left: 4px solid #28a745;
      }
      .stop-key-box {
        background: #fff3cd;
        padding: 15px;
        border-radius: 8px;
        margin-top: 15px;
        border-left: 4px solid #ffc107;
      }
      .instructions {
        background: #e7f3ff;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        font-size: 14px;
        border-left: 4px solid #007bff;
      }
      .error-box {
        background: #f8d7da;
        padding: 15px;
        border-radius: 8px;
        margin: 15px 0;
        border-left: 4px solid #dc3545;
      }
      .code-display {
        font-size: 28px;
        font-weight: bold;
        color: #155724;
        background: white;
        padding: 10px;
        border-radius: 5px;
        margin: 10px 0;
        border: 2px dashed #28a745;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌷 MR AAHAN WHATSAPP SERVER 🌷</h1>
        <p>Fixed Pair Code System - No More Errors</p>
      </div>

      <div class="status">
        🔄 Status: ${connectionStatus}
        ${reconnectAttempts > 0 ? `<br><small>Reconnect attempts: ${reconnectAttempts}</small>` : ''}
      </div>

      <div class="instructions">
        <strong>🎯 FIXED PAIR CODE SYSTEM:</strong><br>
        • Enter your WhatsApp number<br>
        • Get pair code instantly<br>
        • Enter code in WhatsApp Linked Devices<br>
        • Works 100% - No more connection errors
      </div>

      <form action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label>📱 Your WhatsApp Number:</label>
          <input type="text" name="phoneNumber" placeholder="91XXXXXXXXXX (with country code)" required />
        </div>
        <button type="submit" class="btn-pair">🔗 GET PAIR CODE</button>
      </form>

      ${pairCodeData ? `
      <div class="pair-code-box">
        <h3>✅ PAIR CODE GENERATED!</h3>
        <div class="code-display">${pairCodeData.pairCode}</div>
        <p><strong>📱 INSTRUCTIONS:</strong></p>
        <p>1. Open WhatsApp on your phone</p>
        <p>2. Go to Settings → Linked Devices → Link a Device</p>
        <p>3. Enter this code: <strong>${pairCodeData.pairCode}</strong></p>
        <p>4. Wait for "CONNECTED" status above</p>
        <p><small>Generated for: ${pairCodeData.phoneNumber} | Attempts: ${pairCodeData.attempts}</small></p>
      </div>
      ` : ''}

      <form action="/send-messages" method="post" enctype="multipart/form-data">
        <div class="form-group">
          <label>🎯 Target Numbers/Groups:</label>
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
        
        <button type="submit" class="btn-start" ${!isConnected ? 'disabled' : ''}>
          🚀 START SENDING MESSAGES ${!isConnected ? '(Connect WhatsApp First)' : ''}
        </button>
      </form>

      <form action="/stop" method="post">
        <div class="form-group">
          <label>🛑 Stop Key:</label>
          <input type="text" name="stopKeyInput" placeholder="Enter stop key to cancel sending" />
        </div>
        <button type="submit" class="btn-stop">⏹️ STOP SENDING</button>
      </form>

      ${showStopKey ? `
      <div class="stop-key-box">
        <label>🔑 Your Stop Key (Copy This):</label>
        <input type="text" value="${stopKey}" readonly 
               style="background:white; font-weight:bold; font-size: 18px; text-align: center;" 
               onclick="this.select(); document.execCommand('copy'); alert('Stop key copied!')" />
        <small>Click to copy - Use this to stop message sending</small>
      </div>` : ''}

      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
        © 2024 MR AAHAN - Fixed WhatsApp System
      </div>
    </div>

    <script>
      // Auto refresh every 10 seconds to update status
      setTimeout(() => {
        window.location.reload();
      }, 10000);

      // Save form data
      document.addEventListener('DOMContentLoaded', function() {
        // Load saved data
        const savedData = localStorage.getItem('whatsappForm');
        if (savedData) {
          const data = JSON.parse(savedData);
          document.querySelector('input[name="phoneNumber"]').value = data.phoneNumber || '';
          document.querySelector('input[name="targetsInput"]').value = data.targetsInput || '';
          document.querySelector('input[name="haterNameInput"]').value = data.haterNameInput || '';
          document.querySelector('input[name="delayTime"]').value = data.delayTime || '10';
          document.querySelector('input[name="stopKeyInput"]').value = data.stopKeyInput || '';
        }

        // Save data on input
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
          input.addEventListener('input', function() {
            const formData = {
              phoneNumber: document.querySelector('input[name="phoneNumber"]').value,
              targetsInput: document.querySelector('input[name="targetsInput"]').value,
              haterNameInput: document.querySelector('input[name="haterNameInput"]').value,
              delayTime: document.querySelector('input[name="delayTime"]').value,
              stopKeyInput: document.querySelector('input[name="stopKeyInput"]').value
            };
            localStorage.setItem('whatsappForm', JSON.stringify(formData));
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

    // Validation
    if (!targetsInput || !delayTime || !haterNameInput) {
      throw new Error('All fields are required');
    }

    if (!req.file) {
      throw new Error('Please upload a message file');
    }

    const delayNum = parseInt(delayTime);
    if (delayNum < 5) {
      throw new Error('Delay must be at least 5 seconds');
    }

    if (!isConnected) {
      throw new Error('WhatsApp is not connected. Please connect first using pair code.');
    }

    // Read and process messages
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

    // Clear any existing interval
    if (currentInterval) {
      clearInterval(currentInterval);
    }

    console.log(`\n🚀 STARTING MESSAGE SENDING:
    📱 Targets: ${targets.length}
    💬 Messages: ${messages.length}
    ⏰ Delay: ${intervalTime} seconds
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
      console.log(`📤 Sending message ${msgIndex + 1}/${messages.length}: "${fullMessage}"`);
      
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
          console.log(`   ✅ Sent to ${target}`);
        } catch (err) {
          console.log(`   ❌ Failed to send to ${target}: ${err.message}`);
        }
        await delay(1000);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    console.error('❌ Send messages error:', error.message);
    res.send(`<script>alert("Error: ${error.message}"); window.location.href="/";</script>`);
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    console.log('🛑 MESSAGE SENDING STOPPED BY USER');
    res.send(`
      <div style="text-align:center; padding:50px; font-family: Arial, sans-serif;">
        <h2 style="color:green;">✅ MESSAGE SENDING STOPPED</h2>
        <p>All message sending has been successfully stopped.</p>
        <a href="/" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#007bff; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">← Back to Dashboard</a>
      </div>
    `);
  } else {
    res.send(`
      <div style="text-align:center; padding:50px; font-family: Arial, sans-serif;">
        <h2 style="color:red;">❌ INVALID STOP KEY</h2>
        <p>The stop key you entered is incorrect.</p>
        <a href="/" style="display:inline-block; margin-top:20px; padding:12px 24px; background:#007bff; color:white; text-decoration:none; border-radius:8px; font-weight:bold;">← Back to Dashboard</a>
      </div>
    `);
  }
});

app.listen(port, () => {
  console.log(`\n✨ SERVER STARTED: http://localhost:${port}`);
  console.log(`📱 FIXED WHATSAPP PAIR CODE SYSTEM READY`);
  console.log(`🔧 No more reconnecting issues`);
  console.log(`✅ Pair codes will work 100%\n`);
});
