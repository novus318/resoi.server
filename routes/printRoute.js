import express from 'express'
import tableOrderModel from '../models/tableOrderModel.js';
import onlineOrderModel from '../models/onlineOrderModel.js';


const router=express.Router()
const formatOrderForPrinting = (order) => {
  const printDataArray = [
    // Restaurant Name (Centered, Bold, Larger Font)
    {
      type: 0, // Text
      content: "Malabar Resoi",
      bold: 1, // Bold
      align: 1, // Center
      format: 2, // Double Height + Width
    },
    // Restaurant Address (Centered)
    {
      type: 0, // Text
      content: "Perumba, Payyanur",
      bold: 0, // Not bold
      align: 1, // Center
      format: 0, // Normal
    },
    // Restaurant Contact (Centered)
    {
      type: 0, // Text
      content: "Contact: +91 8281930611",
      bold: 0, // Not bold
      align: 1, // Center
      format: 0, // Normal
    },
    // Empty Line for Spacing
    {
      type: 0, // Text
      content: " ",
      bold: 0,
      align: 0,
      format: 0,
    },
    // Order ID (Centered, Bold)
    {
      type: 0, // Text
      content: `Order ID: ${order.orderId}`,
      bold: 1, // Bold
      align: 1, // Center
      format: 0, // Normal
    },
    // Conditional Table Information
    ...(order.table
      ? [
          {
            type: 0, // Text
            content: `Table: ${order.table.tableName}`,
            bold: 1, // Bold
            align: 1, // Center
            format: 0, // Normal
          },
        ]
      : []),
    // Date (Left Aligned)
    {
      type: 0, // Text
      content: `Date: ${String(order?.createdAt.getDate()).padStart(2, '0')}/${String(order?.createdAt.getMonth() + 1).padStart(2, '0')}/${order?.createdAt.getFullYear()}`,
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Separator Line
    {
      type: 0, // Text
      content: "--------------------------------",
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Customer Name (Left Aligned)
    {
      type: 0, // Text
      content: `Customer: ${order.user?.name || "N/A"}`,
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Customer Mobile Number (Left Aligned)
    {
      type: 0, // Text
      content: `Mobile: ${order.user?.mobileNumber || "N/A"}`,
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Separator Line
    {
      type: 0, // Text
      content: "--------------------------------",
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Items Header (Centered, Bold)
    {
      type: 0, // Text
      content: "Items:",
      bold: 1, // Bold
      align: 0, // Center
      format: 0, // Normal
    },
    // List of Items (Left Aligned)
    ...order.cartItems.map((item) => ({
      type: 0, // Text
      content: `${item.name} - ${item.quantity} x ${item.price} = ${item.quantity * item.price} `,
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    })),
    // Separator Line
    {
      type: 0, // Text
      content: "--------------------------------",
      bold: 0, // Not bold
      align: 0, // Left
      format: 0, // Normal
    },
    // Total Amount (Right Aligned, Bold)
    {
      type: 0, // Text
      content: `Total Amount: ₹${order.totalAmount}`,
      bold: 1, // Bold
      align: 2, // Right
      format: 0, // Normal
    },
    // Empty Line for Spacing
    {
      type: 0, // Text
      content: " ",
      bold: 0,
      align: 0,
      format: 0,
    },
    // Thank You Message (Centered, Bold)
    {
      type: 0, // Text
      content: "Thank you for your order!",
      bold: 1, // Bold
      align: 1, // Center
      format: 0, // Normal
    },
    {
      type: 0, // Text
      content: " ",
      bold: 0,
      align: 0,
      format: 0,
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
      order = await tableOrderModel
        .findById(orderId)
        .populate({
          path: 'user',
          model: order?.userType || 'User', // Safely access userType
        })
        .populate('table');
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