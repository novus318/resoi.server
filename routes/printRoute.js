import express from 'express'
import tableOrderModel from '../models/tableOrderModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';


const router=express.Router()


const formatOrderForPrinting = (order) => {
    const printDataArray = [
      {
        type: 0, // Text
        content: `Order ID: ${order.orderId}`,
        bold: 1, // Bold
        align: 1, // Center
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Customer: ${order.user?.name || "N/A"}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Address: ${order.address || "N/A"}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Payment Method: ${order.paymentMethod || "N/A"}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Payment Status: ${order.paymentStatus || "N/A"}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Order Status: ${order.status || "N/A"}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: "--------------------------------",
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: "Items:",
        bold: 1, // Bold
        align: 1, // Center
        format: 0, // Normal
      },
      ...order.cartItems.map((item) => ({
        type: 0, // Text
        content: `${item.name} (${item.variant}) - ${item.quantity} x ₹${item.price}`,
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      })),
      {
        type: 0, // Text
        content: "--------------------------------",
        bold: 0, // Not bold
        align: 0, // Left
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: `Total Amount: ₹${order.totalAmount}`,
        bold: 1, // Bold
        align: 2, // Right
        format: 0, // Normal
      },
      {
        type: 0, // Text
        content: "Thank you for your order!",
        bold: 1, // Bold
        align: 1, // Center
        format: 0, // Normal
      },
    ];
  
    // Convert array to object with numeric keys
    const printDataObject = printDataArray.reduce((acc, item, index) => {
      acc[index] = item;
      return acc;
    }, {});
  
    return printDataObject;
  };

  router.get("/get-order/:id", async (req, res) => {
    try {
      const orderId = req.params.id;
  
      // Try to find the order in onlineOrderModel
      let order = await onlineOrderModel.findById(orderId).populate("user");
  
      // If not found in onlineOrderModel, try tableOrderModel
      if (!order) {
        order = await tableOrderModel.findById(orderId).populate("user table");
      }
  
      // If no order is found, return a 404 error
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      // Format the order data for printing
      const printData = formatOrderForPrinting(order);
  
      // Return the formatted data as a JSON response
      res.status(200).json(printData);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });


export default router