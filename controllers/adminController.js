const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const moment = require("moment");
const ExcelJS = require("exceljs");
const XLSX = require("xlsx");
const model = require("../models/userModel");
const Product = require("../models/productModel");
const Category = require("../models/categoryModel");
const Wallet = require("../models/walletModel");
const Order = require("../models/orderModel");
const Offer = require("../models/offerModel");
const Coupon = require("../models/couponModel");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const multer = require("multer");

//load admin login
const loadLogin = async (req, res) => {
  try {
    res.render("admin/adminLogin", { message: "" });
  } catch (error) {
    console.log("login page broke");
  }
};

//load admin signup
const loadSignup = async (req, res) => {
  try {
    res.render("admin/signup", { message: "" });
  } catch (error) {
    console.log("signup page broke");
  }
};

// bcrpt password
const securePassword = async (password) => {
  try {
    return bcrypt.hash(password, 10);
  } catch (error) {
    console.log(error);
  }
};

//insert user
const SignupUser = async (req, res) => {
  try {
    const spassword = await securePassword(req.body.password);
    const user = new model({
      Username: req.body.username,
      Email: req.body.email,
      Mobile: req.body.mobile,
      Password: spassword,
    });
    const result = await user.save();
    if (result) {
      res.render("admin/signup", { message: "Registered successfully" });
    }
  } catch (error) {
    console.log(error);
  }
};

//verify login
const verifyLogin = async (req, res) => {
  try {
    const { username, password } = req.body;
    // Find the user by username and check if they are an admin
    const userData = await model.findOne({
      Is_admin: true,
      Username: username,
    });

    if (userData) {
      // Compare the provided password with the hashed password stored in the database
      const isPasswordMatch = await bcrypt.compare(password, userData.Password);

      if (isPasswordMatch) {
        // Password matches, set session and redirect to admin dashboard
        req.session.isAdminLoggedIn = true; // Set session flag
        req.session.adminId = userData._id; // Save admin ID or other info
        res.redirect("/admin/dash");
      } else {
        // Password does not match
        res.render("admin/adminLogin", {
          message: "Invalid Username or Password",
        });
      }
    } else {
      // User not found
      res.render("admin/adminLogin", {
        message: "Invalid Username or Password",
      });
    }
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

//load admin dashboard
const loadDash = async (req, res) => {
  try {
    const categories = await Category.find();
    const orders = await Order.find({ Status: "Delivered" });
    res.render("admin/dashboard", { categories, orders });
  } catch (error) {
    console.log("dash post broke");
  }
};

//load user management page
const loadUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 5; // Number of users per page
  const skip = (page - 1) * limit; // Calculate how many users to skip

  try {
    const users = await model
      .find({ Is_admin: false, Is_verified: true })
      .skip(skip)
      .limit(limit);
    const totalUsers = await model.countDocuments(); // Get the total number of users

    res.render("admin/users", {
      users,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
    });
  } catch (err) {
    res.status(500).send(err);
  }
};

// search user
const userSearch = async (req, res) => {
  const search = req.query.search;

  try {
    const users = await model.find({
      isAdmin: false,
      $or: [{ username: new RegExp(`^${search}`, "i") }],
    });

    res.render("admin/users", { users });
  } catch (error) {
    console.log("user search broke");
  }
};

//load products page
const loadProducts = async (req, res) => {
  const limit = 5; // Define how many products to show per page
  const page = req.query.page || 1; // Get the current page from the query, default to 1
  const skip = (page - 1) * limit;

  try {
    // Fetch products with pagination and filter by Is_list
    const products = await Product.find({ Is_list: true })
      .skip(skip)
      .limit(limit)
      .populate("CategoryId");

    // Fetch total count for pagination, filtered by Is_list
    const totalProducts = await Product.countDocuments({ Is_list: true });

    res.render("admin/products", {
      products,
      currentPage: page,
      totalPages: Math.ceil(totalProducts / limit),
      limit,
    });
  } catch (error) {
    console.error("Error loading products:", error);
    res.status(500).send("Error loading products");
  }
};

//to load add product page
const addProduct = async (req, res) => {
  try {
    const categories = await Category.find({ isList: true });
    res.render("admin/addProduct", { categories });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: "Error fetching categories" });
  }
};

//insert user
const addProductLoadPage = async (req, res) => {
  try {
    const categories = await Category.find();
    const admin = await User.findById(req.session.user_id);
    res.render("addProductPage", { admin, categories });
  } catch (error) {
    console.log(error.message);
  }
};

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "../public/uploads");
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Create a unique filename
  },
});

const upload = multer({ storage: storage });

// Add product controller
const insertProduct = async (req, res) => {
  try {
    const { name, size, description, categoryId, quantity, price } = req.body;
    const images = [
      req.files.image1[0].filename,
      req.files.image2[0].filename,
      req.files.image3[0].filename,
    ];

    if (
      !name ||
      !size ||
      !description ||
      !categoryId ||
      !quantity ||
      !price ||
      images.length < 3
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const product = new Product({
      Name: name,
      Size: size,
      Description: description,
      CategoryId: categoryId,
      Quantity: quantity,
      Price: price,
      Images: images,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
      Is_list: true,
    });

    await product.save();
    res.redirect("/admin/products"); // Redirect to the product list page or another relevant page
  } catch (error) {
    console.error("Error adding product:", error);
    res
      .status(500)
      .json({ message: "Error adding product", error: error.message });
  }
};

// To load the product edit page
const loadProductEdit = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId).populate("CategoryId");
    const categories = await Category.find();

    if (!product) {
      return res.status(404).send("Product not found");
    }

    res.render("admin/productEdit", { product, categories, message: "" });
  } catch (error) {
    console.error("Error loading product for edit:", error);
    res
      .status(500)
      .json({ message: "Error loading product", error: error.message });
  }
};

// To make the changes in the product edit page
const editProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, size, price, description, categoryId, quantity } = req.body;

    // Find the product by ID
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Check for duplicate product names (excluding the current product)
    const existingProduct = await Product.findOne({
      name: name,
      _id: { $ne: productId },
    });
    if (existingProduct) {
      // Render the edit product page with an error message
      const categories = await Category.find(); // Fetch categories to repopulate the form
      return res.render("admin/productEdit", {
        product,
        categories,
        message: "Product name already exists.",
      });
    }

    // Handle image uploads if they are provided
    let images = [...product.Images]; // Copy existing images

    if (req.files) {
      const files = ["image1", "image2", "image3"];

      files.forEach((fileKey, index) => {
        if (req.files[fileKey] && req.files[fileKey][0]) {
          // Update image URL in the images array
          images[index] = req.files[fileKey][0].filename; // Store only the filename
        }
      });
    }

    // Update product details
    await Product.findByIdAndUpdate(productId, {
      Name: name,
      Size: size,
      Price: price,
      Description: description,
      CategoryId: categoryId,
      Quantity: quantity,
      Images: images, // Update with new or existing image filenames
    });

    // Redirect to products list or any other page
    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error updating product:", error);
    res
      .status(500)
      .json({ message: "Error updating product", error: error.message });
  }
};

// to delete the the product
const deleteProduct = async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Set Is_list to false to hide the product
    await Product.findByIdAndUpdate(productId, { Is_list: false });

    res.redirect("/admin/products");
  } catch (error) {
    console.error("Error hiding product:", error);
    res.status(500).send("Server error");
  }
};

//load category page
const loadCategory = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 5; // Number of categories per page
  const skip = (page - 1) * limit; // Calculate how many categories to skip

  try {
    // Filter out categories with isSpecialCategory: true or other conditions
    const categories = await Category.find({ isList: true }) // Adjust filtering condition
      .skip(skip)
      .limit(limit);

    const totalCategories = await Category.countDocuments(); // Count total categories excluding special ones

    res.render("admin/category", {
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalCategories / limit),
    });
  } catch (err) {
    res.status(500).send(err);
  }
};

const addCategory = async (req, res) => {
  try {
    res.render("admin/addCategory", { message: "" });
  } catch (error) {
    console.log("add Category broke");
  }
};

// Controller method to handle category addition
const insertCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    if (!name) {
      return res.render("admin/addCategory", {
        message: "Category name is required.",
      });
    }

    const Name = await Category.findOne({ name: name });

    if (Name) {
      return res.render("admin/addCategory", {
        message: "Category Name is already exist",
      });
    }

    // Create a new category
    const newCategory = new Category({
      name: name,
      imageUrl: image, // Save the image URL if an image is provided
      createdAt: new Date(),
      updatedAt: new Date(),
      isList: true,
    });

    await newCategory.save();

    res.redirect("/admin/category"); // Redirect to category list or success page
  } catch (error) {
    console.error("Error adding category:", error);
    res.render("admin/addCategory", {
      message: "Error adding category",
      error,
    });
  }
};

// to load edit category5
const loadEditCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    res.render("admin/editCategory", { category, message: "" });
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

// to update the edit category
const postEditCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const image = req.file ? `/uploads/${req.file.filename}` : null;

    // Check for an existing category with the same name
    const existingCategory = await Category.findOne({ name: name });
    if (existingCategory && existingCategory._id.toString() !== id) {
      return res.render("admin/editCategory", {
        category: { _id: id, name }, // Preserve category information for the form
        message: "Category name already exists.",
      });
    }

    // Find the category by ID
    const category = await Category.findById(id);
    if (!category) {
      return res.render("admin/editCategory", {
        category: null,
        message: "Category not found.",
      });
    }

    // Update category fields
    category.name = name;
    if (image) {
      category.imageUrl = image; // Update the image URL if a new image is provided
    }
    category.updatedAt = new Date();

    await category.save();
    res.redirect("/admin/category"); // Redirect to category list or success page
  } catch (error) {
    console.error("Error updating category:", error);
    res.render("admin/editCategory", {
      message: "Error updating category",
      category: { _id: id, name },
    });
  }
};

// to delete category
const deleteCategory = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // Find the category by ID and update Is_list to false
    const category = await Category.findByIdAndUpdate(
      categoryId,
      { isList: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).send("Category not found");
    }

    // Redirect to the categories list page or any other page
    res.redirect("/admin/category");
  } catch (error) {
    console.error("Error hiding category:", error);
    res
      .status(500)
      .json({ message: "Error hiding category", error: error.message });
  }
};

//to block user
const blockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await model.findByIdAndUpdate(userId, { Is_block: true });
    res.redirect("/admin/users"); // Redirect back to the user management page
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

//to unblock user
const unblockUser = async (req, res) => {
  try {
    const { userId } = req.params;
    await model.findByIdAndUpdate(userId, { Is_block: false });
    res.redirect("/admin/users"); // Redirect back to the user management page
  } catch (error) {
    console.error(error);
    res.status(500).send("Server Error");
  }
};

//for logout
const logout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).send("Could not log out.");
    }
    res.redirect("/admin");
  });
};

//to get orders
const getOrders = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 5; // Number of categories per page
  const skip = (page - 1) * limit; // Calculate how many categories to skip

  const orders = await Order.find({})
    .skip(skip)
    .limit(limit)
    .sort({ createdAt: -1 });
  const totalOrders = await Order.countDocuments();

  try {
    res.render("admin/orders", {
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
    });
  } catch (error) {}
};

const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    console.log("Fetching order details for OrderId:", orderId);
    const order = await Order.findOne({ OrderId: orderId })
      .populate("Products.ProductId") // Assuming ProductId is a reference to a Product model
      .populate("ShippingAddress"); // Assuming ShippingAddress is a reference to an Address model

    if (!order) {
      console.log("Order not found for OrderId:", orderId);
      return res.status(404).json({ message: "Order not found" });
    }

    // Format the order details to include product and address details
    const orderDetails = {
      PaymentMethod: order.PaymentMethod,
      OrderId: order.OrderId,
      TotalPrice: order.TotalPrice,
      Status: order.Status,
      Products: order.Products.map((item) => ({
        ProductId: item.ProductId._id,
        Name: item.ProductId.Name,
        Price: item.ProductId.Price,
        Image: item.ProductId.Images[0],
        Quantity: item.Quantity,
      })),
      ShippingAddress: {
        FullName: order.ShippingAddress.FullName,
        Street: order.ShippingAddress.Address,
        City: order.ShippingAddress.City,
        Pincode: order.ShippingAddress.Pincode,
        Country: order.ShippingAddress.Country,
        AddressType: order.ShippingAddress.AddressType,
      },
    };

    console.log(orderDetails);
    res.json(orderDetails);
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ message: "Failed to load order details" });
  }
};

const fetchOrderDetails = async (orderId) => {
  try {
    const response = await fetch(`/order-details/${orderId}`);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const orderData = await response.json();
    // Handle order data (e.g., display it in your UI)
  } catch (error) {
    console.error("Error fetching order details:", error);
    // Display error message to user
  }
};

const cancelOrder = async (req, res) => {
  const { orderId } = req.body;

  try {
    // Find the order by ID
    const order = await Order.findOne({ OrderId: orderId }).populate(
      "Products.ProductId"
    ); // Populate products
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the status can be updated
    if (order.Status === "Cancelled" || order.Status === "Delivered") {
      return res.status(400).json({ message: "Cannot cancel this order" });
    }

    // Update the order status to 'Cancelled'
    order.Status = "Cancelled";
    await order.save();

    // Check if the payment method is Razorpay
    if (order.PaymentMethod !== "cashOnDelivery") {
      // Retrieve the total price of the cancelled order
      const refundAmount = order.TotalPrice;

      // Find or create the user's wallet entry
      const wallet = await Wallet.findOneAndUpdate(
        { UserId: order.UserId }, // Assuming order has UserId field
        {
          $inc: { Balance: refundAmount }, // Increment the balance by the refund amount
          $push: {
            Transactions: {
              amount: refundAmount,
              date: Date.now(),
              type: "credit",
              reason: `Cancelled Order #${orderId}`,
            },
          }, // Add transaction reason
        },
        { new: true, upsert: true } // Create a new wallet if it doesn't exist
      );

      // Restock the product quantities
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
    }

    res
      .status(200)
      .json({ message: "Order status updated successfully", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const returnOrder = async (req, res) => {
  const { orderId } = req.body;

  try {
    // Find the order by ID
    const order = await Order.findOne({ OrderId: orderId }).populate(
      "Products.ProductId"
    ); // Populate products
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the status can be updated
    if (order.Status === "Cancelled" || order.Status === "Returned") {
      return res.status(400).json({ message: "Cannot return this order" });
    }

    // Update the order status to 'Returned'
    order.Status = "Returned";
    await order.save();

    // Update the user's wallet balance
    const userId = order.UserId; // Get the user ID from the order
    const returnAmount = order.TotalPrice; // Assuming you want to credit the full amount back

    // Find the wallet associated with the user
    const wallet = await Wallet.findOneAndUpdate(
      { UserId: userId },
      {
        $inc: { Balance: returnAmount }, // Increase the wallet balance
        $push: {
          Transactions: {
            amount: returnAmount,
            date: Date.now(),
            type: "credit",
            reason: `Refund for Order #${orderId}`,
          },
        }, // Add transaction reason
      },
      { new: true } // Return the updated wallet document
    );

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    // Restock the product quantities
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

    res
      .status(200)
      .json({
        message:
          "Order status updated successfully and amount credited to wallet",
        order,
      });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateOrderStatus = async (req, res) => {
  const { orderId, newStatus } = req.body;

  try {
    // Find the order by ID
    const order = await Order.findOne({ OrderId: orderId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Check if the status can be updated
    if (order.Status === "Delivered" || order.Status === "Cancelled") {
      return res.status(400).json({ message: "Cannot update this order" });
    }

    // Update the order status
    order.Status = newStatus;
    await order.save();

    res
      .status(200)
      .json({ message: "Order status updated successfully", order });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getOffer = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 5; // Number of categories per page
  const skip = (page - 1) * limit; // Calculate how many categories to skip
  try {
    const products = await Product.find({ Is_list: true });
    const categories = await Category.find({ isList: true });
    const offers = await Offer.find()
      .populate("productIds", "Name")
      .skip(skip)
      .limit(limit) // Assuming 'Name' is the field for product names
      .populate("categoryIds", "name"); // Assuming 'Name' is the field for category names // Fetch all offers
    const totalOffers = await Offer.countDocuments();
    res.render("admin/getOffer", {
      offers,
      products,
      categories,
      currentPage: page,
      totalPages: Math.ceil(totalOffers / limit),
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const getEditOffer = async (req, res) => {
  try {
    // Extract offer ID from request parameters
    const { offerId } = req.params;

    // Fetch the specific offer by ID and populate related product and category data
    const offer = await Offer.findById(offerId)
      .populate("productIds", "Name") // Assuming 'Name' is the field for product names
      .populate("categoryIds", "Name"); // Assuming 'Name' is the field for category names

    // Fetch all products and categories that are listed
    const products = await Product.find({ Is_list: true });
    const categories = await Category.find({ isList: true });

    // Render the edit offer page with the offer data, products, and categories
    res.render("admin/editOffer", { offer, products, categories });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const updateOffer = async (req, res) => {
  try {
    const { id } = req.params; // Get offer ID from URL parameters
    const {
      name,
      discountPercentage,
      applicableTo,
      productIds,
      categoryIds,
      startTime,
      endTime,
    } = req.body;

    // Create an object with the updated offer details
    const updatedOffer = {
      name,
      discountPercentage,
      applicableTo,
      productIds: productIds ? productIds : [], // Use the provided productIds or default to an empty array
      categoryIds: categoryIds ? categoryIds : [], // Use the provided categoryIds or default to an empty array
      startTime,
      endTime,
    };

    // Update the offer in the database
    const offer = await Offer.findByIdAndUpdate(id, updatedOffer, {
      new: true,
    });

    if (!offer) {
      return res.status(404).send("Offer not found");
    }

    // Redirect to offers list page or send a success message
    res.redirect("/admin/offers");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const getAddOffer = async (req, res) => {
  const products = await Product.find({ Is_list: true });
  const categories = await Category.find({ isList: true });

  try {
    res.render("admin/addOffer", { message: "", products, categories });
  } catch (error) {
    console.log(" get add offer broke");
  }
};

const addOffer = async (req, res) => {
  try {
    const {
      name,
      discountPercentage,
      applicableTo,
      productIds,
      categoryIds,
      startTime,
      endTime,
    } = req.body;

    // Validate inputs
    if (
      !name ||
      !discountPercentage ||
      !applicableTo ||
      !startTime ||
      !endTime
    ) {
      return res
        .status(400)
        .json({ error: "Please fill in all required fields." });
    }

    if (
      applicableTo === "product" &&
      (!productIds || productIds.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "Please select at least one product." });
    }

    if (
      applicableTo === "category" &&
      (!categoryIds || categoryIds.length === 0)
    ) {
      return res
        .status(400)
        .json({ error: "Please select at least one category." });
    }

    // Prepare offer data
    const newOffer = new Offer({
      name, // Added the name field
      discountPercentage,
      applicableTo,
      productIds: applicableTo === "product" ? productIds : [],
      categoryIds: applicableTo === "category" ? categoryIds : [],
      startTime,
      endTime,
    });

    // Save offer to the database
    await newOffer.save();
    res.redirect("/admin/offers");
  } catch (error) {
    console.error("Error adding offer:", error);
    res.status(500).json({ error: "Server error. Please try again later." });
  }
};

const deactivateOffer = async (req, res) => {
  try {
    const { id } = req.params; // Get offer ID from URL parameters

    // Find the offer and update its status
    const offer = await Offer.findByIdAndUpdate(
      id,
      { isActive: false }, // Assuming you have an isActive field in your Offer schema
      { new: true }
    );

    if (!offer) {
      return res.status(404).send("Offer not found");
    }

    // Redirect to offers list page or send a success message
    res.redirect("/admin/offers"); // Adjust this to your needs
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};
const activateOffer = async (req, res) => {
  try {
    const { id } = req.params; // Get offer ID from URL parameters

    // Find the offer and update its status
    const offer = await Offer.findByIdAndUpdate(
      id,
      { isActive: true }, // Set isActive to true
      { new: true }
    );

    if (!offer) {
      return res.status(404).send("Offer not found");
    }

    // Redirect to offers list page or send a success message
    res.redirect("/admin/offers"); // Adjust this to your needs
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
};

const deleteOffer = async (req, res) => {
  try {
    const offerId = req.params.id;
    await Offer.findByIdAndDelete(offerId); // Delete the offer by its ID

    // Redirect or respond with a success message

    res.redirect("/admin/offers"); // Redirect back to the offers list
  } catch (error) {
    console.error(error);
    req.flash("error_msg", "Error deleting offer");
    res.redirect("/admin/offers"); // Redirect back to the offers list on error
  }
};

const getCoupon = async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Default to page 1
  const limit = 5; // Number of categories per page
  const skip = (page - 1) * limit; // Calculate how many categories to skip
  try {
    const coupons = await Coupon.find().skip(skip).limit(limit);
    const totalCoupons = await Coupon.countDocuments();
    res.render("admin/Coupon", {
      coupons,
      currentPage: page,
      totalPages: Math.ceil(totalCoupons / limit),
    });
  } catch (error) {
    console.log("get coupon broke", error);
  }
};

const addCoupon = async (req, res) => {
  try {
    res.render("admin/addCoupon", { message: "" });
  } catch (error) {
    console.log("add coupon broke");
  }
};

// Add a new coupon
const postAddCoupon = async (req, res) => {
  const {
    couponCode,
    discountPercentage,
    expiryDate,
    minPurchase,
    maxDiscountAmount,
  } = req.body;

  try {
    // Create a new coupon with the submitted data
    const newCoupon = new Coupon({
      couponCode,
      discountPercentage,
      maxDiscountAmount, // Add this line
      expiryDate,
      minPurchase,
    });

    // Save the coupon to the database
    await newCoupon.save();

    // Redirect to the coupon listing page or show success message
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error adding coupon:", error);
    res.status(500).send("Failed to add coupon.");
  }
};

// Activate coupon
const activateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { isActive: true });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error activating coupon:", error);
    res.status(500).send("Failed to activate coupon.");
  }
};

// Deactivate coupon
const deactivateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndUpdate(couponId, { isActive: false });
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error deactivating coupon:", error);
    res.status(500).send("Failed to deactivate coupon.");
  }
};

// Delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndDelete(couponId);
    res.redirect("/admin/coupon");
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).send("Failed to delete coupon.");
  }
};

// Update coupon
const updateCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    const {
      couponCode,
      discountPercentage,
      minPurchase,
      expiryDate,
      maxDiscountAmount,
    } = req.body;

    await Coupon.findByIdAndUpdate(couponId, {
      couponCode,
      discountPercentage,
      maxDiscountAmount, // Add this line
      minPurchase,
      expiryDate: new Date(expiryDate), // Convert the input date to a Date object
    });

    res.redirect("/admin/coupon"); // Redirect back to the coupons list
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).send("Failed to update coupon.");
  }
};

// Get coupon for editing
const getEditCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;

    // Find the coupon by its ID
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return res.status(404).send("Coupon not found");
    }

    // Render the edit coupon page with the coupon data
    res.render("admin/editCoupon", {
      coupon,
    });
  } catch (error) {
    console.error("Error fetching coupon for edit:", error);
    res.status(500).send("Failed to load coupon for editing.");
  }
};

const generateSalesReportPDF = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;
    let dateQuery = {};
    const today = new Date();

    // Build date query based on report type
    switch (reportType) {
      case "daily":
        dateQuery = {
          $gte: new Date(today.setHours(0, 0, 0, 0)),
          $lt: new Date(today.setHours(23, 59, 59, 999)),
        };
        break;
      case "monthly":
        dateQuery = {
          $gte: new Date(today.getFullYear(), today.getMonth(), 1),
          $lte: new Date(today.getFullYear(), today.getMonth() + 1, 0),
        };
        break;
      case "yearly":
        dateQuery = {
          $gte: new Date(today.getFullYear(), 0, 1),
          $lte: new Date(today.getFullYear(), 11, 31),
        };
        break;
      case "custom":
        dateQuery = {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        };
        break;
      default:
        return res.status(400).send("Invalid report type.");
    }

    const orders = await Order.find({
      Status: "Delivered",
      createdAt: dateQuery,
    });

    // Calculate totals
    const totalRevenue = orders.reduce(
      (total, order) => total + order.TotalPrice,
      0
    );
    const totalDiscount = orders.reduce(
      (total, order) => total + (order.DiscountedPrice || 0),
      0
    );
    const totalOrders = orders.length;

    // Create a PDF document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]); // Set a taller page size

    // Embed the font
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const headerColor = rgb(0.2, 0.2, 0.8); // Blue header color
    const rowColor = rgb(0.9, 0.9, 0.9); // Light gray for rows
    const textColor = rgb(0, 0, 0); // Black text

    // Title and report info
    let yPosition = 750; // Starting Y position for the title

    // Title
    page.drawText("Sales Report", {
      x: 50,
      y: yPosition,
      size: 24,
      font: font,
      color: headerColor,
    });
    yPosition -= 30; // Move down for the report info

    // Report type and date range
    const reportInfo =
      reportType === "custom"
        ? `Report Type: ${reportType}\nDate Range: ${new Date(
            startDate
          ).toLocaleDateString()} to ${new Date(endDate).toLocaleDateString()}`
        : `Report Type: ${reportType}\nDate: ${today.toLocaleDateString()}`;

    page.drawText(reportInfo, {
      x: 50,
      y: yPosition,
      size: 14,
      font: font,
      color: textColor,
    });
    yPosition -= 50; // Space for table headers

    // Table Headers
    const headers = [
      "Order ID",
      "Order Date",
      "Payment Method",
      "Total Price",
      "Discount",
    ];
    const headerWidths = [150, 100, 100, 100, 100]; // Widths for each column

    // Draw headers
    headers.forEach((header, index) => {
      const xPosition =
        50 + headerWidths.slice(0, index).reduce((a, b) => a + b, 0);
      page.drawText(header, {
        x: xPosition,
        y: yPosition,
        size: 12,
        font: font,
        color: headerColor,
        underline: true,
      });
    });

    yPosition -= 20; // Move down for the data rows

    // Add order details to the PDF
    if (orders.length === 0) {
      page.drawText("No delivered orders found for this report.", {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: textColor,
      });
    } else {
      orders.forEach((order, index) => {
        const discount = order.DiscountedPrice || 0;
        const orderDate = new Date(order.createdAt).toLocaleDateString();
        const totalPriceText = `$${order.TotalPrice.toFixed(2)}`;
        const paymentMethodText = order.PaymentMethod || "N/A";

        const rowYPosition = yPosition - index * 20; // Calculate Y position for the row
        if (rowYPosition < 50) {
          page = pdfDoc.addPage([600, 800]);
          yPosition = 750; // Reset yPosition for the new page
        }

        // Draw alternating row colors
        page.drawRectangle({
          x: 40,
          y: rowYPosition,
          width: 550,
          height: 18,
          color: index % 2 === 0 ? rowColor : rgb(1, 1, 1),
        });

        // Draw order details
        page.drawText(`${order.OrderId}`, {
          x: 50,
          y: rowYPosition + 2,
          size: 10,
          font: font,
          color: textColor,
        });
        page.drawText(`${orderDate}`, {
          x: 50 + headerWidths[0],
          y: rowYPosition + 2,
          size: 10,
          font: font,
          color: textColor,
        });
        page.drawText(`${paymentMethodText}`, {
          x: 50 + headerWidths[0] + headerWidths[1],
          y: rowYPosition + 2,
          size: 10,
          font: font,
          color: textColor,
        });
        page.drawText(`$${discount.toFixed(2)}`, {
          x:
            50 +
            headerWidths[0] +
            headerWidths[1] +
            headerWidths[2] +
            headerWidths[3],
          y: rowYPosition + 2,
          size: 10,
          font: font,
          color: textColor,
        });
        page.drawText(totalPriceText, {
          x: 50 + headerWidths[0] + headerWidths[1] + headerWidths[2],
          y: rowYPosition + 2,
          size: 10,
          font: font,
          color: textColor,
        });
      });
    }

    // Summary Section
    yPosition -= orders.length * 20 + 20; // Adjust for the number of rows added
    if (yPosition < 50) {
      page = pdfDoc.addPage([600, 800]);
      yPosition = 750;
    }

    page.drawText("Summary", {
      x: 50,
      y: yPosition,
      size: 16,
      font: font,
      color: headerColor,
    });

    // Summary Details
    const summaryData = [
      { label: "Total Revenue:", value: `$${totalRevenue.toFixed(2)}` },
      { label: "Total Orders:", value: `${totalOrders}` },
      { label: "Total Discount:", value: `$${totalDiscount.toFixed(2)}` },
    ];

    summaryData.forEach((item, index) => {
      yPosition -= 20;
      page.drawText(item.label, {
        x: 50,
        y: yPosition,
        size: 12,
        font: font,
        color: headerColor,
      });
      page.drawText(item.value, {
        x: 150,
        y: yPosition,
        size: 12,
        font: font,
        color: textColor,
      });
    });

    // Serialize the PDFDocument to bytes (a Uint8Array)
    const pdfBytes = await pdfDoc.save();

    // Define the path for saving the PDF file
    const reportFilePath = path.join(
      __dirname,
      "reports",
      `Sales_Report_${reportType}_${moment().format("YYYYMMDD_HHmmss")}.pdf`
    );

    // Ensure the reports directory exists
    fs.mkdirSync(path.dirname(reportFilePath), { recursive: true });

    // Write the PDF to the file system
    fs.writeFileSync(reportFilePath, pdfBytes);

    // Send the file as a download
    res.download(reportFilePath, (err) => {
      if (err) {
        console.error("Error sending PDF file:", err);
        return res.status(500).send("Error sending PDF file.");
      }

      // Optionally delete the file after sending
      fs.unlinkSync(reportFilePath); // Remove the file after sending it
    });
  } catch (error) {
    console.error("Error generating sales report:", error);
    res
      .status(500)
      .send("An error occurred while generating the sales report.");
  }
};

const generateSalesReportExcel = async (req, res) => {
  try {
    const { reportType, startDate, endDate } = req.body;

    // Validate and get the date range based on the report type
    const dateQuery = getDateQuery(reportType, startDate, endDate);
    if (!dateQuery) {
      return res
        .status(400)
        .json({ error: "Invalid report type or date range." });
    }

    // Fetch the orders based on the date range
    const orders = await fetchOrders(dateQuery);
    if (!orders || orders.length === 0) {
      return res
        .status(404)
        .json({ error: "No orders found for the selected criteria." });
    }

    // Create and send the Excel report using ExcelJS (no file saving)
    await createAndSendExcelReport(orders, reportType, res);
  } catch (error) {
    console.error("Error generating sales report:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while generating the sales report.",
        details: error.message,
      });
  }
};

// Function to get date query based on report type
const getDateQuery = (reportType, startDate, endDate) => {
  const today = new Date();
  let dateQuery = {};

  switch (reportType) {
    case "daily":
      dateQuery = {
        $gte: new Date(today.setHours(0, 0, 0, 0)),
        $lt: new Date(today.setHours(23, 59, 59, 999)),
      };
      break;
    case "monthly":
      dateQuery = {
        $gte: new Date(today.getFullYear(), today.getMonth(), 1),
        $lt: new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          0,
          23,
          59,
          59,
          999
        ),
      };
      break;
    case "yearly":
      dateQuery = {
        $gte: new Date(today.getFullYear(), 0, 1),
        $lt: new Date(today.getFullYear(), 11, 31, 23, 59, 59, 999),
      };
      break;
    case "custom":
      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({
            error: "Both start and end dates are required for custom reports.",
          });
      }
      if (new Date(startDate) > new Date(endDate)) {
        return res
          .status(400)
          .json({ error: "Start date cannot be after the end date." });
      }
      dateQuery = {
        $gte: new Date(startDate),
        $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      };
      break;
    default:
      return null; // Invalid report type
  }
  return { createdAt: dateQuery };
};

// Function to fetch orders based on date query
const fetchOrders = async (dateQuery) => {
  try {
    return await Order.find({
      ...dateQuery,
      Status: "Delivered", // Adjust this as necessary if you want to include other statuses
    }).lean();
  } catch (error) {
    console.error("Error fetching orders:", error);
    return null;
  }
};

// Function to create and send Excel report using ExcelJS (no file saving)
const createAndSendExcelReport = async (orders, reportType, res) => {
  try {
    // Create a new workbook and add a worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sales Report");

    // Define columns for the worksheet
    worksheet.columns = [
      { header: "Order ID", key: "OrderId", width: 30 },
      { header: "Order Date", key: "createdAt", width: 20 },
      { header: "Payment Method", key: "PaymentMethod", width: 20 },
      { header: "Discount Price", key: "DiscountedPrice", width: 15 },
      { header: "Total Price", key: "TotalPrice", width: 15 },
    ];

    let totalSales = 0;
    let totalDiscounts = 0;

    // Add rows of order data
    orders.forEach((order) => {
      const totalPrice = order.TotalPrice || 0;
      const discountPrice = order.DiscountedPrice || 0; // Assuming you have this field in your order
      worksheet.addRow({
        OrderId: order.OrderId || "",
        createdAt: order.createdAt
          ? moment(order.createdAt).format("YYYY-MM-DD")
          : "",
        PaymentMethod: order.PaymentMethod || "",
        DiscountedPrice: discountPrice.toFixed(2),
        TotalPrice: totalPrice.toFixed(2),
      });

      // Calculate totals
      totalSales += totalPrice;
      totalDiscounts += discountPrice;
    });

    // Add summary row
    worksheet.addRow({});
    worksheet.addRow({
      OrderId: "Total Orders",
      TotalPrice: orders.length,
      DiscountPrice: "",
    });
    worksheet.addRow({
      OrderId: "Total Sales",
      TotalPrice: totalSales.toFixed(2),
      DiscountPrice: "",
    });
    worksheet.addRow({
      OrderId: "Total Discounts",
      TotalPrice: totalDiscounts.toFixed(2),
      DiscountPrice: "",
    });

    // Generate the Excel file as a buffer in memory
    const buffer = await workbook.xlsx.writeBuffer();

    // Set headers for file download
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Sales_Report_${reportType}.xlsx"`
    );

    // Send the buffer as a response for file download
    res.send(buffer);
  } catch (error) {
    console.error("Error creating Excel file:", error);
    res
      .status(500)
      .json({ error: "Error creating Excel file.", details: error.message });
  }
};

const chartData = async (req, res) => {
  try {
    // Best-Selling Products
    const bestSellingProducts = await Order.aggregate([
      { $unwind: "$Products" }, // Unwind the array of products in each order
      {
        $group: {
          _id: "$Products.ProductId", // Group by ProductId
          totalQuantity: { $sum: "$Products.Quantity" }, // Sum the quantities sold
        },
      },
      {
        $lookup: {
          from: "products", // Join with the Product collection
          localField: "_id", // ProductId from the orders
          foreignField: "_id", // _id in the Product collection
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" }, // Unwind the product details array
      {
        $project: {
          _id: 0,
          productName: "$productDetails.Name", // Get the product name
          totalQuantity: 1, // Include total quantity sold
        },
      },
      { $sort: { totalQuantity: -1 } }, // Sort by most sold
      { $limit: 5 }, // Limit to top 5
    ]);

    // Best-Selling Categories
    const bestSellingCategories = await Order.aggregate([
      { $unwind: "$Products" },
      {
        $lookup: {
          from: "products", // Join with the Product collection
          localField: "Products.ProductId",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" },
      {
        $lookup: {
          from: "categories", // Join with the Category collection
          localField: "productDetails.CategoryId", // Use CategoryId from the product
          foreignField: "_id",
          as: "categoryDetails",
        },
      },
      { $unwind: "$categoryDetails" },
      {
        $group: {
          _id: "$categoryDetails.name", // Group by category name
          totalQuantity: { $sum: "$Products.Quantity" }, // Sum quantities sold for each category
        },
      },
      { $sort: { totalQuantity: -1 } },
    ]);

    // Monthly Sales
    const monthlySales = await Order.aggregate([
      { $match: { Status: "Delivered" } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          totalSales: { $sum: "$TotalPrice" },
        },
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } },
      { $limit: 12 }, // Limit to the most recent 12 months
    ]);

    // Order Statuses
    const orderStatuses = await Order.aggregate([
      {
        $group: {
          _id: "$Status", // Group by order status
          count: { $sum: 1 }, // Count the number of orders per status
        },
      },
    ]);

    // Filter to only include the desired statuses
    const filteredStatuses = orderStatuses.filter((status) =>
      ["Delivered", "Cancelled", "Returned"].includes(status._id)
    );

    // Return the results
    res.json({
      bestSellingProducts,
      bestSellingCategories,
      monthlySales,
      orderStatuses: filteredStatuses,
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ error: "Error fetching sales data" });
  }
};

//export
module.exports = {
  loadLogin,
  loadDash,
  loadUsers,
  loadCategory,
  loadProducts,
  loadSignup,
  SignupUser,
  verifyLogin,
  userSearch,
  addProduct,
  addCategory,
  insertProduct,
  addProductLoadPage,
  insertCategory,
  deleteProduct,
  editProduct,
  loadProductEdit,
  postEditCategory,
  loadEditCategory,
  deleteCategory,
  blockUser,
  unblockUser,
  upload,
  logout,
  getOrders,
  orderDetails,
  cancelOrder,
  updateOrderStatus,
  returnOrder,
  getOffer,
  getAddOffer,
  addOffer,
  getEditOffer,
  updateOffer,
  deactivateOffer,
  activateOffer,
  deleteOffer,
  getCoupon,
  addCoupon,
  postAddCoupon,
  activateCoupon,
  deactivateCoupon,
  deleteCoupon,
  updateCoupon,
  getEditCoupon,
  generateSalesReportPDF,
  generateSalesReportExcel,
  chartData,
};
