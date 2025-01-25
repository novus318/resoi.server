import express from 'express'
import fs from 'fs';
import path from 'path';
import tableOrderModel from '../models/tableOrderModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';


const router=express.Router()

  
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
      const phpFileContent = formatOrderForPrinting(order);
  
      // Set headers to trigger file download
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', 'attachment; filename="order_print.php"');
  
      // Send the PHP file content as the response
      res.send(phpFileContent);
  
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  
  function formatOrderForPrinting(order) {
    // Create an array to hold the print entries
    const printEntries = [];
  
    // Add order details to the print entries
    const titleEntry = {
      type: 0, // text
      content: `Order #${order.orderId}`,
      bold: 1,
      align: 2, // right
      format: 3 // double width
    };
    printEntries.push(titleEntry);
  
    const customerEntry = {
      type: 0, // text
      content: `Customer: ${order.user?.name || 'N/A'}`,
      bold: 0,
      align: 0, // left
      format: 0 // normal
    };
    printEntries.push(customerEntry);
  
    const dateEntry = {
      type: 0, // text
      content: `Date: ${new Date(order.createdAt).toLocaleDateString()}`,
      bold: 0,
      align: 0, // left
      format: 0 // normal
    };
    printEntries.push(dateEntry);
  
    // Add items in the order (check if cartItems exists and is an array)
    if (Array.isArray(order.cartItems)) {
      order.cartItems.forEach(item => {
        const itemEntry = {
          type: 0, // text
          content: `${item.quantity}x ${item.name} - $${item.price}`,
          bold: 0,
          align: 0, // left
          format: 0 // normal
        };
        printEntries.push(itemEntry);
      });
    } else {
      // Handle case where cartItems is missing or not an array
      const noItemsEntry = {
        type: 0, // text
        content: 'No items in this order',
        bold: 0,
        align: 0, // left
        format: 0 // normal
      };
      printEntries.push(noItemsEntry);
    }
  
    const totalEntry = {
      type: 0, // text
      content: `Total: $${order.totalAmount}`,
      bold: 1,
      align: 2, // right
      format: 3 // double width
    };
    printEntries.push(totalEntry);
  
    // Convert the print entries to a JSON string
    const jsonString = JSON.stringify(printEntries, null, 2);
  
    // Generate the PHP file content
    const phpFileContent = `<?php
  // This is an auto-generated PHP file for printing the order details
  $a = ${jsonString};
  
  echo json_encode($a, JSON_FORCE_OBJECT);
  ?>`;
  
    return phpFileContent;
  }


export default router