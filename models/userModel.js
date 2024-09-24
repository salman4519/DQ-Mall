const mongoose = require("mongoose");


const userSchema = new mongoose.Schema({
    Email: { type: String, required: true, unique: true },
    Username: { type: String, required: true },
    Mobile: { type: String, required: false },
    UpdatedAt: { type: Date, required: true, default: new Date() },
    CreatedAt: { type: Date, required: true, default: new Date() },
    Password: { type: String, required: true }, // Optional for Google login
    GoogleId: { type: String }, // Add this for Google OAuth
    Is_admin: { type: Boolean, required: true, default: false },
    Is_block: { type: Boolean, required: true, default: false },
    Is_verified: { type: Boolean, required: true, default: false },
    OTP: { type: String },
    otpExpiresAt: { type: Date } // Used for OTP verification
});


module.exports = mongoose.model("User", userSchema)