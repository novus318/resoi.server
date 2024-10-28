
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv, { populate } from 'dotenv';
import userModel from '../models/userModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';
import axios from 'axios';
import crypto from 'crypto';
import { broadcastOnlineOrderUpdate } from '../utils/webSocket.js';
const router = express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;

const MERCHANT_ID = "PGTESTPAYUAT86";
const SALT_INDEX = 1;
const SALT_KEY = "96434309-7796-489d-8924-ab56988a6076";
const APP_BE_URL = "https://www.malabarresoi.in";

// Helper function to generate unique order ID
async function generateUniqueOrderId() {
    let orderId;
    let isUnique = false;

    while (!isUnique) {
        // Generate a random 7-digit number prefixed with 'RS-'
        const uniqueNumber = Math.floor(1000000 + Math.random() * 9000000);
        orderId = `RS-${uniqueNumber}`;

        // Check if this orderId already exists in the database
        const existingOrder = await onlineOrderModel.findOne({ orderId });
        if (!existingOrder) {
            isUnique = true;
        }
    }

    return orderId;
}

router.post('/create/order', async (req, res) => {
    const {
        userToken,
        address,
        coordinates,
        paymentMethod,
        cartItems,
    } = req.body;

    try {
        const calculateTotal = () => {
            return cartItems.reduce((total, item) => {
                const priceAfterDiscount = item.offer
                    ? item.price - item.price * (item.offer / 100)
                    : item.price;
                return total + priceAfterDiscount * item.quantity;
            }, 0);
        };
        const totalAmount = calculateTotal()

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

            // Generate a unique orderId
            const orderId = await generateUniqueOrderId();

            // Create the order
            const newOrder = new onlineOrderModel({
                orderId: orderId,
                user: user._id,
                address,
                coordinates,
                paymentMethod,
                cartItems,
                totalAmount,
                status: paymentMethod === 'cod' ? 'confirmed' : 'pending',
                paymentStatus: 'pending'
            });

            await newOrder.save();

            user.deliveryAdress = address
            user.deliveryCoordinates = coordinates
            await user.save()
            await newOrder.populate('user');
            if (paymentMethod === 'cod') {
                broadcastOnlineOrderUpdate(newOrder)
                return res.status(201).json({
                    success: true,
                    message: 'Order created successfully',
                    order: newOrder
                });
            } else {
                // Integrate PhonePe payment
                try {
                    const phonePeResponse = await initiatePhonePePayment(newOrder,totalAmount, user);
                    if (phonePeResponse.success) {
                        return res.status(201).json({
                            success: true,
                            message: 'Order created and payment initiated successfully',
                            order: newOrder,
                            payment: phonePeResponse.data
                        });
                    } else {
                        return res.status(400).json({
                            success: false,
                            message: 'Order created but failed to initiate payment',
                            order: newOrder
                        });
                    }
                } catch (paymentError) {
                    console.log('PhonePe Payment Error:', paymentError);
                    return res.status(500).json({
                        success: false,
                        message: 'Error creating order and initiating payment',
                        order: newOrder,
                        error: paymentError.message
                    });
                }
            }
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error creating order', error: error.message });
    }
});


async function initiatePhonePePayment(order,amount, user) {
    
    if (!user.mobileNumber || user.mobileNumber.length !== 10) {
        throw new Error("Invalid mobile number provided.");
    }
    
    const data = {
        merchantId: MERCHANT_ID,
        merchantUserId: 'MUID' + user._id,
        name: user.name,
        mobileNumber: `+91${user.mobileNumber}`,
        amount: parseInt(amount * 100), // Amount in paise, ensure integer
        merchantTransactionId: order.orderId,
        redirectUrl: `${APP_BE_URL}/order-validate/${order.orderId}`,
        redirectMode: "REDIRECT",
        paymentInstrument: {
            type: "PAY_PAGE",
        },
    };

    try {
        const payload = JSON.stringify(data);
        const payloadBase64 = Buffer.from(payload).toString('base64');

        const stringToSign = payloadBase64 + '/pg/v1/pay' + SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
        const checksum = sha256 + '###' + SALT_INDEX;

        const prod_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay";
        const options = {
            method: 'POST',
            url: prod_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum,
            },
            data: {
                request: payloadBase64
            },
        };

        const response = await axios.request(options);
        return response.data;

    } catch (error) {
        console.error('PhonePe Payment Error:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', JSON.stringify(error.response.data, null, 2));
        }
        throw new Error('Failed to initiate PhonePe payment');
    }
}





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

router.get('/order-status/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const order = await onlineOrderModel.findOne({ orderId: id }).populate('user')
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        if (order.paymentMethod === 'cod') {
            return res.status(200).json({
                success: true,
                message: 'Order status fetched successfully',
                order
        })
    }

    const stringToSign = `/pg/v1/status/${MERCHANT_ID}/${id}${SALT_KEY}`;
    const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
    const checksum = `${sha256}###${SALT_INDEX}`;

    const URL = `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${MERCHANT_ID}/${id}`;
    const options = {
        method: 'GET',
        url: URL,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': MERCHANT_ID,
        },
    };

    // Call the PhonePe API to fetch payment status
    const response = await axios.request(options);

    // Update the order status based on the API response
    if (response.data.success === true && order.status !== 'confirmed') {
        order.status = 'confirmed';
        order.paymentStatus = 'completed';
        await order.save();
        broadcastOnlineOrderUpdate(order); // Only broadcast if the status changes
        
        return res.status(200).json({
            success: true,
            message: 'Order confirmed successfully',
            order
        });
    } else if (response.data.success !== true && order.status !== 'failed') {
        order.status = 'failed';
        order.paymentStatus = 'failed';
        await order.save();
        broadcastOnlineOrderUpdate(order); // Only broadcast if the status changes
        
        return res.status(400).json({
            success: false,
            message: 'Order confirmation failed',
            order
        });
    } else {
        // If status hasn't changed, simply return the current order without broadcasting
        return res.status(200).json({
            success: true,
            message: 'Order status fetched successfully',
            order
        });
    }
} catch (error) {
    console.error("Error fetching order status:", error);
    return res.status(500).json({ success: false, message: 'Server Error', error });
}
});

router.get('/get-online/ordersToday', async (req, res) => {
    try {
        // Get the start and end of the current day
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0); // Set to 12:00 AM

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Set to 11:59 PM

        // Query to get orders from today
        const orders = await onlineOrderModel.find({
            createdAt: {
                $gte: startOfToday,
                $lt: endOfToday
            }
        }).populate('user');

        res.status(200).json({
            success: true,
            message: 'Today\'s online orders fetched successfully',
            orders
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});

router.get('/get-online/orders/byId', async (req, res) => {
    try {
        const { authorization } = req.headers;
        jwt.verify(authorization, JWT_SECRET, async (err, decoded) => {
            if (err) {
                // Token is invalid or expired
                return res.status(401).json({ success: false, message: 'Invalid or expired token' });
            }

                 // Token is valid, retrieve the user info using the userId from the token
                 const user = await userModel.findById(decoded.userId).select('-password'); // Exclude password

                 if (!user) {
                     return res.status(404).json({ success: false, message: 'User not found' });
                 }
                 const sixMonthsAgo = new Date();
                 sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
     
                 // Find orders made in the last six months
                 const orders = await onlineOrderModel.find({ user: user._id, createdAt: { $gte: sixMonthsAgo } })
                     .populate('user').sort({
                         createdAt: -1
                     });
     
                 if (!orders.length) { // Check if there are no orders
                     return res.status(404).json({ success: false, message: 'No orders found in the last 6 months' });
                 }

              res.status(200).json({
                  success: true,
                  message: 'Online order fetched successfully',
                  orders
              });
        });
    } catch (error) {
        console.error(error)
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});

export default router