import express from 'express';
import Store from '../models/storeModel.js'; // Adjust the path based on your file structure

const router = express.Router();

// Route to get the current store status
router.get('/status', async (req, res) => {
    try {
      let store = await Store.findOne();
      
      // If no document found, create one with default status
      if (!store) {
        store = await Store.create({ storeStatus: 'closed' }); 
      }
      
      res.json({success:true, status: store.storeStatus });
    } catch (error) {
      res.status(500).json({success:false, message: 'Server error', error });
    }
  });
  

// Route to update the store status
router.put('/status', async (req, res) => {
  const { status } = req.body;
  if (!['open', 'closed'].includes(status)) {
    return res.status(400).json({success:true, message: 'Invalid status' });
  }

  try {
    const store = await Store.findOneAndUpdate({}, { storeStatus: status }, { new: true, upsert: true });
    res.json({ message: 'Store status updated', status: store.storeStatus });
  } catch (error) {
    res.status(500).json({success:false, message: 'Server error', error });
  }
});

export default router;
