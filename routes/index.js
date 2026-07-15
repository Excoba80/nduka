const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
    res.render("home/index", {
        title: "NDUKA",
        message: "Welcome to NDUKA"
    });
});

module.exports = router;