import mongoose from 'mongoose';

const { Schema } = mongoose;

const variantSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
});

const itemSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: function() {
            return this.variants == null || this.variants.length === 0;
        }
    },
    offer:{
        type: Number,
        default: 0
    },
    image: {
        type: String
    },
    status: {
        type: String,
        enum: ['available', 'unavailable', 'coming soon'],
        default: 'available'
    },
    description: {
        type: String
    },
    ingredients: [{
        type: String 
    }],
    category: {
        type: Schema.Types.ObjectId,
        ref: 'ItemCategory',
        required: true
    },
    subcategory: {
        type: Schema.Types.ObjectId,
        ref: 'Subcategory'
    },
    variants: [variantSchema],
    isVeg: {
        type: Boolean,
        default: false 
    },
    isAvailable: {
        type: Boolean,
        default: true 
    },
    rating: {
        type: Number,
        default: 0, 
        min: 0,
        max: 5
    },
    ratingCount: {
        type: Number,
        default: 0 
    }
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
