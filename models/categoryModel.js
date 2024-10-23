const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    imageUrl: { type: String, required: true },
    isList: { type: Boolean, default: true },
  },
  { timestamps: true }
); // Automatically manages CreatedAt and UpdatedAt

module.exports = mongoose.model("Category", categorySchema);
