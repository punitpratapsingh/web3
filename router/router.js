const express = require("express");
const router = express.Router();

const portFolioController = require("../controller/portfolio.controller");

router.get("/portfolio", portFolioController.getUserPortfolio);

module.exports = router;
