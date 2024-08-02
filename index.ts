  import { Telegraf, session, Context, Markup } from 'telegraf';
  import { message } from 'telegraf/filters';
  import { ChatCloudflareWorkersAI } from '@langchain/cloudflare';
  import { BufferMemory, ChatMessageHistory } from "langchain/memory";
  import { ConversationChain } from "langchain/chains";
  import { MessageGraph } from "@langchain/langgraph";
  import { ChatPromptTemplate } from "@langchain/core/prompts";
  import { StringOutputParser } from "@langchain/core/output_parsers";
  import { END } from "@langchain/langgraph";
  import { HumanMessage, AIMessage } from "@langchain/core/messages";
  import { MessagesPlaceholder } from "@langchain/core/prompts";
  import type { BaseMessage } from "@langchain/core/messages";
  import { START } from "@langchain/langgraph";
  import nodegraph from './nodegraph.js';
  import { SwapSDK, Assets, Chains, Asset } from "@chainflip/sdk/swap";
  

  import { config } from 'dotenv';
config();
  // Initialize Cloudflare Workers AI model
  const model = new ChatCloudflareWorkersAI({
    model: "@hf/thebloke/neural-chat-7b-v3-1-awq",
    cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
  });
  const swapSDK = new SwapSDK({
    network: "perseverance", //
    broker: {
      url: 'https://perseverance.chainflip-broker.io/rpc/d3f87d92c7174654a789517624181972',
      commissionBps: 15, // basis points, i.e. 100 = 1%
    },
  });
  const WEB_APP_URL = "https://feathers.studio/telegraf/webapp/example";

  // Define session data interface
  interface SessionData {
    chain: any;
    graph: any;
    messages: BaseMessage[];
  }

  // Define context type
  interface MyContext extends Context {
    session?: SessionData;
  }

  const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_API,);

  bot.use(session());


  // Initialize session
  bot.use((ctx, next) => {
    ctx.session ??= { 
      chain: new ConversationChain({ llm: model, memory: new BufferMemory() }),
      graph: nodegraph(),
      messages: []
    };
    return next();
  });


// Refresh command
bot.command('refresh', async (ctx) => {
 
  if (ctx.session) {
    ctx.session.messages = [];
    ctx.session.graph = nodegraph();
    await ctx.reply('Your session has been refreshed. You can start a new conversation now.');
  } else {
    await ctx.reply('Unable to refresh session. Please try again later.');
  }
});



// Define the permanent keyboard




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

    ctx.reply(welcomeMessage, 
      Markup.keyboard([
        ["🔄 Refresh", "ℹ️ Help"] // Row1 with 2 buttons
      ])
      );
  });

// Handle button presses
bot.hears("🔄 Refresh", async (ctx) => {
  if (ctx.session) {
    ctx.session.messages = [];
    await ctx.reply('Your session has been refreshed. You can start a new conversation now.');
  } else {
    await ctx.reply('Unable to refresh session. Please try again later.');
  }
});

bot.hears("ℹ️ Help", async (ctx) => {
  const helpMessage = `
Here are the available commands:

/start - Start or restart the bot
/refresh - Clear your current session and start fresh
/help - Show this help message

To start a swap, simply send a message like:
"I want to swap 0.1 BTC to ETH"
  `;
  await ctx.reply(helpMessage);
});

  // Don't forget to launch your bot

  // Handle text messages
bot.on(message('text'), async (ctx) => {
  const session = ctx.session;
  try {
    // Send a loading message
    const loadingMessage = await ctx.reply('Processing your request... 🔄');

    // Add user message to the session messages
    session.messages.push(new HumanMessage(ctx.message.text));
    
    const userMessages = new HumanMessage(ctx.message.text);
    // Use the graph to process the message
    const stream = await session.graph.stream({ messages: session.messages });

    let lastResponse = '';
    for await (const value of stream) {
      const [nodeName, output] = Object.entries(value)[0];
      /* @ts-ignore */
      console.log(nodeName, output.messages[0].content);
      if (nodeName !== END) {
        /* @ts-ignore */
        lastResponse = output.messages[0].content;
      }
    }

    // Delete the loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMessage.message_id);

    // Send AI response to user
    await ctx.reply(lastResponse, { parse_mode: 'HTML' });

  } catch (error) {
    console.error('Error:', error);
    await ctx.reply('Sorry, I encountered an error.');
  }
});
  // Start the bot
  bot.launch();

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));