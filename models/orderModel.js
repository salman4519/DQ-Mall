const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who placed the order
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Reference to the product
            quantity: { type: Number, required: true, default: 1 },
            price: { type: Number, required: true }
        }
    ],
    shippingAddress: {
        address: { type: String, required: true },
        city: { type: String, required: true },
        postalCode: { type: String, required: true },
        country: { type: String, required: true }
    },
    paymentMethod: { type: String, required: true }, // e.g., 'Credit Card', 'PayPal'
    paymentStatus: { type: String, default: 'Pending' }, // e.g., 'Pending', 'Paid'
    totalPrice: { type: Number, required: true }, // Total price of the order
    orderStatus: { type: String, default: 'Processing' }, // e.g., 'Processing', 'Shipped', 'Delivered', 'Cancelled'
    isDelivered: { type: Boolean, default: false }, // Delivery status
    deliveredAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Order", orderSchema);
