const mongoose = require('mongoose');

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
    // bcrypt hash, never plaintext. Excluded from queries by default.
    password: { type: String, required: true, select: false },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      // Never leak the hash or internal fields in API responses
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('User', userSchema);
