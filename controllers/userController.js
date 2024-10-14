const User = require("../models/userModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Cart = require('../models/cartModel');
const Order = require("../models/orderModel");
const Wishlist = require("../models/wishlistModel");
const Wallet = require('../models/walletModel')
const Coupon = require('../models/couponModel')
const Offer = require("../models/offerModel")
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const addressModel = require("../models/addressModel");
const Razorpay = require('razorpay');
const crypto = require('crypto');
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
        { productIds: { $in: products.map(product => product._id) } },
        { categoryIds: categoryId }
      ],
      isActive: true
    });

    // Logging to check the applicableOffers data
    console.log('Applicable Offers:', applicableOffers);
    console.log('Type of applicableOffers:', Array.isArray(applicableOffers)); // Check if it's an array

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
    const product = await Product.findById(req.params.id).populate("CategoryId");

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Fetch product-specific offers
    const productOffers = await Offer.find({
      applicableTo: 'product',
      productIds: product._id,
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() }
    });

    // Fetch category-specific offers
    const categoryOffers = await Offer.find({
      applicableTo: 'category',
      categoryIds: product.CategoryId._id, // Ensure this refers to the correct field
      isActive: true,
      startTime: { $lte: new Date() },
      endTime: { $gte: new Date() }
    });

    // Prepare the applicable offers structure for the view
    const applicableOffers = {
      productOffers,
      categoryOffers
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
      return res.render("user/login/signup", { message: "Email already registered" });
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
      Password,
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
        return res.render("user/login/signup", { message: "Failed to send OTP" });
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

// Cancel order
const cancelOrder = async (req, res) => {
  try {
      const { orderId } = req.body;

      // Fetch the order details to get payment info
      const order = await Order.findOne({ OrderId: orderId, UserId: req.session.userId });
      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      // Update the order status to 'Cancelled'
      const updatedOrder = await Order.findOneAndUpdate(
          { OrderId: orderId, UserId: req.session.userId },
          { Status: 'Cancelled' },
          { new: true } // Return the updated document
      );

      if (!updatedOrder) {
          return res.status(404).json({ success: false, message: 'Order not found or already cancelled.' });
      }

      // Check if the payment method is Razorpay
      if (order.PaymentMethod === 'razorpay') {
          // Retrieve the total price of the cancelled order
          const refundAmount = updatedOrder.TotalPrice;

          // Find or create the user's wallet entry
          const wallet = await Wallet.findOneAndUpdate(
              { UserId: req.session.userId },
              { $inc: { Balance: refundAmount } }, // Increment the balance by the refund amount
              { new: true, upsert: true } // Create a new wallet if it doesn't exist
          );

          // Notify the user about the refund
          return res.json({ 
              success: true, 
              message: 'Order cancelled successfully, and funds have been credited to your wallet.', 
              walletBalance: wallet.Balance 
          });
      } else {
          // Simply return a success message without refund
          return res.json({ 
              success: true, 
              message: 'Order cancelled successfully.' 
          });
      } 
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error cancelling order', error });
  }
};





const returnOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Update the order status to 'Returned'
        const updatedOrder = await Order.findOneAndUpdate(
            { OrderId: orderId, UserId: req.session.userId },
            { Status: 'Returned' },
            { new: true } // Return the updated document
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found or already Returned.' });
        }

        // Retrieve the total price of the returned order
        const refundAmount = updatedOrder.TotalPrice;

        // Find or create the user's wallet entry
        const wallet = await Wallet.findOneAndUpdate(
            { UserId: req.session.userId },
            { $inc: { Balance: refundAmount } }, // Increment the balance by the refund amount
            { new: true, upsert: true } // Create a new wallet if it doesn't exist
        );

        // Optionally, you can log this transaction or notify the user

        res.json({ success: true, message: 'Order Returned successfully, and funds have been credited to your wallet.', walletBalance: wallet.Balance });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error returning order', error });
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
        messageType: "danger"
      });
    }

    // Compare the provided old password with the stored hashed password
    const isMatch = await bcrypt.compare(oldPassword, user.Password);
    if (!isMatch) {
      return res.render("user/profile/userChangePass", {
        message: "Current password is incorrect",
        messageType: "danger"
      });
    }

    // Hash the new password before saving
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password in the database
    user.Password = hashedNewPassword;
    await user.save();

    // Redirect back to profile on success
    res.render("user/profile/userChangePass", { message: "Password Changed Sucessfully", messageType: "success" });
  } catch (err) {
    console.log("Error in changePassword:", err);
    res.render("user/profile/userChangePass", { message: "Server error", messageType: "danger" });
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
    const orders = await Order.find({ UserId: req.session.userId }).populate('Products.ProductId').sort({ createdAt: -1 });
    res.render("user/profile/userOrder",{ orders });
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
      return res.redirect('/login');
  }

  try {
      const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');

      if (!cart || !cart.Products || cart.Products.length === 0) {
          return res.render('user/cart/cartPage', {
              cart: null,
              cartTotal: 0,
              isEmpty: true
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
                      { categoryIds: product.ProductId.CategoryId }
                  ]
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

      res.render('user/cart/cartPage', {
          cart: cart,
          cartTotal: cartTotal,
          isEmpty: false
      });
  } catch (error) {
      console.error("Error fetching cart:", error);
      res.status(500).json({ message: "An error occurred while fetching your cart. Please try again later." });
  }
};




//to update cart
const updateCart = async (req, res) => {
  const { productId, newQuantity } = req.body;

  try {
    const cart = await Cart.findOne({ UserId: req.session.userId });
    if (!cart) return res.status(400).json({ message: "Cart not found" });

    const product = cart.Products.find(p => p.ProductId.equals(productId));
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
                  { categoryIds: product.ProductId.CategoryId }
              ]
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
    cart.Products = cart.Products.filter(p => !p.ProductId.equals(productId));

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
          return res.status(404).send('Product not found');
      }

      // Check if a cart already exists for the user
      let cart = await Cart.findOne({ UserId: userId });
      if (!cart) {
          // Create a new cart if none exists
          cart = new Cart({ UserId: userId, Products: [] });
      }

      // Check if the product is already in the cart
      const existingProduct = cart.Products.find(p => p.ProductId.equals(product._id));
      if (existingProduct) {
          // Update the quantity if it already exists
          existingProduct.Quantity += quantity || 1;
      } else {
          // Add the new product to the cart
          cart.Products.push({
              ProductId: product._id,
              Price: product.Price, // Make sure to add the Price here
              Quantity: 1
          });
      }

      // Save the cart
      await cart.save();
      res.status(200).json('Product added to cart');
  } catch (error) {
      console.error('Error adding product to cart:', error);
      res.status(500).send('Internal server error');
  }
};

const getCheckout = async (req, res) => {
  try {
    // Fetch active coupons and offers
    const coupons = await Coupon.find({ isActive: true, expiryDate: { $gte: new Date() } });
    const offers = await Offer.find({ isActive: true, endTime: { $gte: new Date() } });

    const userId = req.session.userId; // Assuming user is authenticated
    const addresses = await addressModel.find({ UserId: userId }); // Fetch user's addresses
    const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');
    const user = await User.findOne({ _id: userId });

    // Check if cart exists
    if (!cart || !cart.Products || !cart.Products.length) {
      return res.status(400).render('user/cart/getCheckout', { 
        addresses, 
        coupons, 
        offers, 
        cart: null, // Send a null cart to the template
        cartTotal: 0, 
        user, 
        RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID 
      });
    }

    let discountedPrice = 0; // Initialize discounted price

    // Get selected quantities from the request body
    const selectedQuantities = req.body; // This will be populated from the POST request

    // Calculate total price based on selected quantities and offers
    cart.Products.forEach(product => {
      const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
      let productPrice = product.Price; 

      // Check if there's an active offer for the product
      const offer = offers.find(o => o.productIds && o.productIds.includes(product.ProductId._id)); 
      let currentDiscountedPrice = productPrice; // Initialize current discountedPrice with the original price

      if (offer) {
        currentDiscountedPrice -= (currentDiscountedPrice * (offer.discountPercentage / 100)); // Apply discount
      }

      // Store the discounted price along with the original price
      product.DiscountedPrice = currentDiscountedPrice; 

      discountedPrice += currentDiscountedPrice * quantity; // Update cart total with discounted price
    });

    // Render the checkout page with all necessary data
    res.render('user/cart/getCheckout', { 
      addresses, 
      coupons, 
      offers, 
      cart, 
      cartTotal: discountedPrice, // Update cart total with discounted price
      user, 
      RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID 
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

const postCheckout = async (req, res) => {
  const selectedQuantities = req.body; // Get selected quantities from request body
  const userId = req.session.userId;  // Assuming user is authenticated
  const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');
  let discountedPrice = 0; // Initialize discounted price

  // Fetch active offers
  const offers = await Offer.find({ isActive: true, endTime: { $gte: new Date() } });

  // Calculate total price using selected quantities and active offers
  if (!cart || !cart.Products || !cart.Products.length) {
    return res.status(400).json({ message: 'No items in the cart.' });
  }

  cart.Products.forEach(product => {
    const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
    let productPrice = product.Price; 
    
    // Check if there's an active offer for the product
    const offer = offers.find(o => o.productIds && o.productIds.includes(product.ProductId._id)); 
    if (offer) {
      productPrice -= (productPrice * (offer.discountPercentage / 100)); // Apply discount
    }
   
    discountedPrice += productPrice * quantity; // Update cart total with discounted price
  });

  // Validate discounted price against total price
  const totalPrice = parseFloat(req.body.TotalPrice); // Get the total price from the request
  if (totalPrice < discountedPrice) {
    return res.status(400).json({ message: 'Total Price cannot be less than the Discounted Price.' });
  }

  // Render the checkout page with cart and total
  res.render('checkout', { cart, cartTotal: discountedPrice, selectedQuantities });
};

const applyCoupon = async (req, res) => {
  try {
    const { couponCode, cartTotal } = req.body;

    console.log('Applying coupon:', couponCode, 'with cart total:', cartTotal);

    const coupon = await Coupon.findOne({
      couponCode,
      isActive: true,
      expiryDate: { $gte: new Date() }
    });

    if (coupon) {
      if (cartTotal < coupon.minPurchase) {
        return res.json({
          valid: false,
          message: `Minimum purchase amount of $${coupon.minPurchase} required to apply this coupon.`
        });
      }

      res.json({
        valid: true,
        discount: coupon.discountPercentage,
        minPurchase: coupon.minPurchase,
        maxDiscount: coupon.maxDiscountAmount,
        message: 'Coupon applied successfully!'
      });
    } else {
      res.json({
        valid: false,
        message: 'Invalid or expired coupon code.'
      });
    }
  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({
      valid: false,
      message: 'An error occurred while applying the coupon.'
    });
  }
};

const postOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { Products, TotalPrice, ShippingAddress, PaymentMethod, DiscountedPrice } = req.body; // Receive discountedPrice

    // Validate TotalPrice against DiscountedPrice
    if (TotalPrice < DiscountedPrice) {
      return res.status(400).json({ message: 'Total Price cannot be less than the Discounted Price.' });
    }

    // Create a new order object using your schema
    const newOrder = new Order({
      Products,
      TotalPrice,
      DiscountedPrice, // Save discounted price to the order
      ShippingAddress,
      PaymentMethod,
      UserId: req.session.userId, // Assuming user authentication is handled
    });

    // Save the order to the database
    await newOrder.save();

    // Decrement product quantities in the database
    for (const product of Products) {
      await Product.updateOne(
        { _id: product.ProductId },
        { $inc: { Quantity: -product.Quantity } }
      );
    }

    await Cart.deleteMany({ UserId: userId });

    // Respond with a success message
    res.json({ orderId: newOrder.OrderId });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error creating order', error });
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
    res.status(500).json({ message: 'Error deleting cart item', error });
  }
};

//to get success page
const getSuccess = async(req, res) => {
  
    try {
      const orderId = req.query.orderId; // Get the order ID from query parameters
      res.render('user/cart/successPage', { orderId }); // Render the success page and pass the order ID
    } catch (error) {
      console.log("the get success page  is broke")
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
    const productsWithOffers = products.map(product => {
      const productOffers = applicableOffers.filter(offer => 
          offer.productIds.includes(product._id) || 
          offer.categoryIds.includes(product.CategoryId)
      );

      let discountedPrice = product.Price; // Default to the original price

      // If there are applicable offers, calculate the discounted price
      if (productOffers.length > 0) {
          const activeOffer = productOffers.find(offer => 
              offer.isActive && 
              new Date() >= offer.startTime && 
              new Date() <= offer.endTime
          );
          if (activeOffer) {
              discountedPrice = product.Price - (product.Price * (activeOffer.discountPercentage / 100));
          }
      }

      return {
          ...product.toObject(),
          applicableOffers: productOffers,
          discountedPrice
      };
    });

    // Pass productsWithOffers to the view
    res.render("user/shop/shop", { products: productsWithOffers, userId: req.session.userId || null });
  } catch (error) {
    console.error("Error loading shop:", error);
    res.status(500).send('Server Error');
  }
};


// Function to get applicable offers for each product
const getApplicableOffersForProducts = async (products) => {
  try {
    const productIds = products.map(product => product._id);
    
    // Fetch applicable offers for these products
    const applicableOffers = await Offer.find({
      $or: [
        { productIds: { $in: productIds } },
        { categoryIds: { $in: products.map(product => product.CategoryId) } }
      ],
      isActive: true
    });

    return applicableOffers;
  } catch (error) {
    console.error("Error fetching applicable offers:", error);
    return []; // Return an empty array on error
  }
};



const loadShopItems = async (req, res) => {
  const { categoryId, priceOrder, arrivalOrder, nameOrder, searchTerm } = req.query;

  // Initialize query to filter products
  let query = {
    $or: [
      { Is_list: true },
      { isList: true }
    ]
  };

  // Filter by category, ensuring categoryId is valid
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    query.CategoryId = new mongoose.Types.ObjectId(categoryId);
  }

  // Search by product name if provided
  if (searchTerm) {
    query.Name = { $regex: searchTerm, $options: 'i' }; // Case-insensitive search
  }

  try {
    // Fetch products based on query
    let products = await Product.find(query).populate("CategoryId");

    // Fetch applicable offers
    const offers = await Offer.find({
      $or: [
        { applicableTo: 'product', productIds: { $in: products.map(product => product._id) } },
        { applicableTo: 'category', categoryIds: { $in: products.map(product => product.CategoryId) } }
      ]
    });

    // Map offers to products
    products = products.map(product => {
      // Find offers applicable to the product
      const applicableOffers = offers.filter(offer =>
        (offer.applicableTo === 'product' && offer.productIds.includes(product._id)) ||
        (offer.applicableTo === 'category' && offer.categoryIds.includes(product.CategoryId))
      );

      // Return product with applicable offers
      return { ...product._doc, applicableOffers }; // Merge the product with its applicable offers
    });

    // Sort products
    if (priceOrder === 'lowToHigh') {
      products.sort((a, b) => a.Price - b.Price);
    } else if (priceOrder === 'highToLow') {
      products.sort((a, b) => b.Price - a.Price);
    }

    // Sort by new arrivals based on createdAt timestamp
    if (arrivalOrder === 'newest') {
      products.sort((a, b) => b.createdAt - a.createdAt);
    }

    // Sort products by name
    if (nameOrder === 'aToZ') {
      products.sort((a, b) => a.Name.localeCompare(b.Name));
    } else if (nameOrder === 'zToA') {
      products.sort((a, b) => b.Name.localeCompare(a.Name));
    }

    // Return sorted products as JSON
    res.json(products);
  } catch (error) {
    console.error("Error loading shop items:", error);
    res.status(500).send('Server Error');
  }
};



const shopCategoryItems = async (req, res) => {
  try {
    // Fetch all categories that are marked as available for listing
    const categories = await Category.find({ isList: true }); 
    res.json(categories); // Send categories as a JSON response
  } catch (error) {
    console.error("Error loading categories:", error);
    res.status(500).send('Server Error'); // Handle errors gracefully
  }
};


const loadWishlist = async (req, res) => {
  try {
      const userId = req.session.userId;
      if (!userId) {
          return res.status(400).send('User is not logged in');
      }

      // Find the user's wishlist
      const wishlist = await Wishlist.findOne({ UserId: userId }).populate('products');

      // Check if the wishlist exists
      if (!wishlist) {
          return res.status(404).send('Wishlist not found');
      }

      // Render the wishlist page and pass the products directly
      res.render('user/cart/wishlistPage', { products: wishlist.products });
  } catch (error) {
      console.log("Error loading wishlist:", error);
      res.status(500).send('Server error');
  }
};




const addProductToWishlist = async (req, res) => {
  const userId = req.session.userId; // Accessing the userId from session

  if (!userId) {
      return res.status(400).send('User is not logged in');
  }

  try {
      // Add product to wishlist logic
      const { ProductId } = req.body; // Make sure the request body contains ProductId
      const wishlist = await Wishlist.findOneAndUpdate(
          { UserId: userId },
          { $addToSet: { products: ProductId } }, // Use the correct field name 'products'
          { upsert: true, new: true }
      ).populate('products'); // Optional: Populate the products to return full product details

      res.status(200).json({ message: 'Product added to wishlist', wishlist });
  } catch (error) {
      console.error('Error adding product to wishlist:', error);
      res.status(500).json({ message: 'Error adding product to wishlist' });
  }
};



const removeProductFromWishlist = async (req, res) => {
  try {
      const { productId } = req.body; // Ensure you're accessing productId correctly
      const userId = req.session.userId;

      if (!userId) {
          return res.status(400).json({ message: 'User is not logged in' });
      }

      const wishlist = await Wishlist.findOne({ UserId: userId });

      if (!wishlist) {
          return res.status(404).json({ message: 'Wishlist not found' });
      }

      // Check if productId is valid
      if (!productId) {
          return res.status(400).json({ message: 'Product ID is required' });
      }

      // Remove product from wishlist
      wishlist.products = wishlist.products.filter(p => p.toString() !== productId);

      await wishlist.save();
      res.status(200).json({ message: 'Product removed from wishlist' });
  } catch (err) {
      console.error('Error removing product from wishlist:', err);
      res.status(500).json({ error: 'Server error' });
  }
};


const getWishlist = async (req, res) => {
  try {
      const userId = req.session.userId;

      const wishlist = await Wishlist.findOne({ userId }).populate('products');

      if (!wishlist || wishlist.products.length === 0) {
          return res.status(404).json({ message: 'No products in wishlist' });
      }

      res.status(200).json(wishlist.products);
  } catch (err) {
      console.error('Error fetching wishlist:', err);
      res.status(500).json({ error: 'Server error' });
  }
};

// Initialize Razorpay instance with your key ID and secret
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID, // Replace with your Razorpay key ID
  key_secret: process.env.RAZORPAY_KEY_SECRET, // Replace with your Razorpay key secret
});

const createRazorpayOrder = async (req, res) => {
  try {
      const { amount } = req.body; // Amount in paise (multiply by 100 on frontend)

      const options = {
          amount: amount, // Amount in paise (e.g., Rs. 500 = 50000 paise)
          currency: 'INR',
          receipt: `receipt_order_${Date.now()}`,
      };

      // Create order on Razorpay
      const order = await razorpayInstance.orders.create(options);

      if (!order) return res.status(500).json({ message: 'Failed to create order' });

      // Send back the order details
      res.status(200).json({
          id: order.id,
          amount: order.amount,
          currency: order.currency,
      });
  } catch (error) {
      console.error('Error creating Razorpay order:', error);
      res.status(500).json({ message: 'Error creating Razorpay order' });
  }
};


const verifyPaymentAndSaveOrder = async (req, res) => {
  try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature, Products, TotalPrice, ShippingAddress } = req.body;

      // Verify the payment signature
      const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET); // Use Razorpay Key Secret
      shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      const generatedSignature = shasum.digest('hex');

      if (generatedSignature !== razorpay_signature) {
          return res.status(400).json({ message: 'Invalid payment signature' });
      }

      // Save the order to the database after payment verification
      const newOrder = new Order({
          Products,
          TotalPrice,
          ShippingAddress,
          PaymentMethod: 'razorpay',
          PaymentDetails: {
              orderId: razorpay_order_id,
              paymentId: razorpay_payment_id,
          },
          Status: 'Paid', // Update status after payment
      });

      await newOrder.save();

      res.status(200).json({ orderId: newOrder._id, message: 'Order placed successfully' });
  } catch (error) {
      console.error('Error verifying payment and saving order:', error);
      res.status(500).json({ message: 'Error processing payment' });
  }
};

const getWallet = async(req,res)=>{

  try {
      res.render("user/profile/userWallet")
  } catch (error) {
      console.log("get wallet broke ",error)
  }
}

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
  walletBalance


};
