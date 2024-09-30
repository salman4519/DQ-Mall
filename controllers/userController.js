const User = require("../models/userModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Cart = require('../models/cartModel');
const Order = require("../models/orderModel")
const otpGenerator = require("otp-generator");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const addressModel = require("../models/addressModel");
const mongoose = require("mongoose")
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

    // Render the category products page with pagination info
    res.render("user/product/listProduct", {
      products,
      category,
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
    res.render("user/product/productDetails", { product });
  } catch (error) {
    console.error(error);
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

      // Update the order status to 'Cancelled'
      const updatedOrder = await Order.findOneAndUpdate(
          { OrderId: orderId, UserId: req.session.userId },
          { Status: 'Cancelled' },
          { new: true } // Return the updated document
      );

      if (!updatedOrder) {
          return res.status(404).json({ success: false, message: 'Order not found or already cancelled.' });
      }

      res.json({ success: true, message: 'Order cancelled successfully.' });
  } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: 'Error cancelling order', error });
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
    const orders = await Order.find({ UserId: req.session.userId }).populate('Products.ProductId');
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
  const userId = req.session.userId; // Get the user ID from the session

  if (!userId) {
    return res.redirect('/login'); // Redirect if user is not logged in
  }

  try {
    // Fetch the user's cart from the database
    const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');

    // Check if the cart is null or has no products
    if (!cart || !cart.Products || cart.Products.length === 0) {
      return res.render('user/cart/cartPage', {
        cart: null, // Explicitly send null for the cart
        cartTotal: 0,
        isEmpty: true // Flag indicating the cart is empty
      });
    }

    // Calculate the total price of the cart
    const cartTotal = cart.Products.reduce((total, product) => {
      // Assuming product.ProductId holds the actual product details and price
      const productPrice = product.ProductId.Price; // Ensure to access the price from the populated ProductId
      const productQuantity = product.Quantity || 0; // Get the quantity, default to 0 if not defined
      return total + (productPrice * productQuantity);
    }, 0);

    // Render the cart page with the populated cart data
    res.render('user/cart/cartPage', {
      cart: cart,
      cartTotal: cartTotal,
      isEmpty: false // Flag indicating the cart has items
    });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Server error" });
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

    product.Quantity = newQuantity;
    await cart.save();

    res.json({ message: "Cart updated successfully" });
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
  const { productId, price, quantity } = req.body;
  const userId = req.session.userId; // Assuming you have user session management

  try {
    // Find or create a cart for the user
    let cart = await Cart.findOne({ UserId: userId });

    if (!cart) {
      // Create a new cart if it doesn't exist
      cart = new Cart({
        UserId: userId,
        Products: []
      });
    }

    // Check if the product is already in the cart
    const existingProduct = cart.Products.find(product => product.ProductId.toString() === productId);

    if (existingProduct) {
      // If it exists, update the quantity
      existingProduct.SelectedQuantity += quantity;
    } else {
      // If it doesn't exist, add it to the cart
      cart.Products.push({ ProductId: productId, SelectedQuantity: quantity, Price: price });
    }

    await cart.save(); // Save the cart
    return res.redirect('/cart');
  } catch (error) {
    console.error('Error adding product to cart:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

//to get checkout page
const getCheckout = async (req, res) => {
  try {
    const userId = req.session.userId; // Assuming user is authenticated and you have their ID
    const addresses = await addressModel.find({ UserId: userId }); // Fetch user's addresses
    const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');
    let cartTotal = 0;

    // Get selected quantities from the request body
    const selectedQuantities = req.body; // This will be populated from the POST request

    // Calculate total price based on selected quantities
    cart.Products.forEach(product => {
      const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
      cartTotal += product.Price * quantity;
    });

    res.render('user/cart/getCheckout', { addresses, cart, cartTotal });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

const postCheckout = async (req, res) => {
  const selectedQuantities = req.body; // Get selected quantities from request body
  const userId = req.session.userId;  // Assuming user is authenticated and you have their ID
  const cart = await Cart.findOne({ UserId: userId }).populate('Products.ProductId');
  let cartTotal = 0;

  // Calculate total price using the selected quantities
  cart.Products.forEach(product => {
    const quantity = selectedQuantities[product.ProductId._id] || 1; // Default to 1 if not set
    cartTotal += product.Price * quantity;
  });

  // Render the checkout page with cart and total
  res.render('checkout', { cart, cartTotal, selectedQuantities });
};


const postOrder = async (req, res) => {
  try {
    const userId = req.session.userId;
    const { Products, TotalPrice, ShippingAddress, PaymentMethod } = req.body;

    // Create a new order object using your schema
    const newOrder = new Order({
      Products,
      TotalPrice,
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
const getShop = async(req,res)=>{
  let products = await Product.find({}); // Fetch all products
    try {
      res.render("user/shop/shop",{ products}) 
      

    } catch (error) {
      console.log("load shop broke",error)
    }
}

const loadShopItems = async (req, res) => {
  const { categoryId, priceOrder, arrivalOrder, nameOrder, searchTerm } = req.query;

  // Initialize query with $or for Is_list and isList
  let query = {
      $or: [
          { Is_list: true },
          { isList: true }
      ]
  };

  // Filter by category, converting categoryId to ObjectId if provided
  if (categoryId && mongoose.isValidObjectId(categoryId)) {
    query.CategoryId = new mongoose.Types.ObjectId(categoryId); // Correct usage
}

  // Search by name if provided
  if (searchTerm) {
      query.Name = { $regex: searchTerm, $options: 'i' }; // Case-insensitive search
  }

  try {
      let products = await Product.find(query);

      // Sort products
      if (priceOrder === 'lowToHigh') {
          products.sort((a, b) => a.Price - b.Price);
      } else if (priceOrder === 'highToLow') {
          products.sort((a, b) => b.Price - a.Price);
      }

      // Sort by new arrivals (if you have a createdAt date or similar)
      if (arrivalOrder === 'newest') {
          products.sort((a, b) => b.createdAt - a.createdAt);
      }

      // Sort by name
      if (nameOrder === 'aToZ') {
          products.sort((a, b) => a.Name.localeCompare(b.Name));
      } else if (nameOrder === 'zToA') {
          products.sort((a, b) => b.Name.localeCompare(a.Name));
      }

      res.json(products);
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
  }
};



const shopCategoryItems = async (req, res) => {
  try {
      const categories = await Category.find({ isList:true }); // Fetch all categories from the database
      res.json(categories); // Send categories as a JSON response
  } catch (error) {
      console.error(error);
      res.status(500).send('Server Error'); // Handle errors gracefully
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
  shopCategoryItems

};
