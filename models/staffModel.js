import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: ['Advance Payment', 'Salary Deduction'],
    required: true 
  },
  amount: { 
    type: Number, 
    required: true 
  },
  date: { 
    type: Date, 
    default: Date.now 
  },
  description: String,
});

const staffSchema = new mongoose.Schema({
  name: { type: String, required: true },
  age: { type: Date, required: true },
  employeeId: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  position: { type: String, required: true },
  salary: { type: Number, required: true },
  advancePayment: {
    type: Number,
    default: 0,
  },
  transactions: [transactionSchema],
  joinDate: { type: Date, default: Date.now },
  contactInfo: {
    phone: { type: String, required: true },
    email: { type: String },
    address: String,
  },
  status: {
    type: String,
    enum: ['Active', 'Resigned'],
    required: true,
  }
},
{ timestamps: true });

export default mongoose.model('staff', staffSchema);
