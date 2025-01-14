import mongoose from "mongoose";

const salarySchema = new mongoose.Schema({
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'staff', required: true },
  amount: { type: Number, required: true },
  netPay: { type: Number }, 
  paymentDate: { type: Date, required: true }, // Ensure paymentDate is required
  status: { type: String, enum: ['Pending', 'Paid', 'Rejected'], default: 'Pending' },
  rejectionReason: { type: String },
}, 
{ timestamps: true }); // To track creation and update times

export default mongoose.model('salary', salarySchema);