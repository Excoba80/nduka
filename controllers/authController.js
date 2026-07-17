
const AuthService = require("../services/authService");

exports.register = async (req, res, next) => {

    try {

        const user = await AuthService.register(req.body);

        res.status(201).json(user);

    } catch (err) {

        next(err);

    }

};

