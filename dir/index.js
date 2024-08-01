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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const telegraf_1 = require("telegraf");
const filters_1 = require("telegraf/filters");
const cloudflare_1 = require("@langchain/cloudflare");
const memory_1 = require("langchain/memory");
const chains_1 = require("langchain/chains");
const langgraph_1 = require("@langchain/langgraph");
const prompts_1 = require("@langchain/core/prompts");
const output_parsers_1 = require("@langchain/core/output_parsers");
const langgraph_2 = require("@langchain/langgraph");
const messages_1 = require("@langchain/core/messages");
const prompts_2 = require("@langchain/core/prompts");
const langgraph_3 = require("@langchain/langgraph");
const nodegraph_js_1 = __importDefault(require("./nodegraph.js"));
// Initialize Cloudflare Workers AI model
const model = new cloudflare_1.ChatCloudflareWorkersAI({
    model: "@hf/thebloke/neural-chat-7b-v3-1-awq",
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
});
const WEB_APP_URL = "https://feathers.studio/telegraf/webapp/example";
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_API);
bot.use((0, telegraf_1.session)());
// Initialize customer support graph
function createSupportGraph() {
    const graph = new langgraph_1.MessageGraph();
    // Add nodes and edges as in the original customer support code
    // initial_support node
    graph.addNode("initial_support", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are frontline support staff for LangCorp, a company that sells computers.
    Be concise in your responses.
    You can chat with customers and help them with basic questions, but if the customer is having a billing or technical problem,
    do not try to answer the question directly or gather information.
    Instead, immediately transfer them to the billing or technical team by asking the user to hold for a moment.
    Otherwise, just respond conversationally.`;
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            new prompts_2.MessagesPlaceholder("messages"),
        ]);
        return prompt.pipe(model).invoke({ messages: state });
    }));
    /* @ts-ignore */
    graph.addEdge(langgraph_3.START, "initial_support");
    // billing_support node
    graph.addNode("billing_support", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are an expert billing support specialist for LangCorp, a company that sells computers.
    Help the user to the best of your ability, but be concise in your responses.
    You have the ability to authorize refunds, which you can do by transferring the user to another agent who will collect the required information.
    If you do, assume the other agent has all necessary information about the customer and their order.
    You do not need to ask the user for more information.`;
        let messages = state;
        if (messages[messages.length - 1]._getType() === "ai") {
            messages = state.slice(0, -1);
        }
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            new prompts_2.MessagesPlaceholder("messages"),
        ]);
        return prompt.pipe(model).invoke({ messages });
    }));
    // technical_support node
    graph.addNode("technical_support", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are an expert at diagnosing technical computer issues. You work for a company called LangCorp that sells computers.
    Help the user to the best of your ability, but be concise in your responses.`;
        let messages = state;
        if (messages[messages.length - 1]._getType() === "ai") {
            messages = state.slice(0, -1);
        }
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            new prompts_2.MessagesPlaceholder("messages"),
        ]);
        return prompt.pipe(model).invoke({ messages });
    }));
    // refund_tool node
    graph.addNode("refund_tool", (state) => __awaiter(this, void 0, void 0, function* () {
        return new messages_1.AIMessage("Refund processed!");
    }));
    // Add conditional edges
    /* @ts-ignore */
    graph.addConditionalEdges("initial_support", (state) => __awaiter(this, void 0, void 0, function* () {
        const SYSTEM_TEMPLATE = `You are an expert customer support routing system.
    Your job is to detect whether a customer support representative is routing a user to a billing team or a technical team, or if they are just responding conversationally.`;
        const HUMAN_TEMPLATE = `The previous conversation is an interaction between a customer support representative and a user.
    Extract whether the representative is routing the user to a billing or technical team, or whether they are just responding conversationally.
    
    If they want to route the user to the billing team, respond only with the word "BILLING".
    If they want to route the user to the technical team, respond only with the word "TECHNICAL".
    Otherwise, respond only with the word "RESPOND".
    
    Remember, only respond with one of the above words.`;
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            new prompts_2.MessagesPlaceholder("messages"),
            ["human", HUMAN_TEMPLATE],
        ]);
        const chain = prompt.pipe(model).pipe(new output_parsers_1.StringOutputParser());
        const rawCategorization = yield chain.invoke({ messages: state });
        if (rawCategorization.includes("BILLING")) {
            return "billing";
        }
        else if (rawCategorization.includes("TECHNICAL")) {
            return "technical";
        }
        else {
            return "conversational";
        }
    }), {
        billing: "billing_support",
        technical: "technical_support",
        conversational: langgraph_2.END,
    });
    /* @ts-ignore */
    graph.addEdge("technical_support", langgraph_2.END);
    /* @ts-ignore */
    graph.addConditionalEdges("billing_support", (state) => __awaiter(this, void 0, void 0, function* () {
        const mostRecentMessage = state[state.length - 1];
        const SYSTEM_TEMPLATE = `Your job is to detect whether a billing support representative wants to refund the user.`;
        const HUMAN_TEMPLATE = `The following text is a response from a customer support representative.
    Extract whether they want to refund the user or not.
    If they want to refund the user, respond only with the word "REFUND".
    Otherwise, respond only with the word "RESPOND".
    
    Here is the text:
    
    <text>
    {text}
    </text>
    
    Remember, only respond with one word.`;
        const prompt = prompts_1.ChatPromptTemplate.fromMessages([
            ["system", SYSTEM_TEMPLATE],
            ["human", HUMAN_TEMPLATE],
        ]);
        const chain = prompt.pipe(model).pipe(new output_parsers_1.StringOutputParser());
        const response = yield chain.invoke({ text: mostRecentMessage.content });
        if (response.includes("REFUND")) {
            return "refund";
        }
        else {
            return "end";
        }
    }), {
        refund: "refund_tool",
        end: langgraph_2.END,
    });
    /* @ts-ignore */
    graph.addEdge("refund_tool", langgraph_2.END);
    return graph.compile();
}
// Initialize session
bot.use((ctx, next) => {
    var _a;
    (_a = ctx.session) !== null && _a !== void 0 ? _a : (ctx.session = {
        chain: new chains_1.ConversationChain({ llm: model, memory: new memory_1.BufferMemory() }),
        graph: (0, nodegraph_js_1.default)(),
        messages: []
    });
    return next();
});
bot.command("stop", ctx => ctx.reply("Launch mini app from inline keyboard!", telegraf_1.Markup.inlineKeyboard([telegraf_1.Markup.button.webApp("Launch", WEB_APP_URL), telegraf_1.Markup.button.webApp("Launch", WEB_APP_URL)])));
bot.command('start', (ctx) => {
    const username = ctx.message.from.username || 'there';
    const welcomeMessage = `
Hey ${username}! 👋 Welcome to LazySwap! 🚀

We're here to make cross-chain crypto swaps as easy as chatting with a friend! 💬✨

🔄 LazySwap uses the power of Chainflip to seamlessly swap your crypto assets across different blockchains. No complicated menus or confusing interfaces - just tell us what you want to do!

Here's how it works:
1️⃣ Tell us what you want to swap (e.g., "I want to swap 0.1 BTC to ETH")
2️⃣ We'll guide you through the process with simple questions
3️⃣ Confirm the details, and we'll handle the rest!

🧠 Powered by AI, we understand natural language, so feel free to ask questions or request a swap in your own words.

🔐 Security first! We'll always provide clear instructions and never ask for sensitive information.

🌈 With LazySwap, you have access to a wide range of tokens and chains supported by Chainflip. More options, more freedom!

Ready to start swapping? Just tell me what you'd like to do, or ask any questions you have about our service. Let's make crypto swaps a breeze! 🌪️💰
  `;
    ctx.reply(welcomeMessage);
});
// Don't forget to launch your bot
// Handle text messages
bot.on((0, filters_1.message)('text'), (ctx) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const session = ctx.session;
    try {
        // Add user message to the session messages
        session.messages.push(new messages_1.HumanMessage(ctx.message.text));
        const userMessages = new messages_1.HumanMessage(ctx.message.text);
        // Use the graph to process the message
        const stream = yield session.graph.stream({ messages: session.messages });
        let lastResponse = '';
        try {
            for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a; _d = true) {
                _c = stream_1_1.value;
                _d = false;
                const value = _c;
                const [nodeName, output] = Object.entries(value)[0];
                /* @ts-ignore */
                console.log(nodeName, output.messages[0].content);
                if (nodeName !== langgraph_2.END) {
                    /* @ts-ignore */
                    lastResponse = output.messages[0].content;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = stream_1.return)) yield _b.call(stream_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        // Add AI response to session messag
        // Send AI response to user
        yield ctx.reply(lastResponse, { parse_mode: 'HTML' });
    }
    catch (error) {
        console.error('Error:', error);
        yield ctx.reply('Sorry, I encountered an error.');
    }
}));
// Start the bot
bot.launch();
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
