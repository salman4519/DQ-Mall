//declaration
const express = require("express")
const adminRoute = express();

//connecting admin controller
const adminController = require("../controllers/adminController")

//import middleware Auth
const adminAuth = require("../middleware/admin/adminAuth")
const adminAuthed = require("../middleware/admin/adminAuthenticated")

//route for admin login page
adminRoute.get('/',adminAuthed,adminController.loadLogin)
adminRoute.post('/',adminController.verifyLogin)

//route for admin signup  page
// adminRoute.get('/signup',adminAuthed,adminController.loadSignup)
// adminRoute.post('/signup',adminController.SignupUser)

//route for admin dashboard page
adminRoute.get('/dash',adminAuth,adminController.loadDash)

//route for users page
adminRoute.get('/users',adminAuth,adminController.loadUsers)
adminRoute.get('/users/search',adminController.userSearch)

//route for products page
adminRoute.get('/products',adminAuth,adminController.loadProducts)

//route for add product page
adminRoute.get('/products/add',adminAuth,adminController.addProduct)
adminRoute.post('/products/add', adminController. upload.fields([{ name: 'image1' }, { name: 'image2' }, { name: 'image3' }]), adminController.insertProduct);

//route for edit product page
adminRoute.get('/products/edit/:id',adminAuth,adminController.loadProductEdit)
adminRoute.post('/products/update/:id',adminController.upload.fields([{ name: 'image1' }, { name: 'image2' }, { name: 'image3' }]),adminController.editProduct)

//route for delete product
adminRoute.get('/products/delete/:id',adminAuth,adminController.deleteProduct)

//route for category
adminRoute.get('/category',adminAuth,adminController.loadCategory)

//route for add category page
adminRoute.get('/category/add',adminAuth,adminController.addCategory)
adminRoute.post('/category/add',adminController.upload.single('image'),adminController.insertCategory)

//route for edit category page
adminRoute.get('/categories/edit/:id',adminAuth, adminController.loadEditCategory);
adminRoute.post('/categories/edit/:id',adminController.upload.single('image'),adminController.postEditCategory);

//route for delete category
adminRoute.get('/categories/delete/:id',adminAuth, adminController.deleteCategory);

//to block and unblock user
adminRoute.post('/users/block/:userId',adminController.blockUser);
adminRoute.post('/users/unblock/:userId',adminController.unblockUser)

//route for orders
adminRoute.get('/orders',adminAuth,adminController.getOrders)
adminRoute.get('/order-details/:orderId',adminAuth,adminController.orderDetails)
adminRoute.post('/cancel-order',adminController.cancelOrder)
adminRoute.post('/update-order-status',adminController.updateOrderStatus)

//route for logout 
adminRoute.get('/logout',adminController.logout)



//export
module.exports = adminRoute;