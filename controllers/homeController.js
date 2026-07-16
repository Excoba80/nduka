const config = require("../config/app");

exports.index = async (req, res) => {
    res.render("home/index", {
        title: config.appName,
        message: "Welcome to NDUKA FROM CONFIG"
    });
};