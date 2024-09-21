//connect to mongodb
const mongoose = require("mongoose")
mongoose.connect("mongodb://127.0.0.1:27017/Kenza")

//declarations
const express = require("express")
const app = express();
const session = require("express-session");
const passport = require("passport")

//session
const Config = require("./config/passport")
app.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Use true if using HTTPS
  }));
  
  app.use(passport.initialize());
  app.use(passport.session());

  // Middleware to disable cache for sensitive routes
const nocache = (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
};

// Apply cache control for sensitive routes
app.use(['/', '/home' ,'/admin','/admin/dash'], nocache);



//declare body parser
const bodyParser = require("body-parser");
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({extended:true}))

//set view engine
app.set('view engine','ejs')
app.set('views','/views')  

//to access public
app.use(express.static('public'))



// admin route
const adminRoute = require("./routes/adminRoute")
app.use('/admin',adminRoute)

//user route
const userRoute = require("./routes/userRoute")
app.use('/',userRoute)


app.listen(3000)