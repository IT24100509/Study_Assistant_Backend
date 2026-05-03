const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { AppError } = require("../middleware/errorMiddleware");
const { sendSuccess, sendCreated } = require("../utils/response");

// ── ASYNC HANDLER: Wrap route handlers to catch errors automatically ──────────
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

// ── REGISTER new user ─────────────────────────────────────────────────────────
const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });
  if (userExists) {
    throw new AppError("User with this email already exists", 400);
  }

  // Hash password
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  // Create user
  const user = await User.create({
    name,
    email,
    password: hashedPassword
  });

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id)
  };

  sendCreated(res, userData, "User registered successfully");
});

// ── LOGIN user ────────────────────────────────────────────────────────────────
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email
  const user = await User.findOne({ email });
  if (!user) {
    throw new AppError("Invalid email or password", 401);
  }

  // Compare passwords
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new AppError("Invalid email or password", 401);
  }

  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    token: generateToken(user._id)
  };

  sendSuccess(res, userData, "Login successful");
});

// ── LOGOUT user ───────────────────────────────────────────────────────────────
// Since JWT is stateless, logout is handled client-side by removing the token
const logout = asyncHandler(async (req, res) => {
  sendSuccess(res, null, "Logged out successfully");
});

module.exports = { register, login, logout };