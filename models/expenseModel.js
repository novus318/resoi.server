import mongoose from 'mongoose';

const { Schema } = mongoose;

const dailyExpenseSchema = new Schema({
    date: {
        type: Date,
        required: true,
        unique: true 
    },
    expenses: [{
        name: {
            type: String,
            required: true 
        },
        category: {
            type: Schema.Types.ObjectId,
            ref: 'ExpenseCategory',
            required: true 
        },
        amount: {
            type: Number,
            required: true 
        }
    }]
}, { timestamps: true });

export default mongoose.model('Expense', dailyExpenseSchema);
