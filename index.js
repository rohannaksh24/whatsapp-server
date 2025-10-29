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
let connectionStatus = "Initializing WhatsApp...";
let pairCodeData = null;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection with pair code focus
const initializeWhatsApp = async () => {
  try {
    console.log('🔧 Setting up WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    MznKing = makeWASocket({
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false, // QR code disable
      auth: state,
      browser: ['Chrome', 'Windows', '10.0.0'],
    });

    MznKing.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect } = update;
      
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ CONNECTED TO WHATSAPP";
        pairCodeData = null;
        console.log("🎉 WHATSAPP CONNECTED SUCCESSFULLY!");
      }
      
      if (connection === "close") {
        isConnected = false;
        connectionStatus = "❌ DISCONNECTED";
        
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (shouldReconnect) {
          console.log("🔄 Reconnecting...");
          connectionStatus = "🔄 RECONNECTING";
          setTimeout(() => initializeWhatsApp(), 3000);
        } else {
          console.log("❌ Logged out. Please pair again.");
          connectionStatus = "❌ LOGGED OUT";
        }
      }
      
      if (connection === "connecting") {
        connectionStatus = "🔄 CONNECTING TO WHATSAPP...";
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

// WORKING PAIR CODE FUNCTION
app.post('/generate-pairing-code', async (req, res) => {
  try {
    const phoneNumber = req.body.phoneNumber;
    
    if (!phoneNumber) {
      return res.send({ 
        status: 'error', 
        message: '📱 Phone number is required' 
      });
    }

    // Clean and validate number
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    if (cleanNumber.length < 10) {
      return res.send({ 
        status: 'error', 
        message: '❌ Please enter a valid phone number (at least 10 digits)' 
      });
    }

    console.log('🔑 Requesting pair code for:', cleanNumber);

    // Check if client is ready
    if (!MznKing) {
      return res.send({ 
        status: 'error', 
        message: '⏳ WhatsApp client is initializing. Please wait 10 seconds and try again.' 
      });
    }

    // If already connected
    if (isConnected) {
      return res.send({ 
        status: 'success', 
        message: '✅ Already connected to WhatsApp! You can start sending messages.' 
      });
    }

    // Generate pair code with timeout
    console.log('⏳ Generating pair code...');
    
    const pairCode = await MznKing.requestPairingCode(cleanNumber);
    
    console.log('✅ Pair code generated successfully:', pairCode);
    
    // Store pair code data
    pairCodeData = {
      pairCode: pairCode,
      phoneNumber: cleanNumber,
      timestamp: new Date(),
      attempts: 0
    };
    
    res.send({ 
      status: 'success', 
      pairCode: pairCode,
      message: `✅ PAIR CODE: ${pairCode}`
    });
    
  } catch (error) {
    console.error('❌ Pair code error:', error.message);
    
    let errorMessage = 'Failed to generate pair code';
    
    if (error.message.includes('not connected')) {
      errorMessage = '⚠️ WhatsApp not ready. Wait 10 seconds and try again.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = '⏳ Too many attempts. Wait 5 minutes before trying again.';
    } else if (error.message.includes('invalid')) {
      errorMessage = '❌ Invalid phone number format. Use country code + number.';
    } else if (error.message.includes('timeout')) {
      errorMessage = '⏰ Request timeout. Please try again.';
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
    <title>WhatsApp Server - Pair Code</title>
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
        border-left: 4px solid ${isConnected ? '#28a745' : '#ffc107'};
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
        background: #667eea;
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
      .success { color: #28a745; }
      .error { color: #dc3545; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🌷 MR AAHAN WHATSAPP SERVER 🌷</h1>
        <p>Pair Code Method - 100% Working</p>
      </div>

      <div class="status">
        🔄 Status: ${connectionStatus}
      </div>

      <div class="instructions">
        <strong>📋 HOW TO CONNECT:</strong><br>
        1. Enter your WhatsApp number with country code<br>
        2. Click "GET PAIR CODE" button<br>
        3. Copy the generated pair code<br>
        4. Open WhatsApp → Settings → Linked Devices → Link a Device<br>
        5. Enter the pair code when prompted<br>
        6. Wait for "CONNECTED" status
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
        <p style="font-size: 24px; font-weight: bold; margin: 10px 0;">${pairCodeData.pairCode}</p>
        <p>Enter this code in WhatsApp Linked Devices</p>
        <p><small>Generated for: ${pairCodeData.phoneNumber}</small></p>
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
        © 2024 MR AAHAN - WhatsApp Bulk Messenger
      </div>
    </div>

    <script>
      // Auto refresh every 8 seconds to update status
      setTimeout(() => {
        window.location.reload();
      }, 8000);

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
  console.log(`📱 WHATSAPP PAIR CODE SYSTEM READY`);
  console.log(`💡 Use the web interface to generate pair codes\n`);
});
