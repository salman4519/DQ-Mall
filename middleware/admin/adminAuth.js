const adminAuth = (req, res, next) => {
  if (req.session && req.session.isAdminLoggedIn) {
    return next();
  }
  res.redirect("/admin"); // Redirect to admin login if not authenticated
};

module.exports = adminAuth;
