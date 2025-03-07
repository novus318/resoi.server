import express  from "express";
import tableOrderModel from "../models/tableOrderModel.js";
import onlineOrderModel from "../models/onlineOrderModel.js";
import expenseModel from "../models/expenseModel.js";
import salaryModel from "../models/salaryModel.js";
import staffModel from "../models/staffModel.js";
import NodeCache from "node-cache";
import moment from "moment-timezone";
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
            paymentDate: { $gte: startOfCurrentMonth, $lt: now },
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
            paymentDate: { $gte: startOfLastMonth, $lt: endOfLastMonth },
            status: 'Paid'
        });

        // Calculate current month totals
        const currentTableOrderTotal = currentMonthTableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const currentOnlineOrderTotal = currentMonthOnlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        const currentExpenses = currentMonthExpenseDoc.reduce((sum, doc) => 
            sum + doc.expenses.reduce((subSum, expense) => subSum + expense.amount, 0), 0);

        const currentSalaryTotal = currentMonthSalaryDoc.reduce((sum, salary) => sum + salary.amount, 0);

        const currentAdvanceTotal = currentMonthAdvance.reduce((sum, staff) => 
            sum + staff.transactions
                .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfCurrentMonth && txn.date < now)
                .reduce((subSum, txn) => subSum + txn.amount, 0), 0);

        const currentTotalRevenue = currentTableOrderTotal + currentOnlineOrderTotal - (currentExpenses + currentSalaryTotal + currentAdvanceTotal);
        const currentTotalExpenses = currentExpenses + currentSalaryTotal + currentAdvanceTotal;

        // Calculate last month totals
        const lastTableOrderTotal = lastMonthTableOrders.reduce((sum, order) => sum + order.totalAmount, 0);
        const lastOnlineOrderTotal = lastMonthOnlineOrders.reduce((sum, order) => sum + order.totalAmount, 0);

        const lastExpenses = lastMonthExpenseDoc.reduce((sum, doc) => 
            sum + doc.expenses.reduce((subSum, expense) => subSum + expense.amount, 0), 0);

        const lastSalaryTotal = lastMonthSalaryDoc.reduce((sum, salary) => sum + salary.amount, 0);

        const lastAdvanceTotal = lastMonthAdvance.reduce((sum, staff) => 
            sum + staff.transactions
                .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfLastMonth && txn.date < endOfLastMonth)
                .reduce((subSum, txn) => subSum + txn.amount, 0), 0);

        const lastTotalRevenue = lastTableOrderTotal + lastOnlineOrderTotal - (lastExpenses + lastSalaryTotal + lastAdvanceTotal);
        const lastTotalExpenses = lastExpenses + lastSalaryTotal + lastAdvanceTotal;

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
            onlineOrderPercentageChange,
            currentSalaryTotal, // Include salary expenses in the response
            currentAdvanceTotal, // Include advance payments in the response
            lastSalaryTotal, // Include last month's salary expenses in the response
            lastAdvanceTotal // Include last month's advance payments in the response
        };

        // Cache the data
        cache.set("totalOfMonthData", responseData);
        res.status(200).json({
            success: true,
            data: responseData
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

            // Get paid salaries for the month
            const salaryDocs = await salaryModel.find({
                paymentDate: { $gte: startOfMonth, $lt: endOfMonth },
                status: 'Paid'
            });

            // Get advance payments for the month
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

            // Calculate total salary payments for the month
            const monthSalaryTotal = salaryDocs.reduce((sum, salary) => sum + salary.amount, 0);

            // Calculate total advance payments for the month
            const advancePaymentsTotal = staffAdvancePayments.reduce((sum, staff) => 
                sum + staff.transactions
                    .filter(txn => txn.type === 'Advance Payment' && txn.date >= startOfMonth && txn.date < endOfMonth)
                    .reduce((subSum, txn) => subSum + txn.amount, 0), 0);

            // Calculate total monthly expenses (including salaries and advance payments)
            const totalMonthlyExpenses = monthExpenses + monthSalaryTotal + advancePaymentsTotal;

            // Store results for the month
            last6MonthsData.push({
                month: monthName,
                revenue: monthRevenue,
                expense: totalMonthlyExpenses,
                StoreOrders: tableOrderTotal,
                OnlineOrders: onlineOrderTotal,
                Salaries: monthSalaryTotal, // Include salary expenses in the response
                AdvancePayments: advancePaymentsTotal // Include advance payments in the response
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

        // Format the combined results into the desired structure
        const analyticsData = Object.values(combinedResults).map(item => ({
            item: item.name,
            totalSold: item.totalSold,
            month: item.month
        }));

        // Prepare the months array for the last six months
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const pastMonth = new Date(now.getFullYear(), now.getMonth() - i);
            months.push(pastMonth.toLocaleString('default', { month: 'long' }));
        }

        res.status(200).json({
            success: true,
            data: analyticsData,
            months: months // Send the array of months along with the data
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});


router.get('/analytics/average-sale-time/last-three-months', async (req, res) => {
    try {
        // Check for cached data
        const cachedData = cache.get("saleTime");
        if (cachedData) {
            // Return cached data if it exists
            return res.status(200).json({
                success: true,
                data: cachedData
            });
        }

        // Get the current date in IST
        const now = moment.tz('Asia/Kolkata');

        // Define the start of three months ago in IST
        const startOfThreeMonthsAgo = now.clone().subtract(3, 'months').startOf('month');

        // Function to calculate average sale metrics by day
        const calculateAverageSaleMetricsByDay = async (model) => {
            return await model.aggregate([
                {
                    $match: {
                        status: 'completed',
                        createdAt: { $gte: startOfThreeMonthsAgo.toDate(), $lte: now.toDate() }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        saleTime: {
                            $subtract: [
                                { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } },
                                { $dateFromParts: {
                                    year: { $year: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                    month: { $month: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                    day: { $dayOfMonth: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                    timezone: 'Asia/Kolkata'
                                }}
                            ]
                        },
                        saleTimeMinutes: {
                            $divide: [
                                { $subtract: [
                                    { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } },
                                    { $dateFromParts: {
                                        year: { $year: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                        month: { $month: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                        day: { $dayOfMonth: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } },
                                        timezone: 'Asia/Kolkata'
                                    }}
                                ]},
                                1000 * 60 // Convert milliseconds to minutes
                            ]
                        },
                        totalAmount: '$totalAmount',
                        dayOfWeek: { $dayOfWeek: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] }} }, // Day of week in IST
                        hourOfDay: { $hour: { $toDate: { $subtract: [{ $toLong: '$createdAt' }, now.utcOffset() * 60 * 1000] } } } // Extract the hour of the sale
                    }
                },
                {
                    $group: {
                        _id: { day: '$dayOfWeek', hour: '$hourOfDay' }, // Group by both day and hour
                        totalSalesPerHour: { $sum: 1 }, // Count sales per hour
                        averageSaleTime: { $avg: '$saleTime' },
                        averageAmount: { $avg: '$totalAmount' }
                    }
                },
                {
                    $group: {
                        _id: '$_id.day', // Group back by day
                        peakHour: { $max: { $cond: [ { $gt: ['$totalSalesPerHour', 0] }, '$_id.hour', null ] } }, // Find the hour with the max sales
                        averageSaleTime: { $avg: '$averageSaleTime' },
                        averageAmount: { $avg: '$averageAmount' },
                        totalSales: { $sum: 1 } // Count of sales for each day
                    }
                },
                {
                    $project: {
                        day: { $switch: {
                            branches: [
                                { case: { $eq: ['$_id', 1] }, then: 'Sun' },
                                { case: { $eq: ['$_id', 2] }, then: 'Mon' },
                                { case: { $eq: ['$_id', 3] }, then: 'Tue' },
                                { case: { $eq: ['$_id', 4] }, then: 'Wed' },
                                { case: { $eq: ['$_id', 5] }, then: 'Thu' },
                                { case: { $eq: ['$_id', 6] }, then: 'Fri' },
                                { case: { $eq: ['$_id', 7] }, then: 'Sat' },
                            ],
                            default: 'Unknown'
                        }},
                        averageSaleTime: { $ifNull: ['$averageSaleTime', 0] }, // Ensure 0 if no sales
                        averageAmount: { $ifNull: ['$averageAmount', 0] }, // Ensure 0 if no sales
                        totalSales: { $ifNull: ['$totalSales', 0] }, // Ensure 0 if no sales
                        peakHour: { $ifNull: ['$peakHour', 0] } // Include peak hour
                    }
                },
                { $sort: { 'day': 1 } } // Sort by day
            ]);
        };

        // Calculate metrics for table orders
        const tableOrderAvg = await calculateAverageSaleMetricsByDay(tableOrderModel);
        // Calculate metrics for online orders
        const onlineOrderAvg = await calculateAverageSaleMetricsByDay(onlineOrderModel);

        // Initialize combined results for each day of the week
        const combinedResults = {
            'Sun': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Mon': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Tue': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Wed': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Thu': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Fri': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 },
            'Sat': { time: 0, avrragesale: 0, averageAmount: 0, peakHour: 0 }
        };

        // Populate the combined results from table orders
        tableOrderAvg.forEach(item => {
            combinedResults[item.day].time += item.averageSaleTime;
            combinedResults[item.day].avrragesale += item.totalSales; // Total number of sales
            combinedResults[item.day].averageAmount += item.averageAmount; // Total amount sold
            combinedResults[item.day].peakHour = Math.max(combinedResults[item.day].peakHour, item.peakHour); // Track peak hour
        });

        // Populate the combined results from online orders
        onlineOrderAvg.forEach(item => {
            combinedResults[item.day].time += item.averageSaleTime;
            combinedResults[item.day].avrragesale += item.totalSales; // Total number of sales
            combinedResults[item.day].averageAmount += item.averageAmount; // Total amount sold
            combinedResults[item.day].peakHour = Math.max(combinedResults[item.day].peakHour, item.peakHour); // Track peak hour
        });

        // Prepare the final structured response
        const responseData = Object.keys(combinedResults).map(day => ({
            day: day,
            time: combinedResults[day].time,
            averageSale: combinedResults[day].avrragesale,
            averageAmount: combinedResults[day].avrragesale > 0 ? combinedResults[day].averageAmount / combinedResults[day].avrragesale : 0, // Calculate average amount per sale
            peakHour: combinedResults[day].peakHour // Include peak hour
        }));

        // Cache the response data
        cache.set("saleTime", responseData);
        res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: 'Server Error',
            error: error.message
        });
    }
});


export default router