const Transactions = require("./models/transactions.model");
require("./config/db.config");
const async = require("async");
const usersModel = require("./models/users.model");
const { referralDistribution, updateLevel } = require("./utils/referral");
const userBonus = require("./config/bonusPlan.json");
const referralLevel = require("./config/referralLevel.json");
const Referral = require("./config/referralLevel.json");

module.exports.referralDistributionFun = async () => {
    return new Promise(async (resolve) => {
        try {
            const fromTime = new Date().getTime() - 1000 * 60 * 60 * 24 * 1;
            const transactionData = await Transactions.find({
                type: "STAKE-IN",
                stakingTime: { $lte: fromTime },
                status: 1,
            });
            async.each(
                transactionData,
                async (element) => {
                    const getUserData = await usersModel.findOne({
                        _id: element.user,
                    });
                    if (getUserData.fromUser) {
                        await referralDistribution(
                            element.user,
                            getUserData.fromUser,
                            1,
                            element.amount * element.stakingPrice,
                        );
                    }
                },
                () => {
                    resolve(true);
                },
            );
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.userDistributionTeam = async () => {
    return new Promise(async (resolve) => {
        try {
            const userData = await usersModel.aggregate([
                {
                    $match: {
                        isDeleted: false,
                        // lastDistributionLevel: { $lt: userBonus.length },
                        totalTeamTurnover: { $gt: 0 },
                    },
                },
                {
                    $lookup: {
                        from: "users",
                        let: { userId: "$_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $eq: ["$fromUser", "$$userId"],
                                    },
                                    $expr: {
                                        $eq: ["$isDeleted", false],
                                    },
                                    $expr: {
                                        $gt: ["$totalTeamTurnover", 0],
                                    },
                                },
                            },
                            {
                                $project: {
                                    totalTeamTurnover: 1,
                                },
                            },
                        ],
                        as: "referralData",
                    },
                },
                {
                    $project: {
                        referralData: 1,
                        lastDistributionLevel: 1,
                    },
                },
            ]);

            let sendData = [];
            async.each(
                userData,
                async (element) => {
                    let teamA = 0,
                        teamB = 0;
                    if (
                        element.referralData &&
                        element.referralData.length > 0
                    ) {
                        element.referralData.forEach((ele) => {
                            if (teamA < ele.totalTeamTurnover) {
                                teamA = ele.totalTeamTurnover;
                            }
                            teamB += ele.totalTeamTurnover;
                        });
                    }
                    teamB -= teamA;
                    const conditions = element.lastDistributionLevel
                        ? userBonus[element.lastDistributionLevel]
                        : userBonus[0];

                    if (teamA > conditions.teamA && teamB > conditions.teamB) {
                        await Transactions.create({
                            user: element._id,
                            level: level,
                            type: "REWARD",
                            amount: conditions.amount,
                            status: 1,
                        });

                        await Users.findOneAndUpdate(
                            {
                                _id: element._id,
                            },
                            {
                                $inc: {
                                    balance: conditions.amount,
                                    rewardBalance: conditions.amount,
                                },
                            },
                            {
                                new: true,
                            },
                        );

                        sendData.push({ element, teamA, teamB, conditions });
                    } else {
                        sendData.push({ teamA, teamB });
                    }
                },
                () => {
                    resolve(sendData);
                },
            );
            // resolve(userData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.userDistributionDirect = async () => {
    return new Promise(async (resolve) => {
        try {
            // let updateData = await usersModel.updateMany(
            //     { level: { $gt: 1 } },
            //     {
            //         $set: {
            //             level: 1,
            //         },
            //     },
            //     {
            //         new: true,
            //     },
            // );
            const userData = await usersModel.aggregate([
                {
                    $match: {
                        isDeleted: false,
                        totalTeamTurnover: { $gt: 0 },
                        stakedBalance: { $gt: 0 },
                    },
                },
            ]);

            console.log("%c 🥝 userData", "color:#3f7cff", userData.length);
            let sendData = [];
            async.each(
                userData,
                async (element) => {
                    const levelData = await updateLevel(element);
                    sendData.push({ email: element.email, levelData });
                    // const nextLevelData =
                    //     referralLevel[element.level ? element.level : 0];

                    // if (nextLevelData.target < totalTeamTurnover) {
                    //     sendData.push(element);
                    //     await Transactions.create({
                    //         user: element._id,
                    //         level: level,
                    //         type: "SYSTEM-REWARD",
                    //         amount: nextLevelData.direct,
                    //         status: 1,
                    //     });

                    //     await Users.findOneAndUpdate(
                    //         {
                    //             _id: element._id,
                    //         },
                    //         {
                    //             $inc: {
                    //                 balance: nextLevelData.direct,
                    //                 rewardBalance: nextLevelData.direct,
                    //             },
                    //         },
                    //         {
                    //             new: true,
                    //         },
                    //     );
                    // }
                },
                () => {
                    resolve(sendData);
                },
            );
            // resolve(updateData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.userStakingDistribution = async () => {
    return new Promise(async (resolve) => {
        try {
            let interestDay = 31;
            const fromTime =
                new Date().getTime() + 1000 * 60 * 60 * 24 * interestDay;
            const transactionData = await Transactions.find({
                type: "STAKE-IN",
                // stakingTime: { $gt: fromTime },
                status: 1,
                // stakingComplete: false,
            });

            let sendData = [];
            async.each(
                transactionData,
                async (element) => {
                    const currentTime = new Date().getTime();
                    if (
                        element.lastInterestTime
                            ? element.lastInterestTime
                            : element.stakingTime + element.stakingInterval >
                              currentTime
                    ) {
                        let bonus =
                            (element.amount *
                                element.stakingPrice *
                                element.interestInterval) /
                            100;
                    }

                    // if (teamA > conditions.teamA && teamB > conditions.teamB) {
                    //     await Transactions.create({
                    //         user: element._id,
                    //         level: level,
                    //         type: "REWARD",
                    //         amount: conditions.amount,
                    //         status: 1,
                    //     });

                    //     await Users.findOneAndUpdate(
                    //         {
                    //             _id: element._id,
                    //         },
                    //         {
                    //             $inc: {
                    //                 balance: conditions.amount,
                    //                 rewardBalance: conditions.amount,
                    //             },
                    //         },
                    //         {
                    //             new: true,
                    //         },
                    //     );

                    //     sendData.push({ element, teamA, teamB, conditions });
                    // } else {
                    //     sendData.push({ teamA, teamB });
                    // }
                },
                () => {
                    resolve(transactionData);
                },
            );
            // resolve(userData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.resetUser = async () => {
    return new Promise(async (resolve) => {
        try {
            const transactionData = await Transactions.deleteMany({
                type: "SYSTEM-REWARD",
            });
            console.log(
                "%c 🍆 transactionData",
                "color:#ffdd4d",
                transactionData.length,
            );
            // const transactionData = await Transactions.aggregate([
            //     {
            //         $match: {
            //             type: "REWARD",
            //         },
            //     },
            //     {
            //         $group: {
            //             _id: "$user",
            //             totalSaleAmount: { $sum: "$amount" },
            //         },
            //     },
            // ]);

            // let sendData = [];
            // async.each(
            //     transactionData,
            //     async (element) => {
            //         const getUserData = await usersModel.findById(element.user);

            //         if (getUserData.balance < element.amount) {
            //             sendData.push({
            //                 email: getUserData.email,
            //                 balance: getUserData.balance,
            //                 amount: element.amount,
            //             });
            //         } else {
            //             const updateUser = await usersModel.findOneAndUpdate(
            //                 {
            //                     _id: element.user,
            //                 },
            //                 {
            //                     $inc: {
            //                         balance: -element.amount,
            //                         rewardBalance: -element.amount,
            //                     },
            //                 },
            //                 {
            //                     new: true,
            //                 },
            //             );
            //             await Transactions.deleteOne({
            //                 _id: element.id,
            //             });
            //             sendData.push({
            //                 email: getUserData.email,
            //                 amount: element.amount,
            //                 newBalance: updateUser.balance,
            //             });
            //         }
            //     },
            //     () => {
            //         resolve(sendData);
            //     },
            // );
            // console.log(
            //     "%c 🍣 transactionData",
            //     "color:#ea7e5c",
            //     transactionData.length,
            // );
            resolve(transactionData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.resetUserTeamTurnOver = async () => {
    return new Promise(async (resolve) => {
        try {
            const userData = await usersModel.updateMany(
                {
                    totalTeamTurnover: {
                        $gt: 0,
                    },
                    isDeleted: false,
                },
                {
                    $set: {
                        totalTeamTurnover: 0,
                    },
                },
                {
                    new: true,
                },
            );
            console.log(
                "%c 🍆 transactionData",
                "color:#ffdd4d",
                userData.length,
            );
            resolve(userData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.addUserTeamTurnOver = async () => {
    return new Promise(async (resolve) => {
        try {
            const transactionData = await Transactions.find({
                type: "STAKE-IN",
            });
            console.log(
                "%c 🥛 transactionData",
                "color:#42b983",
                transactionData.length,
            );

            let sendData = [];
            async.each(
                transactionData,
                async (element) => {
                    const getUserData = await usersModel.findById(element.user);
                    if (getUserData.fromUser) {
                        await teamTurnoverDistribution(
                            getUserData.user,
                            getUserData.fromUser,
                            1,
                            element.amount * element.stakingPrice,
                        );
                        sendData.push({
                            email: getUserData.email,
                            amount: element.amount * element.stakingPrice,
                        });
                    }
                },
                () => {
                    resolve(sendData);
                },
            );
            // console.log(
            //     "%c 🍣 transactionData",
            //     "color:#ea7e5c",
            //     transactionData.length,
            // );

            // resolve(userData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

const teamTurnoverDistribution = async (
    fromUserId,
    toUserId,
    level,
    mainAmount,
) => {
    return new Promise(async (resolve) => {
        console.log("%c 🍅 toUserId", "color:#7f2b82", toUserId);
        try {
            const updateUserBalance = await usersModel.findOneAndUpdate(
                {
                    _id: toUserId,
                },
                {
                    $inc: {
                        totalTeamTurnover: mainAmount,
                    },
                },
                {
                    new: true,
                },
            );
            if (updateUserBalance.fromUser) {
                await teamTurnoverDistribution(
                    fromUserId,
                    updateUserBalance.fromUser,
                    level,
                    mainAmount,
                );
                resolve(true);
            } else {
                resolve(true);
            }
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

module.exports.userStakingDistributution = async () => {
    return new Promise(async (resolve) => {
        try {
            const transactionData = await Transactions.findOne({
                _id: "6339786d5eaf8b2443450c73",
            });
            const userData = await usersModel.findOne({
                _id: transactionData.user,
            });

            let sendData = await teamReferralDistribution(
                transactionData.user,
                userData.fromUser,
                0,
                transactionData.amount * 0.25,
                0,
            );
            resolve(sendData);
        } catch (error) {
            console.log("%c 🍇 error", "color:#ea7e5c", error);
            resolve(true);
        }
    });
};

// const teamReferralDistribution = async (
//     fromUserId,
//     toUserId,
//     level,
//     mainAmount,
//     distributedAmount,
// ) => {
//     return new Promise(async (resolve) => {
//         try {
//             let updateData = {},
//                 nextLevel = level,
//                 amountToAdd = distributedAmount;
//             // if (level < Referral.length) {
//             const userData = await usersModel.findOne({ _id: toUserId });
//             if (userData.level >= level && userData.stakingTime) {
//                 let referralData;
//                 referralData = Referral[userData.level - 1];
//                 amountToAdd =
//                     (referralData.bonus * mainAmount) / 100 - distributedAmount;
//                 await Transactions.create({
//                     fromUser: fromUserId,
//                     user: toUserId,
//                     level: level,
//                     type: "REFERRAL-INCOME",
//                     amount: amountToAdd,
//                     status: 0,
//                     isShow: false,
//                 });
//                 // updateData = {
//                 //     totalTeamTurnover: mainAmount,
//                 //     referralBalance: amountToAdd,
//                 // };
//                 const updateUserBalance = await Users.findOneAndUpdate(
//                     {
//                         _id: toUserId,
//                     },
//                     {
//                         $inc: {
//                             referralBalance: amountToAdd,
//                         },
//                     },
//                     {
//                         new: true,
//                     },
//                 );
//                 nextLevel++;
//             } else {
//                 // updateData = {
//                 //     totalTeamTurnover: mainAmount,
//                 // };
//             }
//             console.log(
//                 "%c 🍻 updateData",
//                 "color:#fca650",
//                 updateData,
//                 userData.email,
//             );
//             // }
//             // const updateUserBalance = await Users.findOneAndUpdate(
//             //     {
//             //         _id: toUserId,
//             //     },
//             //     {
//             //         $inc: updateData,
//             //     },
//             //     {
//             //         new: true,
//             //     },
//             // );

//             if (userData.fromUser) {
//                 await teamReferralDistribution(
//                     fromUserId,
//                     userData.fromUser,
//                     nextLevel,
//                     mainAmount,
//                     amountToAdd,
//                 );
//                 resolve(true);
//             } else {
//                 resolve(true);
//             }
//         } catch (error) {
//             console.log("%c 🍇 error", "color:#ea7e5c", error);
//             resolve(true);
//         }
//     });
// };
