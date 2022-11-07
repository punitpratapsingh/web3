const TokenAddress = require("../config/wallet.json");
const { getTxDataData, getTokenPrice } = require("../utils/wallet");
const async = require("async");
const json2csv = require("json2csv").parseAsync;

module.exports.getUserPortfolio = async (req, res, next) => {
    const { address } = req.query;
    console.log("%c Line:6 🥛 address", "color:#4fff4B", address);
    let transactionData = [],
        sendData;
    async.each(
        TokenAddress,
        async (element) => {
            const price = await getTokenPrice(element.symbol);
            const addressData = await getTxDataData(
                address,
                element.Address,
                price,
            );
            transactionData = transactionData.concat(addressData);
        },
        async () => {
            transactionData.sort((a, b) => {
                return a.time - b.time;
            });
            let fields = ["time", "symbol", "quantity", "amount"];
            // json2csv(transactionData,
            //     function (err, csv) {
            //         console.log("%c Line:29 🥐 csv", "color:#2eafb0", csv);
            //         console.log("%c Line:29 🍋 err", "color:#2eafb0", err);
            //         res.setHeader(
            //             "Content-disposition",
            //             "attachment; filename=shifts-report.csv",
            //         );
            //         res.set("Content-Type", "text/csv");
            //         res.status(200).send(csv);
            //     },
            // );

            console.log(
                "%c Line:40 🍭 transactionData",
                "color:#ea7e5c",
                transactionData,
            );
            const csvString = await json2csv(transactionData, { fields });
            console.log("%c Line:40 🍏 csvString", "color:#ffdd4d", csvString);
            res.setHeader(
                "Content-disposition",
                "attachment; filename=shifts-report.csv",
            );
            res.set("Content-Type", "text/csv");
            res.status(200).send(csvString);

            // res.send(transactionData);
        },
    );
};
