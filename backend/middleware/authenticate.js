import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";

// Middleware to verify JWT token
export function authenticateToken(req, res, next) {
  console.log('Authentication middleware started');
  console.log('Received Authorization header:', req.header("Authorization"));
  
  const authHeader = req.header("Authorization");

  if (!authHeader) {
    console.log('No Authorization header found');
    return res.status(401).json({ message: "Access denied. No token provided." });
  }

  // Extract token from Bearer string
  const token = authHeader.startsWith('Bearer ') 
    ? authHeader.slice(7) 
    : authHeader;
    
  console.log('Processing token:', token.substring(0, 20) + '...');

  try {
    // Verify and decode the token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    console.log('Token successfully decoded:', {
      userId: decoded.userId,
      role: decoded.role,
      email: decoded.email,
      tokenExp: new Date(decoded.exp * 1000).toISOString()
    });

    // Check if token is about to expire (within 1 hour)
    const expirationTime = decoded.exp * 1000; // Convert to milliseconds
    const oneHour = 60 * 60 * 1000;
    if (expirationTime - Date.now() < oneHour) {
      console.log('Token is about to expire');
    }

    // Attach decoded user info to request
    req.user = decoded;
    next();
  } catch (error) {
    console.log('Token verification failed:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: "Token has expired. Please log in again.",
        expired: true
      });
    }
    return res.status(403).json({ message: "Invalid token." });
  }
};

export default authenticateToken;
