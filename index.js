const express = require('express');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const multer = require('multer'); // Secure version 2.0.2
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

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') cb(null, true);
    else cb(new Error('Only .txt files are allowed!'), false);
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Logger
const logger = {
  info: msg => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: msg => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: msg => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// WhatsApp Connection Setup
const setupBaileys = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const connect = async () => {
      MznKing = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        browser: Browsers.macOS('Chrome'), // Valid browser config for pairing
        logger: require('pino')({ level: 'debug' }), // Debug logging for pairing issues
        markOnlineOnConnect: false // Avoid rate limits
      });

      MznKing.ev.on('connection.update', async update => {
        const { connection, lastDisconnect, qr, isOnline } = update;
        if (qr) logger.info('QR Code generated. Scan in WhatsApp > Linked Devices.');
        if (connection === 'open') logger.info('WhatsApp connected successfully.');
        if (connection === 'connecting') logger.info('Connecting to WhatsApp...');
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect = code !== DisconnectReason.loggedOut;
          logger.warn(`Connection closed. Status: ${code}`);
          if (shouldReconnect) {
            logger.info('Reconnecting in 5 seconds...');
            setTimeout(connect, 5000);
          } else {
            logger.error('Logged out. Delete ./auth_info and restart.');
          }
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
    };
    await connect();
  } catch (error) {
    logger.error(`Setup error: ${error.message}`);
    setTimeout(setupBaileys, 10000);
  }
};
setupBaileys();

// Generate Stop Key
function generateStopKey() {
  return 'AAHAN-' + Math.floor(1000000 + Math.random() * 9000000);
}

// HTML Error Page
const errorPage = msg => `
<!DOCTYPE html>
<html>
<head>
  <title>Error</title>
  <style>
    body { background: linear-gradient(135deg, #667eea, #764ba2); font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; color: #fff; }
    .box { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; text-align: center; max-width: 400px; }
    .error { color: #ff6b6b; margin: 20px 0; }
    a { display: inline-block; padding: 12px 25px; background: #ffcc00; color: #333; text-decoration: none; border-radius: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box"><h2>Error</h2><div class="error">${msg}</div><a href="/">Back</a></div>
</body>
</html>`;

// HTML Success Page
const successPage = (msg, sub = '') => `
<!DOCTYPE html>
<html>
<head>
  <title>Success</title>
  <style>
    body { background: linear-gradient(135deg, #667eea, #764ba2); font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; color: #fff; }
    .box { background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; text-align: center; max-width: 400px; }
    .success { color: #51cf66; margin: 20px 0; font-size: 18px; }
    a { display: inline-block; padding: 12px 25px; background: #ffcc00; color: #333; text-decoration: none; border-radius: 10px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="box"><h2>Success</h2><div class="success">${msg}</div><p>${sub}</p><a href="/">Back</a></div>
</body>
</html>`;

// Home Route
app.get('/', (req, res) => {
  const showKey = sendingActive && stopKey;
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AAHAN WhatsApp Server</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: linear-gradient(135deg, #667eea, #764ba2); font-family: 'Segoe UI', Tahoma, sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; color: #fff; }
    .c { width: 90%; max-width: 450px; margin: 20px auto; background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); padding: 30px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 8px 32px rgba(0,0,0,0.3); text-align: center; }
    h1 { font-size: 28px; margin-bottom: 10px; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
    .sub { color: rgba(255,255,255,0.8); font-size: 14px; margin-bottom: 20px; }
    label { display: block; margin: 15px 0 5px; font-weight: 600; text-align: left; }
    input, button { width: 100%; padding: 12px 15px; margin: 8px 0; border-radius: 10px; border: 1px solid rgba(255,255,255,0.3); background: rgba(255,255,255,0.1); color: #fff; font-size: 16px; transition: .3s; }
    input::placeholder { color: rgba(255,255,255,0.6); }
    input:focus { outline: none; border-color: #fff; background: rgba(255,255,255,0.15); }
    button { font-weight: bold; cursor: pointer; margin-top: 10px; border: none; }
    .pair { background: linear-gradient(135deg, #ffcc00, #ff9900); color: #333; }
    .start { background: linear-gradient(135deg, #00cc66, #00aa55); color: #fff; }
    .stop { background: linear-gradient(135deg, #ff4444, #cc0000); color: #fff; }
    button:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.3); }
    .key { margin-top: 20px; padding: 15px; background: rgba(255,255,255,0.1); border-radius: 10px; }
    .footer { margin-top: 25px; font-size: 12px; color: rgba(255,255,255,0.6); }
  </style>
</head>
<body>
<div class="c">
  <h1>AAHAN</h1>
  <div class="sub">WhatsApp Bulk Message Sender</div>

  <form action="/pair" method="post">
    <label for="ph">Phone Number (with country code):</label>
    <input id="ph" name="phoneNumber" placeholder="e.g., 919876543210" required>
    <button class="pair">GENERATE PAIR CODE</button>
  </form>

  <form action="/send" method="post" enctype="multipart/form-data">
    <label for="tg">Target Numbers/Group IDs (comma-separated):</label>
    <input id="tg" name="targetsInput" placeholder="917543864229, group@g.us" required>
    <label for="msg">Message File (.txt):</label>
    <input type="file" id="msg" name="messageFile" accept=".txt" required>
    <label for="hn">Hater Name:</label>
    <input id="hn" name="haterNameInput" placeholder="Name" required>
    <label for="dl">Delay (seconds, min 5):</label>
    <input type="number" id="dl" name="delayTime" min="5" placeholder="5" required>
    <button class="start">START SENDING</button>
  </form>

  <form action="/stop" method="post">
    <label for="sk">Stop Key:</label>
    <input id="sk" name="stopKeyInput" placeholder="Enter stop key">
    <button class="stop">STOP SENDING</button>
  </form>

  ${showKey ? `<div class="key"><label>Current Stop Key:</label><input value="${stopKey}" readonly style="background:rgba(255,255,255,0.2);"><div style="font-size:12px;margin-top:5px;color:#ffcc00;">Save this key!</div></div>` : ''}

  <div class="footer">© ${new Date().getFullYear()} AAHAN Server</div>
</div>
</body>
</html>`);
});

// Pairing Code Route
app.post('/pair', async (req, res) => {
  const phoneNumber = req.body.phoneNumber?.trim().replace(/\D/g, '');
  if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
    return res.send(errorPage('Invalid phone number. Use 10-15 digits with country code (e.g., 919876543210).'));
  }

  try {
    if (!MznKing) {
      throw new Error('WhatsApp socket not initialized. Wait a few seconds and try again.');
    }

    // Wait for socket to be in connecting state
    let attempts = 0;
    while (attempts < 10 && !MznKing.ws.readyState === 1) {
      logger.info('Waiting for socket to be ready...');
      await delay(1000);
      attempts++;
    }

    if (MznKing.ws.readyState !== 1) {
      throw new Error('Socket not ready after 10 seconds. Please restart the server.');
    }

    if (!MznKing.authState.creds.registered) {
      const code = await MznKing.requestPairingCode(phoneNumber);
      if (!code) {
        throw new Error('Failed to generate pairing code. Try again or check logs.');
      }
      logger.info(`Generated pairing code for ${phoneNumber}: ${code}`);
      res.send(successPage(
        `Pairing Code: <strong>${code}</strong>`,
        'Open WhatsApp > Settings > Linked Devices > Link with phone number > Enter this code.'
      ));
    } else {
      res.send(errorPage('Already linked to a WhatsApp account. Delete ./auth_info to pair a new number.'));
    }
  } catch (error) {
    logger.error(`Pairing error: ${error.message}`);
    res.send(errorPage(`Error generating pairing code: ${error.message}. Please try again or check server logs.`));
  }
});

// Send Messages Route
app.post('/send', upload.single('messageFile'), async (req, res) => {
  try {
    if (!MznKing?.user) throw new Error('WhatsApp not connected. Please pair first.');

    const { targetsInput, delayTime, haterNameInput } = req.body;
    haterName = haterNameInput?.trim();
    intervalTime = parseInt(delayTime);

    if (!haterName) throw new Error('Hater name is required.');
    if (intervalTime < 5) throw new Error('Delay must be at least 5 seconds.');
    if (!req.file) throw new Error('Please upload a .txt file.');

    messages = req.file.buffer.toString('utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line);
    if (!messages.length) throw new Error('Message file is empty.');

    targets = targetsInput.split(',')
      .map(t => t.trim())
      .filter(t => t);
    if (!targets.length) throw new Error('No valid targets provided.');

    stopKey = generateStopKey();
    sendingActive = true;
    if (currentInterval) clearInterval(currentInterval);

    let msgIndex = 0;
    currentInterval = setInterval(async () => {
      if (!sendingActive || msgIndex >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        logger.info('Message sending stopped or completed.');
        return;
      }

      const fullMessage = `${haterName} ${messages[msgIndex]}`;
      for (const target of targets) {
        if (!sendingActive) break;
        try {
          const jid = target.includes('@g.us') ? target : target.replace(/\D/g, '') + '@s.whatsapp.net';
          await MznKing.sendMessage(jid, { text: fullMessage });
          logger.info(`Sent message ${msgIndex + 1} to ${target}`);
        } catch (err) {
          logger.error(`Error sending to ${target}: ${err.message}`);
        }
        await delay(1000);
      }
      msgIndex++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (error) {
    res.send(errorPage(error.message));
  }
});

// Stop Sending Route
app.post('/stop', (req, res) => {
  const userKey = req.body.stopKeyInput?.trim();
  if (userKey === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    stopKey = null;
    res.send(successPage('Message sending stopped successfully.', 'You can start again.'));
  } else {
    res.send(errorPage('Invalid stop key.'));
  }
});

// Start Server
app.listen(port, () => {
  logger.info(`Server running on http://localhost:${port}`);
  logger.info('Initializing WhatsApp connection...');
});
