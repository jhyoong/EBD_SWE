// config/database.js

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        // Modern MongoDB Connection Options
        const options = {
            maxPoolSize: parseInt(process.env.MONGODB_POOL_SIZE) || 10,
            minPoolSize: 5,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            family: 4, // Use IPv4, skip trying IPv6
            autoIndex: process.env.NODE_ENV === 'development', // Build indexes in development only
            heartbeatFrequencyMS: 10000, // Check server health every 10 seconds
            connectTimeoutMS: 30000 // Initial connection timeout after 30 seconds
        };

        // Handle authentication if credentials are provided
        if (process.env.MONGODB_USERNAME && process.env.MONGODB_PASSWORD) {
            options.auth = {
                username: process.env.MONGODB_USERNAME,
                password: process.env.MONGODB_PASSWORD
            };
        }

        // Connection with modern options
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`MongoDB Database: ${conn.connection.name}`);

        // Set up connection event handlers
        mongoose.connection.on('connected', () => {
            console.log('Mongoose connected to MongoDB');
        });

        mongoose.connection.on('error', (err) => {
            console.error('Mongoose connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.log('Mongoose disconnected from MongoDB');
        });

        // Monitor connection state changes
        mongoose.connection.on('all', () => {
            console.log(`MongoDB connection state: ${mongoose.connection.readyState}`);
        });

        // Handle application termination
        process.on('SIGINT', async () => {
            try {
                await mongoose.connection.close();
                console.log('MongoDB connection closed through app termination');
                process.exit(0);
            } catch (err) {
                console.error('Error during MongoDB disconnection:', err);
                process.exit(1);
            }
        });

        return conn;
    } catch (error) {
        console.error('MongoDB connection error:', error);
        // Provide more detailed error information
        if (error.name === 'MongoServerSelectionError') {
            console.error('Could not connect to any MongoDB servers');
            console.error('Please check your MongoDB URI and ensure the database server is running');
        }
        if (error.name === 'MongoParseError') {
            console.error('Invalid MongoDB connection string');
            console.error('Please check your MONGODB_URI environment variable');
        }
        process.exit(1);
    }
};

// Utility function to check if MongoDB is healthy
const checkMongoHealth = async () => {
    try {
        if (mongoose.connection.readyState !== 1) {
            return {
                isHealthy: false,
                status: 'Not connected',
                readyState: mongoose.connection.readyState
            };
        }

        // Perform a simple operation to test the connection
        await mongoose.connection.db.admin().ping();
        return {
            isHealthy: true,
            status: 'Connected',
            readyState: mongoose.connection.readyState,
            host: mongoose.connection.host,
            database: mongoose.connection.name
        };
    } catch (error) {
        return {
            isHealthy: false,
            status: 'Error',
            error: error.message,
            readyState: mongoose.connection.readyState
        };
    }
};

module.exports = {
    connectDB,
    checkMongoHealth
};