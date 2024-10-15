import express from 'express'
import categoryModel from '../models/categoryModel.js';
import subCategoryModel from '../models/subCategoryModel.js';


const router=express.Router()

router.post('/create-category',async(req,res)=>{
    try {
        const { name } = req.body;
        // save category to database
        const category = await categoryModel.findOne({
            name: name,
        })
        if (category) {
            return res.status(400).json({ message: 'Category already exists' });
        }
        const newCategory = new categoryModel({
            name: name,
        })
        await newCategory.save()
        res.status(200).json({
            success: true,
            message: 'Category created successfully',
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({success:false, message: 'Server Error', error })
    }
})
router.post('/create-subcategory',async(req,res)=>{
    try {
        const { categoryId,name } = req.body;
        // save category to database
        const newCategory = new subCategoryModel({
            name: name,
            category: categoryId,
        })
        await newCategory.save()
        res.status(200).json({
            success: true,
            message: 'Category created successfully',
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({success:false, message: 'Server Error', error })
    }
})
router.put('/edit-category/:id',async(req,res)=>{
    try {
        const { id } = req.params;
        const { name } = req.body;
        // find the category by ID
        const category = await categoryModel.findByIdAndUpdate(id, { name: name }, { new: true });
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Category updated successfully',
            category,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
})
router.put('/edit-subcategory/:id',async(req,res)=>{
    try {
        const { id } = req.params;
        const { name } = req.body;
        // find the subcategory by ID
        const subcategory = await subCategoryModel.findByIdAndUpdate(id, { name: name }, { new: true });
        if (!subcategory) {
            return res.status(404).json({ message: 'Subcategory not found' });
        }
        res.status(200).json({
            success: true,
            message: 'Subcategory updated successfully',
            subcategory,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
})

router.get('/get-categories',async(req,res)=>{
    try {
        const categories = await categoryModel.find({})
        res.status(200).json({
            success: true,
            categories,
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error })
    }
})

router.get('/get-subcategories',async(req,res)=>{
    try {
        const categoriesWithSubcategories = await categoryModel.aggregate([
            {
                $lookup: {
                    from: 'subcategories', // The collection name for subcategories
                    localField: '_id',
                    foreignField: 'category',
                    as: 'subcategories'
                }
            }
        ]);

        res.status(200).json({
            success: true,
            categories: categoriesWithSubcategories
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
})
export default router