
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import axios from 'axios';
import crypto from 'crypto';
import tableOrderModel from '../models/tableOrderModel.js';
import tableModel from '../models/tableModel.js';
import { broadcastTableOrderUpdate } from '../utils/webSocket.js';
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET,MERCHANT_ID ,SALT_INDEX,SALT_KEY ,APP_BE_URL  } = process.env;


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
        orderType,
        tableId,
        userToken,
        userType,
        cartItems,
    } = req.body;

    try {
        // Input Validation
        if (!orderType || !['dining', 'parcel'].includes(orderType)) {
            return res.status(400).json({ success: false, message: 'Invalid order type' });
        }

        if (!userToken || !userType || !['User', 'AdminUser'].includes(userType)) {
            return res.status(400).json({ success: false, message: 'Invalid user details' });
        }

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart items cannot be empty' });
        }

        if (orderType === 'dining' && !tableId) {
            return res.status(400).json({ success: false, message: 'Table ID is required for dining orders' });
        }

        // Calculate Total Amount
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
        const user = await userModel.findById(decoded.userId).select('-password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Generate a unique orderId
        const orderId = await generateUniqueOrderId();

        // Create the order
        const newOrder = new tableOrderModel({
            orderType,
            table: orderType === 'dining' ? tableId : null,
            orderId,
            user: user._id,
            userType,
            cartItems,
            totalAmount,
            status: 'confirmed',
            paymentStatus: 'pending',
        });

        // Save the order
        await newOrder.save();

        // Update table status for dining orders
        if (orderType === 'dining') {
            await tableModel.findByIdAndUpdate(tableId, { status: 'occupied' });
        }

        await newOrder.populate('user');

        // Conditionally populate 'table' only for dining orders
        if (newOrder.orderType === 'dining') {
            await newOrder.populate('table');
        }
        
        // Broadcast the order update (if applicable)
        broadcastTableOrderUpdate(newOrder);

        // Response
        return res.status(201).json({
            success: true,
            message: 'Order confirmed successfully',
            order: newOrder,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: 'Error confirming order',
            error: error.message,
        });
    }
});



router.put('/update/table-order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        // Input validation
        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        // Find the order by ID
        const order = await tableOrderModel.findOne({orderId});
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Update the status and payment status
        order.status = status;
        if (status.toLowerCase() === 'completed') {
            order.paymentStatus = 'completed';
        }

        // Save the updated order
        await order.save();

        return res.status(200).json({
            success: true,
            message: 'Order status updated successfully',
            order
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating order status', error: error.message });
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

router.post('/order-paymentMethod',async (req,res)=>{
    const {  paymentMethod, orderId } = req.body;
    try {
        // Find the existing order
        const existingOrder = await tableOrderModel.findOne({ orderId });
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        existingOrder.paymentMethod = paymentMethod;

        // Save the updated order
        await existingOrder.save();

        return res.status(200).json({
            success: true,
            message: 'Payment method updated successfully',
            order: existingOrder
        });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error updating payment method', error: error.message });
    }
})

router.post('/table-order/online-pay', async (req, res) => {
    const { orderId } = req.body;
    try {
        // Find the existing order
        const existingOrder = await tableOrderModel.findOne({ orderId }).populate('user');
        if (!existingOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        existingOrder.paymentStatus = 'pending';
        existingOrder.paymentMethod = 'online';

        // Save the updated order
        await existingOrder.save();

        try {
            const phonePeResponse = await initiatePhonePePayment(existingOrder,existingOrder.totalAmount, existingOrder.user);
            if (phonePeResponse.success) {
                return res.status(201).json({
                    success: true,
                    message: 'Order created and payment initiated successfully',
                    order: existingOrder,
                    payment: phonePeResponse.data
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Order created but failed to initiate payment',
                    order: existingOrder
                });
            }
        } catch (paymentError) {
            console.log('PhonePe Payment Error:', paymentError);
            return res.status(500).json({
                success: false,
                message: 'Error creating order and initiating payment',
                order: existingOrder,
                error: paymentError.message
            });
        }

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Error updating payment status', error: error.message });
    }
    })

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
            redirectUrl: `${APP_BE_URL}/table/paymentConfirm//${order.orderId}`,
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
    

    router.get('/order-status/:id', async (req, res) => {
        try {
            const { id } = req.params;
    
            // Validate input
            if (!id) {
                return res.status(400).json({ success: false, message: 'Order ID is required' });
            }
    
            // Find the existing order
            const order = await tableOrderModel.findOne({ orderId: id }).populate('user');
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
    
            // If payment method is cash, return status immediately
            if (order.paymentMethod === 'cash') {
                return res.status(200).json({
                    success: true,
                    message: 'payment status fetched successfully',
                    order
                });
            }
    
            // Prepare data for PhonePe payment status check
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
            if (response.data.success === true && order.paymentStatus !== 'completed') {
                order.status = 'completed';
                order.paymentStatus = 'completed';
                await order.save();
    
                return res.status(200).json({
                    success: true,
                    message: 'payment confirmed successfully',
                    order
                });
            } else if (response.data.success === false && order.paymentStatus !== 'failed') {
                order.status = 'in-progress';
                order.paymentStatus = 'failed';
                await order.save();
    
                return res.status(400).json({
                    success: false,
                    message: 'payment confirmation failed',
                    order
                });
            } else {
                // If status hasn't changed, simply return the current order
                return res.status(200).json({
                    success: true,
                    message: 'payment status fetched successfully',
                    order
                });
            }
        } catch (error) {
            console.error("Error fetching payment status:", error.response.data);
            return res.status(500).json({ success: false, message: 'Server Error', error: error.message });
        }
    });



router.get('/get-store/ordersToday', async (req, res) => {
    try {
        // Get the start and end of the current day
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0); // Set to 12:00 AM

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Set to 11:59 PM

        // Query to get orders from today
        const orders = await tableOrderModel.find({
            createdAt: {
                $gte: startOfToday,
                $lt: endOfToday
            }
        }).populate('user table');

        res.status(200).json({
            success: true,
            message: 'Today\'s store orders fetched successfully',
            orders
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});


export default router