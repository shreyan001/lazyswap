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
const messages_1 = require("@langchain/core/messages");
const nodegraph_js_1 = __importDefault(require("./nodegraph.js"));
const dotenv_1 = require("dotenv");
(0, dotenv_1.config)();
// Initialize Cloudflare Workers AI model
const model = new cloudflare_1.ChatCloudflareWorkersAI({
    model: "@hf/thebloke/neural-chat-7b-v3-1-awq",
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
});
const WEB_APP_URL = "https://feathers.studio/telegraf/webapp/example";
const bot = new telegraf_1.Telegraf(process.env.TELEGRAM_BOT_API);
bot.use((0, telegraf_1.session)());
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
        // Send a loading message
        const loadingMessage = yield ctx.reply('Processing your request... 🔄');
        // Add user message to the session messages
        session.messages.push(new messages_1.HumanMessage(ctx.message.text));
        const userMessages = new messages_1.HumanMessage(ctx.message.text);
        // Use the graph to process the message
        const stream = yield session.graph.stream({ messages: session.messages });
        let lastResponse = '';
        try {
            for (var _d = true, stream_1 = __asyncValues(stream), stream_1_1; stream_1_1 = yield stream_1.next(), _a = stream_1_1.done, !_a;) {
                _c = stream_1_1.value;
                _d = false;
                try {
                    const value = _c;
                    const [nodeName, output] = Object.entries(value)[0];
                    /* @ts-ignore */
                    console.log(nodeName, output.messages[0].content);
                    if (nodeName !== langgraph_1.END) {
                        /* @ts-ignore */
                        lastResponse = output.messages[0].content;
                    }
                }
                finally {
                    _d = true;
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
        // Delete the loading message
        yield ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);
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
