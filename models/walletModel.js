const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  UserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  Balance: { type: Number, default: 0 },
  Transactions: [
    {
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      type: { type: String, enum: ["credit", "debit"], required: true },
      reason: { type: String }, // Add this line for the reason
    },
  ],
});

const Wallet = mongoose.model("Wallet", walletSchema);
module.exports = Wallet;
