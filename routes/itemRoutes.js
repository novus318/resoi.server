import express from 'express'
import itemModel from '../models/itemModel.js';
import multer from 'multer';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __dirname = dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Set up multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../itemImages');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Temporarily use a random name, we'll rename it after saving the item
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

router.post('/create-item', upload.single('image'), async (req, res) => {
    try {
        const { name, price, description, ingredients, category, subcategory } = req.body;
        // Check if required fields are provided
        if (!req.file) {
            return res.status(400).json({success:false,
                message: 'No image provided'
            });
        }

        // Create a new item
        const newItem = new itemModel({
            name,
            price,
            description,
            ingredients:JSON.parse(ingredients),
            status:'available',
            category,
        });

        if(subcategory){
            newItem.subcategory = subcategory;
        }
        // Save the item to the database
        const savedItem = await newItem.save();

        // Handle image if it exists
        if (req.file) {
            const oldPath = req.file.path;
            const newFileName = `${savedItem._id}.webp`;
            const newPath = path.join(path.dirname(oldPath), newFileName);

            // Rename the file to match the item ID
            fs.renameSync(oldPath, newPath);

            // Update the image path in the item
            savedItem.image = `/itemImages/${newFileName}`;
            await savedItem.save();
        }

        // Send the response
        res.status(201).json({
            success: true,
            message: 'Item created successfully',
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while creating the item' });
    }
});


router.put('/edit-item/:id', upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, price, description, ingredients, category, subcategory, status } = req.body;

        // Find the item by ID
        const item = await itemModel.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Update the item's properties
        if (name) item.name = name;
        if (price) item.price = price;
        if (description) item.description = description;
        if (ingredients) item.ingredients = JSON.parse(ingredients);
        if (category) item.category = category;
        if (subcategory) item.subcategory = subcategory;
        if (status) item.status = status;

        // Handle image if a new one is provided
        if (req.file) {
            const oldPath = req.file.path;
            const newFileName = `${item._id}.webp`;
            const newPath = path.join(path.dirname(oldPath), newFileName);

            // Rename the file to match the item ID
            fs.renameSync(oldPath, newPath);

            // Update the image path in the item
            item.image = `/itemImages/${newFileName}`;
        }

        // Save the updated item to the database
        const updatedItem = await item.save();

        // Send the response
        res.status(200).json({
            success: true,
            message: 'Item updated successfully',
            data: updatedItem
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while updating the item' });
    }
});


router.put('/change-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        // Ensure status is one of the allowed values
        if (!['available', 'unavailable', 'coming soon'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

        const updatedItem = await Item.findByIdAndUpdate(id, { status }, { new: true });

        if (!updatedItem) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({
            success:true,
            message: 'Item status updated successfully',
            item: updatedItem
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success:false,error: 'An error occurred while updating the item status' });
    }
});

router.get('/get-items', async (req, res) => {
    try {
        const items = await itemModel.find({});
        res.status(200).json({
            success: true,
            items,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching items' });
    }
});

router.get('/get-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const item = await itemModel.findById(id);

        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        res.status(200).json({
            success: true,
            item,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching item' });
    }
});

router.delete('/delete-item/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if(!id){
            return res.status(400).json({ success: false, message: 'No item ID provided' });
        }
        // Ensure the item ID is a valid MongoDB ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID' });
        }
        // Find the item by ID
        const item = await itemModel.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Remove the item's image file if it exists
        if (item.image) {
            const imagePath = path.join(__dirname, '..', item.image);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        // Delete the item from the database
        await itemModel.findByIdAndDelete(id);

        // Send the response
        res.status(200).json({
            success: true,
            message: 'Item deleted successfully'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while deleting the item' });
    }
});



export default router
