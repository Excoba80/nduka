exports.index = async (req, res) => {
    res.render("home/index", {
        title: "NDUKA",
        message: "Welcome to NDUKA"
    });
};