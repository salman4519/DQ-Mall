const mongoose = require("mongoose");
const { Schema } = mongoose; // Extract Schema from mongoose

const productSchema = new Schema({
    Description: { type: String, required: true },
    CategoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
    Name: { type: String, required: true, unique: true },
    Size: { type: String, required: true },
    Images: [{ type: String, required: true }],  // Array of image URLs
    Quantity: { type: Number, required: true },
    Price: { type: Number, required: true },
    Is_list: { type: Boolean, required: true, default: false },  // Default value is false
}, {
    timestamps: true,  // Automatically add CreatedAt and UpdatedAt fields
});

module.exports = mongoose.model("Product", productSchema);
