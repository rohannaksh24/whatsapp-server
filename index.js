const express = require('express');
const fs = require('fs');
const path = require('path');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const multer = require('multer'); // multer@2.0.2 (secure & working)
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

// Multer: Use memory storage for file upload
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only .txt files are allowed!'), false);
    }
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Simple logger
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// WhatsApp Connection Setup
const setupBaileys = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const connectToWhatsApp = async () => {
      MznKing = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        logger: require('pino')({ level: 'silent' }) // Silent pino
      });

      MznKing.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          logger.info('QR Code ready. Scan it in WhatsApp > Linked Devices');
        }

        if (connection === 'open') {
          logger.info('WhatsApp connected successfully!');
        }

        if (connection === 'close') {
          const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
          logger.warn(`Connection closed: ${lastDisconnect?.error?.output?.statusCode}`);

          if (shouldReconnect) {
            setTimeout(connectToWhatsApp, 5000);
          } else {
            logger.error('Logged out. Delete ./auth_info folder and restart.');
          }
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
    };

    await connectToWhatsApp();
  } catch (error) {
    logger.error(`Setup error: ${error.message}`);
    setTimeout(setupBaileys, 10000);
  }
};

setupBaileys();

// Generate Random Stop Key
function generateStopKey() {
  return 'MRPRINCE-' + Math.floor(1000000 + Math.random() * 9000000);
}

// Home Page
app.get('/', (req, res) => {
  const showStopKey = sendingActive && stopKey;

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>MR PRINCE WhatsApp Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
    }
    .container {
      width: 90%; max-width: 450px; margin: 20px auto;
      background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px);
      padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2);
      box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center;
    }
    h1 { font-size: 28px; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .subtitle { color: rgba(255,255,255,0.8); font-size: 14px; margin-bottom: 20px; }
    label { display: block; margin: 15px 0 5px; font-weight: 600; text-align: left; }
    input, button, select {
      width: 100%; padding: 12px 15px; margin: 8px 0; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1);
      color: white; font-size: 16px; transition: 0.3s;
    }
    input::placeholder { color: rgba(255,255,255,0.6); }
    input:focus { outline: none; border-color: #fff; background: rgba(255,255,255,0.15); }
    button {
      font-weight: bold; cursor: pointer; margin-top: 10px; border: none;
    }
    .pair-btn { background: linear-gradient(135deg, #ffcc00, #ff9900); color: #333; }
    .start-btn { background: linear-gradient(135deg, #00cc66, #00aa55); color: white; }
    .stop-btn { background: linear-gradient(135deg, #ff4444, #cc0000); color: white; }
    button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
    .stop-key-section { margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; }
    .footer { margin-top: 25px; font-size: 12px; color: rgba(255,255,255,0.6); }
    .status { padding: 10px; border-radius: 8px; margin: 10px 0; font-size: 14px; }
    .status.connected { background: rgba(0,255,0,0.2); border: 1px solid rgba(0,255,0,0.5); }
    .status.disconnected { background: rgba(255,0,0,0.2); border: 1px solid rgba(255,0,0,0.5); }
  </style>
</head>
<body>
  <div class="container">
    <h1>MR PRINCE</h1>
    <div class="subtitle">WhatsApp Bulk Message Sender</div>

    <!-- Pairing Code -->
    <form action="/generate-pairing-code" method="post">
      <label for="phoneNumber">Your Phone Number:</label>
      <input type="text" id="phoneNumber" name="phoneNumber" placeholder="919876543210" required />
      <button type="submit" class="pair-btn">GENERATE PAIR CODE</button>
    </form>

    <!-- Send Messages -->
    <form action="/send-messages" method="post" enctype="multipart/form-data">
      <label for="targetsInput">Target Numbers / Group ID:</label>
      <input type="text" id="targetsInput" name="targetsInput" placeholder="917543864229, group@g.us" required />

      <label for="messageFile">Upload Message File (.txt):</label>
      <input type="file" id="messageFile" name="messageFile" accept=".txt" required />

      <label for="haterNameInput">Hater's Name:</label>
      <input type="text" id="haterNameInput" name="haterNameInput" placeholder="Enter name" required />

      <label for="delayTime">Delay (seconds):</label>
      <input type="number" id="delayTime" name="delayTime" placeholder="Min 5" min="5" required />

      <button type="submit" class="start-btn">START SENDING</button>
    </form>

    <!-- Stop Sending -->
    <form action="/stop" method="post">
      <label for="stopKeyInput">Stop Key:</label>
      <input type="text" id="stopKeyInput" name="stopKeyInput" placeholder="Enter key to stop" />
      <button type="submit" class="stop-btn">STOP SENDING</button>
    </form>

    ${showStopKey ? `
    <div class="stop-key-section">
      <label>Current Stop Key:</label>
      <input type="text" value="${stopKey}" readonly style="background: rgba(255,255,255,0.2);" />
      <div style="font-size: 12px; margin-top: 5px; color: #ffcc00;">Save this key!</div>
    </div>` : ''}

    <div class="footer">© ${new Date().getFullYear()} MR PRINCE Server</div>
  </div>
</body>
</html>`);
});

// Generate Pairing Code
app.post('/generate-pairing-code', async (req, res) => {
  const phoneNumber = req.body.phoneNumber?.trim();
  if (!phoneNumber || !/^\d{10,15}$/.test(phoneNumber)) {
    return res.send(errorPage('Invalid phone number. Use 10-15 digits only.'));
  }

  try {
    if (!MznKing) throw new Error('WhatsApp not ready. Wait...');
    const code = await MznKing.requestPairingCode(phoneNumber);
    res.send(successPage(`Pairing Code: <strong>${code}</strong>`, 'Go to WhatsApp > Linked Devices > Link with Phone Number'));
  } catch (err) {
    res.send(errorPage(err.message));
  }
});

// Send Messages
app.post('/send-messages', upload.single('messageFile'), async (req, res) => {
  try {
    if (!MznKing || !MznKing.user) throw new Error('WhatsApp not connected.');

    const { targetsInput, delayTime, haterNameInput } = req.body;
    haterName = haterNameInput?.trim();
    intervalTime = parseInt(delayTime);

    if (!haterName) throw new Error('Hater name required.');
    if (intervalTime < 5) throw new Error('Delay must be ≥ 5 seconds.');
    if (!req.file) throw new Error('Upload a .txt file.');

    messages = req.file.buffer.toString('utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    if (messages.length === 0) throw new Error('Message file is empty.');

    targets = targetsInput.split(',')
      .map(t => t.trim())
      .filter(t => t);

    if (targets.length === 0) throw new Error('No valid targets.');

    stopKey = generateStopKey();
    sendingActive = true;

    if (currentInterval) clearInterval(currentInterval);

    let msgIndex = 0;
    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        logger.info('Sending completed.');
        return;
      }

      const fullMsg = `${haterName} ${messages[msgIndex]}`;

      for (const target of targets) {
        if (!sendingActive) break;
        try {
          const jid = target.includes('@g.us') ? target : target.replace(/\D/g, '') + '@s.whatsapp.net';
          await MznKing.sendMessage(jid, { text: fullMsg });
          logger.info(`Sent to ${target}`);
        } catch (err) {
          logger.error(`Failed to ${target}: ${err.message}`);
        }
        await delay(1000);
      }
      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (err) {
    res.send(errorPage(err.message));
  }
});

// Stop Sending
app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput?.trim();
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    stopKey = null;
    res.send(successPage('Sending stopped!', 'You can start again.'));
  } else {
    res.send(errorPage('Invalid stop key.'));
  }
});

// Helper: Error Page
function errorPage(msg) {
  return `<!DOCTYPE html><html><head><title>Error</title><style>
    body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:white;}
    .box{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
    .error{color:#ff6b6b;margin:20px 0;}
    a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
  </style></head><body>
    <div class="box"><h2>Error</h2><div class="error">${msg}</div><a href="/">Back</a></div>
  </body></html>`;
}

// Helper: Success Page
function successPage(msg, sub) {
  return `<!DOCTYPE html><html><head><title>Success</title><style>
    body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:white;}
    .box{background:rgba(255,255,255,0.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
    .success{color:#51cf66;margin:20px 0;font-size:18px;}
    a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
  </style></head><body>
    <div class="box"><h2>Success</h2><div class="success">${msg}</div><p>${sub}</p><a href="/">Back</a></div>
  </body></html>`;
}

// Start Server
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
  logger.info('Connecting to WhatsApp...');
});
