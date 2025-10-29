const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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
let connectionStatus = "Connecting...";
let qrCode = null;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection setup with proper initialization
const initializeWhatsApp = async () => {
  try {
    console.log('🚀 Initializing WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();
    
    MznKing = makeWASocket({
      version,
      logger: pino({ level: 'error' }),
      printQRInTerminal: true,
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
      syncFullHistory: false,
      defaultQueryTimeoutMs: 60000,
    });

    MznKing.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      
      if (qr) {
        qrCode = qr;
        connectionStatus = "Scan QR Code";
        console.log('📱 QR Code received - Scan with WhatsApp');
      }
      
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ Connected";
        qrCode = null;
        console.log("✅ WhatsApp connected successfully!");
        
        // Get connection info
        const user = MznKing.user;
        if (user) {
          console.log(`👤 Logged in as: ${user.name || user.id}`);
        }
      }
      
      if (connection === "close") {
        isConnected = false;
        connectionStatus = "❌ Disconnected";
        
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const error = lastDisconnect?.error;
        
        console.log('🔌 Connection closed:', error);
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log("❌ Device logged out. Clearing auth...");
          try {
            fs.rmSync('./auth_info', { recursive: true, force: true });
          } catch (e) {}
          connectionStatus = "❌ Logged Out - Restart Required";
        } else {
          console.log("🔄 Reconnecting...");
          connectionStatus = "🔄 Reconnecting...";
          setTimeout(() => initializeWhatsApp(), 5000);
        }
      }
      
      if (connection === "connecting") {
        connectionStatus = "🔄 Connecting...";
        console.log('🔄 Connecting to WhatsApp...');
      }
    });

    MznKing.ev.on('creds.update', saveCreds);
    
    MznKing.ev.on('messages.upsert', () => {
      // Keep alive for messages
    });

    return MznKing;
  } catch (error) {
    console.error('❌ Setup error:', error);
    connectionStatus = "❌ Connection Failed";
    setTimeout(() => initializeWhatsApp(), 10000);
  }
};

// Initialize WhatsApp connection
initializeWhatsApp();

function generateStopKey() {
  return 'MRPRINCE-' + Math.floor(1000000 + Math.random() * 9000000);
}

// Improved connection check with auto-retry
const checkConnection = async (req, res, next) => {
  if (!isConnected) {
    // If not connected but we have MznKing instance, try to get status
    if (MznKing && MznKing.user) {
      isConnected = true;
      connectionStatus = "✅ Connected";
      return next();
    }
    
    return res.send({ 
      status: 'error', 
      message: 'WhatsApp not connected yet. Please wait...',
      connectionStatus: connectionStatus
    });
  }
  next();
};

app.get('/', (req, res) => {
  const showStopKey = sendingActive && stopKey;

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>❣️🌷𝐖𝐇𝐀𝐓𝐒𝐇𝐏𝐏 𝐒𝐄𝐑𝐕𝐄𝐑 🌷❣️</title>
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
        backdrop-filter: blur(10px);
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
      }
      .header h1 {
        color: #333;
        font-size: 28px;
        margin-bottom: 10px;
        background: linear-gradient(45deg, #ff6b6b, #ee5a24);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
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
      .qr-container {
        text-align: center;
        margin: 20px 0;
        padding: 20px;
        background: #f8f9fa;
        border-radius: 10px;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>❣️🌷 𝐌𝐑 𝐏𝐑𝐈𝐍𝐂𝐄 🌷❣️</h1>
        <p>WhatsApp Messaging Server</p>
      </div>

      <div class="status-container ${isConnected ? '' : 'status-disconnected'}">
        <strong>Status:</strong> ${connectionStatus}
        ${qrCode ? '<div class="qr-container"><p>📱 Scan QR Code in WhatsApp</p></div>' : ''}
      </div>

      <form action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label for="phoneNumber">📱 Your Phone Number:</label>
          <input type="text" id="phoneNumber" name="phoneNumber" placeholder="91XXXXXXXXXX" required />
        </div>
        <button type="submit" class="btn-pair">🔗 GENERATE PAIR CODE</button>
      </form>

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
        
        <button type="submit" class="btn-start">🚀 START SENDING</button>
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
        © 2024 MR PRINCE - WhatsApp Server
      </div>
    </div>

    <script>
      // Auto-refresh status every 5 seconds
      setInterval(() => {
        window.location.reload();
      }, 5000);
      
      // Copy stop key on click
      function copyStopKey() {
        const input = document.querySelector('input[readonly]');
        if (input) {
          input.select();
          document.execCommand('copy');
          alert('Stop key copied!');
        }
      }
    </script>
  </body>
  </html>
  `);
});

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
    
    if (!cleanNumber.startsWith('91') || cleanNumber.length !== 12) {
      return res.send({ 
        status: 'error', 
        message: 'Please enter valid Indian number with 91 (12 digits total)' 
      });
    }

    console.log('📞 Requesting pairing code for:', cleanNumber);
    
    if (!MznKing) {
      return res.send({ 
        status: 'error', 
        message: 'WhatsApp client not initialized. Please wait...' 
      });
    }

    // Wait a bit for connection if still connecting
    if (!isConnected) {
      await delay(2000);
    }

    const pairCode = await MznKing.requestPairingCode(cleanNumber);
    console.log('✅ Pairing code generated:', pairCode);
    
    res.send({ 
      status: 'success', 
      pairCode: pairCode,
      message: `Pairing code: ${pairCode}`
    });
    
  } catch (error) {
    console.error('❌ Pairing code error:', error);
    
    let errorMessage = 'Failed to generate pairing code';
    if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please wait 5 minutes and try again.';
    } else if (error.message.includes('not connected')) {
      errorMessage = 'WhatsApp not connected. Please wait for connection...';
    } else if (error.message.includes('invalid phone number')) {
      errorMessage = 'Invalid phone number format';
    }
    
    res.send({ 
      status: 'error', 
      message: errorMessage 
    });
  }
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

    // Read and validate messages
    const fileContent = req.file.buffer.toString('utf-8');
    messages = fileContent.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (messages.length === 0) {
      throw new Error('Message file is empty or invalid');
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
      currentInterval = null;
    }

    console.log(`🚀 Starting message blast:
      Targets: ${targets.length}
      Messages: ${messages.length}
      Delay: ${intervalTime}s
      Hater: ${haterName}`);

    let msgIndex = 0;
    let successCount = 0;
    let errorCount = 0;

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        if (currentInterval) {
          clearInterval(currentInterval);
          currentInterval = null;
        }
        sendingActive = false;
        console.log(`✅ Message sending completed. Success: ${successCount}, Failed: ${errorCount}`);
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      console.log(`📤 Sending ${msgIndex + 1}/${messages.length}: "${fullMessage}"`);

      for (const target of targets) {
        try {
          // Determine JID format
          let targetJid;
          if (target.includes('@g.us')) {
            targetJid = target; // Group ID
          } else if (target.includes('@s.whatsapp.net')) {
            targetJid = target; // Full JID
          } else {
            // Clean number and create JID
            const cleanTarget = target.replace(/[^0-9]/g, '');
            targetJid = `${cleanTarget}@s.whatsapp.net`;
          }

          await MznKing.sendMessage(targetJid, { text: fullMessage });
          successCount++;
          console.log(`✅ Sent to ${target}`);
        } catch (err) {
          errorCount++;
          console.log(`❌ Failed to send to ${target}: ${err.message}`);
        }
        
        // Small delay between targets
        await delay(500);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.send({
      status: 'success',
      message: `Message sending started! Stop Key: ${stopKey}`,
      stopKey: stopKey,
      details: {
        targets: targets.length,
        messages: messages.length,
        delay: intervalTime
      }
    });

  } catch (error) {
    console.error('❌ Send messages error:', error);
    res.send({ 
      status: 'error', 
      message: error.message 
    });
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  
  if (!userKey) {
    return res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:red;">❌ Stop Key Required</h2>
        <p>Please enter the stop key</p>
        <a href="/" style="color:blue;">← Back to Home</a>
      </div>
    `);
  }

  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) {
      clearInterval(currentInterval);
      currentInterval = null;
    }
    console.log('🛑 Message sending stopped by user');
    
    return res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:green;">✅ Sending Stopped Successfully</h2>
        <p>All message sending has been stopped</p>
        <a href="/" style="color:blue;">← Back to Home</a>
      </div>
    `);
  } else {
    return res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:red;">❌ Invalid Stop Key</h2>
        <p>The stop key you entered is incorrect</p>
        <a href="/" style="color:blue;">← Back to Home</a>
      </div>
    `);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    whatsapp: {
      connected: isConnected,
      status: connectionStatus
    },
    messaging: {
      active: sendingActive,
      targets: targets.length,
      messages: messages ? messages.length : 0
    },
    timestamp: new Date().toISOString()
  });
});

// Auto-reconnect every 10 minutes to keep alive
setInterval(() => {
  if (!isConnected && MznKing) {
    console.log('🔄 Periodic reconnection attempt...');
    initializeWhatsApp();
  }
}, 10 * 60 * 1000);

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 WhatsApp connection initializing...`);
  console.log(`🌐 Open http://localhost:${port} to access the panel`);
});
