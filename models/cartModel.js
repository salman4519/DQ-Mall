const mongoose = require("mongoose");
const { Schema } = mongoose;

const cartSchema = new Schema({
  Products: [{
    ProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // References Product model // Quantity of the product
    Price: { type: Number, required: true } // Price at the time of adding the product to cart
  }],
  UserId: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // References User model
}, {
  timestamps: true // Automatically handles createdAt and updatedAt fields
});

module.exports = mongoose.model("Cart", cartSchema);
