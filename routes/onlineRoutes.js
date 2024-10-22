
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;

router.post('/create/order', async (req, res) => {
    const {
        userToken,
        address,
        coordinates,
        paymentMethod,
        cartItems,
        totalAmount,
    } = req.body;

    try {
        // Verify the token and retrieve the user
        let user;
        jwt.verify(userToken, JWT_SECRET, async (err, decoded) => {
            if (err) {
                return res.status(401).json({ success: false, message: 'Invalid or expired token' });
            }

            // Token is valid, retrieve the user info using the userId from the token
            user = await userModel.findById(decoded.userId).select('-password'); // Exclude password

            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            // Create the order
            const newOrder = new onlineOrderModel({
                user: user._id,
                address,
                coordinates,
                paymentMethod,
                cartItems,
                totalAmount,
                status: 'pending',
                paymentStatus: 'pending'
            });

            await newOrder.save();

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                order: newOrder
            });
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
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
                 const user = await userModel.findById(decoded.userId).select('-password'); // Exclude password

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