
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import axios from 'axios';
import useragent from 'useragent';
import onlineOrderModel from '../models/onlineOrderModel.js';
import tableOrderModel from '../models/tableOrderModel.js';
import NodeCache from 'node-cache';

const cache = new NodeCache({ stdTTL: 120, checkperiod: 120 }); 
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;


router.post('/create/user', async (req, res) => {
    try {
        const { name, mobileNumber, ipAddress } = req.body;
        const ipResponse = await axios.get(`http://ip-api.com/json/${ipAddress}`);
        const { city, regionName, country, isp, lat, lon } = ipResponse.data;

        // Construct placeOfOperation and coordinates
        const placeOfOperation = `${city}, ${regionName}, ${country}`;
        const coordinates = {
            lat:lat,
            lng:lon
        };

        const agent = useragent.parse(req.headers['user-agent']);
        const device = agent.device.toString(); 
        // Check if the user already exists
        let user = await userModel.findOne({ mobileNumber });
        if (user) {
            // Update the existing user's name and IP address
            user.name = name;
            user.ipAddress = ipAddress;
            user.placeOfOperation = placeOfOperation;
            user.isp = isp;
            user.coordinates = coordinates;
            user.device = device;
            await user.save();
        } else {
            // Create a new user
            user = new userModel({
                name,
                mobileNumber,
                ipAddress,
                placeOfOperation,
                isp,
                coordinates,
                device
            });
            await user.save();
        }

        // Generate a token valid for 24 hours
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' } // Token validity
        );

        res.status(201).json({ success:true,message: 'User created or updated successfully', user, token });
    } catch (error) {
        console.log(error)
        res.status(500).json({ success:false,message: 'Error creating or updating user', error: error.message });
    }
});


router.get('/get-users', async (req, res) => {
    try {
        const users = await userModel.find({}).sort({
            createdAt: -1
        });
        res.status(200).json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});
router.get('/get-user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await userModel.findById(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const onlineOrders = await onlineOrderModel.find({ user: id });
        const storeOrders = await tableOrderModel.find({ user: id });
        res.status(200).json({ success: true, user,onlineOrders,storeOrders });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error', error });
    }
});


router.put('/update-user/:id', async (req, res) => {
    const { id } = req.params;
    const { name, mobileNumber, placeOfOperation, isp } = req.body;
    try {
        const user = await userModel.findByIdAndUpdate(id, { name, mobileNumber, placeOfOperation, isp }, { new: true });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating user', error: error.message });
        }
        });

router.delete('/delete-user/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const user = await userModel.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.status(200).json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error deleting user', error: error.message });
    }
});

router.get('/address', async (req, res) => {
    try {
        const { authorization } = req.headers;

        // Verify the token
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
     
                 res.status(200).json({
                     success: true,
                     message: 'User address retrieved successfully',
                     address: user?.deliveryAdress|| null,
                     name:user?.name,
                     number:user?.mobileNumber,
                     coordinates:user?.deliveryCoordinates||null
                 });
        });
 } catch (error) {
        console.log(error)
        res.status(500).json({ success: false, message: 'Error retrieving user address', error: error.message });
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
        let user = cache.get(`user_${decoded.userId}`);
        if (!user) {
            // User not found in cache, fetch from DB
            user = await userModel.findById(decoded.userId).select('-password').lean();
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }
            // Cache plain JavaScript user data object
            cache.set(`user_${decoded.userId}`, user);
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