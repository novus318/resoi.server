import mongoose from 'mongoose';

const { Schema } = mongoose;

const tableOrderSchema = new Schema({
  table: {
    type: Schema.Types.ObjectId,
    ref: 'Table',
    required: function() {
      return this.orderType === 'dining'; // Table required only for dining orders
    }
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  user: {
    type: Schema.Types.ObjectId,
    required: true,
    refPath: 'userType',
  },
  userType: {
    type: String,
    required: true,
    enum: ['User', 'AdminUser'],
  },  
  paymentMethod: {
    type: String,
    enum: ['cash', 'online'],
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
  orderType: {
    type: String,
    enum: ['dining', 'parcel'],
    required: true
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

export default mongoose.model('tableOrder', tableOrderSchema);
