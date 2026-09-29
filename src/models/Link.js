const mongoose = require('mongoose');
const { invalidateLinks } = require('../utils/linkCache');

const linkSchema = new mongoose.Schema(
  {
    originalUrl: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, unique: true }, // unique index
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    clickCount: { type: Number, default: 0 }, // incremented on every redirect
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

// --- Redirect cache invalidation ---
// Any delete, or any write touching originalUrl/shortCode, evicts the affected
// short codes from the redirect cache. Old codes are captured before the write
// and evicted after it succeeds. Writes to other fields only (e.g. the
// clickCount $inc on every redirect) skip this, so they don't defeat the cache.
const CACHED_FIELDS = ['originalUrl', 'shortCode'];

const DELETE_OPS = ['deleteOne', 'deleteMany', 'findOneAndDelete'];
const REPLACE_OPS = ['replaceOne', 'findOneAndReplace'];
const UPDATE_OPS = ['updateOne', 'updateMany', 'findOneAndUpdate'];

function touchesCachedFields(update) {
  if (!update || Array.isArray(update)) return true; // aggregation pipeline: assume yes
  const paths = Object.entries(update).flatMap(([key, value]) =>
    key.startsWith('$') && value && typeof value === 'object' ? Object.keys(value) : [key]
  );
  return paths.some((path) => CACHED_FIELDS.includes(path.split('.')[0]));
}

linkSchema.pre([...DELETE_OPS, ...REPLACE_OPS, ...UPDATE_OPS], async function () {
  if (UPDATE_OPS.includes(this.op) && !touchesCachedFields(this.getUpdate())) return;
  const docs = await this.model.find(this.getFilter(), { shortCode: 1 }).lean();
  this._staleShortCodes = docs.map((doc) => doc.shortCode);
});

linkSchema.post([...DELETE_OPS, ...REPLACE_OPS, ...UPDATE_OPS], async function () {
  if (this._staleShortCodes?.length) await invalidateLinks(this._staleShortCodes);
});

// Document-level save / deleteOne (e.g. link.originalUrl = x; await link.save()).
// Remember the short code as loaded so a changed code evicts the old key too.
linkSchema.post('init', function () {
  this.$locals.loadedShortCode = this.shortCode;
});

linkSchema.pre('save', function () {
  this.$locals.invalidateOnSave =
    !this.isNew && CACHED_FIELDS.some((field) => this.isModified(field));
});

linkSchema.post('save', async function () {
  if (this.$locals.invalidateOnSave) {
    const { loadedShortCode = this.shortCode } = this.$locals;
    await invalidateLinks([...new Set([loadedShortCode, this.shortCode])]);
  }
  this.$locals.loadedShortCode = this.shortCode;
});

linkSchema.post('deleteOne', { document: true, query: false }, async function () {
  await invalidateLinks([this.shortCode]);
});

module.exports = mongoose.model('Link', linkSchema);
