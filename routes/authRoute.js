import express from 'express'
import adminUserModel from '../models/adminUserModel.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 120, checkperiod: 120 }); 
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;

router.post('/create/admin-user', async (req, res) => {
    try {
        const { name, role, username, password } = req.body;

        // Check if the user already exists
        const existingUser = await adminUserModel.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ message: 'Username already exists' });
        }

        const newUser = new adminUserModel({
            name,
            role,
            username,
            password: password,
        });

        await newUser.save();
        res.status(201).json({ message: 'Admin user created successfully', user: newUser });
    } catch (error) {
        res.status(500).json({ message: 'Error creating admin user', error: error.message });
    }
});

// Update an existing AdminUser
router.put('/edit/admin-user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, role, username, password, status } = req.body;

        const updateData = { name, role, username, status,password };


        const updatedUser = await adminUserModel.findByIdAndUpdate(id, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        res.status(200).json({ message: 'Admin user updated successfully', user: updatedUser });
    } catch (error) {
        res.status(500).json({ message: 'Error updating admin user', error: error.message });
    }
});

// Delete an AdminUser
router.delete('/delete/admin-user/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const deletedUser = await adminUserModel.findByIdAndDelete(id);

        if (!deletedUser) {
            return res.status(404).json({ message: 'Admin user not found' });
        }

        res.status(200).json({ message: 'Admin user deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting admin user', error: error.message });
    }
});
router.post('/admin-user/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Check if the user exists
        const user = await adminUserModel.findOne({ username });
        if (!user) {
            return res.status(400).json({ message: 'username does not exist' });
        }

        // Compare the provided password with the stored hashed password
        const isPasswordValid = password === user.password;
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        // Generate a token valid for 24 hours
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' } // Token validity
        );

        res.status(200).json({
            message: 'Login successful',
            token,
            user: {
                id: user._id,
                name: user.name,
                role: user.role,
                username: user.username
            }
        });
    } catch (error) {
        console.log(error)
        res.status(500).json({ message: 'Error logging in', error: error.message });
    }
});

router.post('/verify', async (req, res) => {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Token is required' });
        }

        try {
            // Verify the token synchronously for better error control
            const decoded = jwt.verify(token, JWT_SECRET);
    
            // Check cache for user data
            let user = cache.get(`admin_${decoded.userId}`);
            if (!user) {
                // User not found in cache, fetch from DB
                user = await adminUserModel.findById(decoded.userId).select('-password').lean();
                if (!user) {
                    return res.status(404).json({ success: false, message: 'User not found' });
                }
                // Cache plain JavaScript user data object
                cache.set(`admin_${decoded.userId}`, user);
            }
   
            return res.status(200).json({
                success: true,
                message: 'Token is valid',
                user,
            });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Token expired' });
            }
            if (error.name === 'JsonWebTokenError') {
                return res.status(401).json({ success: false, message: 'Invalid token' });
            }
            
            console.error('Error verifying token:', error);
            res.status(500).json({ success: false, message: 'Server error verifying token' });
        }
    });

export default router