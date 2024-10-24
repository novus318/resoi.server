
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';
import axios from 'axios';
import uniqid from 'uniqid'
import sha256 from 'sha256'
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
        const totalAmount =calculateTotal()

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
            if (paymentMethod === 'cod') {
                return res.status(201).json({
                    success: true,
                    message: 'Order created successfully',
                    order: newOrder
                });
            } else {
                // Integrate PhonePe payment
                try {
                    const phonePeResponse = await initiatePhonePePayment(orderId, totalAmount,user);
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

// Function to initiate PhonePe payment
async function initiatePhonePePayment(orderId, amount,user) {
    let merchantTransactionId = uniqid();
    const paymentURL = 'https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay'; // Example PhonePe endpoint
    const payload = {
        orderId: orderId,
        amount: amount * 100, // Converting to paise
        merchantId: merchantTransactionId,
        merchantTransactionId: orderId,
        merchantUserId: user._id,
        redirectUrl: `${APP_BE_URL}/payment/validate/${merchantTransactionId}`,
        redirectMode: "REDIRECT",
        mobileNumber: `91${user.mobileNumber}`,
        paymentInstrument: {
          type: "PAY_PAGE",
        },
    };
 // Make a base64-encoded payload
 let bufferObj = Buffer.from(JSON.stringify(payload), "utf8");
 let base64EncodedPayload = bufferObj.toString("base64");

 // X-VERIFY => SHA256(base64EncodedPayload + "/pg/v1/pay" + SALT_KEY) + ### + SALT_INDEX
 let string = base64EncodedPayload + "/pg/v1/pay" + SALT_KEY;
 let sha256_val = sha256(string);
 let xVerifyChecksum = sha256_val + "###" + SALT_INDEX;

    const headers = {
        "Content-Type": "application/json",
       "X-VERIFY": xVerifyChecksum,
       accept: "application/json",
    };

    try {
        const response = await axios.post(paymentURL, payload, { headers });
        return response.data;
    } catch (error) {
        console.log('Error in PhonePe API:', error);
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