// server.js

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors');
const compression = require('compression');
const { connectDB, checkMongoHealth } = require('./config/database');
require('dotenv').config();

// Import routes
const membershipRoutes = require('./routes/membership');

// Initialize express app
const app = express();

// Environment variables validation
const requiredEnvVars = [
    'MONGODB_URI',
    'CSRF_SECRET',
    'NODE_ENV'
];

// Validate required environment variables
requiredEnvVars.forEach(varName => {
    if (!process.env[varName]) {
        console.error(`Error: Environment variable ${varName} is required`);
        process.exit(1);
    }
});

// Environment Configuration
const config = {
    port: parseInt(process.env.PORT, 10) || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongo: {
        uri: process.env.MONGODB_URI,
        dbName: process.env.MONGODB_DB_NAME || 'membership_db',
        username: process.env.MONGODB_USERNAME,
        password: process.env.MONGODB_PASSWORD,
        poolSize: parseInt(process.env.MONGODB_POOL_SIZE, 10) || 10
    },
    cors: {
        origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
        credentials: true
    }
};

// Connect to MongoDB and start server
(async () => {
    try {
        await connectDB();
        startServer();
        
        // Schedule periodic health checks
        setInterval(async () => {
            const healthStatus = await checkMongoHealth();
            if (!healthStatus.isHealthy) {
                console.error('MongoDB health check failed:', healthStatus);
            }
        }, 30000); // Check every 30 seconds
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
})();

// Server startup function
function startServer() {
    // Middleware
    app.use(helmet());
    app.use(cors(config.cors));
    app.use(compression());
    app.use(express.json({ limit: '10kb' }));
    app.use(express.urlencoded({ extended: true, limit: '10kb' }));

    // Logging
    if (config.nodeEnv === 'development') {
        app.use(morgan('dev'));
    } else {
        app.use(morgan('combined'));
    }

    // Request timestamp
    app.use((req, res, next) => {
        req.requestTime = new Date().toISOString();
        next();
    });

    // Enhanced health check endpoint
    app.get('/health', async (req, res) => {
        const mongoHealth = await checkMongoHealth();
        
        res.status(mongoHealth.isHealthy ? 200 : 503).json({
            status: mongoHealth.isHealthy ? 'success' : 'error',
            timestamp: req.requestTime,
            environment: config.nodeEnv,
            database: mongoHealth
        });
    });

    // API routes
    app.use('/api/v1/membership', membershipRoutes);

    // 404 handler
    app.use('*', (req, res) => {
        res.status(404).json({
            status: 'error',
            message: `Can't find ${req.originalUrl} on this server!`
        });
    });

    // Global error handler
    app.use((err, req, res, next) => {
        err.statusCode = err.statusCode || 500;
        err.status = err.status || 'error';

        if (config.nodeEnv === 'development') {
            res.status(err.statusCode).json({
                status: err.status,
                error: err,
                message: err.message,
                stack: err.stack
            });
        } else {
            res.status(err.statusCode).json({
                status: err.status,
                message: err.message
            });
        }
    });

    // Start server
    const server = app.listen(config.port, () => {
        console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
    });

    // Handle unhandled rejections
    process.on('unhandledRejection', (err) => {
        console.error('UNHANDLED REJECTION! 💥 Shutting down...');
        console.error(err.name, err.message);
        server.close(() => {
            mongoose.connection.close();
            process.exit(1);
        });
    });
}

module.exports = app;