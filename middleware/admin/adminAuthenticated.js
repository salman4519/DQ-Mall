const adminAuthenticated = (req, res, next) => {
  if (req.session && req.session.isAdminLoggedIn) {
    return res.redirect("/admin/dash"); // Redirect to dashboard if already logged in
  }
  next(); // Proceed to the admin login page if not logged in
};

module.exports = adminAuthenticated;
