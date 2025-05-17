import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import validateRegistration from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import dotenv from 'dotenv';
import { authenticateToken } from '../middleware/authenticate.js';

const router = express.Router();

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// POST /login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // User existence check
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "User not found." });
    }

    // Password match check
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: "Invalid password." });
    }

    // Token generation with more user data
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      {
        expiresIn: "24h", // Extended to 24 hours
      }
    );

    // Log token generation
    console.log('Generated token for user:', { 
      userId: user._id, 
      role: user.role, 
      email: user.email 
    });

    // Successful login response
    res.status(200).json({
      message: "Login successful.",
      token,
      role: user.role,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// POST /register - Register a new user
router.post("/register", validateRegistration, async (req, res) => {
  try {
    const { name, email, phone, password, location, role } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email." });
    }

    // Create a new user
    const user = new User({
      name,
      email,
      phone,
      password,
      location,
      role,
    });

    // Save the user to the database
    await user.save();

    // Generate JWT token with more user data
    const token = jwt.sign(
      { 
        userId: user._id, 
        role: user.role,
        email: user.email,
        name: user.name
      }, 
      JWT_SECRET, 
      {
        expiresIn: "24h", // Extended to 24 hours
      }
    );

    // Log token generation
    console.log('Generated token for new user:', { 
      userId: user._id, 
      role: user.role, 
      email: user.email 
    });

    // Send success response with the JWT token
    res.status(201).json({
      message: "User registered successfully.",
      token,
      role: user.role,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error("Error during registration:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// GET /me - Get current user's data
router.get('/me', authenticateToken, async (req, res) => {
  res.json(req.user);
});

export default router;
