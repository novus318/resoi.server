import express from 'express'
import itemModel from '../models/itemModel.js';
import multer from 'multer';
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import NodeCache from 'node-cache';
import tableModel from '../models/tableModel.js';

const cache = new NodeCache({ stdTTL: 1450, checkperiod: 120 }); 

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
        const { 
            name, 
            price, 
            offer,
            description, 
            ingredients, 
            category, 
            subcategory, 
            variants, 
            isVeg 
        } = req.body;

        // Check if required fields are provided
        if (!req.file && !price) {
            return res.status(400).json({
                success: false,
                message: 'No image provided and no price specified for single-price item'
            });
        }

        // Create a new item
        const newItem = new itemModel({
            name,
            price: price ? Number(price) : undefined,
            offer: Number(offer), // Use price if provided
            description,
            ingredients: ingredients ? JSON.parse(ingredients) : [], // Parse ingredients array if provided
            category,
            status: 'available',
            isVeg: isVeg === 'true', // Convert to Boolean from string
            isAvailable: true, // Default availability
            rating: 0, // Default rating
            ratingCount: 0 // Default rating count
        });

        if (subcategory) {
            newItem.subcategory = subcategory;
        }

        // Handle variants if provided
        if (variants) {
            newItem.variants = JSON.parse(variants).map(variant => ({
                name: variant.name,
                price: Number(variant.price),
                isAvailable: variant.isAvailable !== undefined ? variant.isAvailable : true
            }));
        }

        // Save the item to the database
        const savedItem = await newItem.save();

        cache.del("items");
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
        const {
            name,
            offer,
            price,
            description,
            ingredients,
            category,
            subcategory,
            status,
            variants,
            isVeg,
        } = req.body;

        // Find the item by ID
        const item = await itemModel.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Update the item's properties
        if (name) item.name = name;
        if (price) item.price = Number(price);
        if (offer) item.offer = Number(offer) // Ensure price is a number
        if (description) item.description = description;
        if (ingredients) item.ingredients = JSON.parse(ingredients);
        if (category) item.category = category;
        if (subcategory) item.subcategory = subcategory;
        if (status) item.status = status;
        if (isVeg !== undefined) item.isVeg = isVeg === 'true'; // Convert string to Boolean

        // Handle variants if provided
        if (variants) {
            item.variants = JSON.parse(variants).map(variant => ({
                name: variant.name,
                price: Number(variant.price),
                isAvailable: variant.isAvailable !== undefined ? variant.isAvailable : true
            }));
        }

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

        cache.del("items");
        // Send the response
        res.status(200).json({
            success: true,
            message: 'Item updated successfully',
            data: updatedItem,
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
        cache.del("items");
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
        const cachedItems = cache.get('items');
        
        if (cachedItems) {
            // Return cached data if available
            return res.status(200).json({
                success: true,
                items: cachedItems,
            });
        }

        // Fetch from database if not cached
        const items = await itemModel.find({}).populate('category')
        .populate('subcategory')
        .lean();;

        // Store result in cache
        cache.set('items', items);

        res.status(200).json({
            success: true,
            items,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching items' });
    }
});
router.get('/get-table-items/:tableId', async (req, res) => {
    const { tableId } = req.params;

    try {
        // Find the table by ID and populate the categories
        const table = await tableModel.findById(tableId).populate('categories.value').lean();
        
        if (!table) {
            return res.status(404).json({ success: false, error: 'Table not found' });
        }

        // Extract category IDs from the table's categories
        const categoryIds = table.categories.map(category => category.value._id);

        // Fetch items that match the categories assigned to the table
        const items = await itemModel.find({ category: { $in: categoryIds } })
            .populate('category')
            .populate('subcategory')
            .lean();

        res.status(200).json({
            success: true,
            items,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'An error occurred while fetching table items' });
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
