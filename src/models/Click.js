const mongoose = require('mongoose');

// One document per short-link visit (raw event log for analytics).
const clickSchema = new mongoose.Schema(
  {
    link: { type: mongoose.Schema.Types.ObjectId, ref: 'Link', required: true },
    timestamp: { type: Date, default: Date.now },
    referrer: { type: String, default: null }, // null = direct visit (no Referer header)
    userAgent: { type: String, default: null },
    ipAddress: { type: String, default: null },
  },
  {
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

// Serves every analytics query: filter by link, then sort/range by time
clickSchema.index({ link: 1, timestamp: -1 });

module.exports = mongoose.model('Click', clickSchema);
