import mongoose from 'mongoose';

const { Schema } = mongoose;

const itemSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true
    },
    image: {
        type: String, 
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
    }
}, { timestamps: true });

export default mongoose.model('Item', itemSchema);
