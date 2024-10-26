import mongoose from 'mongoose';

const { Schema } = mongoose;

const tableSchema = new Schema({
    tableName: {
        type: String,
        required: true,
        unique: true
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'reserved'],
        default: 'available'
    },
    categories: [{
        value:{
            type: Schema.Types.ObjectId,
        ref: 'ItemCategory'
        },
        label:{
            type: String
        }
    }]
}, { timestamps: true });

export default mongoose.model('Table', tableSchema);
