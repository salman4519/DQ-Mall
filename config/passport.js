const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const UserModel = require('../models/userModel'); // Adjust path as necessary
require('dotenv').config();


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user exists in database
        let user = await UserModel.findOne({ GoogleId: profile.id });
        if (!user) {
            // Create new user if not exists
            user = new UserModel({
                GoogleId: profile.id,
                Username: profile.displayName,
                Email: profile.emails[0].value, // Save email from Google profile
                Is_verified: true
            });
            await user.save();
        }
        done(null, user);
    } catch (error) {
        done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user._id); // Store user ID in session
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await UserModel.findById(id);
        done(null, user); // Restore user from stored ID
    } catch (error) {
        done(error, null);
    }
});