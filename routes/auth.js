
const express = require("express");
const router = express.Router();

const { body } = require("express-validator");

const authController = require("../controllers/authController");

router.post(

    "/register",

    [
        body("name")
            .trim()
            .notEmpty()
            .withMessage("Name is required"),

        body("email")
            .isEmail()
            .withMessage("Enter a valid email"),

        body("password")
            .isLength({ min: 8 })
            .withMessage("Password must be at least 8 characters")
    ],

    authController.register

);

module.exports = router;