// monitor.js - Monitoring and alerting
const axios = require('axios');
const telegram = require('./utils/telegram');

class Monitor {
    constructor() {
        this.checks = [];
        this.interval = 60000; // 1 minute
    }
    
    addCheck(name, checkFn) {
        this.checks.push({ name, checkFn });
    }
    
    async start() {
        console.log('[MONITOR] Starting monitoring system...');
        
        setInterval(async () => {
            for (const check of this.checks) {
                try {
                    await check.checkFn();
                } catch (error) {
                    console.error(`[MONITOR FAIL] ${check.name}:`, error.message);
                    await telegram.sendAlert(`⚠️ ${check.name} FAILED: ${error.message}`);
                }
            }
        }, this.interval);
    }
    
    async checkWebsite() {
        const response = await axios.get('https://growth.instagram-business.net/health', {
            timeout: 10000
        });
        
        if (response.status !== 200) {
            throw new Error(`Website returned ${response.status}`);
        }
    }
    
    async checkTelegram() {
        await telegram.sendAlert('[MONITOR] System check - OK');
    }
    
    async checkDiskSpace() {
        const fs = require('fs');
        const stats = fs.statfsSync('/');
        const freePercent = (stats.bfree / stats.blocks) * 100;
        
        if (freePercent < 10) {
            throw new Error(`Low disk space: ${freePercent.toFixed(1)}% free`);
        }
    }
    
    async checkLogs() {
        const logger = require('./utils/logger');
        const stats = logger.getStats();
        
        if (stats.totalSize > 100 * 1024 * 1024) { // 100MB
            throw new Error(`Logs size too large: ${(stats.totalSize / 1024 / 1024).toFixed(1)}MB`);
        }
    }
}

// Initialize monitoring
const monitor = new Monitor();

monitor.addCheck('Website Health', monitor.checkWebsite);
monitor.addCheck('Telegram Connection', monitor.checkTelegram);
monitor.addCheck('Disk Space', monitor.checkDiskSpace);
monitor.addCheck('Logs Size', monitor.checkLogs);

module.exports = monitor;
