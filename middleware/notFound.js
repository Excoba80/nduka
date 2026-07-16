
// Catch 404
module.exports = (req, res, next) => {
    const err = new Error("Page Not Found");
    err.status = 404;
    next(err);
}