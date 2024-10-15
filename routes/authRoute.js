import express from 'express'
import adminUserModel from '../models/adminUserModel.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
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
    try {
        const { token } = req.body;

        // Verify the token
        jwt.verify(token, JWT_SECRET, async (err, decoded) => {
            if (err) {
                // Token is invalid or expired
                return res.status(401).json({ success: false, message: 'Invalid or expired token' });
            }

                 // Token is valid, retrieve the user info using the userId from the token
                 const user = await adminUserModel.findById(decoded.userId).select('-password'); // Exclude password

                 if (!user) {
                     return res.status(404).json({ success: false, message: 'User not found' });
                 }
     
                 res.status(200).json({
                     success: true,
                     message: 'Token is valid',
                     user,
                     decoded
                 });
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error verifying token', error: error.message });
    }
});
export default router