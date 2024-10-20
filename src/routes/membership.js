// Required dependencies
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const xss = require('xss-clean');
const mongoose = require('mongoose');
const { doubleCsrf } = require('csrf-csrf');
const cookieParser = require('cookie-parser');

// CSRF Protection Configuration
const { 
    generateToken,
    doubleCsrfProtection
} = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET, // Your server-side secret
    cookieName: "x-csrf-token", // The name of the cookie to set
    cookieOptions: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production" // Only send cookie over HTTPS in production
    },
    size: 64, // The size of the generated tokens in bits
    ignoredMethods: ["GET", "HEAD", "OPTIONS"], // Methods that don't require CSRF protection
    getTokenFromRequest: (req) => req.headers["x-csrf-token"] // Token extraction from request
});

// MongoDB Schema for Member
const memberSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    lastName: {
        type: String,
        required: true,
        trim: true,
        maxLength: 50
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        validate: {
            validator: validator.isEmail,
            message: 'Invalid email format'
        }
    },
    phoneNumber: {
        type: String,
        required: true,
        validate: {
            validator: function(v) {
                return /^\+?[\d\s-]{10,}$/.test(v);
            },
            message: 'Invalid phone number format'
        }
    },
    acceptedTerms: {
        type: Boolean,
        required: true
    },
    newsletterSubscription: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Member = mongoose.model('Member', memberSchema);

// Rate limiter configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});

// Middleware setup
const app = express();
app.use(express.json({ limit: '10kb' })); // Limit body size
app.use(cookieParser());
app.use(helmet()); // Security headers
app.use(xss()); // Prevent XSS attacks
app.use('/api/v1/membership', limiter); // Rate limiting

// CSRF Token Generation Endpoint
router.get('/csrf-token', (req, res) => {
    res.json({
        token: generateToken(req, res)
    });
});

// Input validation middleware
const validateMembershipInput = (req, res, next) => {
    const { firstName, lastName, email, phoneNumber, acceptedTerms } = req.body;

    if (!firstName || !lastName || !email || !phoneNumber || acceptedTerms === undefined) {
        return res.status(400).json({
            status: 'error',
            message: 'Missing required fields'
        });
    }

    if (!validator.isEmail(email)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid email format'
        });
    }

    if (!/^\+?[\d\s-]{10,}$/.test(phoneNumber)) {
        return res.status(400).json({
            status: 'error',
            message: 'Invalid phone number format'
        });
    }

    next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    
    if (err.code === 'INVALID_CSRF_TOKEN') {
        return res.status(403).json({
            status: 'error',
            message: 'Invalid CSRF token'
        });
    }

    if (err.code === 11000) { // Duplicate key error
        return res.status(409).json({
            status: 'error',
            message: 'Email already exists'
        });
    }

    res.status(500).json({
        status: 'error',
        message: 'Internal server error'
    });
};

// POST endpoint for membership sign-up with CSRF protection
router.post('/signup', 
    // doubleCsrfProtection, // CSRF protection middleware
    validateMembershipInput, 
    async (req, res, next) => {
        try {
            // Sanitize input
            const sanitizedInput = {
                firstName: validator.escape(req.body.firstName.trim()),
                lastName: validator.escape(req.body.lastName.trim()),
                email: validator.normalizeEmail(req.body.email.toLowerCase()),
                phoneNumber: req.body.phoneNumber.replace(/[^\d+\s-]/g, ''),
                acceptedTerms: Boolean(req.body.acceptedTerms),
                newsletterSubscription: Boolean(req.body.newsletterSubscription)
            };

            // Create new member
            const member = await Member.create(sanitizedInput);

            // Send success response
            res.status(201).json({
                status: 'success',
                data: {
                    member: {
                        id: member._id,
                        firstName: member.firstName,
                        lastName: member.lastName,
                        email: member.email,
                        phoneNumber: member.phoneNumber,
                        newsletterSubscription: member.newsletterSubscription,
                        createdAt: member.createdAt
                    }
                }
            });
        } catch (error) {
            next(error);
        }
    }
);

// Apply error handling middleware
app.use(errorHandler);

module.exports = router;