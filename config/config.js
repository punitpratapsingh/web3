require("dotenv").config();

const config = {
    PORT: process.env.PORT,

    ETH: {
        SCAN_URL: "https://api.etherscan.io/",
        SCAN_API_KEY: "1HURYHP63RWG6BA1K976H8PC1TNC37NIUH",
        END_BLOCK: 9999999999,
    },
};

module.exports = config;
