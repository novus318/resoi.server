import mongoose from 'mongoose';

const { Schema } = mongoose;

const storeSchema = new Schema({
  storeStatus: {
    type: String,
    enum: ['open', 'closed'],
    default: 'closed', // Default state can be set as needed
  },
}, { timestamps: true });

export default mongoose.model('Store', storeSchema);
