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

// Initialize Cloudflare Workers AI model
const model = new ChatCloudflareWorkersAI({
  model: "@hf/thebloke/neural-chat-7b-v3-1-awq",
  cloudflareAccountId: process.env.CLOUDFLARE_ACCOUNT_ID,
  cloudflareApiToken: process.env.CLOUDFLARE_API_TOKEN,
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

// Initialize customer support graph
function createSupportGraph() {
  const graph = new MessageGraph();

  // Add nodes and edges as in the original customer support code
  // initial_support node
  graph.addNode("initial_support", async (state: BaseMessage[]) => {
    const SYSTEM_TEMPLATE = `You are frontline support staff for LangCorp, a company that sells computers.
    Be concise in your responses.
    You can chat with customers and help them with basic questions, but if the customer is having a billing or technical problem,
    do not try to answer the question directly or gather information.
    Instead, immediately transfer them to the billing or technical team by asking the user to hold for a moment.
    Otherwise, just respond conversationally.`;

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      new MessagesPlaceholder("messages"),
    ]);

    return prompt.pipe(model).invoke({ messages: state });
  });
    /* @ts-ignore */
  graph.addEdge(START, "initial_support");

  // billing_support node
  graph.addNode("billing_support", async (state: BaseMessage[]) => {
    const SYSTEM_TEMPLATE = `You are an expert billing support specialist for LangCorp, a company that sells computers.
    Help the user to the best of your ability, but be concise in your responses.
    You have the ability to authorize refunds, which you can do by transferring the user to another agent who will collect the required information.
    If you do, assume the other agent has all necessary information about the customer and their order.
    You do not need to ask the user for more information.`;

    let messages = state;
    if (messages[messages.length - 1]._getType() === "ai") {
      messages = state.slice(0, -1);
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      new MessagesPlaceholder("messages"),
    ]);
    return prompt.pipe(model).invoke({ messages });
  });

  // technical_support node
  graph.addNode("technical_support", async (state: BaseMessage[]) => {
    const SYSTEM_TEMPLATE = `You are an expert at diagnosing technical computer issues. You work for a company called LangCorp that sells computers.
    Help the user to the best of your ability, but be concise in your responses.`;

    let messages = state;
    if (messages[messages.length - 1]._getType() === "ai") {
      messages = state.slice(0, -1);
    }

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      new MessagesPlaceholder("messages"),
    ]);
    return prompt.pipe(model).invoke({ messages });
  });

  // refund_tool node
  graph.addNode("refund_tool", async (state) => {
    return new AIMessage("Refund processed!");
  });

  // Add conditional edges
    /* @ts-ignore */
  graph.addConditionalEdges("initial_support", async (state) => {
    const SYSTEM_TEMPLATE = `You are an expert customer support routing system.
    Your job is to detect whether a customer support representative is routing a user to a billing team or a technical team, or if they are just responding conversationally.`;
    const HUMAN_TEMPLATE = `The previous conversation is an interaction between a customer support representative and a user.
    Extract whether the representative is routing the user to a billing or technical team, or whether they are just responding conversationally.
    
    If they want to route the user to the billing team, respond only with the word "BILLING".
    If they want to route the user to the technical team, respond only with the word "TECHNICAL".
    Otherwise, respond only with the word "RESPOND".
    
    Remember, only respond with one of the above words.`;
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      new MessagesPlaceholder("messages"),
      ["human", HUMAN_TEMPLATE],
    ]);
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const rawCategorization = await chain.invoke({ messages: state });
    if (rawCategorization.includes("BILLING")) {
      return "billing";
    } else if (rawCategorization.includes("TECHNICAL")) {
      return "technical";
    } else {
      return "conversational";
    }
  }, {
    billing: "billing_support",
    technical: "technical_support",
    conversational: END,
  });
  /* @ts-ignore */
  graph.addEdge("technical_support", END);
   /* @ts-ignore */
  graph.addConditionalEdges("billing_support", async (state) => {
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
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_TEMPLATE],
      ["human", HUMAN_TEMPLATE],
    ]);
    const chain = prompt.pipe(model).pipe(new StringOutputParser());
    const response = await chain.invoke({ text: mostRecentMessage.content });
    if (response.includes("REFUND")) {
      return "refund";
    } else {
      return "end";
    }
  }, {
    refund: "refund_tool",
    end: END,
  });
   /* @ts-ignore */
  graph.addEdge("refund_tool", END);

  return graph.compile();
}

// Initialize session
bot.use((ctx, next) => {
  ctx.session ??= { 
    chain: new ConversationChain({ llm: model, memory: new BufferMemory() }),
    graph: nodegraph(),
    messages: []
  };
  return next();
});

bot.command("stop", ctx =>
  ctx.reply(
    "Launch mini app from inline keyboard!",
    Markup.inlineKeyboard([Markup.button.webApp("Launch", WEB_APP_URL), Markup.button.webApp("Launch", WEB_APP_URL)]),
  ),
);

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

    // Add AI response to session messag

    // Send AI response to user
    await ctx.reply(lastResponse,{ parse_mode: 'HTML'});

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