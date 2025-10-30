// index.js
const express = require('express');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
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
let currentQR = null; // Store QR as text

// Multer
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') cb(null, true);
    else cb(new Error('Only .txt files!'), false);
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

// WhatsApp Setup
const setupBaileys = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const connect = async () => {
      MznKing = makeWASocket({
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        logger: require('pino')({ level: 'silent' }), // Silent to avoid spam
        markOnlineOnConnect: false,
        syncFullHistory: false
      });

      MznKing.ev.on('connection.update', async update => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          currentQR = qr;
          logger.info(`QR Code: ${qr}`);
          logger.info(`Open in browser: https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}`);
        }
        if (connection === 'open') {
          logger.info('WhatsApp connected!');
          currentQR = null;
        }
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const reconnect = code !== DisconnectReason.loggedOut;
          logger.warn(`Disconnected (${code})`);
          if (reconnect) setTimeout(connect, 10000);
          else logger.error('Logged out – delete ./auth_info');
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
    };
    await connect();
  } catch (e) {
    logger.error(`Setup: ${e.message}`);
    setTimeout(setupBaileys, 15000);
  }
};
setupBaileys();

// Stop Key
function generateStopKey() {
  return 'AAHAN-' + Math.floor(1000000 + Math.random() * 9000000);
}

// HTML Pages
const errorPage = msg => `<!DOCTYPE html><html><head><title>Error</title><style>
  body{background:#667eea;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:#fff;}
  .box{background:rgba(255,255,255,.1);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
  .e{color:#ff6b6b;margin:20px 0;}
  a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
</style></head><body><div class="box"><h2>Error</h2><div class="e">${msg}</div><a href="/">Back</a></div></body></html>`;

const successPage = (msg, sub = '') => `<!DOCTYPE html><html><head><title>Success</title><style>
  body{background:#667eea;font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:#fff;}
  .box{background:rgba(255,255,255,.1);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
  .s{color:#51cf66;margin:20px 0;font-size:18px;}
  a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
</style></head><body><div class="box"><h2>Success</h2><div class="s">${msg}</div><p>${sub}</p><a href="/">Back</a></div></body></html>`;

// Home
app.get('/', (req, res) => {
  const showKey = sendingActive && stopKey;
  const qrLink = currentQR ? `<p><a href="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(currentQR)}" target="_blank" style="color:#ffcc00;">Open QR Code in Browser</a></p>` : '';
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AAHAN WhatsApp Server</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}
    .c{width:90%;max-width:450px;margin:20px auto;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 32px rgba(0,0,0,.3);text-align:center}
    h1{font-size:28px;margin-bottom:10px}
    label{display:block;margin:15px 0 5px;font-weight:600;text-align:left}
    input,button{width:100%;padding:12px 15px;margin:8px 0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:16px}
    button{font-weight:bold;cursor:pointer;margin-top:10px;border:none}
    .pair{background:#ffcc00;color:#333}
    .start{background:#00cc66;color:#fff}
    .stop{background:#ff4444;color:#fff}
    .key{margin-top:20px;padding:15px;background:rgba(255,255,255,.1);border-radius:10px}
    .footer{margin-top:25px;font-size:12px;color:rgba(255,255,255,.6)}
  </style>
</head>
<body>
<div class="c">
  <h1>AAHAN</h1>
  <div style="font-size:14px;margin-bottom:20px">WhatsApp Bulk Sender</div>

  <form action="/pair" method="post">
    <label>Phone Number (e.g., 919876543210):</label>
    <input name="phoneNumber" placeholder="919876543210" required>
    <button class="pair">GENERATE PAIR CODE</button>
  </form>
  ${qrLink}

  <form action="/send" method="post" enctype="multipart/form-data">
    <label>Targets (comma separated):</label>
    <input name="targetsInput" placeholder="917543864229, group@g.us" required>
    <label>Message File (.txt):</label>
    <input type="file" name="messageFile" accept=".txt" required>
    <label>Hater Name:</label>
    <input name="haterNameInput" placeholder="Name" required>
    <label>Delay (sec ≥5):</label>
    <input type="number" name="delayTime" min="5" required>
    <button class="start">START SENDING</button>
  </form>

  <form action="/stop" method="post">
    <label>Stop Key:</label>
    <input name="stopKeyInput" placeholder="Enter key">
    <button class="stop">STOP SENDING</button>
  </form>

  ${showKey ? `<div class="key"><label>Stop Key:</label><input value="${stopKey}" readonly><div style="font-size:12px;color:#ffcc00">Save it!</div></div>` : ''}

  <div class="footer">© ${new Date().getFullYear()} AAHAN</div>
</div>
</body>
</html>`);
});

// Pairing Code
app.post('/pair', async (req, res) => {
  const phone = req.body.phoneNumber?.trim().replace(/\D/g, '');
  if (!phone || phone.length < 10) return res.send(errorPage('Invalid phone number'));

  try {
    if (!MznKing) throw new Error('WhatsApp not ready');
    if (MznKing.authState.creds.registered) throw new Error('Already linked. Delete ./auth_info');

    let code = null;
    for (let i = 0; i < 5; i++) {
      try {
        code = await MznKing.requestPairingCode(phone);
        if (code) break;
      } catch (e) { await delay(2000); }
    }
    if (!code) throw new Error('Failed to generate code. Try QR below.');

    logger.info(`PAIR CODE: ${code}`);
    res.send(successPage(`Pairing Code: <strong>${code}</strong>`, 'Enter in WhatsApp > Linked Devices > Link with phone number'));
  } catch (e) {
    res.send(errorPage(e.message + '<br><br>If code fails, use QR: <a href="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=whatsapp://pair" target="_blank">Open QR</a>'));
  }
});

// Send
app.post('/send', upload.single('messageFile'), async (req, res) => {
  try {
    if (!MznKing?.user) throw new Error('Not connected');

    const { targetsInput, delayTime, haterNameInput } = req.body;
    haterName = haterNameInput?.trim();
    intervalTime = parseInt(delayTime);
    if (!haterName || intervalTime < 5 || !req.file) throw new Error('Invalid input');

    messages = req.file.buffer.toString('utf-8').split('\n').map(l => l.trim()).filter(l => l);
    if (!messages.length) throw new Error('Empty messages');

    targets = targetsInput.split(',').map(t => t.trim()).filter(t => t);
    if (!targets.length) throw new Error('No targets');

    stopKey = generateStopKey();
    sendingActive = true;
    if (currentInterval) clearInterval(currentInterval);

    let idx = 0;
    currentInterval = setInterval(async () => {
      if (!sendingActive || idx >= messages.length) {
        clearInterval(currentInterval); sendingActive = false; return;
      }
      const txt = `${haterName} ${messages[idx]}`;
      for (const t of targets) {
        if (!sendingActive) break;
        try {
          const jid = t.includes('@g.us') ? t : t + '@s.whatsapp.net';
          await MznKing.sendMessage(jid, { text: txt });
          logger.info(`Sent to ${t}`);
        } catch (e) { logger.error(`Failed ${t}`); }
        await delay(1000);
      }
      idx++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (e) {
    res.send(errorPage(e.message));
  }
});

// Stop
app.post('/stop', (req, res) => {
  if (req.body.stopKeyInput?.trim() === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    stopKey = null;
    res.send(successPage('Stopped!'));
  } else {
    res.send(errorPage('Wrong key'));
  }
});

app.listen(port, () => {
  logger.info(`Server: http://localhost:${port}`);
});
