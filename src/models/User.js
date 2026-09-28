const mongoose = require('mongoose');

// Schema only — hashing/auth logic comes later.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true, // creates a unique index
      lowercase: true,
      trim: true,
    },
    // Will store a hash, never plaintext. Excluded from queries by default.
    password: { type: String, required: true, select: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('User', userSchema);
