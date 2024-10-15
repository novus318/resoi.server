import mongoose from 'mongoose';

const { Schema } = mongoose;

const itemCategorySchema = new Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String
    },
    image:{
        type: String,
    }
}, { timestamps: true });

export default mongoose.model('ItemCategory', itemCategorySchema);
