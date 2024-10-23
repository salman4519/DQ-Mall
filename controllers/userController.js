const User = require("../models/userModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Cart = require("../models/cartModel");
const Order = require("../models/orderModel");
const Wishlist = require("../models/wishlistModel");
const Wallet = require("../models/walletModel");
const Coupon = require("../models/couponModel");
const Offer = require("../models/offerModel");
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const addressModel = require("../models/addressModel");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types; // Correct way to get ObjectId
require("dotenv").config();

//to get home page
const loadHome = async (req, res) => {
  try {
    const categories = await Category.find({ isList: true });
    res.render("user/home", { categories });
  } catch (error) {
    console.log("the loadHome broke");
  }
};

// Controller method to load products by category
const loadCategoryProducts = async (req, res) => {
  const categoryId = req.params.id; // Get the category ID from the URL
  const limit = 6; // Number of products per page
  const page = parseInt(req.query.page) || 1; // Current page number, default to 1
  const skip = (page - 1) * limit;

  try {
    // Fetch the category by ID
    const category = await Category.findById(categoryId);

    // Fetch total products count for pagination
    const totalProducts = await Product.countDocuments({
      CategoryId: categoryId,
      Is_list: true,
    });

    // Fetch products by category ID with pagination
    const products = await Product.find({
      CategoryId: categoryId,
      Is_list: true,
    })
      .skip(skip)
      .limit(limit)
      .populate("CategoryId");

    // Fetch applicable offers for the products
    const applicableOffers = await Offer.find({
      $or: [
        { productIds: { $in: products.map((product) => product._id) } },
        { categoryIds: categoryId },
      ],
      isActive: true,
    });

    // Logging to check the applicableOffers data
    console.log("Applicable Offers:", applicableOffers);
    console.log("Type of applicableOffers:", Array.isArray(applicableOffers)); // Check if it's an array

    // Render the category products page with pagination info
    res.render("user/product/listProduct", {
      products,
      category,
      applicableOffers, // Pass applicableOffers to the view
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error loading category products");
  }
};

// Controller to load product details
const loadProductDetails = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate(
      "CategoryId"
    );

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Fetch product-specific offers
    const productOffers = await Offer.find({
      applicableTo: "product",
      productIds: product._id,
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    });

    // Fetch category-specific offers
    const categoryOffers = await Offer.find({
      applicableTo: "category",
      categoryIds: product.CategoryId._id, // Ensure this refers to the correct field
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() },
    });

    // Prepare the applicable offers structure for the view
    const applicableOffers = {
      productOffers,
      categoryOffers,
    };

    // Render the product details with the applicable offers
    res.render("user/product/productDetails", { product, applicableOffers });
  } catch (error) {
    console.error("Error loading product details:", error);
    res.status(500).send("Internal Server Error");
  }
};

//controller to get login page
const getLogin = async (req, res) => {
  try {
    res.render("user/login/userLogin", { message: "" });
  } catch (error) {
    console.log(" get login broke");
  }
};

//to post login page
const postLogin = async (req, res) => {
  const { Username, Password } = req.body;

  try {
    const user = await User.findOne({
      Is_block: false,
      Is_verified: true,
      Username,
    });
    if (!user) {
      return res.render("user/login/userLogin", {
        message: "Invalid username or password",
      });
    }

    // Check password if present
    if (user.Password) {
      const isMatch = await bcrypt.compare(Password, user.Password);
      if (!isMatch) {
        return res.render("user/login/userLogin", {
          message: "Invalid username or password",
        });
      }
    }

    // Successful login
    req.session.isLoggedIn = true;
    req.session.userId = user.id;
    res.redirect("/home");
  } catch (error) {
    console.error("Error in postLogin:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

//controller to get signup page
const getSigup = async (req, res) => {
  try {
    res.render("user/login/signup");
  } catch (error) {
    console.log(" get signup broke");
  }
};

//to post signup
const postSignup = async (req, res) => {
  const { Email, Username, Mobile, Password } = req.body;
  console.log(
    `Received data - Email: ${Email}, Username: ${Username}, Mobile: ${Mobile}`
  );

  if (!Email || !Username) {
    return res.render("user/login/signup", {
      message: "Email and Username are required",
    });
  }

  try {
    // Check if the email already exists
    let user = await User.findOne({ Email });
    if (user) {
      return res.render("user/login/signup", {
        message: "Email already registered",
      });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit numeric OTP
    const otpExpiresAt = Date.now() + 15 * 60 * 1000; // OTP expires in 15 minutes

    const pass = await bcrypt.hash(Password, 10);
    // Create new user
    user = new User({
      Email,
      Username,
      Mobile,
      Password: pass,
      OTP: otp,
      otpExpiresAt,
    });

    await user.save();

    // Setup Nodemailer transporter
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER, // Your email
        pass: process.env.EMAIL_PASS, // Your email password or app-specific password
      },
      tls: {
        rejectUnauthorized: false, // Ignore SSL certificate issues (useful for dev)
      },
    });

    // Email options
    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to: Email, // Recipient's email
      subject: "Your OTP Code", // Email subject
      text: `Your OTP code is ${otp}. It is valid for 15 minutes.`, // Email body
    };

    // Send OTP email
    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("Error sending OTP email:", error);
        return res.render("user/login/signup", {
          message: "Failed to send OTP",
        });
      }

      // Set session and redirect to OTP verification page
      // req.session.isLoggedIn = true;
      req.session.userId = user._id;
      req.session.userEmail = Email;
      req.session.message = "OTP sent to your email";

      res.redirect("/verify-otp");
    });
  } catch (error) {
    console.error("Error in postSignup:", error);
    res.render("user/login/signup", { message: "Internal server error" });
  }
};

//to verify otp
const verifyOtp = async (req, res) => {
  const { OTP } = req.body;

  try {
    // Retrieve the email stored in the session
    const Email = req.session.userEmail;

    if (!Email) {
      return res.render("user/login/verifyOtp", {
        message: "Session expired, please sign up again.",
      });
    }

    // Find the user by email
    const user = await User.findOne({ Email });

    if (!user) {
      return res.render("user/login/verifyOtp", { message: "User not found" });
    }

    // Check if OTP is correct and not expired
    if (user.OTP !== OTP) {
      return res.render("user/login/verifyOtp", { message: "Invalid OTP" });
    }

    if (user.otpExpiresAt < Date.now()) {
      return res.render("user/verifyOtp", {
        message: "OTP has expired, please sign up again.",
      });
    }

    // OTP is valid, redirect to /home
    // You can also clear the OTP and expiration fields after successful verification
    req.session.isLoggedIn = true;
    req.session.userId = user._id;
    req.session.userEmail = Email;
    user.Is_verified = true;
    user.OTP = null;
    user.otpExpiresAt = null;
    await user.save();

    // Redirect to /home or any desired route after successful verification
    res.redirect("/home");
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.render("user/login/verifyOtp", { message: "Internal server error" });
  }
};

//to get verifyOtp page
const getVerifyOtp = async (req, res) => {
  try {
    res.render("user/login/verifyOtp", { message: "" });
  } catch (error) {
    console.log("verify otp page broke");
  }
};

//to logout
const logout = (req, res) => {
  try {
    req.session.destroy();
    res.redirect("/");
  } catch (error) {
    console.log("logout is broke");
  }
};

// Controller to get the forgot password page
const getForgotPassword = (req, res) => {
  try {
    res.render("user/login/forgotPassword", { message: "" });
  } catch (error) {
    console.error("Error rendering forgot password page:", error);
    res.status(500).send("Internal server error");
  }
};

const forgotPassword = async (req, res) => {
  const { Email } = req.body;

  try {
    const user = await User.findOne({ Email, Is_verified: true });

    if (!user) {
      return res.render("user/login/forgotPassword", {
        message: "No account associated with this email",
      });
    }

    // Generate OTP or reset token
    const otp = Math.floor(100000 + Math.random() * 900000);
    const otpExpiresAt = Date.now() + 15 * 60 * 1000; // OTP expires in 15 minutes
    user.OTP = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    // Setup Nodemailer to send OTP to the user's email
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls: { rejectUnauthorized: false },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: Email,
      subject: "Password Reset OTP",
      text: `Your OTP for password reset is ${otp}. It will expire in 15 minutes.`,
    };

    transporter.sendMail(mailOptions, (error) => {
      if (error) {
        return res.render("user/login/forgotPassword", {
          message: "Failed to send OTP. Try again later.",
        });
      }
      req.session.userEmail = Email;
      return res.redirect("/verify-reset-otp");
    });
  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.render("user/login/forgotPassword", {
      message: "Internal server error. Please try again later.",
    });
  }
};

// Controller to get the verify OTP page for password reset
const getVerifyResetOtp = (req, res) => {
  try {
    res.render("user/login/verifyResetOtp", { message: "" });
  } catch (error) {
    console.error("Error rendering verify OTP page:", error);
    res.status(500).send("Internal server error");
  }
};

const verifyResetOtp = async (req, res) => {
  const { OTP } = req.body;
  const Email = req.session.userEmail;

  try {
    const user = await User.findOne({ Email });

    if (!user) {
      return res.render("user/login/verifyResetOtp", {
        message: "User not found",
      });
    }

    if (user.OTP !== OTP || user.otpExpiresAt < Date.now()) {
      return res.render("user/login/verifyResetOtp", {
        message: "Invalid or expired OTP",
      });
    }

    // Clear OTP and expiration and allow password reset
    user.OTP = null;
    user.otpExpiresAt = null;
    await user.save();

    return res.redirect("/reset-password");
  } catch (error) {
    console.error("Error verifying reset OTP:", error);
    res.render("user/login/verifyResetOtp", {
      message: "Internal server error",
    });
  }
};

// Controller to get the reset password page
const getResetPassword = (req, res) => {
  try {
    res.render("user/login/resetPassword", { message: "" });
  } catch (error) {
    console.error("Error rendering reset password page:", error);
    res.status(500).send("Internal server error");
  }
};

const resetPassword = async (req, res) => {
  const { Password, ConfirmPassword } = req.body;
  const Email = req.session.userEmail;

  if (Password !== ConfirmPassword) {
    return res.render("user/login/resetPassword", {
      message: "Passwords do not match",
    });
  }

  try {
    const user = await User.findOne({ Email });

    if (!user) {
      return res.render("user/login/resetPassword", {
        message: "User not found",
      });
    }

    const hashedPassword = await bcrypt.hash(Password, 10);
    user.Password = hashedPassword;
    await user.save();

    // Clear session and redirect to login
    req.session.destroy();
    return res.redirect("/login");
  } catch (error) {
    console.error("Error resetting password:", error);
    res.render("user/login/resetPassword", {
      message: "Internal server error",
    });
  }
};

//to get landing Page
const getLandPage = async (req, res) => {
  try {
    const categories = await Category.find({ isList: true });
    res.render("user/login/landPage", { categories });
  } catch (error) {
    console.log("the land Page  broke");
  }
};

//to get profile page

const getProfile = async (req, res) => {
  try {
    // // Proceed with fetching the profile using the user's ID
    const userId = req.session.userId;

    // // Fetch user details based on the ID
    const user = await User.findById(userId);

    // Render the user profile view and pass user data
    res.render("user/profile/userProfile", { user });
  } catch (error) {
    console.error("Unexpected error while fetching profile:", error);
    res.status(500).json({ message: "Server error while fetching profile." });
  }
};

// Edit profile
const editProfile = async (req, res) => {
  const { Username, Mobile } = req.body;
  try {
    await User.findByIdAndUpdate(req.session.userId, {
      Username,
      Mobile,
      UpdatedAt: new Date(),
    });
    res.redirect("/profile");
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error");
  }
};

const returnOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Find the order and update its status to 'Returned'
    const updatedOrder = await Order.findOneAndUpdate(
      { OrderId: orderId, UserId: req.session.userId },
      { Status: "Returned" },
      { new: true }
    ).populate("Products.ProductId"); // Populate the products to access their details

    if (!updatedOrder) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Order not found or already Returned.",
        });
    }

    // Retrieve the total price of the returned order
    const refundAmount = updatedOrder.TotalPrice;

    // Update the user's wallet with the refund transaction
    const wallet = await Wallet.findOneAndUpdate(
      { UserId: req.session.userId },
      {
        $inc: { Balance: refundAmount },
        $push: {
          Transactions: {
            amount: refundAmount,
            type: "credit",
            date: new Date(),
            reason: `Refund for Order #${orderId}`, // Set the reason for the transaction
          },
        },
      },
      { new: true, upsert: true }
    );

    // Restock the quantity for each product in the order
    for (const item of updatedOrder.Products) {
      const productId = item.ProductId._id;
      const quantity = item.Quantity; // Get the quantity from the order

      // Restock the product quantity in the inventory
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { Quantity: quantity } }, // Increment the product quantity
        { new: true }
      );
    }

    // Respond with the updated wallet balance
    res.json({
      success: true,
      message:
        "Order returned successfully, and funds have been credited to your wallet.",
      walletBalance: wallet.Balance,
    });
  } catch (error) {
    console.error("Error returning order:", error);
    res
      .status(500)
      .json({ success: false, message: "Error returning order", error });
  }
};

const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.body;

    // Fetch the order details to get payment info and products
    const order = await Order.findOne({
      OrderId: orderId,
      UserId: req.session.userId,
    }).populate("Products.ProductId");
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    }

    // Update the order status to 'Cancelled'
    await Order.findOneAndUpdate(
      { OrderId: orderId, UserId: req.session.userId },
      { Status: "Cancelled" },
      { new: true }
    );

    // Restock the quantity for each product in the order
    for (const item of order.Products) {
      const productId = item.ProductId._id;
      const quantity = item.Quantity; // Get the quantity from the order

      // Restock the product quantity in the inventory
      await Product.findByIdAndUpdate(
        productId,
        { $inc: { Quantity: quantity } }, // Increment the product quantity
        { new: true }
      );
    }

    // Update the user's wallet with the cancellation transaction (if applicable)
    let wallet;
    if (order.PaymentMethod !== "cashOnDelivery") {
      wallet = await Wallet.findOneAndUpdate(
        { UserId: req.session.userId },
        {
          $inc: { Balance: order.TotalPrice }, // Credit the full order amount to wallet balance
          $push: {
            Transactions: {
              amount: order.TotalPrice, // Credit amount
              type: "credit",
              date: new Date(),
              reason: `Cancelled Order #${orderId}`, // Set the reason for the transaction
            },
          },
        },
        { new: true, upsert: true }
      );

      // Notify the user about the refund
      return res.json({
        success: true,
        message:
          "Order cancelled successfully, and funds have been credited to your wallet.",
        walletBalance: wallet.Balance,
      });
    }

    // Notify the user that COD orders cannot be refunded
    return res.json({
      success: true,
      message:
        "Order cancelled successfully. Refund is not applicable for Cash on Delivery orders.",
    });
  } catch (error) {
    console.error("Error processing order cancellation:", error);
    res
      .status(500)
      .json({ success: false, message: "Error cancelling order", error });
  }
};

// Change password
const changePassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // Get the authenticated user's ID from the session
  const userId = req.session.userId;
  console.log(userId);

  try {
    // Fetch the user from the database
    const user = await User.findOne({ _id: userId });
    console.log(user.Password);
    console.log(user.Mobile);
    console.log(oldPassword);

    // Check if the user and password are defined
    if (!user || !user.Password) {
      console.log("User or user.Password not found.");
      return res.render("user/profile/userChangePass", {
        message: "User not found or password not set.",
        messageType: "danger",
      });
    }

    // Compare the provided old password with the stored hashed password
    const isMatch = await bcrypt.compare(oldPassword, user.Password);
    if (!isMatch) {
      return res.render("user/profile/userChangePass", {
        message: "Current password is incorrect",
        messageType: "danger",
      });
    }

    // Hash the new password before saving
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    user.Password = hashedNewPassword;
    await user.save();

    // Redirect back to profile on success
    res.render("user/profile/userChangePass", {
      message: "Password Changed Sucessfully",
      messageType: "success",
    });
  } catch (err) {
    console.log("Error in changePassword:", err);
    res.render("user/profile/userChangePass", {
      message: "Server error",
      messageType: "danger",
    });
  }
};

// Add or edit address
const addAddress = async (req, res) => {
  const {
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  } = req.body;
  const userId = req.session.userId; // Assuming user is authenticated and user ID is available in req.user

  const newAddress = new addressModel({
    UserId: userId,
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  });

  try {
    await newAddress.save();
    res.redirect("/profile/address"); // Redirect after adding
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).send("Error adding address");
  }
};

// Add or edit address in checkout page
const addAddressCheck = async (req, res) => {
  const {
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  } = req.body;
  const userId = req.session.userId; // Assuming user is authenticated and user ID is available in req.user

  const newAddress = new addressModel({
    UserId: userId,
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  });

  try {
    await newAddress.save();
    res.redirect("/checkout"); // Redirect after adding
  } catch (error) {
    console.error("Error adding address:", error);
    res.status(500).send("Error adding address");
  }
};

//to edit the address
const editAddress = async (req, res) => {
  const { id } = req.params;
  const {
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  } = req.body;

  try {
    await addressModel.findByIdAndUpdate(
      id,
      {
        FullName,
        MobileNo,
        FlatNo,
        Address,
        Landmark,
        Pincode,
        City,
        District,
        State,
        Country,
        AddressType,
      },
      { new: true }
    );
    res.redirect("/profile/address"); // Redirect to profile page or wherever you need
  } catch (error) {
    console.error("Error editing address:", error);
    res.status(500).send("Error editing address");
  }
};

//to edit the address in checkout page
const editAddressCheck = async (req, res) => {
  const { id } = req.params;
  const {
    FullName,
    MobileNo,
    FlatNo,
    Address,
    Landmark,
    Pincode,
    City,
    District,
    State,
    Country,
    AddressType,
  } = req.body;

  try {
    await addressModel.findByIdAndUpdate(
      id,
      {
        FullName,
        MobileNo,
        FlatNo,
        Address,
        Landmark,
        Pincode,
        City,
        District,
        State,
        Country,
        AddressType,
      },
      { new: true }
    );
    res.redirect("/checkout"); // Redirect to profile page or wherever you need
  } catch (error) {
    console.error("Error editing address:", error);
    res.status(500).send("Error editing address");
  }
};

//to delete address
const deleteAddress = async (req, res) => {
  const { id } = req.params;

  try {
    await addressModel.findByIdAndDelete(id);
    res.redirect("/profile/address"); // Redirect to profile page or wherever you need
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).send("Error deleting address");
  }
};

//to delete address
const deleteAddressCheck = async (req, res) => {
  const { id } = req.params;

  try {
    await addressModel.findByIdAndDelete(id);
    res.redirect("/checkout"); // Redirect to profile page or wherever you need
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).send("Error deleting address");
  }
};

//to get userAdresses in profile
const getUserAdresses = async (req, res) => {
  const userId = req.session.userId;
  const addresses = await addressModel.find({ UserId: userId });
  try {
    res.render("user/profile/userAddresses", { addresses });
  } catch (error) {
    console.log("get user Addresses broke");
  }
};

//to get userOrder in profile page
const getUserOrders = async (req, res) => {
  try {
    const orders = await Order.find({ UserId: req.session.userId })
      .populate("Products.ProductId")
      .sort({ createdAt: -1 });

    // Assuming you store the Razorpay key in an environment variable
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID;

    res.render("user/profile/userOrder", { orders, razorpayKeyId }); // Pass the key to the view
  } catch (error) {
    console.log("get user order broke");
  }
};

//to get user cahnge password in profile page
const getUserPass = async (req, res) => {
  try {
    res.render("user/profile/userChangePass", { message: "", messageType: "" });
  } catch (error) {
    console.log("get user change pass broke");
  }
};

//to get profile edit
const getProfileEdit = async (req, res) => {
  // // Proceed with fetching the profile using the user's ID
  const userId = req.session.userId;

  // // Fetch user details based on the ID
  const user = await User.findById(userId);
  try {
    res.render("user/profile/profileEdit", { user, message: "" });
  } catch (error) {
    console.log("the get profile is broke");
  }
};

//to get cart page
const getCart = async (req, res) => {
  const userId = req.session.userId;

  if (!userId) {
    return res.redirect("/login");
  }

  try {
    const cart = await Cart.findOne({ UserId: userId }).populate(
      "Products.ProductId"
    );

    if (!cart || !cart.Products || cart.Products.length === 0) {
      return res.render("user/cart/cartPage", {
        cart: null,
        cartTotal: 0,
        isEmpty: true,
      });
    }

    let cartTotal = 0;

    for (const product of cart.Products) {
      if (product.ProductId) {
        let discountedPrice = product.ProductId.Price;

        // Fetch active offers for the product
        const activeOffers = await Offer.find({
          isActive: true,
          startTime: { $lte: new Date() },
          endTime: { $gte: new Date() },
          $or: [
            { productIds: product.ProductId._id },
            { categoryIds: product.ProductId.CategoryId },
          ],
        });

        // Calculate the best discount
        if (activeOffers.length > 0) {
          const bestOffer = activeOffers.reduce((max, offer) => {
            const discount = discountedPrice * (offer.discountPercentage / 100);
            return Math.max(max, discount);
          }, 0);

          discountedPrice -= bestOffer;
        }

        // Calculate total price
        cartTotal += discountedPrice * (product.Quantity || 1);
        product.DiscountedPrice = discountedPrice; // Store discounted price
      }
    }

    res.render("user/cart/cartPage", {
      cart: cart,
      cartTotal: cartTotal,
      isEmpty: false,
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res
      .status(500)
      .json({
        message:
          "An error occurred while fetching your cart. Please try again later.",
      });
  }
};

//to update cart
const updateCart = async (req, res) => {
  const { productId, newQuantity } = req.body;

  try {
    const cart = await Cart.findOne({ UserId: req.session.userId });
    if (!cart) return res.status(400).json({ message: "Cart not found" });

    const product = cart.Products.find((p) => p.ProductId.equals(productId));
    if (!product) {
      return res.status(404).json({ message: "Product not found in cart" });
    }

    product.Quantity = newQuantity; // Update quantity
    await cart.save(); // Save the updated cart

    // Recalculate the total price after the update
    let cartTotal = 0;
    for (const product of cart.Products) {
      if (product.ProductId) {
        let discountedPrice = product.ProductId.Price;

        // Fetch active offers for the product
        const activeOffers = await Offer.find({
          isActive: true,
          startTime: { $lte: new Date() },
          endTime: { $gte: new Date() },
          $or: [
            { productIds: product.ProductId._id },
            { categoryIds: product.ProductId.CategoryId },
          ],
        });

        // Calculate the best discount
        if (activeOffers.length > 0) {
          const bestOffer = activeOffers.reduce((max, offer) => {
            const discount = discountedPrice * (offer.discountPercentage / 100);
            return Math.max(max, discount);
          }, 0);

          discountedPrice -= bestOffer;
        }

        cartTotal += discountedPrice * (product.Quantity || 1);
      }
    }

    res.json({ message: "Cart updated successfully", cartTotal });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//to remove from cart
const removeCart = async (req, res) => {
  const { productId } = req.body;

  try {
    const cart = await Cart.findOne({ UserId: req.session.userId });
    if (!cart) return res.status(400).json({ message: "Cart not found" });

    // Filter out the product to remove
    cart.Products = cart.Products.filter((p) => !p.ProductId.equals(productId));

    await cart.save();
    res.json({ message: "Product removed successfully" });
  } catch (error) {
    console.error("Error removing product from cart:", error);
    res.status(500).json({ message: "Server error" });
  }
};

//to add product to cart
const addCart = async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.session.userId; // Assuming you're using session for user identification

  try {
    // Fetch product details including the price
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Check if a cart already exists for the user
    let cart = await Cart.findOne({ UserId: userId });
    if (!cart) {
      // Create a new cart if none exists
      cart = new Cart({ UserId: userId, Products: [] });
    }

    // Check if the product is already in the cart
    const existingProduct = cart.Products.find((p) =>
      p.ProductId.equals(product._id)
    );
    if (existingProduct) {
      // Update the quantity if it already exists
      existingProduct.Quantity += quantity || 1;
    } else {
      // Add the new product to the cart
      cart.Products.push({
        ProductId: product._id,
        Price: product.Price, // Make sure to add the Price here
        Quantity: 1,
      });
    }

    // Save the cart
    await cart.save();
    res.status(200).json("Product added to cart");
  } catch (error) {
    console.error("Error adding product to cart:", error);
    res.status(500).send("Internal server error");
  }
};

const getCheckout = async (req, res) => {
  try {
    // Fetch active coupons and offers
    const coupons = await Coupon.find({
      isActive: true,
      expiryDate: { $gte: new Date() },
    });
    const offers = await Offer.find({
      isActive: true,
      endTime: { $gte: new Date() },
    });

    const userId = req.session.userId; // Assuming user is authenticated
    const addresses = await addressModel.find({ UserId: userId }); // Fetch user's addresses
    const cart = await Cart.findOne({ UserId: userId }).populate(
      "Products.ProductId"
    );
    const user = await User.findOne({ _id: userId });
    const wallet = await Wallet.findOne({ UserId: userId }); // Fetch the user's wallet

    // Check if cart exists
    if (!cart || !cart.Products || !cart.Products.length) {
      return res.status(400).render("user/cart/getCheckout", {
        addresses,
        coupons,
        offers,
        cart: null, // Send a null cart to the template
        cartTotal: 0,
        user,
        walletBalance: wallet ? wallet.Balance : 0, // Send wallet balance
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
      });
    }

    let discountedPrice = 0; // Initialize discounted price

    // Get selected quantities from the request body
    const selectedQuantities = req.body; // This will be populated from the POST request

    // Calculate total price based on selected quantities and offers
    cart.Products.forEach((product) => {
      const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
      let productPrice = product.Price;

      // Check if there's an active offer for the product
      const offer = offers.find(
        (o) => o.productIds && o.productIds.includes(product.ProductId._id)
      );
      let currentDiscountedPrice = productPrice; // Initialize current discountedPrice with the original price

      if (offer) {
        currentDiscountedPrice -=
          currentDiscountedPrice * (offer.discountPercentage / 100); // Apply discount
      }

      // Store the discounted price along with the original price
      product.DiscountedPrice = currentDiscountedPrice;

      discountedPrice += currentDiscountedPrice * quantity; // Update cart total with discounted price
    });

    // Render the checkout page with all necessary data
    res.render("user/cart/getCheckout", {
      addresses,
      coupons,
      offers,
      cart,
      cartTotal: discountedPrice, // Update cart total with discounted price
      user,
      walletBalance: wallet ? wallet.Balance : 0, // Send wallet balance
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

const postCheckout = async (req, res) => {
  const selectedQuantities = req.body; // Get selected quantities from request body
  const userId = req.session.userId; // Assuming user is authenticated
  const cart = await Cart.findOne({ UserId: userId }).populate(
    "Products.ProductId"
  );
  let discountedPrice = 0; // Initialize discounted price

  // Fetch active offers
  const offers = await Offer.find({
    isActive: true,
    endTime: { $gte: new Date() },
  });

  // Calculate total price using selected quantities and active offers
  if (!cart || !cart.Products || !cart.Products.length) {
    return res.status(400).json({ message: "No items in the cart." });
  }

  cart.Products.forEach((product) => {
    const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
    let productPrice = product.Price;

    // Check if there's an active offer for the product
    const offer = offers.find(
      (o) => o.productIds && o.productIds.includes(product.ProductId._id)
    );
    if (offer) {
      productPrice -= productPrice * (offer.discountPercentage / 100); // Apply discount
    }

    discountedPrice += productPrice * quantity; // Update cart total with discounted price
  });

  // Validate discounted price against total price
  const totalPrice = parseFloat(req.body.TotalPrice); // Get the total price from the request
  if (totalPrice < discountedPrice) {
    return res
      .status(400)
      .json({
        message: "Total Price cannot be less than the Discounted Price.",
      });
  }

  // Render the checkout page with cart and total
  res.render("checkout", {
    cart,
    cartTotal: discountedPrice,
    selectedQuantities,
  });
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;

    console.log("Applying coupon:", couponCode, "with cart total:", cartTotal);

    const coupon = await Coupon.findOne({
      couponCode,
      isActive: true,
      expiryDate: { $gte: new Date() },
    });

    if (coupon) {
      if (cartTotal < coupon.minPurchase) {
        return res.json({
          valid: false,
          message: `Minimum purchase amount of $${coupon.minPurchase} required to apply this coupon.`,
        });
      }

      res.json({
        valid: true,
        discount: coupon.discountPercentage,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscountAmount,
        message: "Coupon applied successfully!",
      });
    } else {
      res.json({
        valid: false,
        message: "Invalid or expired coupon code.",
      });
    }
  } catch (error) {
    console.error("Error applying coupon:", error);
    res.status(500).json({
      valid: false,
      message: "An error occurred while applying the coupon.",
    });
  }
};

const deleteCartItem = async (req, res) => {
  try {
    const userId = req.session.userId; // Assuming user authentication is handled
    const productId = req.params.productId; // Get product ID from URL parameters

    // Assuming you have a Cart model to update
    await Cart.findOneAndUpdate(
      { UserId: userId },
      { $pull: { Products: { ProductId: productId } } } // Adjust according to your cart structure
    );

    res.status(204).send(); // No content to send back
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting cart item", error });
  }
};

//to get success page
const getSuccess = async (req, res) => {
  try {
    const orderId = req.query.orderId; // Get the order ID from query parameters
    res.render("user/cart/successPage", { orderId }); // Render the success page and pass the order ID
  } catch (error) {
    console.log("the get success page  is broke");
  }
};

//to load shop page
// Function to load the shop page
const getShop = async (req, res) => {
  try {
    // Fetch all products with their categories
    const products = await Product.find({}).populate("CategoryId");

    // Fetch applicable offers for these products
    const applicableOffers = await getApplicableOffersForProducts(products);

    // Attach applicable offers and calculate discounted prices
    const productsWithOffers = products.map((product) => {
      const productOffers = applicableOffers.filter(
        (offer) =>
          offer.productIds.includes(product._id) ||
          offer.categoryIds.includes(product.CategoryId)
      );

      let discountedPrice = product.Price; // Default to the original price

      // If there are applicable offers, calculate the discounted price
      if (productOffers.length > 0) {
        const activeOffer = productOffers.find(
          (offer) =>
            offer.isActive &&
            new Date() >= offer.startTime &&
            new Date() <= offer.endTime
        );
        if (activeOffer) {
          discountedPrice =
            product.Price -
            product.Price * (activeOffer.discountPercentage / 100);
        }
      }

      return {
        ...product.toObject(),
        applicableOffers: productOffers,
        discountedPrice,
      };
    });

    // Pass productsWithOffers to the view
    res.render("user/shop/shop", {
      products: productsWithOffers,
      userId: req.session.userId || null,
    });
  } catch (error) {
    console.error("Error loading shop:", error);
    res.status(500).send("Server Error");
  }
};

// Function to get applicable offers for each product
const getApplicableOffersForProducts = async (products) => {
  try {
    const productIds = products.map((product) => product._id);

    // Fetch applicable offers for these products
    const applicableOffers = await Offer.find({
      $or: [
        { productIds: { $in: productIds } },
        { categoryIds: { $in: products.map((product) => product.CategoryId) } },
      ],
      isActive: true,
    });

    return applicableOffers;
  } catch (error) {
    console.error("Error fetching applicable offers:", error);
    return []; // Return an empty array on error
  }
};

const loadShopItems = async (req, res) => {
  const { categoryId, priceOrder, arrivalOrder, nameOrder, searchTerm } =
    req.query;

  // Initialize query to filter products
  let query = {
    $or: [{ Is_list: true }, { isList: true }],
  };

  // Filter by category, ensuring categoryId is valid
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    query.CategoryId = new mongoose.Types.ObjectId(categoryId);
  }

  // Search by product name if provided
  if (searchTerm) {
    query.Name = { $regex: searchTerm, $options: "i" }; // Case-insensitive search
  }

  try {
    // Fetch products based on query
    let products = await Product.find(query).populate("CategoryId");

    // Fetch applicable offers
    const offers = await Offer.find({
      $or: [
        {
          applicableTo: "product",
          productIds: { $in: products.map((product) => product._id) },
        },
        {
          applicableTo: "category",
          categoryIds: { $in: products.map((product) => product.CategoryId) },
        },
      ],
    });

    // Map offers to products
    products = products.map((product) => {
      // Find offers applicable to the product
      const applicableOffers = offers.filter(
        (offer) =>
          (offer.applicableTo === "product" &&
            offer.productIds.includes(product._id)) ||
          (offer.applicableTo === "category" &&
            offer.categoryIds.includes(product.CategoryId))
      );

      // Return product with applicable offers
      return { ...product._doc, applicableOffers }; // Merge the product with its applicable offers
    });

    // Sort products
    if (priceOrder === "lowToHigh") {
      products.sort((a, b) => a.Price - b.Price);
    } else if (priceOrder === "highToLow") {
      products.sort((a, b) => b.Price - a.Price);
    }

    // Sort by new arrivals based on createdAt timestamp
    if (arrivalOrder === "newest") {
      products.sort((a, b) => b.createdAt - a.createdAt);
    }

    // Sort products by name
    if (nameOrder === "aToZ") {
      products.sort((a, b) => a.Name.localeCompare(b.Name));
    } else if (nameOrder === "zToA") {
      products.sort((a, b) => b.Name.localeCompare(a.Name));
    }

    // Return sorted products as JSON
    res.json(products);
  } catch (error) {
    console.error("Error loading shop items:", error);
    res.status(500).send("Server Error");
  }
};

const shopCategoryItems = async (req, res) => {
  try {
    // Fetch all categories that are marked as available for listing
    const categories = await Category.find({ isList: true });
    res.json(categories); // Send categories as a JSON response
  } catch (error) {
    console.error("Error loading categories:", error);
    res.status(500).send("Server Error"); // Handle errors gracefully
  }
};

const loadWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(400).send("User is not logged in");
    }

    // Find the user's wishlist
    const wishlist = await Wishlist.findOne({ UserId: userId }).populate(
      "products"
    );

    // Define isEmpty based on whether the wishlist exists and has products
    const isEmpty =
      !wishlist || !wishlist.products || wishlist.products.length === 0;

    // Render the wishlist page and pass the products and isEmpty flag
    res.render("user/cart/wishlistPage", {
      products: wishlist ? wishlist.products : [],
      isEmpty,
    });
  } catch (error) {
    console.log("Error loading wishlist:", error);
    res.status(500).send("Server error");
  }
};

const addProductToWishlist = async (req, res) => {
  const userId = req.session.userId; // Accessing the userId from session

  if (!userId) {
    return res.status(400).send("User is not logged in");
  }

  try {
    // Add product to wishlist logic
    const { ProductId } = req.body; // Make sure the request body contains ProductId
    const wishlist = await Wishlist.findOneAndUpdate(
      { UserId: userId },
      { $addToSet: { products: ProductId } }, // Use the correct field name 'products'
      { upsert: true, new: true }
    ).populate("products"); // Optional: Populate the products to return full product details

    res.status(200).json({ message: "Product added to wishlist", wishlist });
  } catch (error) {
    console.error("Error adding product to wishlist:", error);
    res.status(500).json({ message: "Error adding product to wishlist" });
  }
};

const removeProductFromWishlist = async (req, res) => {
  try {
    const { productId } = req.body; // Ensure you're accessing productId correctly
    const userId = req.session.userId;

    if (!userId) {
      return res.status(400).json({ message: "User is not logged in" });
    }

    const wishlist = await Wishlist.findOne({ UserId: userId });

    if (!wishlist) {
      return res.status(404).json({ message: "Wishlist not found" });
    }

    // Check if productId is valid
    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    // Remove product from wishlist
    wishlist.products = wishlist.products.filter(
      (p) => p.toString() !== productId
    );

    await wishlist.save();
    res.status(200).json({ message: "Product removed from wishlist" });
  } catch (err) {
    console.error("Error removing product from wishlist:", err);
    res.status(500).json({ error: "Server error" });
  }
};

const getWishlist = async (req, res) => {
  try {
    const userId = req.session.userId;

    const wishlist = await Wishlist.findOne({ userId }).populate("products");

    if (!wishlist || wishlist.products.length === 0) {
      return res.status(404).json({ message: "No products in wishlist" });
    }

    res.status(200).json(wishlist.products);
  } catch (err) {
    console.error("Error fetching wishlist:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// Initialize Razorpay instance with your key ID and secret
// Initialize Razorpay instance with your key ID and secret
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Replace with your Razorpay key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Replace with your Razorpay key secret
});

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, orderId } = req.body; // 'orderId' will be used if retrying payment
    const options = {
      amount: amount, // Amount in paise (e.g., Rs. 500 = 50000 paise)
      currency: "INR",
      receipt: `receipt_order_${Date.now()}`, // New receipt each time
    };

    // Create order on Razorpay
    const order = await razorpayInstance.orders.create(options);
    console.log("order razorpay", order);
    if (!order)
      return res.status(500).json({ message: "Failed to create order" });

    // Update the order in the database if it's a retry
    if (orderId) {
      await Order.findByIdAndUpdate(orderId, {
        "PaymentDetails.0.RazorpayOrderId": order.id, // Update the orderId field in the PaymentDetails array
        Status: "Pending", // Reset order status to pending for retry
      });
    }

    // Send back the order details
    res.status(200).json({
      id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("Error creating Razorpay order:", error);
    res.status(500).json({ message: "Error creating Razorpay order" });
  }
};

const postOrder = async (req, res) => {
  try {
    console.log("Received order data:", req.body); // Log the incoming order data

    const {
      Products,
      TotalPrice,
      ShippingAddress,
      PaymentMethod,
      DiscountedPrice,
      PaymentDetails,
      Status,
      appliedCode,
    } = req.body;
    console.log("Received appliedCode:", appliedCode); // Log received applied code

    // Coupon validation
    if (appliedCode) {
      const coupon = await Coupon.findOne({
        couponCode: appliedCode,
        isActive: true,
      });
      if (!coupon) {
        return res.status(400).json({ message: "The coupon is not valid" });
      }
    }

    // Validate TotalPrice against DiscountedPrice
    if (TotalPrice < DiscountedPrice) {
      return res
        .status(400)
        .json({
          message: "Total Price cannot be less than the Discounted Price.",
        });
    }

    // Create a new order object using your schema
    const newOrder = new Order({
      Products,
      TotalPrice,
      DiscountedPrice, // Save discounted price to the order
      ShippingAddress,
      PaymentMethod,
      UserId: req.session.userId, // Assuming user authentication is handled
      PaymentDetails, // Add PaymentDetails to the order
      Status, // Add Status to the order
    });

    // Save the order to the database
    await newOrder.save();
    console.log("Order saved successfully:", newOrder); // Log the saved order

    // Decrement product quantities in the database
    for (const product of Products) {
      const updatedProduct = await Product.findOneAndUpdate(
        { _id: product.ProductId },
        { $inc: { Quantity: -product.Quantity } },
        { new: true } // Return the updated document
      );

      // Check if the quantity became negative (in case of overselling)
      if (updatedProduct.Quantity < 0) {
        return res
          .status(400)
          .json({
            message: `Not enough stock for product ${updatedProduct.Name}`,
          });
      }
    }

    // Clear the user's cart
    await Cart.deleteMany({ UserId: req.session.userId });

    // Respond with a success message and order ID
    res.json({ orderId: newOrder.OrderId });
  } catch (error) {
    console.error("Error creating order:", error); // Log any errors
    res.status(500).json({ message: "Error creating order", error });
  }
};

const verifyPaymentAndSaveOrder = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    // Log received payment data for debugging
    console.log("Payment verification data:", req.body);

    // Verify the payment signature
    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const generatedSignature = shasum.digest("hex");
    console.log("Generated Signature:", generatedSignature);
    console.log("Expected Signature:", razorpay_signature); // Log expected signature

    // If payment is successful, update or create the order
    let newOrder;
    if (orderId) {
      newOrder = await Order.findOneAndUpdate(
        { OrderId: orderId },
        {
          Status: "Pending", // Update status after payment
          $set: {
            "PaymentDetails.0": {
              razorpay_payment_id,
              razorpay_order_id,
              razorpay_signature,
            },
          }, // Add PaymentDetails
        },
        { new: true }
      );
    } else {
      // Create a new order if it's the first payment attempt
      newOrder = new Order({
        Products: req.body.Products,
        TotalPrice: req.body.TotalPrice,
        ShippingAddress: req.body.ShippingAddress,
        PaymentMethod: "razorpay",
        Status: "Pending", // Mark as paid
        PaymentDetails: [
          { razorpay_payment_id, razorpay_order_id, razorpay_signature },
        ], // Initialize PaymentDetails array
      });
      await newOrder.save();
    }

    console.log("Order processed successfully:", newOrder);
    res
      .status(200)
      .json({
        success: true,
        orderId: newOrder.OrderId,
        message: "Order placed successfully",
      });
  } catch (error) {
    console.error("Error verifying payment and saving order:", error);
    res
      .status(500)
      .json({ success: false, message: "Error processing payment" });
  }
};

// Function to render the wallet page
const getWallet = async (req, res) => {
  try {
    const userId = req.session.userId;
    const wallet = await Wallet.findOne({ UserId: userId });

    if (!wallet) {
      return res.render("wallet", {
        balance: 0,
        transactions: [], // Pass an empty array if no wallet is found
      });
    }

    // Render the wallet page with balance and transaction history
    res.render("user/profile/userWallet", {
      balance: wallet.Balance,
      transactions: wallet.Transactions || [], // Pass transactions
    });
  } catch (error) {
    console.error("Error fetching wallet data:", error);
    res.status(500).render("error", { message: "Error fetching wallet data" });
  }
};

// New endpoint to fetch wallet history
const getWalletHistory = async (req, res) => {
  try {
    const userId = req.session.userId;
    const wallet = await Wallet.findOne({ UserId: userId });

    if (!wallet || !wallet.Transactions || wallet.Transactions.length === 0) {
      return res.json([]); // Return an empty array if no transactions found
    }

    res.json(wallet.Transactions); // Send transactions back to the client
  } catch (error) {
    console.error("Error fetching wallet history:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching wallet history." });
  }
};

// Function to get wallet balance
const walletBalance = async (req, res) => {
  try {
    const userId = req.session.userId; // Assuming your authentication middleware sets req.user
    const wallet = await Wallet.findOne({ UserId: userId });

    if (!wallet) {
      return res.status(404).json({ balance: 0 }); // Return 0 if no wallet found
    }

    res.json({ balance: wallet.Balance });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({ message: "Error fetching wallet balance" });
  }
};

const deductFromWallet = async (req, res) => {
  const { amount } = req.body; // Get the amount to deduct from the request body
  const userId = req.session.userId; // Assuming user ID is stored in session

  try {
    // Find the user's wallet
    const wallet = await Wallet.findOne({ UserId: userId });

    // Check if wallet exists and has sufficient balance
    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    if (wallet.Balance < amount) {
      return res.status(400).json({ message: "Insufficient wallet balance" });
    }

    // Deduct the amount from the wallet
    wallet.Balance -= amount;

    // Add a transaction record
    wallet.Transactions.push({
      type: "debit", // Set the type to 'debit'
      amount: amount, // Amount deducted
      reason: "Order Payment", // Reason for the transaction
    });

    await wallet.save(); // Save the updated wallet

    res.status(200).json({ message: "Amount deducted successfully" });
  } catch (error) {
    console.error("Error deducting from wallet:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const invoice = async (req, res) => {
  try {
    const orderId = req.params.orderId;

    // Find the order and populate product details
    const order = await Order.findOne({ OrderId: orderId }).populate(
      "Products.ProductId"
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    // Fetch the user's address using the UserId from the order
    const address = await addressModel.findOne({ UserId: order.UserId }).exec();

    const doc = new PDFDocument({ margin: 50 });
    const invoicePath = path.join(
      __dirname,
      `../invoices/invoice-${orderId}.pdf`
    );
    const stream = fs.createWriteStream(invoicePath);
    doc.pipe(stream);

    // Set the font that supports the rupee symbol
    doc.font("Helvetica"); // Default font that supports the rupee symbol

    // Header Section
    doc.fontSize(20).text("DQ Mall", { align: "center" });
    doc
      .fontSize(12)
      .text("123 Shopping St, City, State, ZIP", { align: "center" });
    doc.text("Phone: (123) 456-7890", { align: "center" });
    doc.moveDown(0.5);
    doc.fontSize(16).text("INVOICE", { align: "center", underline: true });
    doc.moveDown(1);

    // Order Details
    doc.fontSize(12).text(`Order ID: ${order.OrderId}`, { align: "right" });
    doc.text(`Ordered on: ${new Date(order.createdAt).toLocaleDateString()}`, {
      align: "right",
    });
    doc.text(`Order Status: ${order.Status}`, { align: "right" });
    doc.moveDown(1); // Add spacing

    // Customer Details
    const customerName = address ? address.FullName : "N/A";
    const shippingAddress = address
      ? `${address.FlatNo ? address.FlatNo + ", " : ""}${address.Address},` +
        "\n" +
        `${address.Landmark ? address.Landmark + ", " : ""}${address.City},` +
        "\n" +
        `${address.District}, ${address.State},` +
        "\n" +
        `${address.Country}, ${address.Pincode}`
      : "N/A";

    doc.text(`Customer Name: ${customerName}`, { align: "left" });
    doc.moveDown(0.25); // Add spacing between customer name and address
    doc.text(`Shipping Address:`, { align: "left", continued: true });
    doc.moveDown(0.25); // Add spacing
    doc.text(shippingAddress, { align: "left" });
    doc.moveDown(1); // Add spacing

    // Products Table Header
    const tableTop = doc.y;
    doc.fontSize(12).text("Products:", { underline: true });
    doc.moveDown(0.5);

    // Draw table header with background color
    const headerHeight = 20;
    const rowHeight = 18;
    const tableStartY = doc.y;

    doc.rect(50, tableStartY, 500, headerHeight).fill("#e0e0e0"); // Light gray background for header
    doc
      .fontSize(10)
      .fillColor("black")
      .text("Product Name", 50, tableStartY + 3);
    doc.text("Quantity", 250, tableStartY + 3);
    doc.text("Unit Price", 350, tableStartY + 3);
    doc.text("Total", 450, tableStartY + 3);
    doc.fillColor("black");

    // Draw the table rows
    let subtotal = 0;
    let currentY = tableStartY + headerHeight;

    order.Products.forEach((product, index) => {
      const productName = product.ProductId?.Name || "Product Not Found";
      const quantity = product.Quantity;
      const unitPrice = product.ProductId?.Price || 0;
      const totalPrice = quantity * unitPrice;

      // Alternating row colors
      const rowColor = index % 2 === 0 ? "#f9f9f9" : "#ffffff"; // Light alternating row colors
      doc.rect(50, currentY, 500, rowHeight).fill(rowColor);
      doc.fillColor("black").text(productName, 50, currentY + 3);
      doc.text(quantity.toString(), 250, currentY + 3);
      doc.text(`${unitPrice.toFixed(2)}`, 350, currentY + 3); // Correct rupee symbol
      doc.text(`${totalPrice.toFixed(2)}`, 450, currentY + 3); // Correct rupee symbol

      subtotal += totalPrice;
      currentY += rowHeight;
    });

    doc.moveDown(1);

    // Footer Section (Summary)
    const discount = order.DiscountedPrice || 0; // Assuming you have discount in the order
    const finalPrice = subtotal - discount;

    // Draw footer with summary
    doc.moveTo(50, currentY);
    doc.lineTo(550, currentY).stroke();
    doc.moveDown(0.5);

    // Enhanced Summary Layout
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown(0.5);

    // Add spacing for better appearance
    doc.text(`Subtotal:`, { align: "right" });
    doc
      .text(`${subtotal.toFixed(2)}`, { align: "right", continued: true })
      .font("Helvetica-Bold")
      .text(`\n`); // Correct rupee symbol

    doc.text(`Discount:`, { align: "right" });
    doc
      .text(`${discount.toFixed(2)}`, { align: "right", continued: true })
      .font("Helvetica-Bold")
      .text(`\n`); // Correct rupee symbol

    doc.text(`Final Price:`, { align: "right" });
    doc
      .text(`${finalPrice.toFixed(2)}`, { align: "right", continued: true })
      .font("Helvetica-Bold")
      .text(`\n`); // Correct rupee symbol

    // Finalize PDF file
    doc.end();

    // Wait for the PDF to finish writing
    stream.on("finish", () => {
      res.download(invoicePath, (err) => {
        if (err) {
          console.error("Error downloading the invoice:", err);
        }
        // Optionally delete the invoice file after download
        fs.unlinkSync(invoicePath);
      });
    });
  } catch (error) {
    console.error("Error generating invoice:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const getOrderDetails = async (req, res) => {
  const { orderId } = req.params;

  try {
    // Fetch the order by ID
    const order = await Order.findOne({ OrderId: orderId }).populate(
      "Products.ProductId"
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error fetching order details" });
  }
};

const paymentFailed = async (req, res) => {
  try {
    const {
      Products,
      TotalPrice,
      DiscountedPrice,
      ShippingAddress,
      PaymentMethod,
    } = req.body;
    // Create a new order object with status "Payment Failed"
    const failedOrder = new Order({
      Products,
      TotalPrice,
      DiscountedPrice,
      ShippingAddress,
      PaymentMethod,
      UserId: req.session.userId, // Assuming user authentication is handled
      Status: "Payment Failed", // Set the status to Payment Failed
    });
    // Save the order to the database
    await failedOrder.save();

    // Reduce the quantity of products in the database
    for (const product of Products) {
      await Product.updateOne(
        { _id: product.ProductId },
        { $inc: { Quantity: -product.Quantity } } // Decrement the quantity
      );
    }

    // Optionally, clear the cart (if you store it in the database or session)
    // Assuming you have a Cart model and a way to identify the user's cart
    await Cart.deleteMany({ UserId: req.session.userId });

    // Respond with the order ID
    res.json({ orderId: failedOrder.OrderId });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ message: "Error creating failed payment order", error });
  }
};

const updateStatus = async (req, res) => {
  const { orderId, status } = req.body;
  try {
    const order = await Order.findOneAndUpdate(
      { OrderId: orderId },
      {
        Status: status,
        $set: {
          "PaymentDetails.0": {
            razorpay_order_id: "",
            razorpay_payment_id: "",
          },
        }, // Update PaymentDetails array
      },
      { new: true }
    );
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }
    res.json({ success: true, message: "Order status updated successfully" });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ success: false, message: "Error updating order status", error });
  }
};

const validateCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;
    const coupon = await Coupon.findOne({ couponCode });

    if (!coupon || !coupon.isActive) {
      return res.json({ isActive: false });
    }

    return res.json({ isActive: true });
  } catch (error) {
    return res.status(500).json({ error: "Server error occurred" });
  }
};

module.exports = {
  loadHome,
  loadCategoryProducts,
  loadProductDetails,
  getLogin,
  getSigup,
  postSignup,
  verifyOtp,
  postLogin,
  getVerifyOtp,
  logout,
  getProfile,
  editProfile,
  getUserOrders,
  cancelOrder,
  changePassword,
  addAddress,
  editAddress,
  deleteAddress,
  getUserAdresses,
  getUserPass,
  getProfileEdit,
  getLandPage,
  getCart,
  updateCart,
  removeCart,
  addCart,
  getCheckout,
  postCheckout,
  addAddressCheck,
  editAddressCheck,
  deleteAddressCheck,
  postOrder,
  deleteCartItem,
  getSuccess,
  getShop,
  loadShopItems,
  shopCategoryItems,
  getWishlist,
  addProductToWishlist,
  removeProductFromWishlist,
  loadWishlist,
  createRazorpayOrder,
  verifyPaymentAndSaveOrder,
  returnOrder,
  applyCoupon,
  getWallet,
  walletBalance,
  getWalletHistory,
  deductFromWallet,
  invoice,
  getOrderDetails,
  paymentFailed,
  updateStatus,
  forgotPassword,
  verifyResetOtp,
  resetPassword,
  getForgotPassword,
  getVerifyResetOtp,
  getResetPassword,
  validateCoupon,
};
