const User = require("../models/userModel");
const Product = require("../models/productModel")
const Category = require("../models/categoryModel")
const otpGenerator = require('otp-generator');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
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
    const { Email, Username, Mobile } = req.body;
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

        // Create new user
        user = new User({
            Email,
            Username,
            Mobile,
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
    logout
}