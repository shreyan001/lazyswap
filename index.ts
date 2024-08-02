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

 // Help command
bot.command('help', async (ctx) => {
  const helpMessage = `
Here are the available commands:

/start - Start or restart the bot
/refresh - Clear your current session and start fresh
/help - Show this help message
/status - Check the bot's current status
/supported_tokens - List supported tokens
/faq - Show frequently asked questions
/cancel - Cancel the current operation

To start a swap, simply send a message like:
"I want to swap 0.1 BTC to ETH"
  `;
  await ctx.reply(helpMessage);
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

async function getSwapLimits() {
  return await swapSDK.getSwapLimits();
}

function formatTokenLimits(limits) {
  const { minimumSwapAmounts, maximumSwapAmounts } = limits;
  const formatAmounts = (amounts) => {
    return Object.entries(amounts).map(([token, amount]) => `${token}: ${amount}`).join('\n');
  };

  let formattedMessage = "Token Limits:\n\nMinimum Swap Amounts:\n";

  for (const [chain, tokens] of Object.entries(minimumSwapAmounts)) {
    formattedMessage += `\n${chain}:\n${formatAmounts(tokens)}`;
  }

  formattedMessage += "\n\nMaximum Swap Amounts:\n";

  for (const [chain, tokens] of Object.entries(maximumSwapAmounts)) {
    formattedMessage += `\n${chain}:\n${formatAmounts(tokens)}`;
  }

  return formattedMessage;
}

bot.command('tokenlimits', async (ctx) => {
  try {
    const limits = await getSwapLimits();
    const formattedMessage = formatTokenLimits(limits);
    ctx.reply(formattedMessage);
  } catch (error) {
    console.error('Error fetching token limits:', error);
    ctx.reply('Sorry, there was an error fetching the token limits. Please try again later.');
  }
});

// Status command
bot.command('status', async (ctx) => {
  const uptime = process.uptime();
  const uptimeString = `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`;
  await ctx.reply(`Bot is running.\nUptime: ${uptimeString}`);
});

bot.command('supported_tokens', async (ctx) => {
  try {
    const supportedChains = await swapSDK.getChains();
    let message = 'Supported tokens by chain:\n\n';
    
    for (const chain of supportedChains) {
      /* @ts-ignore */
      const assets = await swapSDK.getAssets(chain[name]);
      const assetSymbols = assets.map(asset => asset.symbol).join(', ');
      message += `${chain.name}:\n${assetSymbols}\n\n`;
    }
    
    await ctx.reply(message);
  } catch (error) {
    console.error('Error fetching supported tokens:', error);
    await ctx.reply('Sorry, I couldn\'t fetch the list of supported tokens at the moment.');
  }
});


// FAQ command
bot.command('faq', async (ctx) => {
  const faqMessage = `
Frequently Asked Questions:

Q: How does LazySwap work?
A: LazySwap uses AI to understand your swap request and facilitates cross-chain swaps using the Chainflip protocol.

Q: Is there a minimum swap amount?
A: Yes, the minimum varies by token but is typically around $10-$20 worth.

Q: How long does a swap take?
A: Most swaps complete within a few minutes, depending on network congestion.

Q: Are my funds safe?
A: LazySwap is non-custodial, meaning we never hold your funds. Swaps are executed directly through the Chainflip protocol.

For more questions, visit our website or contact support.
  `;
  await ctx.reply(faqMessage);
});

// Cancel command
bot.command('cancel', async (ctx) => {
  if (ctx.session) {
    ctx.session.messages = [];
    ctx.session.graph = {};
    await ctx.reply('Current operation cancelled. You can start a new request.');
  } else {
    await ctx.reply('No active operation to cancel.');
  }
});
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