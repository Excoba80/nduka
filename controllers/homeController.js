

const User = require("../models/User");

exports.index = async (req, res, next) => {

    try {

        const users = await User.findAll();

        res.render("home/index", {
            title: "NDUKA",
            users
        });

    } catch (err) {

        next(err);

    }

};