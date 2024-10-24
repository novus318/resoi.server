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
    deliveryAdress:{
        type: String,
    },
    deliveryCoordinates:{
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    ipAddress: {
        type: String
    },
    placeOfOperation:{
        type: String
    },
    isp:{
        type: String
    },
    coordinates:{
        type: [Number] 
    },
    device:{
        type: String
    }
}, { timestamps: true });

export default mongoose.model('User', normalUserSchema);
