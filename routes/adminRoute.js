//declaration
const express = require("express");
const adminRoute = express();

//connecting admin controller
const adminController = require("../controllers/adminController");

//import middleware Auth
const adminAuth = require("../middleware/admin/adminAuth");
const adminAuthed = require("../middleware/admin/adminAuthenticated");

//route for admin login page
adminRoute.get("/", adminAuthed, adminController.loadLogin);
adminRoute.post("/", adminController.verifyLogin);

//route for admin signup  page
// adminRoute.get('/signup',adminAuthed,adminController.loadSignup)
// adminRoute.post('/signup',adminController.SignupUser)

//route for admin dashboard page
adminRoute.get("/dash", adminAuth, adminController.loadDash);

//route for users page
adminRoute.get("/users", adminAuth, adminController.loadUsers);
adminRoute.get("/users/search", adminController.userSearch);

//route for products page
adminRoute.get("/products", adminAuth, adminController.loadProducts);

//route for add product page
adminRoute.get("/products/add", adminAuth, adminController.addProduct);
adminRoute.post(
  "/products/add",
  adminController.upload.fields([
    { name: "image1" },
    { name: "image2" },
    { name: "image3" },
  ]),
  adminController.insertProduct
);

//route for edit product page
adminRoute.get(
  "/products/edit/:id",
  adminAuth,
  adminController.loadProductEdit
);
adminRoute.post(
  "/products/update/:id",
  adminController.upload.fields([
    { name: "image1" },
    { name: "image2" },
    { name: "image3" },
  ]),
  adminController.editProduct
);

//route for delete product
adminRoute.get(
  "/products/delete/:id",
  adminAuth,
  adminController.deleteProduct
);

//route for category
adminRoute.get("/category", adminAuth, adminController.loadCategory);

//route for add category page
adminRoute.get("/category/add", adminAuth, adminController.addCategory);
adminRoute.post(
  "/category/add",
  adminController.upload.single("image"),
  adminController.insertCategory
);

//route for edit category page
adminRoute.get(
  "/categories/edit/:id",
  adminAuth,
  adminController.loadEditCategory
);
adminRoute.post(
  "/categories/edit/:id",
  adminController.upload.single("image"),
  adminController.postEditCategory
);

//route for delete category
adminRoute.get(
  "/categories/delete/:id",
  adminAuth,
  adminController.deleteCategory
);

//to block and unblock user
adminRoute.post("/users/block/:userId", adminController.blockUser);
adminRoute.post("/users/unblock/:userId", adminController.unblockUser);

//route for orders
adminRoute.get("/orders", adminAuth, adminController.getOrders);
adminRoute.get(
  "/order-details/:orderId",
  adminAuth,
  adminController.orderDetails
);
adminRoute.post("/cancel-order", adminController.cancelOrder);
adminRoute.post("/return-order", adminController.returnOrder);
adminRoute.post("/update-order-status", adminController.updateOrderStatus);

//route for offers
adminRoute.get("/offers", adminAuth, adminController.getOffer);
adminRoute.get("/offers/add", adminAuth, adminController.getAddOffer);
adminRoute.get(
  "/offers/edit/:offerId",
  adminAuth,
  adminController.getEditOffer
);
adminRoute.post("/offers/edit/:id", adminController.updateOffer);
adminRoute.post("/offers/deactivate/:id", adminController.deactivateOffer);
adminRoute.post("/offers/activate/:id", adminController.activateOffer);
adminRoute.post("/add-offer", adminController.addOffer);
adminRoute.post("/offers/delete/:id", adminController.deleteOffer);

//route for coupon
adminRoute.get("/coupon", adminAuth, adminController.getCoupon);
adminRoute.get("/coupon/add", adminAuth, adminController.addCoupon);
adminRoute.post("/coupon/add", adminAuth, adminController.postAddCoupon);
adminRoute.post("/coupons/activate/:id", adminController.activateCoupon);
adminRoute.post("/coupons/deactivate/:id", adminController.deactivateCoupon);
adminRoute.post("/coupons/delete/:id", adminController.deleteCoupon);
adminRoute.post("/coupons/update/:id", adminController.updateCoupon);
adminRoute.get("/coupons/edit/:id", adminAuth, adminController.getEditCoupon);

adminRoute.post(
  "/download-sales-report",
  adminController.generateSalesReportPDF
);
adminRoute.post(
  "/download-sales-report-excel",
  adminController.generateSalesReportExcel
);
adminRoute.get("/sales-data", adminAuth, adminController.chartData);

//route for logout
adminRoute.get("/logout", adminController.logout);

//export
module.exports = adminRoute;
