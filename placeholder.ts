import { SwapSDK, Assets, Chains } from "@chainflip/sdk/swap";
import { BufferMemory } from "langchain/memory";
import { ConversationChain } from "langchain/chains";
import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from "@langchain/core/prompts";
import {  StateGraph } from "@langchain/langgraph";
import { END } from "@langchain/langgraph";
import { RunnableSequence } from "@langchain/core/runnables";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { MessagesPlaceholder } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { BaseMessage, AIMessage, HumanMessage} from "@langchain/core/messages";
import { START } from "@langchain/langgraph";
import {z} from "zod";
import { ChatGroq } from "@langchain/groq";

type lazyState = {
  messages: any[] | null,
  swapValues?: {
      sourceChain?: string | null,
      sourceToken?: string | null,
      destChain?: string | null,
      destToken?: string | null,
      amount?: string | null,
      destAddress?: string | null,
  }
}


const swapSDK = new SwapSDK({
  network: "perseverance", //
  broker: {
    url: 'https://perseverance.chainflip-broker.io/rpc/d3f87d92c7174654a789517624181972',
    commissionBps: 15, // basis points, i.e. 100 = 1%
  },
});


const model = new ChatGroq({
    modelName: "Llama3-8b-8192",
    temperature:0,
  apiKey: process.env.GROQ_API_KEY,
});
   
  const REKT = async ( ) => {

    // (alias) const Assets: ArrayToMap<readonly ["FLIP", "USDC", "DOT", "ETH", "BTC", "USDT"]>
    // import Assets
    
    // (alias) const Chains: ArrayToMap<readonly ["Bitcoin", "Ethereum", "Polkadot", "Arbitrum"]>
    // import Chains
    const response = await swapSDK.getStatus({id:'2028718-Ethereum-22'});
    const quoteRequest = {
      srcChain: Chains.Ethereum,
      destChain: Chains.Ethereum,
      srcAsset: Assets.ETH,
      destAsset: Assets.USDT,
      amount: (10e18).toString(), // 1.5 ETH
      brokerCommissionBps: 15, // 100 basis point = 1%
     
    };

//     const response = await swapSDK.getQuote(quoteRequest);
// const parsedResult = JSON.stringify(response, null, 2);
     
    console.log(response);

}

REKT();