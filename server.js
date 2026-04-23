require("dotenv").config(); // ✅ ADDED

const express = require("express");
const crypto = require("crypto");
const path = require("path");
const Razorpay = require("razorpay");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 3001;

// ✅ CHANGE HERE
app.use(cors({ origin: "*" }));

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ===============================
   ✅ MONGODB CONNECTION (UPDATED)
================================= */
mongoose.connect(process.env.MONGO_URI) // ✅ CHANGED
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err));

/* ===============================
   ✅ ORDER MODEL (UPDATED)
================================= */
const OrderSchema = new mongoose.Schema({
  name: String,
  phone: String,
  address: String,
  order_id: String,
  payment_id: String,
  cart: Array,
  date: { type: Date, default: Date.now }
});

const Order = mongoose.model("Order", OrderSchema);

/* ===============================
   ✅ RAZORPAY SETUP (UPDATED)
================================= */
const RZP_KEY_ID = process.env.RAZORPAY_KEY_ID;       // ✅ CHANGED
const RZP_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET; // ✅ CHANGED

const rzp = new Razorpay({
  key_id: RZP_KEY_ID,
  key_secret: RZP_KEY_SECRET,
});

console.log("Razorpay initialized");

/* ===============================
   ✅ SEND KEY TO FRONTEND
================================= */
app.get("/api/config", (req, res) => {
  res.json({ key: RZP_KEY_ID, demo: false });
});

/* ===============================
   ✅ CREATE ORDER
================================= */
app.post("/api/create-order", async (req, res) => {
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }

  try {
    const order = await rzp.orders.create({
      amount: Math.round(amount * 100),
      currency: "INR",
      receipt: "order_" + Date.now(),
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/* ===============================
   ✅ VERIFY PAYMENT + SAVE ORDER
================================= */
app.post("/api/verify-payment", async (req, res) => {
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    name,
    phone,
    address,
    cart
  } = req.body;

  const generated_signature = crypto
    .createHmac("sha256", RZP_KEY_SECRET) // ✅ still works (now from env)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  if (generated_signature === razorpay_signature) {

    try {
      const newOrder = new Order({
        name,
        phone,
        address,
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        cart: cart
      });

      await newOrder.save();

      res.json({ success: true });

    } catch (err) {
      console.log(err);
      res.status(500).json({ success: false });
    }

  } else {
    res.status(400).json({ success: false });
  }
});

/* ===============================
   ✅ GET ALL ORDERS
================================= */
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ date: -1 });
    res.json(orders);
  } catch (err) {
    res.json([]);
  }
});

/* ===============================
   ✅ BACKEND CHECK
================================= */
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

/* ===============================
   ✅ START SERVER
================================= */
app.listen(PORT, () => {
  console.log("Server running at port " + PORT);
});
