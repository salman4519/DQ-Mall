
const model = require("../models/userModel")
const Product = require("../models/productModel")
const Category = require("../models/categoryModel")
const Order = require("../models/orderModel")
const bcrypt = require("bcrypt")
const path = require('path')
const fs = require('fs')
const multer = require('multer')

//load admin login
const loadLogin = async (req,res)=>{

try {
    res.render('admin/adminLogin',{message:""})
} catch (error) {
    console.log("login page broke")
}
}


//load admin signup
const loadSignup = async (req,res)=>{

    try {
        res.render('admin/signup',{message:""})
    } catch (error) {
        console.log("signup page broke")
    }
    }

// bcrpt password
const securePassword = async(password)=>{

    try {
        return bcrypt.hash(password ,10);
    } catch (error) {
        console.log(error)
        
    }
}

//insert user
const SignupUser = async (req,res)=>{

    try {
        const spassword = await securePassword(req.body.password)
        const user = new model({
            Username:req.body.username,
            Email:req.body.email,
            Mobile:req.body.mobile,
            Password:spassword
        })
        const result = await user.save()
        if(result){
            res.render("admin/signup",{message:"Registered successfully"})
        }
    } catch (error) {
        console.log(error)
    }
}

//verify login
const verifyLogin = async (req, res) => {
    try {
        const { username, password } = req.body;
        // Find the user by username and check if they are an admin
        const userData = await model.findOne({ Is_admin: true, Username: username });

        if (userData) {
            // Compare the provided password with the hashed password stored in the database
            const isPasswordMatch = await bcrypt.compare(password, userData.Password);

            if (isPasswordMatch) {
                // Password matches, set session and redirect to admin dashboard
                req.session.isAdminLoggedIn = true; // Set session flag
                req.session.adminId = userData._id; // Save admin ID or other info
                res.redirect('/admin/dash');
            } else {
                // Password does not match
                res.render('admin/adminLogin', { message: 'Invalid Username or Password' });
            }
        } else {
            // User not found
            res.render('admin/adminLogin', { message: 'Invalid Username or Password' });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal Server Error');
    }
};

//load admin dashboard
const loadDash = async (req,res)=>{

    try {
        const categories = await Category.find();
        res.render('admin/demo',{ categories })
    } catch (error){
        console.log("dash post broke")
        
    }
}

//load user management page
const loadUsers = async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 5; // Number of users per page
    const skip = (page - 1) * limit; // Calculate how many users to skip
    
    try {
      const users = await model.find({Is_admin:false,Is_verified:true }).skip(skip).limit(limit);
      const totalUsers = await model.countDocuments(); // Get the total number of users
  
      res.render('admin/users', {
        users,
        currentPage: page,
        totalPages: Math.ceil(totalUsers / limit)
      });
    } catch (err) {
      res.status(500).send(err);
    }
  };

// search user
const userSearch = async (req,res)=>{
    const search = req.query.search;

    try {
        const users = await model.find({
            isAdmin:false,$or : [
                {username: new RegExp(`^${search}`,'i')}
            ]
        });

        res.render('admin/users',{users})
    } catch (error) {
        console.log("user search broke")
    }
}

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
                                      .populate('CategoryId');
        
        // Fetch total count for pagination, filtered by Is_list
        const totalProducts = await Product.countDocuments({ Is_list: true });
  
        res.render('admin/products', {
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            limit
        });
    } catch (error) {
        console.error("Error loading products:", error);
        res.status(500).send("Error loading products");
    }
};

//to load add product page
const addProduct = async (req, res) => {
    try {
        const categories = await Category.find();
        res.render('admin/addProduct', { categories });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Error fetching categories" });
    }
};


//insert user
const addProductLoadPage = async(req,res)=>{
    try {
        const categories = await Category.find();
        const admin = await User.findById(req.session.user_id);
        res.render('addProductPage',{admin,categories})
    } catch (error) {
        console.log(error.message);
    }
}

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../public/uploads');
        cb(null, uploadPath);

    },
    filename: function (req, file, cb) {
      cb(null, Date.now() + path.extname(file.originalname));  // Create a unique filename
    }
  });
  
  const upload = multer({ storage: storage });
  
  // Add product controller
  const insertProduct = async (req, res) => {
    try {
        const { name, size, description, categoryId, quantity, price } = req.body;
        const images = [req.files.image1[0].filename, req.files.image2[0].filename, req.files.image3[0].filename];

        if (!name || !size || !description || !categoryId || !quantity || !price || images.length < 3) {
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
            Is_list: true
        });

        await product.save();
        res.redirect('/admin/products'); // Redirect to the product list page or another relevant page
    } catch (error) {
        console.error("Error adding product:", error);
        res.status(500).json({ message: "Error adding product", error: error.message });
    }
};

// to load the product edit page
const loadProductEdit = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('CategoryId');
        const categories = await Category.find();

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // console.log("Product Data:", product); // Add this line to debug

        res.render('admin/productEdit', { product, categories });
    } catch (error) {
        console.error("Error loading product for edit:", error);
        res.status(500).json({ message: "Error loading product", error: error.message });
    }
};

//to make the changes in product edit page
const editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const { name, size, price, description, categoryId, quantity } = req.body;

        // Find the product by ID
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Handle image uploads if they are provided
        let images = [...product.Images]; // Copy existing images

        if (req.files) {
            const files = ['image1', 'image2', 'image3'];

            files.forEach((fileKey, index) => {
                if (req.files[fileKey] && req.files[fileKey][0]) {
                    // Update image URL in the images array
                    images[index] = req.files[fileKey][0].filename; // Store only the filename
                }
            });
        }

        // Update product details
        await Product.findByIdAndUpdate(productId, {
            Name:name,
            Size:size,
            Price:price,
            Description:description,
            CategoryId:categoryId,
            Quantity:quantity,
            Images: images // Update with new or existing image filenames
        });

        // Redirect to products list or any other page
        res.redirect('/admin/products');
    } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ message: "Error updating product", error: error.message });
    }
};

// to delete the the product
const deleteProduct  = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId);

        if (!product) {
            return res.status(404).send('Product not found');
        }

        // Set Is_list to false to hide the product
        await Product.findByIdAndUpdate(productId, { Is_list: false });

        res.redirect('/admin/products');
    } catch (error) {
        console.error("Error hiding product:", error);
        res.status(500).send('Server error');
    }
};




//load category page
const loadCategory = async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 5; // Number of categories per page
    const skip = (page - 1) * limit; // Calculate how many categories to skip
    
    try {
      // Filter out categories with isSpecialCategory: true or other conditions
      const categories = await Category.find({isList:true}) // Adjust filtering condition
        .skip(skip)
        .limit(limit);
      
      const totalCategories = await Category.countDocuments(); // Count total categories excluding special ones
  
      res.render('admin/category', {
        categories,
        currentPage: page,
        totalPages: Math.ceil(totalCategories / limit)
      });
    } catch (err) {
      res.status(500).send(err);
    }
  };


const addCategory = async(req,res)=>{

    try {
        res.render('admin/addCategory',{message:""})
        
    } catch (error) {
        console.log("add Category broke")
        
    }
}

 // Controller method to handle category addition
const insertCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        if (!name) {
            return res.render('admin/addCategory',{ message: "Category name is required." });
        }

        // Create a new category
        const newCategory = new Category({
            name: name,
            imageUrl: image,  // Save the image URL if an image is provided
            createdAt: new Date(),
            updatedAt: new Date(),
            isList: true
        });

        await newCategory.save();

        res.redirect('/admin/category'); // Redirect to category list or success page
    } catch (error) {
        console.error('Error adding category:', error);
        res.render('admin/addCategory',{ message: "Error adding category", error });
    }
};

// to load edit category
const loadEditCategory = async (req, res) => {
    try {
      const category = await Category.findById(req.params.id);
      const message = ""
      res.render('admin/editCategory', {category });
    } catch (error) {
      console.error(error);
      res.status(500).send('Server Error');
    }
  };

  // to update the edit category
  const postEditCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const image = req.file ? `/uploads/${req.file.filename}` : null;

        // if (!name) {
        //     return res.status(400).json({ message: "Category name is required." });
        // }

        // Find the category by ID
        const category = await Category.findById(id);

        if (!category) {
            res.render('admin/editCategory',{ message: "Category not found." ,category });
        }

        // Update category fields
        category.name = name;
        if (image) {
            category.imageUrl = image; // Update the image URL if a new image is provided
        }
        category.updatedAt = new Date();

        await category.save();

        res.redirect('/admin/category'); // Redirect to category list or success page
    } catch (error) {
        console.error('Error updating category:', error);
        res.render('admin/editCategory',{ message: "Error updating category", error });
    }
};

  // to delete category 
  const deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        // Find the category by ID and update Is_list to false
        const category = await Category.findByIdAndUpdate(categoryId, { isList: false }, { new: true });

        if (!category) {
            return res.status(404).send('Category not found');
        }

        // Redirect to the categories list page or any other page
        res.redirect('/admin/category');
    } catch (error) {
        console.error("Error hiding category:", error);
        res.status(500).json({ message: "Error hiding category", error: error.message });
    }
};

  //to block user
  const blockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        await model.findByIdAndUpdate(userId, { Is_block: true });
        res.redirect('/admin/users'); // Redirect back to the user management page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

//to unblock user
const unblockUser = async (req, res) => {
    try {
        const { userId } = req.params;
        await model.findByIdAndUpdate(userId, { Is_block: false });
        res.redirect('/admin/users'); // Redirect back to the user management page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server Error');
    }
};

//for logout
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.redirect('/admin');
    });
};

//to get orders 
const getOrders = async(req,res)=>{
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = 5; // Number of categories per page
    const skip = (page - 1) * limit; // Calculate how many categories to skip

        const orders = await Order.find({}).skip(skip).limit(limit)
        const totalOrders = await Order.countDocuments(); 

    try {
        res.render("admin/orders",{ 
            orders ,
            currentPage: page,
            totalPages: Math.ceil(totalOrders / limit)
          });
    } catch (error) {
        
    }
}

const orderDetails = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        console.log('Fetching order details for OrderId:', orderId);
        const order = await Order.findOne({ OrderId: orderId })
            .populate('Products.ProductId')  // Assuming ProductId is a reference to a Product model
            .populate('ShippingAddress');      // Assuming ShippingAddress is a reference to an Address model

        if (!order) {
            console.log('Order not found for OrderId:', orderId);
            return res.status(404).json({ message: 'Order not found' });
        }

        // Format the order details to include product and address details
        const orderDetails = {
            PaymentMethod:order.PaymentMethod,
            OrderId: order.OrderId,
            TotalPrice: order.TotalPrice,
            Status: order.Status,
            Products: order.Products.map(item => ({
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
            }
        };

        console.log(orderDetails);
        res.json(orderDetails);
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).json({ message: 'Failed to load order details' });
    }
};

const fetchOrderDetails = async (orderId) => {
    try {
        const response = await fetch(`/order-details/${orderId}`);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const orderData = await response.json();
        // Handle order data (e.g., display it in your UI)
    } catch (error) {
        console.error('Error fetching order details:', error);
        // Display error message to user
    }
};

const cancelOrder = async (req, res) => {
    const { orderId } = req.body;
  
    try {
      // Find the order by ID
      const order = await Order.findOne({ OrderId: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Check if the status can be updated
      if (order.Status === 'Cancelled' || order.Status === 'Delivered') {
        return res.status(400).json({ message: 'Cannot cancel this order' });
      }
  
      // Update the order status to 'Cancelled'
      order.Status = 'Cancelled';
      await order.save();
  
      res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };

  const updateOrderStatus = async (req, res) => {
    const { orderId, newStatus } = req.body;
  
    try {
      // Find the order by ID
      const order = await Order.findOne({ OrderId: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Check if the status can be updated
      if (order.Status === 'Delivered' || order.Status === 'Cancelled') {
        return res.status(400).json({ message: 'Cannot update this order' });
      }
  
      // Update the order status
      order.Status = newStatus;
      await order.save();
  
      res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  };
  
  // Controller function to cancel an order
  exports.cancelOrder = async (req, res) => {
    const { orderId } = req.body;
  
    try {
      // Find the order by ID
      const order = await Order.findOne({ OrderId: orderId });
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Check if the status can be updated
      if (order.Status === 'Cancelled' || order.Status === 'Delivered') {
        return res.status(400).json({ message: 'Cannot cancel this order' });
      }
  
      // Update the order status to 'Cancelled'
      order.Status = 'Cancelled';
      await order.save();
  
      res.status(200).json({ message: 'Order status updated successfully', order });
    } catch (error) {
      console.error('Error updating order status:', error);
      res.status(500).json({ message: 'Internal server error' });
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
    updateOrderStatus
    

}
    
