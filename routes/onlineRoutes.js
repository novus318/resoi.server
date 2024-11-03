
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';
import axios from 'axios';
import crypto from 'crypto';
import { broadcastOnlineOrderUpdate } from '../utils/webSocket.js';
import mongoose from 'mongoose';
const router = express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET,MERCHANT_ID ,SALT_INDEX,SALT_KEY ,APP_BE_URL  } = process.env;




// Function to generate a unique Order ID
async function generateUniqueOrderId() {
    let orderId;
    let isUnique = false;

    while (!isUnique) {
        const uniqueNumber = Math.floor(1000000 + Math.random() * 9000000);
        orderId = `RS-${uniqueNumber}`;
        
        const existingOrder = await onlineOrderModel.findOne({ orderId });
        if (!existingOrder) {
            isUnique = true;
        }
    }

    return orderId;
}

// Function to verify JWT and retrieve user
async function verifyToken(token) {
    try {
        const decoded = await jwt.verify(token, JWT_SECRET);
        const user = await userModel.findById(decoded.userId).select('-password');
        return user;
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

// Calculate total order amount
function calculateTotal(cartItems) {
    return cartItems.reduce((total, item) => {
        const priceAfterDiscount = item.offer
            ? item.price - item.price * (item.offer / 100)
            : item.price;
        return total + priceAfterDiscount * item.quantity;
    }, 0);
}

// Payment Integration
async function initiatePhonePePayment(order, amount, user) {
    if (!user.mobileNumber || user.mobileNumber.length !== 10) {
        throw new Error('Invalid mobile number provided.');
    }

    const data = {
        merchantId: MERCHANT_ID,
        merchantUserId: 'MUID' + user._id,
        name: user.name,
        mobileNumber: `+91${user.mobileNumber}`,
        amount: parseInt(amount * 100),
        merchantTransactionId: order.orderId,
        redirectUrl: `${APP_BE_URL}/order-validate/${order.orderId}`,
        redirectMode: 'REDIRECT',
        paymentInstrument: {
            type: 'PAY_PAGE',
        },
    };

    try {
        const payload = JSON.stringify(data);
        const payloadBase64 = Buffer.from(payload).toString('base64');

        const stringToSign = payloadBase64 + '/pg/v1/pay' + SALT_KEY;
        const sha256 = crypto.createHash('sha256').update(stringToSign).digest('hex');
        const checksum = sha256 + '###' + SALT_INDEX;

        const response = await axios.post(
            'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay',
            { request: payloadBase64 },
            {
                headers: {
                    accept: 'application/json',
                    'Content-Type': 'application/json',
                    'X-VERIFY': checksum,
                },
            }
        );

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


router.post('/create/order', async (req, res) => {
    const { userToken, address, coordinates, paymentMethod, cartItems, existingOrderId } = req.body;
    console.log(existingOrderId);
  
    // Start a session for the transaction
    const session = await mongoose.startSession();
    session.startTransaction();
  
    try {
      const user = await verifyToken(userToken);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
  
      let newOrder;
      let totalAmount;
  
      if (!existingOrderId) {
        // Calculate total amount
        totalAmount = calculateTotal(cartItems);
  
        // Generate a unique order ID
        const uniqueOrderId = await generateUniqueOrderId();
  
        // Create a new order in the session
        newOrder = new onlineOrderModel({
          orderId: uniqueOrderId,
          user: user._id,
          address,
          coordinates,
          paymentMethod,
          cartItems,
          totalAmount,
          status: paymentMethod === 'cod' ? 'confirmed' : 'pending',
          paymentStatus: 'pending',
        });
  
        await newOrder.save({ session });
  
        // Update user's delivery address and coordinates within the transaction
        user.deliveryAddress = address;
        user.deliveryCoordinates = coordinates;
        await user.save({ session });
  
        if (paymentMethod === 'cod') {
          await session.commitTransaction();
          session.endSession();
  
          broadcastOnlineOrderUpdate(newOrder);
          return res.status(201).json({
            success: true,
            message: 'Order created successfully',
            order: newOrder,
          });
        }
      } else {
        // Retrieve and update the existing order
        newOrder = await onlineOrderModel.findOne({ orderId: existingOrderId }).session(session);
        if (!newOrder) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ success: false, message: 'Order not found' });
        }
  
        // Update the order details
        newOrder.address = address;
        newOrder.coordinates = coordinates;
        newOrder.paymentMethod = paymentMethod;
        newOrder.cartItems = cartItems;
        newOrder.totalAmount = calculateTotal(cartItems);
        await newOrder.save({ session });
  
        if (paymentMethod === 'cod') {
            newOrder.status = 'confirmed';
            await newOrder.save({ session });
          await session.commitTransaction();
          session.endSession();
  
          return res.status(200).json({
            success: true,
            message: 'Order confirmed successfully',
            order: newOrder,
          });
        }
  
        totalAmount = newOrder.totalAmount;
      }
  
      // If payment method is not COD, initiate payment
      try {
        const phonePeResponse = await initiatePhonePePayment(newOrder, totalAmount, user);
  
        if (phonePeResponse.success) {
          await session.commitTransaction();
          session.endSession();
  
          return res.status(201).json({
            success: true,
            message: 'Order created and payment initiated successfully',
            order: newOrder,
            payment: phonePeResponse.data,
          });
        } else {
          await session.abortTransaction();
          session.endSession();
  
          return res.status(400).json({
            success: false,
            message: 'Order created but failed to initiate payment',
          });
        }
      } catch (paymentError) {
        console.error('PhonePe Payment Error:', paymentError);
  
        await session.abortTransaction();
        session.endSession();
  
        return res.status(500).json({
          success: false,
          message: 'Error creating order and initiating payment',
          error: paymentError.message,
        });
      }
    } catch (error) {
      console.error('Order Creation Error:', error);
  
      await session.abortTransaction();
      session.endSession();
  
      return res.status(500).json({
        success: false,
        message: 'Error creating order',
        error: error.message,
      });
    }
  });
  

  router.put('/update/online-order-status/:orderId', async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        // Input validation
        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: 'Invalid input data' });
        }

        // Find the order by ID
        const order = await onlineOrderModel.findOne({orderId});
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
router.get('/get-online/ordersToday/forDelivery', async (req, res) => {
    try {
        // Get the start and end of the current day
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0); // Set to 12:00 AM

        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999); // Set to 11:59 PM

        // Query to get orders from today
        const orders = await onlineOrderModel.find({
            status: {
                $in: ['confirmed', 'in-progress']
            },
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