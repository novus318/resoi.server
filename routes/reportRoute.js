import express  from "express";
import tableOrderModel from "../models/tableOrderModel.js";
import onlineOrderModel from "../models/onlineOrderModel.js";
import expenseModel from "../models/expenseModel.js";
import salaryModel from "../models/salaryModel.js";
import staffModel from "../models/staffModel.js";
import NodeCache from "node-cache";
const cache = new NodeCache({ stdTTL: 30, checkperiod: 30 });

const router=express.Router()


router.get('/totalof-month', async (req, res) => {
    try {
        const cachedData = cache.get("totalOfMonthData");
        if (cachedData) {
            // Return cached data if it exists
            return res.status(200).json({
                success: true,
                data: cachedData
            });
        }
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59); // Set to 23:59:59
        
        // Current month data
        const currentMonthTableOrders = await tableOrderModel.find({
            status: 'completed',
            createdAt: { $gte: startOfCurrentMonth, $lt: now }
        });

        const currentMonthOnlineOrders = await onlineOrderModel.find({
            status: 'completed',
            createdAt: { $gte: startOfCurrentMonth, $lt: now }
        });

        const currentMonthExpenseDoc = await expenseModel.find({
            date: { $gte: startOfCurrentMonth, $lt: now }
        });

        const currentMonthAdvance = await staffModel.find({
            status: 'Active',
            transactions: {
                $elemMatch: {
                    type: 'Advance Payment',
                    date: { $gte: startOfCurrentMonth, $lt: now }
                }
            }
        });
        
        const currentMonthSalaryDoc = await salaryModel.find({
            date: { $gte: startOfCurrentMonth, $lt: now },
            status: 'Paid'
        });

        // Last month data
        const lastMonthTableOrders = await tableOrderModel.find({
            status: 'completed',
            createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth }
        });

        const lastMonthOnlineOrders = await onlineOrderModel.find({
            status: 'completed',
            createdAt: { $gte: startOfLastMonth, $lt: endOfLastMonth }
        });

        const lastMonthExpenseDoc = await expenseModel.find({
            date: { $gte: startOfLastMonth, $lt: endOfLastMonth }
        });

        const lastMonthAdvance = await staffModel.find({
            status: 'Active',
            transactions: {
                $elemMatch: {
                    type: 'Advance Payment',
                    date: { $gte: startOfLastMonth, $lt: endOfLastMonth }
                }
            }
        });
        
        const lastMonthSalaryDoc = await salaryModel.find({
            date: { $gte: startOfLastMonth, $lt: endOfLastMonth },
            status: 'Paid'
        });

        // Calculate current month totals
        const currentTableOrderTotal = currentMonthTableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const currentOnlineOrderTotal = currentMonthOnlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        const currentExpenses = currentMonthExpenseDoc.reduce((sum, doc) => sum + doc.expenses.reduce((subSum, expense) => subSum + expense.amount, 0), 0);

        const currentSalaryTotal = currentMonthSalaryDoc.reduce((sum, doc) => sum + doc.netPay, 0) + 
            currentMonthAdvance.reduce((sum, staff) => {
                return sum + staff.transactions
                    .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfCurrentMonth && txn.date < now)
                    .reduce((subSum, txn) => subSum + txn.amount, 0);
            }, 0);

        const currentTotalRevenue = currentTableOrderTotal + currentOnlineOrderTotal;
        const currentTotalExpenses = currentExpenses + currentSalaryTotal;

        // Calculate last month totals
        const lastTableOrderTotal = lastMonthTableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const lastOnlineOrderTotal = lastMonthOnlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        const lastExpenses = lastMonthExpenseDoc.reduce((sum, doc) => sum + doc.expenses.reduce((subSum, expense) => subSum + expense.amount, 0), 0);

        const lastSalaryTotal = lastMonthSalaryDoc.reduce((sum, doc) => sum + doc.netPay, 0) + 
            lastMonthAdvance.reduce((sum, staff) => {
                return sum + staff.transactions
                    .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfLastMonth && txn.date < endOfLastMonth)
                    .reduce((subSum, txn) => subSum + txn.amount, 0);
            }, 0);

        const lastTotalRevenue = lastTableOrderTotal + lastOnlineOrderTotal;
        const lastTotalExpenses = lastExpenses + lastSalaryTotal;

        // Calculate percentage changes
        const revenuePercentageChange = lastTotalRevenue
            ? ((currentTotalRevenue - lastTotalRevenue) / lastTotalRevenue) * 100
            : 0;
        const expensePercentageChange = lastTotalExpenses
            ? ((currentTotalExpenses - lastTotalExpenses) / lastTotalExpenses) * 100
            : 0;

        const tableOrderPercentageChange = lastTableOrderTotal
            ? ((currentTableOrderTotal - lastTableOrderTotal) / lastTableOrderTotal) * 100
            : 0;

        const onlineOrderPercentageChange = lastOnlineOrderTotal
            ? ((currentOnlineOrderTotal - lastOnlineOrderTotal) / lastOnlineOrderTotal) * 100
            : 0;


            const responseData = {
                totalRevenue: currentTotalRevenue,
                totalExpenses: currentTotalExpenses,
                currentTableOrderTotal,
                currentOnlineOrderTotal,
                revenuePercentageChange,
                expensePercentageChange,
                tableOrderPercentageChange,
                onlineOrderPercentageChange
            };
    
            // Cache the data
            cache.set("totalOfMonthData", responseData);
        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});


router.get('/revenue-expenses/last-6-months', async (req, res) => {
    try {

        const cachedData = cache.get("revenue-expenses");
        if (cachedData) {
            // Return cached data if it exists
            return res.status(200).json({
                success: true,
                data: cachedData
            });
        }
        const now = new Date();
        const last6MonthsData = [];

        // Loop over the last 6 months (excluding the current month)
        for (let i = 1; i <= 6; i++) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            const monthName = startOfMonth.toLocaleString("default", { month: "long" });


            // Get completed orders for the month
            const tableOrders = await tableOrderModel.find({
                status: 'completed',
                createdAt: { $gte: startOfMonth, $lt: endOfMonth }
            });
            const onlineOrders = await onlineOrderModel.find({
                status: 'completed',
                createdAt: { $gte: startOfMonth, $lt: endOfMonth }
            });

            // Get expenses for the month
            const expenseDocs = await expenseModel.find({
                date: { $gte: startOfMonth, $lt: endOfMonth }
            });

            // Get paid salaries and advance payments for the month
            const salaryDocs = await salaryModel.find({
                date: { $gte: startOfMonth, $lt: endOfMonth },
                status: 'Paid'
            });

            const staffAdvancePayments = await staffModel.find({
                status: 'Active',
                transactions: {
                    $elemMatch: {
                        type: 'Advance Payment',
                        date: { $gte: startOfMonth, $lt: endOfMonth }
                    }
                }
            });

            // Calculate total revenue for the month
            const tableOrderTotal = tableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
            const onlineOrderTotal = onlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);
            const monthRevenue = tableOrderTotal + onlineOrderTotal;

            // Calculate total expenses for the month
            const monthExpenses = expenseDocs.reduce((sum, doc) => 
                sum + doc.expenses.reduce((subSum, expense) => subSum + expense.amount, 0), 0);

            const monthSalaryTotal = salaryDocs.reduce((sum, salary) => sum + salary.netPay, 0);
            const advancePaymentsTotal = staffAdvancePayments.reduce((sum, staff) => 
                sum + staff.transactions
                    .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfMonth && txn.date < endOfMonth)
                    .reduce((subSum, txn) => subSum + txn.amount, 0), 0);
            
            const totalMonthlyExpenses = monthExpenses + monthSalaryTotal + advancePaymentsTotal;

            // Store results for the month
            last6MonthsData.push({
                month: monthName,
                revenue: monthRevenue,
                expense: totalMonthlyExpenses,
                StoreOrders: tableOrderTotal,
                OnlineOrders: onlineOrderTotal,
            });
        }


    

        // Cache the data
        cache.set("revenue-expenses", last6MonthsData);
        res.status(200).json({
            success: true,
            data: last6MonthsData
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});


router.get('/analytics/items-sold/last-six-months', async (req, res) => {
    try {
        // Get the current date
        const now = new Date();

        // Define the start of six months ago
        const startOfSixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

        // Aggregation pipeline to get items sold from table orders
        const tableOrderItems = await tableOrderModel.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startOfSixMonthsAgo, $lte: now }
                }
            },
            { $unwind: '$cartItems' },
            {
                $group: {
                    _id: { name: '$cartItems.name', month: { $month: '$createdAt' } },
                    totalSold: { $sum: '$cartItems.quantity' }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id.name',
                    month: { $arrayElemAt: [
                        ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                        { $subtract: ['$_id.month', 1] }
                    ]},
                    totalSold: 1
                }
            }
        ]);

        // Aggregation pipeline to get items sold from online orders
        const onlineOrderItems = await onlineOrderModel.aggregate([
            {
                $match: {
                    status: 'completed',
                    createdAt: { $gte: startOfSixMonthsAgo, $lte: now }
                }
            },
            { $unwind: '$cartItems' },
            {
                $group: {
                    _id: { name: '$cartItems.name', month: { $month: '$createdAt' } },
                    totalSold: { $sum: '$cartItems.quantity' }
                }
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id.name',
                    month: { $arrayElemAt: [
                        ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                        { $subtract: ['$_id.month', 1] }
                    ]},
                    totalSold: 1
                }
            }
        ]);

        // Combine results from both collections
        const combinedResults = {};

        // Add table order items to the combined results
        tableOrderItems.forEach(item => {
            const key = `${item.name}-${item.month}`;
            if (combinedResults[key]) {
                combinedResults[key].totalSold += item.totalSold;
            } else {
                combinedResults[key] = {
                    name: item.name,
                    month: item.month,
                    totalSold: item.totalSold
                };
            }
        });

        // Add online order items to the combined results
        onlineOrderItems.forEach(item => {
            const key = `${item.name}-${item.month}`;
            if (combinedResults[key]) {
                combinedResults[key].totalSold += item.totalSold;
            } else {
                combinedResults[key] = {
                    name: item.name,
                    month: item.month,
                    totalSold: item.totalSold
                };
            }
        });

        // Format the combined results into an array of objects
        const analyticsData = Object.values(combinedResults);

        res.status(200).json({
            success: true,
            data: analyticsData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});

export default router