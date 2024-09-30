const mongoose = require("mongoose");
const { Schema } = mongoose;

const orderSchema = new Schema({
    OrderId: { type: String, unique: true },
    PaymentMethod: { type: String, required: true },
    UserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    Products: [{
        ProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        Quantity: { type: Number, required: true },
    }],
    TotalPrice: { type: Number, required: true },
    ShippingAddress: { type: Schema.Types.ObjectId, ref: 'Address', required: true }, // Reference to an existing address document
    Status: { type: String, required: true, default: 'Pending' }
}, {
    timestamps: true
});

orderSchema.pre('save', function (next) {
    if (this.isNew) {
        this.OrderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    next();
});

module.exports = mongoose.model('Order', orderSchema);
