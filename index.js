const express = require('express');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const multer = require('multer');
const app = express();
const port = process.env.PORT || 5000;

let MznKing;
let messages = null;
let targets = [];
let intervalTime = null;
let haterName = null;
let currentInterval = null;
let stopKey = null;
let sendingActive = false;
let isConnected = false;

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// WhatsApp connection setup with better error handling
const setupBaileys = async () => {
  try {
    console.log('Setting up WhatsApp connection...');
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    
    const connectToWhatsApp = async () => {
      MznKing = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Chrome', 'Windows', '10.0.0'],
      });

      MznKing.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          console.log('QR Code received:', qr);
        }
        
        if (connection === "open") {
          isConnected = true;
          console.log("✅ WhatsApp connected successfully!");
        }
        
        if (connection === "close") {
          isConnected = false;
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          console.log('Connection closed:', lastDisconnect?.error);
          
          if (shouldReconnect) {
            console.log("🔄 Reconnecting...");
            await delay(3000);
            await connectToWhatsApp();
          } else {
            console.log("❌ Connection closed. Manual restart required.");
          }
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
      return MznKing;
    };
    
    await connectToWhatsApp();
  } catch (error) {
    console.error('Setup error:', error);
  }
};

// Initialize WhatsApp connection
setupBaileys();

function generateStopKey() {
  return 'MRPRINCE-' + Math.floor(1000000 + Math.random() * 9000000);
}

// Check connection status middleware
const checkConnection = (req, res, next) => {
  if (!isConnected) {
    return res.status(503).send({ 
      status: 'error', 
      message: 'WhatsApp not connected. Please wait for connection...' 
    });
  }
  next();
};

app.get('/', (req, res) => {
  const showStopKey = sendingActive && stopKey;
  const connectionStatus = isConnected ? '✅ Connected' : '❌ Disconnected';

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>❣️🌷𝐖𝐇𝐀𝐓𝐒𝐇𝐏𝐏 𝐒𝐄𝐑𝐕𝐄𝐑 🌷❣️</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-image: url('https://i.ibb.co/PvG9BWd1/482999af8e28fc48a3d1dcb9160fb51e.jpg');
        background-size: cover;
        background-position: center;
        font-family: Arial, sans-serif;
      }
      .container {
        width: 90%;
        max-width: 400px;
        margin: 30px auto;
        background-color: rgba(0, 0, 0, 0.6);
        padding: 20px;
        border-radius: 15px;
        border: 2px solid white;
        color: white;
        box-shadow: 0 0 20px rgba(255,255,255,0.2);
        text-align: center;
      }
      h1 { color: white; margin-bottom: 20px; }
      label {
        display: block;
        margin: 10px 0 5px;
        text-align: left;
        font-weight: bold;
      }
      input, button {
        width: 100%;
        padding: 10px;
        margin-bottom: 12px;
        border-radius: 8px;
        border: 2px solid white;
        background: transparent;
        color: white;
        box-sizing: border-box;
        text-align: center;
      }
      input::placeholder { color: #eee; }
      button {
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
      }
      button[type="submit"]:nth-of-type(1) { background-color: #ffcc00; color: black; }
      button[type="submit"]:nth-of-type(2) { background-color: #00cc66; color: white; }
      button[type="submit"]:nth-of-type(3) { background-color: #ff4444; color: white; }
      button:hover { opacity: 0.8; }
      .status {
        padding: 10px;
        border-radius: 8px;
        margin-bottom: 15px;
        font-weight: bold;
      }
      .connected { background-color: #00cc66; }
      .disconnected { background-color: #ff4444; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>❣️🌷𝐌𝐑 𝐏𝐑𝐈𝐍𝐂𝐄🌷❣️</h1>
      
      <div class="status ${isConnected ? 'connected' : 'disconnected'}">
        Status: ${connectionStatus}
      </div>

      <form action="/generate-pairing-code" method="post">
        <label for="phoneNumber">Your Phone Number:</label>
        <input type="text" id="phoneNumber" name="phoneNumber" placeholder="91..." required />
        <button type="submit">PAIR</button>
      </form>

      <form action="/send-messages" method="post" enctype="multipart/form-data">
        <label for="targetsInput">Number or Group UID:</label>
        <input type="text" id="targetsInput" name="targetsInput" placeholder="917543864229 OUR GROUP UID" required />

        <label for="messageFile">Upload Message File:</label>
        <input type="file" id="messageFile" name="messageFile" required />

        <label for="haterNameInput">Hater's Name:</label>
        <input type="text" id="haterNameInput" name="haterNameInput" placeholder="Hatters name" required />

        <label for="delayTime">Delay (seconds):</label>
        <input type="number" id="delayTime" name="delayTime" placeholder="minimum 5" required />

        <button type="submit">START</button>
      </form>

      <form action="/stop" method="post">
        <label for="stopKeyInput">Stop Key:</label>
        <input type="text" id="stopKeyInput" name="stopKeyInput" placeholder="Enter Stop Key"/>
        <button type="submit">STOP</button>
      </form>

      ${showStopKey ? `
      <div style="margin-top:10px;">
        <label>Current Stop Key:</label>
        <input type="text" value="${stopKey}" readonly />
      </div>` : ''}
    </div>
  </body>
  </html>
  `);
});

app.post('/generate-pairing-code', checkConnection, async (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  
  // Validate phone number
  if (!phoneNumber.startsWith('91') || phoneNumber.length < 10) {
    return res.send({ 
      status: 'error', 
      message: 'Please enter a valid Indian phone number starting with 91' 
    });
  }

  try {
    console.log('Requesting pairing code for:', phoneNumber);
    const pairCode = await MznKing.requestPairingCode(phoneNumber.trim());
    console.log('Pairing code generated:', pairCode);
    
    res.send({ 
      status: 'success', 
      pairCode,
      message: `Pairing code: ${pairCode}`
    });
  } catch (error) {
    console.error('Pairing code error:', error);
    res.send({ 
      status: 'error', 
      message: `Failed to generate pairing code: ${error.message}` 
    });
  }
});

app.post('/send-messages', upload.single('messageFile'), checkConnection, async (req, res) => {
  try {
    const { targetsInput, delayTime, haterNameInput } = req.body;

    // Validation
    if (!targetsInput || !delayTime || !haterNameInput) {
      throw new Error('All fields are required');
    }

    if (parseInt(delayTime) < 5) {
      throw new Error('Delay must be at least 5 seconds');
    }

    haterName = haterNameInput;
    intervalTime = parseInt(delayTime, 10);

    if (!req.file) throw new Error('No message file uploaded');
    messages = req.file.buffer.toString('utf-8').split('\n').filter(Boolean);
    
    if (messages.length === 0) {
      throw new Error('Message file is empty');
    }

    targets = targetsInput.split(',').map(t => t.trim());
    
    if (targets.length === 0) {
      throw new Error('No valid targets provided');
    }

    stopKey = generateStopKey();
    sendingActive = true;

    if (currentInterval) clearInterval(currentInterval);
    let msgIndex = 0;

    console.log(`Starting message sending to ${targets.length} targets with ${intervalTime}s delay`);

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        console.log('Message sending completed or stopped');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      console.log(`Sending message ${msgIndex + 1}/${messages.length}: ${fullMessage}`);

      for (const target of targets) {
        const suffix = target.endsWith('@g.us') ? '' : '@s.whatsapp.net';
        const targetJid = target + suffix;
        
        try {
          await MznKing.sendMessage(targetJid, { text: fullMessage });
          console.log(`✅ Sent to ${target}`);
        } catch (err) {
          console.log(`❌ Error sending to ${target}: ${err.message}`);
        }
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    console.error('Send messages error:', error);
    res.send({ status: 'error', message: error.message });
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    console.log('Message sending stopped by user');
    return res.send(`<h2 style="color:green;text-align:center;">✅ Sending Stopped Successfully</h2><br/><a href="/">Back</a>`);
  } else {
    return res.send(`<h2 style="color:red;text-align:center;">❌ Invalid Stop Key</h2><br/><a href="/">Back</a>`);
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    whatsappConnected: isConnected,
    sendingActive: sendingActive 
  });
});

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 WhatsApp connection initializing...`);
});
