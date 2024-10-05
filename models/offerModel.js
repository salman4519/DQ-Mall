const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const offerSchema = new Schema({
    name: {
        type: String,
        required: true // Ensuring that the offer name is required
    },
    discountPercentage: {
        type: Number,
        required: true
    },
    applicableTo: {
        type: String,
        enum: ['product', 'category'],
        required: true
    },
    productIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null
    }],
    categoryIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    }],
    startTime: {
        type: Date,
        required: true
    },
    endTime: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true // Defaulting to active when the offer is created
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date
    }
});

// Pre-save hook to update the `updatedAt` field on every update
offerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

const Offer = mongoose.model('Offer', offerSchema);

module.exports = Offer;
