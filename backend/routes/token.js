import express from 'express';
import Token from '../models/Token.js';
import authenticate from '../middleware/authenticate.js';

const router = express.Router();

// POST /api/token - Create a new food token (donor creates token for food)
router.post("/", authenticate, async (req, res) => {
  try {
    console.log('Received token creation request:', req.body); // Debug log
    console.log('User:', req.user); // Debug log

    if (req.user.role !== 'Donor') {
      return res.status(403).json({ success: false, message: 'Only donors can create tokens' });
    }

    const { type, quantity, location, coordinates } = req.body;

    // Debug log for validation
    console.log('Validating fields:', {
      type: !!type,
      quantity: !!quantity,
      location: !!location,
      coordinates: !!coordinates,
      latitude: coordinates?.latitude,
      longitude: coordinates?.longitude
    });

    if (!type || !quantity || !location || !coordinates || !coordinates.latitude || !coordinates.longitude) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const token = new Token({
      donor: req.user.userId,
      type,
      quantity,
      location,
      coordinates: {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude
      },
      status: "Available", // Initial status when the token is created
      createdAt: new Date(),
    });

    console.log('Token object before save:', token);

    // Save the token to the database
    await token.save();
    console.log('Token saved successfully');

    res.status(201).json({ success: true, token });
  } catch (error) {
    console.error("Error creating token:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
});

// GET /api/token - Get all available tokens (for NGOs to view)
router.get("/", authenticate, async (req, res) => {
  try {
    // Calculate expiry cutoff time (4 hours ago)
    const expiryCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // Fetch all available tokens (status 'Available') created within last 4 hours
    const tokens = await Token.find({
      status: "Available",
      createdAt: { $gte: expiryCutoff },
    }).populate("donor", "name location");

    res.status(200).json({ tokens });
  } catch (error) {
    console.error("Error fetching tokens:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// PATCH /api/token/:id/claim - Claim a token (NGO claims the food)
router.patch("/:id/claim", authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'NGO') {
      return res.status(403).json({ success: false, message: 'Only NGOs can claim tokens' });
    }

    const { id } = req.params;

    // Find the token by ID
    const token = await Token.findById(id);

    // Check if the token exists and is available
    if (!token || token.status !== "Available") {
      return res
        .status(400)
        .json({ success: false, message: "Token not available or already claimed." });
    }

    // Update the status to 'Claimed' and assign the recipient
    token.status = "Claimed";
    token.recipient = req.user.userId; // Assign the recipient (NGO) userId

    // Save the updated token
    await token.save();

    res.status(200).json({ success: true, token });
  } catch (error) {
    console.error("Error claiming token:", error);
    res.status(500).json({ success: false, message: "Server error. Please try again later." });
  }
});

// Route to get tokens created by the logged-in donor (Dashboard)
router.get("/donor-dashboard", authenticate, async (req, res) => {
  try {
    const { userId } = req.user;
    console.log('Fetching tokens for user:', userId); // Debug log

    // Calculate expiry cutoff time (4 hours ago)
    const expiryCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);

    // Fetch tokens created by the logged-in donor within last 4 hours
    const tokens = await Token.find({
      donor: userId,
      createdAt: { $gte: expiryCutoff },
    }).populate("donor", "name location");

    console.log('Found tokens:', tokens); // Debug log

    // Return tokens (even if empty array)
    res.status(200).json({ tokens });
  } catch (error) {
    console.error("Error fetching donor's tokens:", error);
    res.status(500).json({ message: "Server error. Please try again later." });
  }
});

// Update token
router.put("/:id", authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, quantity, location } = req.body;
        const userId = req.user.userId;

        const token = await Token.findOne({ _id: id, donor: userId });
        
        if (!token) {
            return res.status(404).json({ message: "Token not found or unauthorized" });
        }

        if (token.status !== "Available") {
            return res.status(400).json({ message: "Cannot update claimed or expired token" });
        }

        token.type = type;
        token.quantity = quantity;
        token.location = location;

        await token.save();
        res.json({ message: "Token updated successfully", token });
    } catch (error) {
        console.error("Error updating token:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// Delete token
router.delete("/:id", authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.userId;

        const token = await Token.findOne({ _id: id, donor: userId });
        
        if (!token) {
            return res.status(404).json({ message: "Token not found or unauthorized" });
        }

        if (token.status !== "Available") {
            return res.status(400).json({ message: "Cannot delete claimed token" });
        }

        await token.deleteOne();
        res.json({ message: "Token deleted successfully" });
    } catch (error) {
        console.error("Error deleting token:", error);
        res.status(500).json({ message: "Server error" });
    }
});

// GET /api/token/ngo-claimed - Get tokens claimed by the logged-in NGO
router.get("/ngo-claimed", authenticate, async (req, res) => {
    try {
        const { userId } = req.user;

        // Fetch tokens claimed by this NGO
        const tokens = await Token.find({
            recipient: userId,
            status: "Claimed"
        }).populate("donor", "name location");

        res.status(200).json({ tokens });
    } catch (error) {
        console.error("Error fetching claimed tokens:", error);
        res.status(500).json({ message: "Server error. Please try again later." });
    }
});

// Get all available tokens
router.get('/available', authenticate, async (req, res) => {
    try {
        const tokens = await Token.find({ 
            status: 'Available'
        }).populate('donor', 'name');
        
        res.json({ success: true, tokens });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get NGO's claimed tokens
router.get('/claimed', authenticate, async (req, res) => {
    try {
        const tokens = await Token.find({
            recipient: req.user.userId,
            status: 'Claimed'
        }).populate('donor', 'name');
        
        res.json({ success: true, tokens });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get specific token
router.get('/:id', authenticate, async (req, res) => {
    try {
        const token = await Token.findById(req.params.id).populate('donor', 'name');
        if (!token) {
            return res.status(404).json({ success: false, message: 'Token not found' });
        }
        res.json({ success: true, token });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
