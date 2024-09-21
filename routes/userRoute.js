const express = require("express")
const userRoute = express();
const passport = require('passport');

//to connect user controller
const userController = require("../controllers/userController")

//import usermodel
const UserModel = require("../models/userModel")

// Import middleware Auth
const userAuth = require('../middleware/userAuth');
const userAuthed = require('../middleware/userAuthenticated')

//route for google authentication
userRoute.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email']
}));

userRoute.get('/auth/google/callback', 
    passport.authenticate('google', { session: true }), // Ensure session is handled
    async (req, res) => {
        try {
            // After successful authentication, the user is in req.user
            req.session.isLoggedIn = true; // Set session flag
            req.session.userId = req.user._id; // Save user ID
            
            // Optionally update user status if needed
            await UserModel.findByIdAndUpdate(req.user._id, { is_verified: true });

            res.redirect('/home'); // Redirect to a secure page
        } catch (error) {
            console.error('Error during Google callback:', error);
            res.redirect('/'); // Redirect to an error page or handle it as needed
        }
    }
);

//route for login page
userRoute.get('/',userAuthed,userController.getLogin)
userRoute.post('/',userController.postLogin)

//route for verify otp page
userRoute.get('/verify-otp',userAuthed,userController.getVerifyOtp)
userRoute.post('/verify-otp', userController.verifyOtp);


//route for signup page
userRoute.get('/signup',userAuthed,userController.getSigup)
userRoute.post('/signup',userController.postSignup)
userRoute.post('/verify-otp', userController.verifyOtp);

//route for home page
userRoute.get('/home',userAuth,userController.loadHome)

// route for category shop page
userRoute.get('/category/:id/products',userAuth, userController.loadCategoryProducts);

// Route to load product details page
userRoute.get('/product/:id',userAuth, userController.loadProductDetails);

//route to logout
userRoute.get('/logout',userAuth,userController.logout)

//export
module.exports = userRoute;