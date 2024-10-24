
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import axios from 'axios';
import uniqid from 'uniqid'
import sha256 from 'sha256'
import tableOrderModel from '../models/tableOrderModel.js';
import tableModel from '../models/tableModel.js';
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;

const MERCHANT_ID = "PGTESTPAYUAT";
const PHONE_PE_HOST_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox";
const SALT_INDEX = 1;
const SALT_KEY = "099eb0cd-02cf-4e2a-8aca-3e6c6aff0399";
const APP_BE_URL = "http://localhost:3000";

// Helper function to generate unique order ID
async function generateUniqueOrderId() {
    let orderId;
    let isUnique = false;

    while (!isUnique) {
        // Generate a random 7-digit number prefixed with 'RS-'
        const uniqueNumber = Math.floor(1000000 + Math.random() * 9000000);
        orderId = `RS-${uniqueNumber}`;

        // Check if this orderId already exists in the database
        const existingOrder = await tableOrderModel.findOne({ orderId });
        if (!existingOrder) {
            isUnique = true;
        }
    }

    return orderId;
}

router.post('/create/table-order', async (req, res) => {
    const {
        tableId,
        userToken,
        cartItems,
    } = req.body;

    try {
        // Input Validation
        if (!tableId || !userToken || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        const calculateTotal = () => {
            return cartItems.reduce((total, item) => {
                const priceAfterDiscount = item.offer
                    ? item.price - item.price * (item.offer / 100)
                    : item.price;
                return total + priceAfterDiscount * item.quantity;
            }, 0);
        };

        const totalAmount = calculateTotal();

        // Verify the token and retrieve the user
        const verifyToken = () => {
            return new Promise((resolve, reject) => {
                jwt.verify(userToken, JWT_SECRET, (err, decoded) => {
                    if (err) {
                        reject('Invalid or expired token');
                    } else {
                        resolve(decoded);
                    }
                });
            });
        };

        const decoded = await verifyToken();
        const user = await userModel.findById(decoded.userId).select('-password'); // Exclude password

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate a unique orderId
        const orderId = await generateUniqueOrderId();

        // Create the order
        const newOrder = new tableOrderModel({
            table: tableId,
            orderId: orderId,
            user: user._id,
            cartItems,
            totalAmount,
            status: 'confirmed',
            paymentStatus: 'pending'
        });

        // Save the order and update the table status
        await newOrder.save();
        await tableModel.findByIdAndUpdate(tableId, { status: 'occupied' });

        return res.status(201).json({
            success: true,
            message: 'Order confirmed successfully',
            order: newOrder
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error confirming order', error: error.message });
    }
});


router.put('/update/table-order', async (req, res) => {
    const { orderId, cartItems } = req.body;

    try {
        // Input Validation
        if (!orderId || !Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        // Find the existing order
        const existingOrder = await tableOrderModel.findOne({orderId});
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Update or add cart items
        cartItems.forEach(newItem => {
            const existingItemIndex = existingOrder.cartItems.findIndex(
                item => item._id.toString() === newItem._id && item.variant === newItem.variant
            );

            if (existingItemIndex !== -1) {
                // If item exists, update the quantity
                existingOrder.cartItems[existingItemIndex].quantity += newItem.quantity;
            } else {
                // If item does not exist, add as a new item
                existingOrder.cartItems.push(newItem);
            }
        });

        // Recalculate total amount
        const calculateTotal = () => {
            return existingOrder.cartItems.reduce((total, item) => {
                const priceAfterDiscount = item.offer
                    ? item.price - item.price * (item.offer / 100)
                    : item.price;
                return total + priceAfterDiscount * item.quantity;
            }, 0);
        };

        existingOrder.totalAmount = calculateTotal();

        // Save the updated order
        await existingOrder.save();

        return res.status(200).json({
            success: true,
            message: 'Order updated successfully',
            order: existingOrder
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error updating cart', error: error.message });
    }
});


router.get('/get-order/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Find the existing order
        const existingOrder = await tableOrderModel.findOne({orderId:id}).populate('table user');
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        return res.status(200).json({
            success: true,
            message: 'Order retrieved successfully',
            order: existingOrder
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error retrieving order', error: error.message });
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

router.get('/order-status/:id',async(req,res)=>{
    try {
        const { id } = req.params;
        console.log(id)
        const order = await onlineOrderModel.findOne({orderId:id})
console.log(id,order)
        if(!order){
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Order status fetched successfully',
            order
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
})
export default router