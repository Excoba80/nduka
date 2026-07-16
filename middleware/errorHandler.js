


// Global Error Handler
module.exports = (err, req, res, next) => {

    res.status(err.status || 500);

    res.render("error", {
        message: err.message,
        status: err.status || 500,
        error: req.app.get("env") === "development" ? err : {}
    }
)}