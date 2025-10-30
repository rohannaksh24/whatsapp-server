// index.js
const express = require('express');
const { makeWASocket, useMultiFileAuthState, delay, DisconnectReason } = require("@whiskeysockets/baileys");
const multer = require('multer');               // 2.0.2 – safe
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

// ---------- Multer ----------
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },          // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/plain') cb(null, true);
    else cb(new Error('Only .txt files!'), false);
  }
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// ---------- Logger ----------
const logger = {
  info:  msg => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: msg => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn:  msg => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`)
};

// ---------- WhatsApp ----------
const setupBaileys = async () => {
  try {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
    const connect = async () => {
      MznKing = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        logger: require('pino')({ level: 'silent' })
      });

      MznKing.ev.on('connection.update', async u => {
        const { connection, lastDisconnect, qr } = u;
        if (qr) logger.info('QR ready – scan in WhatsApp');
        if (connection === 'open') logger.info('WhatsApp connected');
        if (connection === 'close') {
          const code = lastDisconnect?.error?.output?.statusCode;
          const reconnect = code !== DisconnectReason.loggedOut;
          logger.warn(`Closed (${code})`);
          if (reconnect) setTimeout(connect, 5000);
          else logger.error('Logged out – delete ./auth_info & restart');
        }
      });

      MznKing.ev.on('creds.update', saveCreds);
    };
    await connect();
  } catch (e) {
    logger.error(`Setup: ${e.message}`);
    setTimeout(setupBaileys, 10000);
  }
};
setupBaileys();

// ---------- Stop-key ----------
function generateStopKey() {
  return 'AAHAN-' + Math.floor(1000000 + Math.random() * 9000000);
}

// ---------- HTML Helpers ----------
const errorPage = msg => `<!DOCTYPE html><html><head><title>Error</title><style>
  body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:#fff;}
  .box{background:rgba(255,255,255,.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
  .e{color:#ff6b6b;margin:20px 0;}
  a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
</style></head><body><div class="box"><h2>Error</h2><div class="e">${msg}</div><a href="/">Back</a></div></body></html>`;

const successPage = (msg, sub = '') => `<!DOCTYPE html><html><head><title>Success</title><style>
  body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;color:#fff;}
  .box{background:rgba(255,255,255,.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;text-align:center;max-width:400px;}
  .s{color:#51cf66;margin:20px 0;font-size:18px;}
  a{display:inline-block;padding:12px 25px;background:#ffcc00;color:#333;text-decoration:none;border-radius:10px;font-weight:bold;}
</style></head><body><div class="box"><h2>Success</h2><div class="s">${msg}</div><p>${sub}</p><a href="/">Back</a></div></body></html>`;

// ---------- Home ----------
app.get('/', (req, res) => {
  const showKey = sendingActive && stopKey;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AAHAN WhatsApp Server</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{background:linear-gradient(135deg,#667eea,#764ba2);font-family:Segoe UI,Tahoma,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;color:#fff}
    .c{width:90%;max-width:450px;margin:20px auto;background:rgba(255,255,255,.1);backdrop-filter:blur(10px);padding:30px;border-radius:20px;border:1px solid rgba(255,255,255,.2);box-shadow:0 8px 32px rgba(0,0,0,.3);text-align:center}
    h1{font-size:28px;margin-bottom:10px;text-shadow:0 2px 4px rgba(0,0,0,.3)}
    .sub{color:rgba(255,255,255,.8);font-size:14px;margin-bottom:20px}
    label{display:block;margin:15px 0 5px;font-weight:600;text-align:left}
    input,button{width:100%;padding:12px 15px;margin:8px 0;border-radius:10px;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);color:#fff;font-size:16px;transition:.3s}
    input::placeholder{color:rgba(255,255,255,.6)}
    input:focus{outline:none;border-color:#fff;background:rgba(255,255,255,.15)}
    button{font-weight:bold;cursor:pointer;margin-top:10px;border:none}
    .pair{background:linear-gradient(135deg,#ffcc00,#ff9900);color:#333}
    .start{background:linear-gradient(135deg,#00cc66,#00aa55);color:#fff}
    .stop{background:linear-gradient(135deg,#ff4444,#cc0000);color:#fff}
    button:hover{transform:translateY(-2px);box-shadow:0 5px 15px rgba(0,0,0,.3)}
    .key{margin-top:20px;padding:15px;background:rgba(255,255,255,.1);border-radius:10px}
    .footer{margin-top:25px;font-size:12px;color:rgba(255,255,255,.6)}
  </style>
</head>
<body>
<div class="c">
  <h1>AAHAN</h1>
  <div class="sub">WhatsApp Bulk Sender</div>

  <form action="/pair" method="post">
    <label for="ph">Your Phone Number:</label>
    <input id="ph" name="phoneNumber" placeholder="919876543210" required>
    <button class="pair">GENERATE PAIR CODE</button>
  </form>

  <form action="/send" method="post" enctype="multipart/form-data">
    <label for="tg">Targets (comma separated):</label>
    <input id="tg" name="targetsInput" placeholder="917543864229, group@g.us" required>

    <label for="msg">Message File (.txt):</label>
    <input type="file" id="msg" name="messageFile" accept=".txt" required>

    <label for="hn">Hater Name:</label>
    <input id="hn" name="haterNameInput" placeholder="Name" required>

    <label for="dl">Delay (sec ≥5):</label>
    <input type="number" id="dl" name="delayTime" min="5" required>

    <button class="start">START SENDING</button>
  </form>

  <form action="/stop" method="post">
    <label for="sk">Stop Key:</label>
    <input id="sk" name="stopKeyInput" placeholder="Enter key">
    <button class="stop">STOP SENDING</button>
  </form>

  ${showKey ? `<div class="key"><label>Current Stop Key:</label>
    <input value="${stopKey}" readonly style="background:rgba(255,255,255,.2)">
    <div style="font-size:12px;margin-top:5px;color:#ffcc00">Save it!</div></div>` : ''}

  <div class="footer">© ${new Date().getFullYear()} AAHAN Server</div>
</div>
</body></html>`);
});

// ---------- Pairing ----------
app.post('/pair', async (req, res) => {
  const phone = req.body.phoneNumber?.trim().replace(/\D/g, '');
  if (!phone || phone.length < 10 || phone.length > 15) return res.send(errorPage('Invalid phone number'));

  try {
    if (!MznKing) throw new Error('WhatsApp not ready');
    const code = await MznKing.requestPairingCode(phone);   // 8-digit code
    res.send(successPage(`Pairing Code: <strong>${code}</strong>`, 'Open WhatsApp → Linked Devices → Link with phone number'));
  } catch (e) {
    res.send(errorPage(e.message));
  }
});

// ---------- Send ----------
app.post('/send', upload.single('messageFile'), async (req, res) => {
  try {
    if (!MznKing?.user) throw new Error('WhatsApp not connected');

    const { targetsInput, delayTime, haterNameInput } = req.body;
    haterName = haterNameInput?.trim();
    intervalTime = parseInt(delayTime);
    if (!haterName) throw new Error('Hater name required');
    if (intervalTime < 5) throw new Error('Delay ≥ 5 sec');
    if (!req.file) throw new Error('Upload .txt file');

    messages = req.file.buffer.toString('utf-8')
      .split('\n').map(l => l.trim()).filter(l => l);
    if (!messages.length) throw new Error('Empty message file');

    targets = targetsInput.split(',').map(t => t.trim()).filter(t => t);
    if (!targets.length) throw new Error('No targets');

    stopKey = generateStopKey();
    sendingActive = true;
    if (currentInterval) clearInterval(currentInterval);

    let idx = 0;
    currentInterval = setInterval(async () => {
      if (!sendingActive || idx >= messages.length) {
        clearInterval(currentInterval);
        sendingActive = false;
        logger.info('Sending finished');
        return;
      }
      const txt = `${haterName} ${messages[idx]}`;
      for (const t of targets) {
        if (!sendingActive) break;
        try {
          const jid = t.includes('@g.us') ? t : t.replace(/\D/g, '') + '@s.whatsapp.net';
          await MznKing.sendMessage(jid, { text: txt });
          logger.info(`Sent → ${t}`);
        } catch (e) { logger.error(`Failed ${t}: ${e.message}`); }
        await delay(1000);
      }
      idx++;
    }, intervalTime * 1000);

    res.redirect('/');
  } catch (e) {
    res.send(errorPage(e.message));
  }
});

// ---------- Stop ----------
app.post('/stop', (req, res) => {
  const key = req.body.stopKeyInput?.trim();
  if (key === stopKey) {
    sendingActive = false;
    if (currentInterval) clearInterval(currentInterval);
    stopKey = null;
    res.send(successPage('Sending stopped', 'You can start again'));
  } else {
    res.send(errorPage('Wrong stop key'));
  }
});

// ---------- Server ----------
app.listen(port, () => {
  logger.info(`Server: http://localhost:${port}`);
  logger.info('Connecting WhatsApp...');
});
