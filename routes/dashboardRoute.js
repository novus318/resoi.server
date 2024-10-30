import express from 'express';
import tableOrderModel from '../models/tableOrderModel.js';
import onlineOrdersModel from '../models/onlineOrderModel.js';
import expenseModel from '../models/expenseModel.js';

const router = express.Router();

router.get('/totalof-day', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to midnight

        // Get completed table orders for today
        const tableOrders = await tableOrderModel.find({
            status: 'completed',
            createdAt: { $gte: today }
        });

        // Get completed online orders for today
        const onlineOrders = await onlineOrdersModel.find({
            status: 'completed',
            createdAt: { $gte: today }
        });

        // Get today's expenses document
        const expenseDoc = await expenseModel.findOne({
            date: { $gte: today }
        });

        // Calculate total amounts
        const tableOrderTotal = tableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const onlineOrderTotal = onlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        
        // Calculate total expenses from today's document
        const totalExpenses = expenseDoc
            ? expenseDoc.expenses.reduce((sum, expense) => sum + expense.amount, 0)
            : 0;

        // Calculate today's revenue
        const totalRevenue = tableOrderTotal + onlineOrderTotal - totalExpenses;

        res.status(200).json({
            success: true,
            tableOrderTotal,
            onlineOrderTotal,
            totalExpenses,
            totalRevenue
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});

export default router;
