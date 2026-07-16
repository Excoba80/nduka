exports.showRegister = (req, res) => {

    res.render("auth/register");

};

exports.register = (req, res) => {

    res.send("Registration Successful");

};