const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
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

// WhatsApp connection setup
const initializeWhatsApp = async () => {
  try {
    console.log('🚀 Initializing WhatsApp connection...');
    
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const { version } = await fetchLatestBaileysVersion();
    
    MznKing = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: ['Ubuntu', 'Chrome', '20.0.04'],
      markOnlineOnConnect: true,
      generateHighQualityLinkPreview: true,
    });

    MznKing.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr, isNewLogin } = update;
      
      // Handle QR Code
      if (qr) {
        qrCode = qr;
        connectionStatus = "QR Code Ready - Scan with WhatsApp";
        console.log('\n📱 QR CODE RECEIVED - SCAN WITH WHATSAPP');
        qrcode.generate(qr, { small: true });
        console.log('\n');
      }
      
      // Handle connection open
      if (connection === "open") {
        isConnected = true;
        connectionStatus = "✅ Connected";
        qrCode = null;
        pairCodeData = null;
        console.log("✅ WhatsApp connected successfully!");
        
        if (MznKing.user) {
          console.log(`👤 Logged in as: ${MznKing.user.name || MznKing.user.id}`);
        }
      }
      
      // Handle connection close
      if (connection === "close") {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        
        console.log('🔌 Connection closed');
        
        if (statusCode === DisconnectReason.loggedOut) {
          console.log("❌ Device logged out. Clearing auth...");
          try {
            fs.rmSync('./auth_info', { recursive: true, force: true });
          } catch (e) {}
          connectionStatus = "❌ Logged Out - Restart Required";
        } else {
          console.log("🔄 Reconnecting in 5 seconds...");
          connectionStatus = "🔄 Reconnecting...";
          setTimeout(() => initializeWhatsApp(), 5000);
        }
      }
      
      // Handle connecting state
      if (connection === "connecting") {
        connectionStatus = "🔄 Connecting...";
        console.log('🔄 Connecting to WhatsApp...');
      }
    });

    MznKing.ev.on('creds.update', saveCreds);

    return MznKing;
  } catch (error) {
    console.error('❌ Setup error:', error);
    connectionStatus = "❌ Connection Failed - Retrying...";
    setTimeout(() => initializeWhatsApp(), 10000);
  }
};

// Initialize WhatsApp
initializeWhatsApp();

function generateStopKey() {
  return 'MRPRINCE-' + Math.floor(1000000 + Math.random() * 9000000);
}

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
      .refresh-info {
        background: #d1ecf1;
        padding: 10px;
        border-radius: 8px;
        margin: 10px 0;
        text-align: center;
        font-size: 14px;
        color: #0c5460;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>❣️🌷 𝐌𝐑 𝐏𝐑𝐈𝐍𝐂𝐄 🌷❣️</h1>
        <p>WhatsApp Messaging Server</p>
      </div>

      <div class="status-container ${isConnected ? '' : !qrCode ? 'status-disconnected' : 'status-connecting'}">
        <strong>Status:</strong> ${connectionStatus}
        ${qrCode ? '<p>📱 QR Code is available in terminal - Scan with WhatsApp</p>' : ''}
      </div>

      <div class="refresh-info">
        💡 <strong>Tip:</strong> Page automatically refreshes every 10 seconds to show status
      </div>

      <form id="pairForm" action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label for="phoneNumber">📱 Your Phone Number:</label>
          <input type="text" id="phoneNumber" name="phoneNumber" placeholder="91XXXXXXXXXX" required />
          <small style="color: #666;">Enter your WhatsApp number with country code (91 for India)</small>
        </div>
        <button type="submit" class="btn-pair">🔗 GENERATE PAIR CODE</button>
      </form>

      ${pairCodeData ? `
      <div class="pair-code-result">
        <h3>✅ Pair Code Generated!</h3>
        <p><strong>Code: ${pairCodeData.pairCode}</strong></p>
        <p>Enter this code in WhatsApp → Linked Devices → Link a Device</p>
      </div>
      ` : ''}

      <form id="messageForm" action="/send-messages" method="post" enctype="multipart/form-data">
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

      <form id="stopForm" action="/stop" method="post">
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
      // Store form data before refresh
      let formData = {
        phoneNumber: '',
        targetsInput: '',
        haterNameInput: '',
        delayTime: '10',
        stopKeyInput: ''
      };

      // Load saved data when page loads
      document.addEventListener('DOMContentLoaded', function() {
        // Load from localStorage
        const savedData = localStorage.getItem('whatsappFormData');
        if (savedData) {
          formData = JSON.parse(savedData);
          
          // Fill form fields
          document.getElementById('phoneNumber').value = formData.phoneNumber || '';
          document.getElementById('targetsInput').value = formData.targetsInput || '';
          document.getElementById('haterNameInput').value = formData.haterNameInput || '';
          document.getElementById('delayTime').value = formData.delayTime || '10';
          document.getElementById('stopKeyInput').value = formData.stopKeyInput || '';
        }

        // Save data when user types
        document.getElementById('phoneNumber').addEventListener('input', function(e) {
          formData.phoneNumber = e.target.value;
          saveFormData();
        });

        document.getElementById('targetsInput').addEventListener('input', function(e) {
          formData.targetsInput = e.target.value;
          saveFormData();
        });

        document.getElementById('haterNameInput').addEventListener('input', function(e) {
          formData.haterNameInput = e.target.value;
          saveFormData();
        });

        document.getElementById('delayTime').addEventListener('input', function(e) {
          formData.delayTime = e.target.value;
          saveFormData();
        });

        document.getElementById('stopKeyInput').addEventListener('input', function(e) {
          formData.stopKeyInput = e.target.value;
          saveFormData();
        });

        // Clear data when forms are submitted
        document.getElementById('pairForm').addEventListener('submit', function() {
          formData.phoneNumber = '';
          saveFormData();
        });

        document.getElementById('messageForm').addEventListener('submit', function() {
          formData.targetsInput = '';
          formData.haterNameInput = '';
          formData.delayTime = '10';
          saveFormData();
        });

        document.getElementById('stopForm').addEventListener('submit', function() {
          formData.stopKeyInput = '';
          saveFormData();
        });
      });

      function saveFormData() {
        localStorage.setItem('whatsappFormData', JSON.stringify(formData));
      }

      // Smart refresh - only refresh if user is not typing
      let isUserTyping = false;
      let typingTimer = null;

      document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', function() {
          isUserTyping = true;
          clearTimeout(typingTimer);
        });

        input.addEventListener('blur', function() {
          typingTimer = setTimeout(() => {
            isUserTyping = false;
          }, 2000);
        });

        input.addEventListener('input', function() {
          isUserTyping = true;
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => {
            isUserTyping = false;
          }, 3000);
        });
      });

      // Refresh only when user is not typing and no file is selected
      setInterval(() => {
        if (!isUserTyping && !document.getElementById('messageFile').files.length) {
          // Check if we have any active form submissions
          const hasActiveForms = document.querySelectorAll('form').length > 0;
          if (hasActiveForms) {
            window.location.reload();
          }
        }
      }, 10000); // Refresh every 10 seconds instead of 3

      // Manual refresh button functionality
      function manualRefresh() {
        window.location.reload();
      }

      // Add manual refresh button
      const refreshButton = document.createElement('button');
      refreshButton.textContent = '🔄 Refresh Status';
      refreshButton.style.cssText = 'width: 100%; padding: 10px; background: #17a2b8; color: white; border: none; border-radius: 8px; cursor: pointer; margin: 10px 0;';
      refreshButton.onclick = manualRefresh;
      
      // Insert after status container
      const statusContainer = document.querySelector('.status-container');
      statusContainer.parentNode.insertBefore(refreshButton, statusContainer.nextSibling);
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

    // Clean phone number - remove all non-digits
    const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
    
    // Validate Indian number (91 followed by 10 digits)
    if (!cleanNumber.startsWith('91') || cleanNumber.length !== 12) {
      return res.send({ 
        status: 'error', 
        message: 'Please enter valid Indian number: 91 followed by 10 digits (12 digits total)' 
      });
    }

    console.log('📞 Requesting pairing code for:', cleanNumber);
    
    if (!MznKing) {
      return res.send({ 
        status: 'error', 
        message: 'WhatsApp client not initialized. Please wait...' 
      });
    }

    // Check if we're connected - if connected, no need for pair code
    if (isConnected) {
      return res.send({ 
        status: 'success', 
        message: 'Already connected to WhatsApp! No pair code needed.' 
      });
    }

    // Request pairing code with timeout
    const pairCodePromise = MznKing.requestPairingCode(cleanNumber);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 15000);
    });

    const pairCode = await Promise.race([pairCodePromise, timeoutPromise]);
    
    console.log('✅ Pairing code generated:', pairCode);
    
    // Store pair code data to display on page
    pairCodeData = {
      pairCode: pairCode,
      phoneNumber: cleanNumber,
      timestamp: new Date()
    };
    
    res.send({ 
      status: 'success', 
      pairCode: pairCode,
      message: `Pair code generated: ${pairCode}`
    });
    
  } catch (error) {
    console.error('❌ Pairing code error:', error);
    
    let errorMessage = 'Failed to generate pairing code';
    
    if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Please try again.';
    } else if (error.message.includes('rate limit')) {
      errorMessage = 'Rate limit exceeded. Please wait 5-10 minutes and try again.';
    } else if (error.message.includes('not connected')) {
      errorMessage = 'WhatsApp not connected. Please wait for connection...';
    } else if (error.message.includes('invalid phone number')) {
      errorMessage = 'Invalid phone number format. Use 91XXXXXXXXXX format.';
    } else if (error.message.includes('connection')) {
      errorMessage = 'Connection issue. Please wait and try again.';
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
      Delay: ${intervalTime}s`);

    let msgIndex = 0;

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        console.log('✅ Message sending completed');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      
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
        await delay(500);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
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
  
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) {
      clearInterval(currentInterval);
    }
    console.log('🛑 Message sending stopped');
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:green;">✅ Sending Stopped</h2>
        <a href="/">← Back</a>
      </div>
    `);
  } else {
    res.send(`
      <div style="text-align:center; padding:50px;">
        <h2 style="color:red;">❌ Invalid Stop Key</h2>
        <a href="/">← Back</a>
      </div>
    `);
  }
});

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    whatsapp: {
      connected: isConnected,
      status: connectionStatus,
      hasQR: !!qrCode
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 WhatsApp connection starting...`);
  console.log(`🌐 Open http://localhost:${port} to access the panel`);
});
