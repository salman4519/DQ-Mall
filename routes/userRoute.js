const express = require("express")
const userRoute = express();
const passport = require('passport');

//to connect user controller
const userController = require("../controllers/userController")

//import usermodel
const UserModel = require("../models/userModel")

// Import middleware Auth
const userAuth = require('../middleware/user/userAuth');
const userAuthed = require('../middleware/user/userAuthenticated')

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
userRoute.get('/login',userAuthed,userController.getLogin)
userRoute.post('/login',userController.postLogin)

//route for verify otp page
userRoute.get('/verify-otp',userAuthed,userController.getVerifyOtp)
userRoute.post('/verify-otp', userController.verifyOtp);


//route for signup page
userRoute.get('/signup',userAuthed,userController.getSigup)
userRoute.post('/signup',userController.postSignup)
userRoute.post('/verify-otp', userController.verifyOtp);

//route for land page
userRoute.get('/',userAuthed,userController.getLandPage)

//route for home page
userRoute.get('/home',userAuth,userController.loadHome)

// route for category shop page
userRoute.get('/category/:id/products',userAuth, userController.loadCategoryProducts);

// Route to load product details page
userRoute.get('/product/:id',userAuth, userController.loadProductDetails);

// Get user profile
userRoute.get('/profile',userAuth, userController.getProfile);

// Edit user profile
userRoute.post('/profile/edit',userAuth, userController.editProfile);
userRoute.get('/profile/edit',userAuth, userController.getProfileEdit);


// View user orders
userRoute.get('/profile/orders',userAuth, userController.getUserOrders);

// Cancel order
userRoute.post('/cancel-order', userController.cancelOrder);
userRoute.post('/return-order', userController.returnOrder);



// Add or edit address
userRoute.post('/profile/address/edit/:id', userController.editAddress);
userRoute.post('/profile/address/add', userController.addAddress);
userRoute.get('/profile/address',userAuth, userController.getUserAdresses);

//to delete address
userRoute.post('/profile/address/delete/:id', userController.deleteAddress);



// Change password
userRoute.post('/profile/change-password', userController.changePassword);
userRoute.get('/profile/change-password',userAuth, userController.getUserPass);



//route to logout
userRoute.get('/logout',userAuth,userController.logout)

//route for cart
userRoute.get('/cart',userAuth,userController.getCart)
userRoute.post('/cart/update',userAuth,userController.updateCart)
userRoute.post('/cart/remove',userAuth,userController.removeCart)
userRoute.post('/cart/add',userAuth,userController.addCart)

//route for chekout page
userRoute.get('/checkout',userAuth,userController.getCheckout)
userRoute.post('/checkout',userAuth,userController.postCheckout)
userRoute.post('/checkout/address/edit/:id', userController.editAddressCheck);
userRoute.post('/checkout/address/add', userController.addAddressCheck);
userRoute.post('/checkout/address/delete/:id', userController.deleteAddressCheck);
userRoute.post('/order',userController.postOrder)
userRoute.post('/create-order', userController.createRazorpayOrder);
userRoute.post('/verify-payment', userController.verifyPaymentAndSaveOrder);

userRoute.delete('/cart/:productId', userController.deleteCartItem);
userRoute.get('/success',userAuth,userController.getSuccess)

//route for shop 
userRoute.get('/shop',userAuth,userController.getShop)
userRoute.get('/load-items',userAuth,userController.loadShopItems)
userRoute.get('/load-categories',userAuth, userController.shopCategoryItems);


//routes for wishlist
userRoute.get('/wishlist',userAuth,userController.loadWishlist);
userRoute.post('/wishlist/add', userController.addProductToWishlist);
userRoute.post('/wishlist/remove', userController.removeProductFromWishlist);










//export
module.exports = userRoute;