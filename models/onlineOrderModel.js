import mongoose from 'mongoose';

const { Schema } = mongoose;

const onlineOrderSchema = new Schema({
  orderId: {
    type: String,
    required: true,
    unique: true
  },
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      },
  address: {
    type: String,
    required: true
  },
  coordinates: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true }
  },
  paymentMethod: {
    type: String,
    enum: ['cod', 'online'],
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  cartItems: [
    {
      _id: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
      name: { type: String, required: true },
      offer: { type: Number, default: 0 },
      image: { type: String, required: true },
      description: { type: String },
      category: { type: Schema.Types.ObjectId, ref: 'ItemCategory' },
      subcategory: { type: Schema.Types.ObjectId, ref: 'Subcategory' },
      isVeg: { type: Boolean, required: true },
      quantity: { type: Number, required: true },
      variant: { type: String, default: null },
      price: { type: Number, required: true }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  }
}, { timestamps: true });

export default mongoose.model('onlineOrder', onlineOrderSchema);
