const express = require('express');
const fs = require('fs');
const path = require('path');
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

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simple logger since pino might not be available
const logger = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.error(`[ERROR] ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${msg}`)
};

const setupBaileys = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const connectToWhatsApp = async () => {
      MznKing = makeWASocket({
        printQRInTerminal: true,
        auth: state,
      });

      MznKing.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s;
        
        if (qr) {
          logger.info('QR Code received');
        }
        
        if (connection === "open") {
          logger.info("WhatsApp connected successfully.");
        }
        
        if (connection === "close") {
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
          
          logger.warn(`Connection closed. Status: ${statusCode}`);
          
          if (shouldReconnect) {
            logger.info("Reconnecting...");
            await connectToWhatsApp();
          } else {
            logger.error("Connection closed. Please restart the application.");
          }
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
      return MznKing;
    };
    
    await connectToWhatsApp();
  } catch (error) {
    logger.error(`Setup error: ${error.message}`);
  }
};

setupBaileys();

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
    <title>❣️🌷 WhatsApp Server 🌷❣️</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        margin: 0;
        padding: 0;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        background-size: cover;
        background-position: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .container {
        width: 90%;
        max-width: 450px;
        margin: 30px auto;
        background: rgba(255, 255, 255, 0.1);
        backdrop-filter: blur(10px);
        padding: 30px;
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        text-align: center;
      }
      
      .header {
        margin-bottom: 25px;
        padding-bottom: 15px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      h1 {
        color: white;
        font-size: 28px;
        margin-bottom: 10px;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      }
      
      .subtitle {
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
        margin-bottom: 5px;
      }
      
      .form-group {
        margin-bottom: 20px;
        text-align: left;
      }
      
      label {
        display: block;
        margin: 10px 0 5px;
        font-weight: 600;
        color: white;
      }
      
      input, button {
        width: 100%;
        padding: 12px 15px;
        margin-bottom: 15px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.3);
        background: rgba(255, 255, 255, 0.1);
        color: white;
        box-sizing: border-box;
        font-size: 16px;
        transition: all 0.3s ease;
      }
      
      input::placeholder {
        color: rgba(255, 255, 255, 0.6);
      }
      
      input:focus {
        outline: none;
        border-color: rgba(255, 255, 255, 0.6);
        background: rgba(255, 255, 255, 0.15);
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
      }
      
      button {
        font-weight: bold;
        cursor: pointer;
        transition: 0.3s;
        border: none;
        margin-top: 5px;
      }
      
      .pair-btn {
        background: linear-gradient(135deg, #ffcc00, #ff9900);
        color: #333;
      }
      
      .start-btn {
        background: linear-gradient(135deg, #00cc66, #00aa55);
        color: white;
      }
      
      .stop-btn {
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
      }
      
      button:hover {
        transform: translateY(-2px);
        box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      }
      
      .stop-key-section {
        margin-top: 20px;
        padding: 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .stop-key-section label {
        margin-top: 0;
      }
      
      .footer {
        margin-top: 20px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.6);
      }
      
      .status {
        padding: 10px;
        border-radius: 8px;
        margin: 10px 0;
        font-size: 14px;
      }
      
      .status.connected {
        background: rgba(0, 255, 0, 0.2);
        border: 1px solid rgba(0, 255, 0, 0.5);
      }
      
      .status.disconnected {
        background: rgba(255, 0, 0, 0.2);
        border: 1px solid rgba(255, 0, 0, 0.5);
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>❣️🌷 MR PRINCE 🌷❣️</h1>
        <div class="subtitle">WhatsApp Message Sender</div>
      </div>

      <form action="/generate-pairing-code" method="post">
        <div class="form-group">
          <label for="phoneNumber">Your Phone Number:</label>
          <input type="text" id="phoneNumber" name="phoneNumber" placeholder="91XXXXXXXXXX" required />
        </div>
        <button type="submit" class="pair-btn">GENERATE PAIR CODE</button>
      </form>

      <form action="/send-messages" method="post" enctype="multipart/form-data">
        <div class="form-group">
          <label for="targetsInput">Target Numbers or Group UID:</label>
          <input type="text" id="targetsInput" name="targetsInput" placeholder="917543864229 or group UID" required />

          <label for="messageFile">Upload Message File:</label>
          <input type="file" id="messageFile" name="messageFile" required />

          <label for="haterNameInput">Hater's Name:</label>
          <input type="text" id="haterNameInput" name="haterNameInput" placeholder="Enter name" required />

          <label for="delayTime">Delay (seconds):</label>
          <input type="number" id="delayTime" name="delayTime" placeholder="Minimum 5 seconds" min="5" required />
        </div>
        <button type="submit" class="start-btn">START SENDING</button>
      </form>

      <form action="/stop" method="post">
        <div class="form-group">
          <label for="stopKeyInput">Stop Key:</label>
          <input type="text" id="stopKeyInput" name="stopKeyInput" placeholder="Enter stop key to cancel"/>
        </div>
        <button type="submit" class="stop-btn">STOP SENDING</button>
      </form>

      ${showStopKey ? `
      <div class="stop-key-section">
        <label>Current Stop Key:</label>
        <input type="text" value="${stopKey}" readonly style="background: rgba(255,255,255,0.2);" />
        <div style="font-size: 12px; margin-top: 5px; color: rgba(255,255,255,0.8);">Save this key to stop sending later</div>
      </div>` : ''}
      
      <div class="footer">
        © ${new Date().getFullYear()} MR PRINCE Server
      </div>
    </div>
  </body>
  </html>
  `);
});

app.post('/generate-pairing-code', async (req, res) => {
  const phoneNumber = req.body.phoneNumber;
  try {
    if (!MznKing) {
      throw new Error('WhatsApp is not initialized yet. Please wait...');
    }
    
    const pairCode = await MznKing.requestPairingCode(phoneNumber.trim());
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pairing Code</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
          }
          h2 {
            margin-bottom: 20px;
          }
          .pair-code {
            font-size: 32px;
            font-weight: bold;
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 10px;
            margin: 20px 0;
            letter-spacing: 3px;
          }
          .instructions {
            margin: 20px 0;
            font-size: 14px;
            color: rgba(255, 255, 255, 0.8);
          }
          .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #ffcc00, #ff9900);
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📱 Pairing Code Generated</h2>
          <div class="instructions">
            Go to WhatsApp on your phone > Linked Devices > Link a Device
          </div>
          <div class="pair-code">${pairCode}</div>
          <div class="instructions">
            You should see "Ubuntu" as the device to connect to
          </div>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          .error {
            color: #ff6b6b;
            margin: 20px 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #ffcc00, #ff9900);
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>❌ Error</h2>
          <div class="error">${error.message}</div>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.post('/send-messages', upload.single('messageFile'), async (req, res) => {
  try {
    const { targetsInput, delayTime, haterNameInput } = req.body;

    if (!MznKing) {
      throw new Error('WhatsApp is not connected. Please wait for connection.');
    }

    haterName = haterNameInput;
    intervalTime = parseInt(delayTime, 10);

    if (intervalTime < 5) {
      throw new Error('Delay time must be at least 5 seconds');
    }

    if (!req.file) {
      throw new Error('No message file uploaded');
    }

    messages = req.file.buffer.toString('utf-8').split('\n').filter(Boolean);
    
    if (messages.length === 0) {
      throw new Error('Message file is empty');
    }

    targets = targetsInput.split(',').map(t => t.trim());
    
    if (targets.length === 0) {
      throw new Error('No targets specified');
    }

    stopKey = generateStopKey();
    sendingActive = true;

    if (currentInterval) {
      clearInterval(currentInterval);
    }

    let msgIndex = 0;

    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        logger.info('Message sending completed or stopped');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      
      for (const target of targets) {
        try {
          // Check if target is a group ID or individual number
          const formattedTarget = target.endsWith('@g.us') ? target : target.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
          await MznKing.sendMessage(formattedTarget, { text: fullMessage });
          logger.info(`Sent message ${msgIndex + 1} to ${target}`);
        } catch (err) {
          logger.error(`Error sending to ${target}: ${err.message}`);
        }
        
        // Small delay between sends to avoid rate limiting
        await delay(1000);
      }

      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          .error {
            color: #ff6b6b;
            margin: 20px 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #ffcc00, #ff9900);
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>❌ Error</h2>
          <div class="error">${error.message}</div>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput;
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) {
      clearInterval(currentInterval);
      currentInterval = null;
    }
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Stopped</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          .success {
            color: #51cf66;
            margin: 20px 0;
            font-size: 18px;
          }
          .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #ffcc00, #ff9900);
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>✅ Success</h2>
          <div class="success">Message sending stopped successfully</div>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  } else {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            padding: 30px;
            border-radius: 20px;
            text-align: center;
            color: white;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          }
          .error {
            color: #ff6b6b;
            margin: 20px 0;
          }
          .btn {
            display: inline-block;
            padding: 12px 25px;
            background: linear-gradient(135deg, #ffcc00, #ff9900);
            color: #333;
            text-decoration: none;
            border-radius: 10px;
            font-weight: bold;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>❌ Error</h2>
          <div class="error">Invalid stop key</div>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);
  }
});

app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
  logger.info('Initializing WhatsApp connection...');
});
