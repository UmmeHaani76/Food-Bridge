import mongoose from 'mongoose';

// Define Token Schema
const tokenSchema = new mongoose.Schema({
  donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Refers to the donor (user)
  type: { type: String, required: true }, // Type of food (e.g., Veg or Non-Veg)
  quantity: { type: String, required: true }, // Quantity of food
  location: { type: String, required: true }, // Location address
  coordinates: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  }, // Precise location coordinates
  status: {
    type: String,
    enum: ["Available", "Claimed"],
    default: "Available",
  }, // Token status
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  }, // Recipient (NGO) when claimed
  createdAt: { type: Date, default: Date.now }, // When the token was created
});

// Create Token Model
const Token = mongoose.model("Token", tokenSchema);

export default Token;
