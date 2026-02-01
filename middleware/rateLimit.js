const rateLimit = require('express-rate-limit');

// Different limiters for different paths
const createLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: { error: message },
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: true,
        keyGenerator: (req) => {
            // Use fingerprint if available, else IP
            return req.fingerprint || req.ip;
        },
        skip: (req) => {
            // Skip rate limiting for certain conditions
            return req.userAgent?.isInstagram || 
                   req.path.includes('health') ||
                   req.ip === '127.0.0.1';
        }
    });
};

// API limiter (strict)
const apiLimiter = createLimiter(
    15 * 60 * 1000, // 15 minutes
    50, // 50 requests per window
    'Too many API requests from this device'
);

// Auth limiter (very strict)
const authLimiter = createLimiter(
    60 * 60 * 1000, // 1 hour
    5, // 5 login attempts per hour
    'Too many authentication attempts'
);

// General limiter
const generalLimiter = createLimiter(
    60 * 1000, // 1 minute
    100, // 100 requests per minute
    'Too many requests'
);

module.exports = {
    apiLimiter,
    authLimiter,
    generalLimiter
};
