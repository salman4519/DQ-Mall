const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discountType: { type: String, enum: ['fixed', 'percentage'], required: true },
  discountValue: { type: Number, required: true },
  minOrderValue: { type: Number, default: 0 }, // minimum order value to apply the coupon
  startDate: { type: Date, required: true },
  expirationDate: { type: Date, required: true },
  usageLimit: { type: Number, default: 1 }, // how many times the coupon can be used
  usedCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
});

const Coupon = mongoose.model('Coupon', couponSchema);
