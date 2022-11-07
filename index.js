const express = require("express");

const cors = require("cors");
const fileUpload = require("express-fileupload");

const serverless = require("serverless-http");
const router = require("./router/router");
const config = require("./config/config");
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(fileUpload());

app.use("/", router);

//custom 404 page
app.use(function (req, res) {
    res.type("text/plain");
    res.status(404);
    res.send({ success: false, message: "404 Not Found" });
});

app.use(function (err, req, res, next) {
    res.type("text/plain");
    res.status(500);
    res.json({ success: false, message: "500 Server Error", data: err.stack });
    next(err);
});

module.exports.serverless = serverless(app);

// app.listen(config.PORT, () => {
//     console.log(`App running on http://localhost:${config.PORT}`);
// });
