import mongoose from 'mongoose';

const { Schema } = mongoose;

const subcategorySchema = new Schema({
    name: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'ItemCategory',
        required: true
    },
    description: {
        type: String
    },
    image: {
        type: String,
    }
}, { timestamps: true });

export default mongoose.model('Subcategory', subcategorySchema);
