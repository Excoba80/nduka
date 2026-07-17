require('dotenv').config();
const express = require("express");
const path = require("path");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const indexRouter = require("./routes/index");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const authRouter = require("./routes/auth");



const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,

    cookie: {
        maxAge: 1000 * 60 * 60
    }
}));

app.use(express.static(path.join(__dirname, "public")));

// routes
app.use("/", indexRouter);
app.use("/auth", authRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);


module.exports = app;