import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current file path in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
    origin: ['http://localhost:8080', 'http://127.0.0.1:8080'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Import Routes
import authRoutes from './routes/auth.js';
import tokenRoutes from './routes/token.js';
import mapRouter from './routes/map.js';

// Serve static files - try multiple directories
const staticDirs = [
    path.join(__dirname, '..'),          // Parent directory
    path.join(__dirname, '../..'),       // Two levels up
    path.join(__dirname, '../public'),   // Public directory if exists
];

// Set up static file serving for each directory
staticDirs.forEach(dir => {
    app.use(express.static(dir));
});

// API Routes - make sure these come after static files
app.use("/api/auth", authRoutes);
app.use("/api/token", tokenRoutes);
app.use('/api', mapRouter);

// Basic route for testing
app.get('/test', (req, res) => {
    res.json({ message: "Server is working!" });
});

// Connect to MongoDB
mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch((err) => console.error("MongoDB connection failed:", err));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    
    // Log the directories being served
    console.log('Serving static files from:');
    staticDirs.forEach(dir => {
        console.log('-', dir);
    });
});