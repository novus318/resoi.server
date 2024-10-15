import mongoose from 'mongoose';

const { Schema } = mongoose;

const normalUserSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    mobileNumber: {
        type: String,
        required: true,
        unique: true
    },
    ipAddress: {
        type: String
    }
}, { timestamps: true });

export default mongoose.model('User', normalUserSchema);
