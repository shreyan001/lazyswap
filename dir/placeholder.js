"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const swap_1 = require("@chainflip/sdk/swap");
const groq_1 = require("@langchain/groq");
const swapSDK = new swap_1.SwapSDK({
    network: "perseverance", //
    broker: {
        url: 'https://perseverance.chainflip-broker.io/rpc/d3f87d92c7174654a789517624181972',
        commissionBps: 15, // basis points, i.e. 100 = 1%
    },
});
const model = new groq_1.ChatGroq({
    modelName: "Llama3-8b-8192",
    temperature: 0,
    apiKey: process.env.GROQ_API_KEY,
});
const REKT = () => __awaiter(void 0, void 0, void 0, function* () {
    // (alias) const Assets: ArrayToMap<readonly ["FLIP", "USDC", "DOT", "ETH", "BTC", "USDT"]>
    // import Assets
    // (alias) const Chains: ArrayToMap<readonly ["Bitcoin", "Ethereum", "Polkadot", "Arbitrum"]>
    // import Chains
    const quoteRequest = {
        srcChain: swap_1.Chains.Ethereum,
        destChain: swap_1.Chains.Ethereum,
        srcAsset: swap_1.Assets.ETH,
        destAsset: swap_1.Assets.USDT,
        amount: (10e18).toString(), // 1.5 ETH
        brokerCommissionBps: 15, // 100 basis point = 1%
    };
    const response = yield swapSDK.getQuote(quoteRequest);
    const parsedResult = JSON.stringify(response, null, 2);
    console.log(parsedResult);
});
REKT();
