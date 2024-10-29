import express from 'express'
import expenseCategoryModel from '../models/expenseCategoryModel.js';
import expenseModel from '../models/expenseModel.js';

const router = express.Router();

// Route to create a new user
router.post('/create-expense/category', async (req, res) => {
    try {
        const { name, description } = req.body;
        // Check if the category already exists
        const existingCategory = await expenseCategoryModel.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Category already exists' });
        }

        const newCategory = new expenseCategoryModel({
            name,
            description,
        });
        await newCategory.save();
        res.status(200).json({ success: true, message: 'Category created successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });

    // Route to get all categories
    router.get('/get-expense/categories', async (req, res) => {
    try {
        const categories = await expenseCategoryModel.find();
        res.status(200).json({ success: true, categories });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });
    // Route to update a category
    router.put('/update-expense/category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description } = req.body;
        // find if name already exist
        const existingCategory = await expenseCategoryModel.findOne({ name, _id: { $ne: id } });
        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Category name already exists' });
        }
        // Find the category by ID
        const updatedCategory = await expenseCategoryModel.findByIdAndUpdate(id, { name, description }, { new: true });
        if (!updatedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category updated successfully', updatedCategory });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });

    // Route to delete a category
    router.delete('/delete-expense/category/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const deletedCategory = await expenseCategoryModel.findByIdAndDelete(id);
        if (!deletedCategory) {
            return res.status(404).json({ success: false, message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
    });


    router.post('/create-daily/expense', async (req, res) => {
        try {
            const { date, expenses } = req.body;
    
            // Convert the provided date to a Date object and set it to the start of the day in IST
            const providedDate = new Date(date);
            providedDate.setHours(0, 0, 0, 0); // Normalize to 00:00:00
    
            // Find if a document exists for the given date (normalized)
            let dailyExpense = await expenseModel.findOne({ date: providedDate });
    
            if (dailyExpense) {
                // If it exists, update the expenses array
                dailyExpense.expenses.push(...expenses);
                await dailyExpense.save();
                res.status(200).json({ success: true, message: 'Daily expense updated successfully', dailyExpense });
            } else {
                // If it doesn't exist, create a new document
                dailyExpense = new expenseModel({ date: providedDate, expenses });
                await dailyExpense.save();
                res.status(201).json({ success: true, message: 'Daily expense created successfully', dailyExpense });
            }
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'An error occurred', error });
        }
    });
    
    router.put('/edit-expense/:date/:expenseId', async (req, res) => {
        try {
            const { date, expenseId } = req.params;
            const { amount, description, name, category } = req.body;
    
            // Convert the date to the start of the day in IST
            const providedDate = new Date(date);
            providedDate.setHours(0, 0, 0, 0);
    
            // Find the document by date
            let dailyExpense = await expenseModel.findOne({ date: providedDate });
            if (!dailyExpense) {
                return res.status(404).json({ success: false, message: 'Daily expense not found' });
            }
    
            // Find the expense by ID and update it
            const expense = dailyExpense.expenses.id(expenseId);
            if (!expense) {
                return res.status(404).json({ success: false, message: 'Expense not found' });
            }
    
            // Update fields if they are provided in the request
            if (amount !== undefined) expense.amount = amount;
            if (description) expense.description = description;
            if (name) expense.name = name;
            if (category) expense.category = category;
    
            await dailyExpense.save();
            res.status(200).json({ success: true, message: 'Expense updated successfully', dailyExpense });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'An error occurred', error });
        }
    });
    
    router.delete('/delete-expense/:date/:expenseId', async (req, res) => {
        try {
            const { date, expenseId } = req.params;
    
            // Convert the date to the start of the day in IST
            const providedDate = new Date(date);
            providedDate.setHours(0, 0, 0, 0);
    
            // Find the document by date
            let dailyExpense = await expenseModel.findOne({ date: providedDate });
            if (!dailyExpense) {
                return res.status(404).json({ success: false, message: 'Daily expense not found' });
            }
    
            // Remove the expense by ID
            const expenseIndex = dailyExpense.expenses.findIndex(expense => expense._id.toString() === expenseId);
            if (expenseIndex === -1) {
                return res.status(404).json({ success: false, message: 'Expense not found' });
            }
    
            dailyExpense.expenses.splice(expenseIndex, 1); // Remove the expense from the array
            await dailyExpense.save(); // Save the document after modification
    
            res.status(200).json({ success: true, message: 'Expense deleted successfully', dailyExpense });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'An error occurred', error });
        }
    });
    

    router.get('/get-expense/forWeek', async (req, res) => {
        try {
            const { date } = req.query;
    
            // Convert the query date to JavaScript Date and set timezone to IST (UTC+5:30)
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999); // Set to 11:59:59 PM
    
            // Start date is 7 days before the end date
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 6); // Go back 6 days to include the current day (7 days total)
            startDate.setHours(0, 0, 0, 0); // Start from 00:00:00 AM IST
    
            // Find all daily expenses within the last 7 days (inclusive)
            const weeklyExpenses = await expenseModel.find({
                date: {
                    $gte: startDate,
                    $lte: endDate
                }
            }).populate('expenses.category');
    
            res.status(200).json({ success: true, weeklyExpenses });
        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'An error occurred', error });
        }
    });
    

export default router;

