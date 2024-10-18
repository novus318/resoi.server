import express from 'express'
import tableModel from '../models/tableModel.js';



const router = express.Router();

router.post('/create-table', async (req, res) => {
    try {
        const { name } = req.body;
        // save table to database
        const table = await tableModel.findOne({
            tableName: name,
        });
        if (table) {
            return res.status(400).json({success:false, message: 'Table name already exists' });
        }
        const newTable = new tableModel({
            tableName: name,
        });
        await newTable.save();
        res.status(200).json({
            success: true,
            message: 'Table created successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while creating the table' });
    }
});

router.delete('/delete-table/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const table = await tableModel.findByIdAndDelete(id);
        if (!table) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Table deleted successfully',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while deleting the table' });
    }
});

router.put('/update-table/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { tableName } = req.body;

        // Check if the new table name already exists (excluding the current table ID)
        const existingTable = await tableModel.findOne({ tableName, _id: { $ne: id } });

        if (existingTable) {
            return res.status(400).json({
                success: false,
                message: 'Table name already exists.',
            });
        }

        // Proceed with the update if no conflicts
        const updatedTable = await tableModel.findByIdAndUpdate(id, { tableName }, { new: true });

        if (!updatedTable) {
            return res.status(404).json({ success: false, message: 'Table not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Table updated successfully',
            updatedTable,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while updating the table' });
    }
});


router.get('/get-tables', async (req, res) => {
    try {
        const tables = await tableModel.find({});
        res.status(200).json({
            success: true,
            tables,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching tables' });
    }
});

export default router;