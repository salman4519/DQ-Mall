const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  couponCode: {
    type: String,
    required: true,
    unique: true
  },
  discountPercentage: {
    type: Number,
    required: true
  },
  maxDiscountAmount: {
    type: Number,
    required: true // This field ensures that the maximum discount amount is specified
  },
  expiryDate: {
    type: Date,
    required: true
  },
  minPurchase: {
    type: Number,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true // Automatically set to true when a new coupon is added
  }
}, { timestamps: true });

const Coupon = mongoose.model('Coupon', couponSchema);
module.exports = Coupon;
