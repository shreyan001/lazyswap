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
const prompts_1 = require("@langchain/core/prompts");
const langgraph_1 = require("@langchain/langgraph");
const langgraph_2 = require("@langchain/langgraph");
const prompts_2 = require("@langchain/core/prompts");
const output_parsers_1 = require("@langchain/core/output_parsers");
const messages_1 = require("@langchain/core/messages");
const langgraph_3 = require("@langchain/langgraph");
const groq_1 = require("@langchain/groq");
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
const swapSDK = new swap_1.SwapSDK({
    network: "perseverance",
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
const chainflipValidation = ({ sourceChain, sourceToken, destChain, destToken }) => __awaiter(void 0, void 0, void 0, function* () {
    const supportedChains = yield swapSDK.getChains();
    const chainNames = supportedChains.map(chain => chain.name.toLowerCase());
    if (!chainNames.includes(sourceChain.toLowerCase()) || !chainNames.includes(destChain.toLowerCase())) {
        return `Invalid chains. Supported chains are: ${chainNames.join(', ')}`;
    }
    const sourceAssets = yield swapSDK.getAssets(sourceChain);
    const destAssets = yield swapSDK.getAssets(destChain);
    function findToken(assets, tokenQuery) {
        tokenQuery = tokenQuery.toLowerCase();
        return assets.find(asset => asset.symbol.toLowerCase() === tokenQuery ||
            asset.name.toLowerCase().includes(tokenQuery));
    }
    const sourceTokenAsset = findToken(sourceAssets, sourceToken);
    const destTokenAsset = findToken(destAssets, destToken);
    if (!sourceTokenAsset) {
        return `Invalid source token. "${sourceToken}" not found on ${sourceChain}.`;
    }
    if (!destTokenAsset) {
        return `Invalid destination token. "${destToken}" not found on ${destChain}.`;
    }
    return "SUCCESS";
});
function nodegraph() {
    const graph = new langgraph_1.StateGraph({
        channels: {
            messages: {
                value: (x, y) => x.concat(y),
            },
            swapValues: {
                value: null,
            }
        }
    });
    graph.addNode("initial_node", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are LazySwap, an AI-powered Telegram bot facilitating cross-chain cryptocurrency swaps powered by Chainflip SDK on the Perseverance testnet.
        Be concise yet friendly in your responses.
        Your main functions are:
        1. Assist users in performing cross-chain swaps using simple, conversational interactions.
        2. Provide information about available tokens and chains supported by the Chainflip SDK on the Perseverance testnet.
        3. Guide users through the swap process step-by-step.
        4. Answer basic questions about LazySwap and cross-chain swaps.
        
        Tokens refer to the digital assets you want to swap, such as cryptocurrencies like ETH, BTC, USDT, and USDC. Chains refer to the blockchain networks these tokens reside on, such as Ethereum, Polkadot, Bitcoin, and Arbitrum.
        
        Currently supported chains on the Perseverance testnet include:
        - Ethereum (EVM Chain ID: 11155111, requires 7 block confirmations)
        - Polkadot (requires undefined block confirmations)
        - Bitcoin (requires 6 block confirmations)
        - Arbitrum (EVM Chain ID: 421614, requires 2 block confirmations)
        
        If a user mentions Sepolia or Sepolia Ethereum, understand that it means the Ethereum chain.
        
        When a user wants to perform a swap, gather the following information conversationally:
        - The token symbol they want to swap from (source token)
        - The chain of the source token (source chain)
        - The token symbol they want to swap to (destination token)
        - The chain of the destination token (destination chain)
        - The amount they want to swap
        
        Ensure the following conditions are met:
        - Only accept token symbols (e.g., ETH, BTC, USDT, USDC, FLIP).
        - Only accept supported chains (Ethereum, Polkadot, Bitcoin, Arbitrum).
        - Assume ETH is on the Ethereum chain unless explicitly stated otherwise.
        - The minimum amount for ETH swaps is 0.01 ETH.
        - The minimum amount for other tokens is 1 token (e.g USDT, USDC, FLIP).
        - The maximum amount for any token is 10 token (e.g., ETH, BTC, USDT, USDC, FLIP).
        - Users may optionally provide a deposit address. If provided, use it; otherwise, default to "null".
        
        Always ensure you have all five required fields (source token, source chain, destination token, destination chain, amount) before proceeding.
        
        Validate the provided chains and tokens against the supported list. If any chain or token is invalid, inform the user and ask for clarification.
        
        Once you have all the required information, reorder and display it to the user in the following format for the next support bot to easily make a decision:
        'You want to swap [amount] [source token] from [source chain] to [destination token] on [destination chain].
        
        Before we proceed, I just want to confirm the details:
        
        * Source Token: [source token]
        * Source Chain: [source chain]
        * Destination Token: [destination token]
        * Destination Chain: [destination chain]
        * Amount: [amount]
        * destAddress: [deposit address or "null"]'
        
        If any information is missing, ask the user conversationally for clarification (e.g., "Could you please specify the chain for your USDT token?").
        `;
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            new prompts_2.MessagesPlaceholder("messages"),
        ]);
        const response = yield prompt.pipe(model).invoke({ messages: state.messages });
        return {
            messages: [response]
        };
    }));
    /* @ts-ignore */
    graph.addEdge(langgraph_3.START, "initial_node");
    /* @ts-ignore */
    graph.addConditionalEdges("initial_node", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are a support system for the LazySwap bot responsible for routing the conversation to either the pre-check node or continuing the conversation.
Your task is to discern whether the user has provided all the necessary information for a swap or if the conversation is still ongoing.`;
        const HUMAN_TEMPLATE = `Analyze the following user message:

{messages}

Extract the following information from the message if it is present:
1. Source token
2. Source chain
3. Destination token
4. Destination chain
5. Amount to swap

If all required information is present, respond with "PRECHECK".
If any information is missing or the bot is responding to questions, respond with "RESPOND".

Remember, only respond with one of the above words.`;
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            ["human", HUMAN_TEMPLATE],
        ]);
        const chain = prompt.pipe(model).pipe(new output_parsers_1.StringOutputParser());
        console.log(state.messages[state.messages.length - 1].content, "yo mfs this is the state what you gonna do");
        const rawCategorization = yield chain.invoke({ messages: state.messages[state.messages.length - 1].content });
        if (rawCategorization.includes("PRECHECK")) {
            console.log("precheck");
            return "precheck";
        }
        else {
            console.log("conversational");
            return "conversational";
        }
    }), {
        precheck: "precheck_node",
        conversational: langgraph_2.END,
    });
    graph.addNode("precheck_node", (state) => __awaiter(this, void 0, void 0, function* () {
        const systemTemplate = `You are an expert at verifying details for cross-chain swaps. Extract the following information from the user's input:
        1. Source chain
        2. Source token
        3. Destination chain
        4. Destination token
        5. Amount to swap
        6. Destination address (if provided)
    
        Format your response ONLY as a JSON object with these keys: sourceChain, sourceToken, destChain, destToken, amount, destAddress.
        If any information is missing, use null as the value for that key. Do not include any other text in your response.`;
        const humanTemplate = "{input}";
        const chatPrompt = prompts_1.ChatPromptTemplate.fromMessages([
            prompts_1.SystemMessagePromptTemplate.fromTemplate(systemTemplate),
            prompts_1.HumanMessagePromptTemplate.fromTemplate(humanTemplate),
        ]);
        const message = state.messages[state.messages.length - 1].content;
        const chain = chatPrompt.pipe(model).pipe(new output_parsers_1.StringOutputParser());
        const result = yield chain.invoke({ input: message });
        console.log(result);
        // Parse the JSON result
        let parsedResult;
        try {
            parsedResult = JSON.parse(result);
            console.log(parsedResult);
        }
        catch (error) {
            console.log("Failed to parse JSON:", error);
            return {
                messages: [new messages_1.AIMessage("ERROR: There was an internal error please try again")]
            };
        }
        // Validate the parsed result using chainflipValidation
        const validationResult = yield chainflipValidation(parsedResult);
        console.log(validationResult);
        if (validationResult === "SUCCESS") {
            const swapValues = {
                sourceChain: parsedResult.sourceChain,
                sourceToken: parsedResult.sourceToken,
                destChain: parsedResult.destChain,
                destToken: parsedResult.destToken,
                amount: parsedResult.amount,
            };
            // Only add destAddress if it's provided and not null
            if (parsedResult.destAddress !== null && parsedResult.destAddress !== undefined) {
                swapValues.destAddress = parsedResult.destAddress;
            }
            return {
                messages: [new messages_1.AIMessage("Tokens are available to swap on ChainFlip proceeding to generate quote")],
                swapValues: swapValues
            };
        }
        else {
            console.error("Validation failed:", validationResult);
            return {
                messages: [new messages_1.AIMessage(validationResult)]
            };
        }
    }));
    /* @ts-ignore */
    graph.addConditionalEdges("precheck_node", (state) => {
        // Check if swapValues exist and have all the necessary properties
        if (state.swapValues &&
            state.swapValues.sourceChain &&
            state.swapValues.sourceToken &&
            state.swapValues.destChain &&
            state.swapValues.destToken &&
            state.swapValues.amount) {
            console.log("Routing to getQuote_node");
            return "getQuote";
        }
        else {
            // If swap values are not complete, end the conversation
            console.log("Ending conversation");
            return "end";
        }
    }, {
        getQuote: "getQuote_node",
        end: langgraph_2.END
    });
    graph.addNode("getQuote_node", (state) => __awaiter(this, void 0, void 0, function* () {
        try {
            // Helper function to get the correct chain key
            const getChainKey = (chain) => {
                const chainMap = {
                    "bitcoin": "Bitcoin",
                    "ethereum": "Ethereum",
                    "polkadot": "Polkadot",
                    "arbitrum": "Arbitrum"
                };
                return chainMap[chain.toLowerCase()] || chain;
            };
            // Helper function to get the correct asset key
            const getAssetKey = (asset) => {
                const assetMap = {
                    "flip": "FLIP",
                    "usdc": "USDC",
                    "dot": "DOT",
                    "eth": "ETH",
                    "btc": "BTC",
                    "usdt": "USDT"
                };
                return assetMap[asset.toLowerCase()] || asset.toUpperCase();
            };
            // Convert amount from base10 to e18 format
            const amountInE18 = (parseFloat(state.swapValues.amount) * 1e18).toString();
            const quoteRequest = {
                srcChain: swap_1.Chains[getChainKey(state.swapValues.sourceChain)],
                destChain: swap_1.Chains[getChainKey(state.swapValues.destChain)],
                srcAsset: swap_1.Assets[getAssetKey(state.swapValues.sourceToken)],
                destAsset: swap_1.Assets[getAssetKey(state.swapValues.destToken)],
                amount: amountInE18,
                brokerCommissionBps: 15, // 100 basis point = 1%
            };
            console.log(quoteRequest);
            const response = yield swapSDK.getQuote(quoteRequest);
            const parsedResult = JSON.stringify(response, null, 2);
            // Convert amounts from e18 format to base10 and format numbers
            const deposit = parseFloat(response.amount) / 1e18;
            const receive = parseFloat(response.quote.egressAmount) / 1e18;
            const estRate = receive / deposit;
            const estPlatformFee = parseFloat(response.quote.includedFees.find(fee => fee.type === "BROKER").amount) / 1e18;
            const estProtocolGasFee = parseFloat(response.quote.includedFees.find(fee => fee.type === "NETWORK").amount) / 1e18;
            const quoteDate = new Date().toUTCString();
            const result = `
<b>🎉 Your Swap Quote:</b>

<b>💸 Deposit:</b> ${deposit.toFixed(6)} ${state.swapValues.sourceToken}
<b>💸 Receive:</b> ${receive.toFixed(6)} ${state.swapValues.destToken}
<b>📈 Estimated Rate:</b> ${deposit.toFixed(6)} ${state.swapValues.sourceToken} ≈ ${receive.toFixed(6)} ${state.swapValues.destToken}
<b>💼 Estimated Platform Fee (0.15%):</b> ${estPlatformFee.toFixed(6)} ${state.swapValues.sourceToken}
<b>🛠️ Estimated Protocol & Gas Fee:</b> ${estProtocolGasFee.toFixed(6)} ${state.swapValues.sourceToken}

<b>📅 Quote Date:</b> ${quoteDate}

<b>❗ Review your Recipient Address and the amounts carefully.</b>
The final amount received may vary due to market conditions and network fees.

<b>🔑 Please enter your destination address to proceed with the swap.</b>
`;
            console.log(result);
            return {
                messages: [new messages_1.AIMessage(result)],
            };
        }
        catch (error) {
            return {
                messages: [new messages_1.AIMessage("😕 Oops! There was an error processing your request. This could be due to insufficient liquidity or another issue. Please try again with different parameters.")],
            };
        }
    }));
    /* @ts-ignore */
    graph.addConditionalEdges("getQuote_node", (state) => {
        const lastMessage = state.messages[state.messages.length - 1].content;
        if (lastMessage.includes("Please enter your destination address to proceed with the swap.") && state.swapValues.destAddress) {
            console.log("Routing to generateDeposit_node");
            return "generateDeposit";
        }
        else if (lastMessage.includes("Sorry, there was an error processing your request.") || lastMessage.includes("Please try again with different parameters.")) {
            console.log("Ending conversation");
            return "end";
        }
        else {
            console.log("Destination address not found in response, ending conversation");
            return "end";
        }
    }, {
        generateDeposit: "generateDeposit_node",
        end: langgraph_2.END
    });
    /* @ts-ignore */
    graph.addNode("generateDeposit_node", (state) => __awaiter(this, void 0, void 0, function* () {
        try {
            // Helper function to get the correct chain key
            const getChainKey = (chain) => {
                const chainMap = {
                    "bitcoin": "Bitcoin",
                    "ethereum": "Ethereum",
                    "polkadot": "Polkadot",
                    "arbitrum": "Arbitrum"
                };
                return chainMap[chain.toLowerCase()] || chain;
            };
            // Helper function to get the correct asset key
            const getAssetKey = (asset) => {
                const assetMap = {
                    "flip": "FLIP",
                    "usdc": "USDC",
                    "dot": "DOT",
                    "eth": "ETH",
                    "btc": "BTC",
                    "usdt": "USDT"
                };
                return assetMap[asset.toLowerCase()] || asset.toUpperCase();
            };
            const quoteRequest = {
                srcChain: swap_1.Chains[getChainKey(state.swapValues.sourceChain)],
                destChain: swap_1.Chains[getChainKey(state.swapValues.destChain)],
                srcAsset: swap_1.Assets[getAssetKey(state.swapValues.sourceToken)],
                destAsset: swap_1.Assets[getAssetKey(state.swapValues.destToken)],
                amount: (parseFloat(state.swapValues.amount) * 1e18).toString(),
                brokerCommissionBps: 15,
            };
            const quoteResponse = yield swapSDK.getQuote(quoteRequest);
            const swapDepositAddressRequest = Object.assign(Object.assign({}, quoteRequest), { destAddress: state.swapValues.destAddress });
            const result = yield swapSDK.requestDepositAddress(swapDepositAddressRequest);
            // Convert amounts from e18 format to base10
            const deposit = parseFloat(result.amount) / 1e18;
            const receive = parseFloat(quoteResponse.quote.egressAmount) / 1e18;
            const estRate = receive / deposit;
            const estPlatformFee = parseFloat(quoteResponse.quote.includedFees.find(fee => fee.type === "BROKER").amount) / 1e18;
            const estProtocolGasFee = parseFloat(quoteResponse.quote.includedFees.find(fee => fee.type === "NETWORK").amount) / 1e18;
            const resultMessage = `
<b>🎉 Your Swap Details:</b>

<b>❗ Important:</b>
- Send <b>${deposit.toFixed(6)} ${state.swapValues.sourceToken}</b> within 1 hour. Delays may result in a different rate.
- Funds sent to an expired Deposit Address are unrecoverable.
- Funds exceeding <b>${deposit.toFixed(6)} ${state.swapValues.sourceToken}</b> are processed at current market rates.

<b>⚠️ Warning:</b> Any funds sent below the minimum amount of 0.01 ${state.swapValues.sourceToken} will be lost!

<b>📊 Swap Details:</b>
- <b>Deposit:</b> ${deposit.toFixed(6)} ${state.swapValues.sourceToken}
- <b>Receive:</b> ${receive.toFixed(6)} ${state.swapValues.destToken}
- <b>Estimated Rate:</b> ${deposit.toFixed(6)} ${state.swapValues.sourceToken} ≈ ${receive.toFixed(6)} ${state.swapValues.destToken}
- <b>Estimated Platform Fee (0.15%):</b> ${estPlatformFee.toFixed(6)} ${state.swapValues.sourceToken}
- <b>Estimated Protocol & Gas Fee:</b> ${estProtocolGasFee.toFixed(6)} ${state.swapValues.sourceToken}
- <b>Recipient Address:</b> ${state.swapValues.destAddress}

<b>📦 Deposit Address:</b>
<code>${result.depositAddress}</code>

<b>📋 Instructions:</b>
- Send EXACTLY <b>${deposit.toFixed(6)} ${state.swapValues.sourceToken}</b> on the ${state.swapValues.sourceChain} network.
- Verify the Deposit Address on Chainflip's official website: <a href="https://blocks-perseverance.chainflip.io/channels/${result.depositChannelId}">Verify Here</a>
        `;
            console.log(resultMessage);
            return {
                messages: [new messages_1.AIMessage(resultMessage, { parse_mode: 'HTML' })],
                depositAddress: result.depositAddress,
                depositChannelId: result.depositChannelId,
            };
        }
        catch (error) {
            console.error(error);
            return {
                messages: [new messages_1.AIMessage(`😕 Sorry, there was an error processing your request. Please make sure you have provided the correct deposit address: ${state.swapValues.destAddress}. Please try again with a valid address.`, { parse_mode: 'HTML' })],
            };
        }
    }));
    /* @ts-ignore */
    graph.addEdge("generateDeposit_node", langgraph_2.END);
    return graph.compile();
}
exports.default = nodegraph;
;
nodegraph();
