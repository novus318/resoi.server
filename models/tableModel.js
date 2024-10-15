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
    }
}, { timestamps: true });

export default mongoose.model('Table', tableSchema);
