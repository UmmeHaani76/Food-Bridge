// middleware/validate.js

const validateRegistration = (req, res, next) => {
  const { name, email, phone, password, location, role } = req.body;

  // Basic checks
  if (!name || !email || !phone || !password || !location || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format." });
  }

  // Phone number must start with +91 and be valid
  const phoneRegex = /^\+91\d{10}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({
      message:
        "Phone number must start with +91 and contain 10 digits after it.",
    });
  }

  // Password strength check (min 6 characters)
  if (password.length < 6) {
    return res
      .status(400)
      .json({ message: "Password must be at least 6 characters long." });
  }

  // Role validation
  if (!["Donor", "NGO"].includes(role)) {
    return res
      .status(400)
      .json({ message: "Role must be either 'Donor' or 'NGO'." });
  }

  next();
};

export default validateRegistration;
