require('dotenv').config();
const express = require("express");
const path = require("path");
const logger = require("morgan");
const cookieParser = require("cookie-parser");

const indexRouter = require("./routes/index");

const app = express();

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(express.static(path.join(__dirname, "public")));


app.use("/", indexRouter);

// Catch 404
app.use((req, res, next) => {
    const err = new Error("Page Not Found");
    err.status = 404;
    next(err);
});


// Global Error Handler
app.use((err, req, res, next) => {
    res.status(err.status || 500);

    res.render("error", {
        message: err.message,
        status: err.status || 500,
        error: req.app.get("env") === "development" ? err : {}
    });
});

module.exports = app;