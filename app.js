const express = require("express");
const path = require("path");
const logger = require("morgan");
const cookieParser = require("cookie-parser");

const app = express();

// View Engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

// Middleware
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static Folder
app.use(express.static(path.join(__dirname, "public")));

// Test Route
app.get("/", (req, res) => {
    res.render("home/index", {
        title: "NDUKA",
        message: "Welcome to NDUKA"
    });
});

module.exports = app;