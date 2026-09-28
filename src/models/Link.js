const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema(
  {
    originalUrl: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, unique: true }, // unique index
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clickCount: { type: Number, default: 0 }, // populated by click analytics (next step)
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model('Link', linkSchema);
