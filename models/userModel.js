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
        lat: { type: Number },
        lng: { type: Number }
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
        lat: { type: Number },
        lng: { type: Number }
    },
    device:{
        type: String
    }
}, { timestamps: true });

export default mongoose.model('User', normalUserSchema);
