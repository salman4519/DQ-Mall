// models/Wallet.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const walletSchema = new Schema({
    UserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    Balance: { type: Number, default: 0 }
}, {
    timestamps: true
});

module.exports = mongoose.model('Wallet', walletSchema);
