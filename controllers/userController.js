const User = require("../models/userModel");
const Product = require("../models/productModel")
const Category = require("../models/categoryModel")
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const addressModel = require("../models/addressModel");
require('dotenv').config();


//to get home page
const loadHome = async (req, res) => {

    try {
        const categories = await Category.find({ isList: true });
        res.render('user/home', { categories })
    } catch (error) {
        console.log("the loadHome broke")
    }
}

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
        const totalProducts = await Product.countDocuments({ CategoryId: categoryId, Is_list: true });

        // Fetch products by category ID with pagination
        const products = await Product.find({ CategoryId: categoryId, Is_list: true })
            .skip(skip)
            .limit(limit)
            .populate('CategoryId');

        // Render the category products page with pagination info
        res.render('user/listProduct', {
            products,
            category,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit)
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading category products');
    }
};

// Controller to load product details
const loadProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id).populate('CategoryId');
        if (!product) {
            return res.status(404).send('Product not found');
        }
        res.render('user/productDetails', { product });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
};

//controller to get login page
const getLogin = async (req, res) => {

    try {
        res.render('user/userLogin', { message: "" })
    } catch (error) {
        console.log(" get login broke")

    }
}

//to post login page
const postLogin = async (req, res) => {
    const { Username, Password } = req.body;

    try {
        const user = await User.findOne({ Is_block: false, Is_verified: true, Username });
        if (!user) {
            return res.render('user/userLogin', { message: "Invalid username or password" });
        }

        // Check password if present
        if (user.Password) {
            const isMatch = await bcrypt.compare(Password, user.Password);
            if (!isMatch) {
                return res.render('user/userLogin', { message: "Invalid username or password" });
            }
        }

        // Successful login
        req.session.isLoggedIn = true;
        req.session.userId = user.id;
        res.redirect('/home');
    } catch (error) {
        console.error('Error in postLogin:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

//controller to get signup page
const getSigup = async (req, res) => {

    try {
        res.render('user/signup')
    } catch (error) {
        console.log(" get signup broke")

    }
}


//to post signup
const postSignup = async (req, res) => {
    const { Email, Username, Mobile ,Password } = req.body;
    console.log(`Received data - Email: ${Email}, Username: ${Username}, Mobile: ${Mobile}`);

    if (!Email || !Username) {
        return res.render('user/signup', { message: 'Email and Username are required' });
    }

    try {
        // Check if the email already exists
        let user = await User.findOne({ Email });
        if (user) {
            return res.render('user/signup', { message: 'Email already registered' });
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
            otpExpiresAt
        });

        await user.save();

        // Setup Nodemailer transporter
        const transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user: process.env.EMAIL_USER, // Your email
                pass: process.env.EMAIL_PASS  // Your email password or app-specific password
            },
            tls: {
                rejectUnauthorized: false // Ignore SSL certificate issues (useful for dev)
            }
        });

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER,  // Sender address
            to: Email,                     // Recipient's email
            subject: 'Your OTP Code',      // Email subject
            text: `Your OTP code is ${otp}. It is valid for 15 minutes.` // Email body
        };

        // Send OTP email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending OTP email:', error);
                return res.render('user/signup', { message: 'Failed to send OTP' });
            }

            // Set session and redirect to OTP verification page
            // req.session.isLoggedIn = true;
            req.session.userId = user._id;
            req.session.userEmail = Email;
            req.session.message = 'OTP sent to your email';

            res.redirect('/verify-otp');
        });
    } catch (error) {
        console.error('Error in postSignup:', error);
        res.render('user/signup', { message: 'Internal server error' });
    }
};

//to verify otp
const verifyOtp = async (req, res) => {
    const { OTP } = req.body;

    try {
        // Retrieve the email stored in the session
        const Email = req.session.userEmail;

        if (!Email) {
            return res.render("user/verifyOtp", { message: 'Session expired, please sign up again.' });
        }

        // Find the user by email
        const user = await User.findOne({ Email });

        if (!user) {
            return res.render("user/verifyOtp", { message: 'User not found' });
        }

        // Check if OTP is correct and not expired
        if (user.OTP !== OTP) {
            return res.render("user/verifyOtp", { message: 'Invalid OTP' });
        }

        if (user.otpExpiresAt < Date.now()) {
            return res.render("user/verifyOtp", { message: 'OTP has expired, please sign up again.' });
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
        res.redirect('/home');

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.render('verify-otp', { message: 'Internal server error' });
    }
};

//to get verifyOtp page 
const getVerifyOtp = async (req, res) => {

    try {
        res.render("user/verifyOtp", { message: '' })
    } catch (error) {
        console.log("verify otp page broke")

    }
}

//to logout 
const logout = (req, res) => {

    try {
        req.session.destroy();
        res.redirect('/');

    } catch (error) {
        console.log("logout is broke")

    }
};

//to get profile page


const getProfile = async (req, res) => {
    try {
        // // Check if userId is defined in the session
        // if (!req.session.userId) {
        //     return res.status(400).json({ message: "User not found or not authenticated." });
        // }

        // // Proceed with fetching the profile using the user's ID
         const userId = req.session.userId;

        // // Fetch user details based on the ID
         const user = await User.findById(userId);

        // if (!user) {
        //     return res.status(404).json({ message: "User not found." });
        // }

        // Render the user profile view and pass user data
        res.render('user/profile/userProfile', { user});
    } catch (error) {
        console.error("Unexpected error while fetching profile:", error);
        res.status(500).json({ message: "Server error while fetching profile." });
    }
};



// Edit profile
const editProfile = async (req, res) => {
    const { Username, Mobile } = req.body;
    try {
        await User.findByIdAndUpdate(req.session.userId, { Username, Mobile, UpdatedAt: new Date() });
        res.redirect('/profile');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



// Cancel order
const cancelOrder = async (req, res) => {
    try {
        await Order.findByIdAndUpdate(req.params.orderId, { status: 'Cancelled' });
        res.redirect('/profile/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

// Change password
const changePassword = async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    // Get the authenticated user's ID from the session
    const userId = req.session.userId;
    console.log(userId)


    try {
        // Fetch the user from the database
        const user = await User.findOne({ _id: userId });
        console.log(user.Password)
        console.log(user.Mobile)
        console.log(oldPassword)


        // Check if the user and password are defined
        if (!user || !user.Password) {
            console.log("User or user.Password not found.");
            return res.render('user/profile/userChangePass',{ message: 'User not found or password not set.' });
        }

        // Compare the provided old password with the stored hashed password
        const isMatch = await bcrypt.compare(oldPassword, user.Password);
        if (!isMatch) {
            return res.render('user/profile/userChangePass',{ message: 'Current password is incorrect' });
        }

        // Hash the new password before saving
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        user.Password = hashedNewPassword;
        await user.save();

        // Redirect back to profile on success
        res.redirect('/profile');
    } catch (err) {
        console.log("Error in changePassword:", err);
        res.render('user/profile/userChangePass',{ message: 'Server error' });
    }
};

// Add or edit address
const addAddress = async (req, res) => {
    const { FullName, MobileNo, FlatNo, Address, Landmark, Pincode, City, District, State, Country, AddressType } = req.body;
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
        AddressType
    });

    try {
        await newAddress.save();
        res.redirect('/profile/address'); // Redirect after adding
    } catch (error) {
        console.error('Error adding address:', error);
        res.status(500).send('Error adding address');
    }
};

//to edit the address
const editAddress = async (req, res) => {
    const { id } = req.params;
    const { FullName, MobileNo, FlatNo, Address, Landmark, Pincode, City, District, State, Country, AddressType } = req.body;

    try {
        await addressModel.findByIdAndUpdate(id, {
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
            AddressType
        }, { new: true });
        res.redirect('/profile/address'); // Redirect to profile page or wherever you need
    } catch (error) {
        console.error('Error editing address:', error);
        res.status(500).send('Error editing address');
    }
};

//to delete address
const deleteAddress = async (req, res) => {
    const { id } = req.params;

    try {
        await addressModel.findByIdAndDelete(id);
        res.redirect('/profile/address'); // Redirect to profile page or wherever you need
    } catch (error) {
        console.error('Error deleting address:', error);
        res.status(500).send('Error deleting address');
    }
};

//to get userAdresses in profile
const getUserAdresses = async(req,res)=>{
        const userId = req.session.userId;
        const addresses = await addressModel.find({UserId:userId});
    try {
        res.render('user/profile/userAddresses',{ addresses})
    } catch (error) {
        console.log("get user Addresses broke")
    }
}

//to get userOrder in profile page
const getUserOrders = async(req,res)=>{

    try {
        res.render('user/profile/userOrder')
    } catch (error) {
        console.log("get user order broke")
    }
}

//to get user cahnge password in profile page
const getUserPass = async(req,res)=>{

    try {
        res.render('user/profile/userChangePass',{ message: ''})
    } catch (error) {
        console.log("get user change pass broke")
    }
}

//to get profile edit
const getProfileEdit = async(req,res)=>{
        // // Proceed with fetching the profile using the user's ID
        const userId = req.session.userId;

        // // Fetch user details based on the ID
         const user = await User.findById(userId);
    try {
        res.render("user/profile/profileEdit",{ user , message:'' })
    } catch (error) {
        console.log("the get profile is broke")
        
    }
}


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
    getProfileEdit

}