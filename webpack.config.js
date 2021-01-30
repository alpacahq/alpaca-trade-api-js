module.exports = {
    mode: 'development',
    entry: './lib/alpaca-trade-api.js',
    module: {
        rules: [
            {
                test: require.resolve("./lib/alpaca-trade-api.js"),
                loader: "expose-loader",
                options: {
                    exposes: ["Alpaca"],
                },
            }
        ]
    }
};
