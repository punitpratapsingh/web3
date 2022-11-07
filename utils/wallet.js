const { ETH } = require("../config/config");
const axios = require("axios");

module.exports.getTxDataData = (address, tokenAddress, price) => {
    return new Promise(async (resolve) => {
        axios
            .get(
                `${ETH.SCAN_URL}/api?module=account&action=tokentx&address=${address}&contractaddress=${tokenAddress}&startblock=15680501&endblock=${ETH.END_BLOCK}&page=1&offset=1000&sort=asc&apikey=${ETH.SCAN_API_KEY}`,
            )
            .then(async function (response) {
                let sendData = [];
                response.data.result.forEach((element) => {
                    if (element.from.toLowerCase() == address.toLowerCase()) {
                        sendData.push({
                            time: parseFloat(element.timeStamp),
                            symbol: element.tokenSymbol,
                            quantity:
                                element.value / 10 ** element.tokenDecimal,
                            amount:
                                (element.value / 10 ** element.tokenDecimal) *
                                price,
                        });
                    } else if (
                        element.to.toLowerCase() == address.toLowerCase()
                    ) {
                        sendData.push({
                            time: parseFloat(element.timeStamp),
                            symbol: element.tokenSymbol,
                            quantity:
                                -element.value / 10 ** element.tokenDecimal,
                            amount:
                                -(element.value / 10 ** element.tokenDecimal) *
                                price,
                        });
                    }
                });
                resolve(sendData);
            })
            .catch(function (error) {
                console.log("%c Line:14 🍋 error", "color:#4fff4B", error);
                console.log(error);
                resolve([]);
            });
    });
};

module.exports.getTokenPrice = (symbol) => {
    return new Promise(async (resolve) => {
        axios
            .get(
                `https://min-api.cryptocompare.com/data/price?fsym=${symbol}&tsyms=USD`,
            )
            .then(async function (response) {
                resolve(response.data.USD);
            })
            .catch(function (error) {
                console.log("%c Line:14 🍋 error", "color:#4fff4B", error);
                console.log(error);
                resolve([]);
            });
    });
};
