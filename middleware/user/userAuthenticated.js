const userAuthenticated = (req, res, next) => {
  if (req.session && req.session.isLoggedIn) {
    return res.redirect("/home"); // Redirect to home if already logged in
  }
  next(); // Proceed to the login page if not logged in
};

module.exports = userAuthenticated;
