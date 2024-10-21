
import express from 'express'
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import userModel from '../models/userModel.js';
import axios from 'axios';
import useragent from 'useragent';
const router=express.Router()
dotenv.config({ path: './.env' })

const { JWT_SECRET } = process.env;


router.post('/create/user', async (req, res) => {
    try {
        const { name, mobileNumber, ipAddress } = req.body;
        const ipResponse = await axios.get(`http://ip-api.com/json/${ipAddress}`);
        const { city, regionName, country, isp, lat, lon } = ipResponse.data;

console.log(ipResponse.data)

        // Construct placeOfOperation and coordinates
        const placeOfOperation = `${city}, ${regionName}, ${country}`;
        const coordinates = [lat, lon];

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