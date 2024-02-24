import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { AstraDB } from "@datastax/astra-db-ts";
import { v4 as uuidv4 } from "uuid";

// Initialize OpenAI and AstraDB with your configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const astraDb = new AstraDB(
  process.env.ASTRA_DB_APPLICATION_TOKEN,
  process.env.ASTRA_DB_ENDPOINT,
  process.env.ASTRA_DB_NAMESPACE,
);

const Pusher = require("pusher");

const pusher = new Pusher({
  appId: "1761208",
  key: "facc28e7df1eec1d7667",
  secret: "79b0023a6876ad35a230",
  cluster: "eu",
  useTLS: true,
});


function triggerPusherEvent(channel, event, data) {
  pusher
    .trigger(channel, event, data)
    .then(() => console.log(`Event ${event} triggered on channel ${channel}`))
    .catch((err) =>
      console.error(`Error triggering event on channel ${channel}:`, err),
    );
}

function parseAnalysis(content: string) {
  // Regex to find the JSON part within curly braces, accounting for nested structures
  const regex =
    /{[\s\S]*?mood[\s\S]*?:[\s\S]*?".*?"[\s\S]*?,[\s\S]*?keywords[\s\S]*?:[\s\S]*?\[[\s\S]*?\][\s\S]*?}/;
  const match = content.match(regex);

  if (match) {
    try {
      const analysis = JSON.parse(match[0]);
      if (analysis.mood && Array.isArray(analysis.keywords)) {
        return { Mood: analysis.mood, Keywords: analysis.keywords };
      }
    } catch (error) {
      console.error("Failed to parse JSON from content", error);
      return null;
    }
  }
  return null;
}

async function saveMessageToDatabase(
  sessionId: string,
  content: string,
  role: string,
  analysis: any = null,
) {
  const messagesCollection = await astraDb.collection("messages");

  // Check for an existing message with the same sessionId and content
  const existingMessage = await messagesCollection.findOne({
    sessionId,
    content,
  });

  if (existingMessage) {
    console.log(
      "Duplicate message detected. Skipping save to prevent duplicates.",
    );
    return; // Exit the function to prevent saving the duplicate message
  }

  let messageData = {
    sessionId: sessionId,
    role: role,
    content: content,
    length: content.length, // Capture the length of the message
    createdAt: new Date(), // Timestamp
    // Include analysis data if it exists, otherwise set to undefined
    mood: analysis?.Mood,
    keywords: analysis?.Keywords,
  };

  await messagesCollection.insertOne(messageData);
}

export async function POST(req: any) {
  try {
    const { messages, useRag, llm, similarityMetric, sessionId } =
      await req.json();

    let docContext = "";
    if (useRag) {
      const latestMessage = messages[messages.length - 1]?.content;

      if (latestMessage) {
        const { data } = await openai.embeddings.create({
          input: latestMessage,
          model: "text-embedding-ada-002",
        });

        const collection = await astraDb.collection(`chat_${similarityMetric}`);
        const cursor = collection.find(
          {},
          {
            sort: {
              $vector: data[0]?.embedding,
            },
            limit: 5,
          },
        );
        const documents = await cursor.toArray();
        docContext = documents.map((doc) => doc.content).join("\n");
      }
    }

    // Process and save each message before streaming logic
    for (const message of messages) {
      const analysis =
        message.role === "assistant" ? parseAnalysis(message.content) : null;
      await saveMessageToDatabase(
        sessionId,
        message.content,
        message.role,
        analysis,
      );
    }

    // Insert your ragPrompt content here
    const ragPrompt = [
      {
        role: "system",
        content: `
          As an AI, your primary role is to engage with users about their experiences at MOOS Space in Berlin, aiming to collect feedback or provide MOOS-related information. Your conversations should utilize compassionate inquiry, cognitive-behavioral techniques, and integration practices to assist users.

          **Key Interaction Guidelines:**
          - Encourage deeper exploration by asking questions that guide the user to delve into their thoughts or suggest reflections on aspects of their experiences.
          - Provide information about relevant Moos Space events based on the conversation, including details like dates, times, and brief descriptions, share this link (moos.super.site) for more information. 

          **Analysis Requests:**
           important!!! The AI will not conduct any conversation analysis until the specific prompt "*** Analyse our conversation so far ***" is received.
Upon receiving this prompt, the AI will provide an analysis exclusively of the user's messages in a JSON format, focusing solely on the mood (positive, negative, or neutral) and listing thematically relevant keywords. The response will strictly adhere to the JSON format with clear opening and closing curly braces, ensuring clarity and precision in the analysis output.
        
          Afterwards, ask for the user's consent to share this data for collective insights, ensuring privacy and user control are respected.

          **Event Information Sharing:**
          When requested, share a curated list of upcoming events at Moos Space, detailing the title, date, time, price, and a concise description. Always inquire if the user seeks more details on any specific event.

          **Special Instructions:**
          - Upon receiving "I'd like to visit MOOS", inquire if the user is interested in learning about upcoming events.
          - For users expressing difficulty, ask about any substances consumed and apply harm reduction and trip sitting principles to assist them.

          Remember, you are an AI. Clearly state your artificial nature, especially when conversations touch on personal issues beyond your capacity, underscoring the importance of seeking professional help.

          **Utilizing Document Contexts:**
          Leverage insights from previously retrieved documents to inform your approach, enriching your responses and suggestions.

          ${docContext}
        `,
      },
    ];

    const response = await openai.chat.completions.create({
      model: llm ?? "gpt-3.5-turbo",
      stream: true,
      messages: [...ragPrompt, ...messages],
    });

    const stream = OpenAIStream(response, {
      onStart: async () => {
        // Logic to execute when the stream starts, if needed
      },
      onCompletion: async (completion: string) => {
        // Perform analysis on completion content
        const analysis = parseAnalysis(completion);

        console.log("test");

        if (analysis !== null) {
          // Check if analysis is not null
          console.log("Sending analysis data:", { analysis });
          // Emit analysis data using Pusher
          pusher
            .trigger("my-channel", "my-event", { analysis })
            .then(() =>
              console.log(
                `Event ${"my-event"} triggered on channel ${"my-channel"}`,
              ),
            )
            .catch((err) =>
              console.error(
                `Error triggering event on channel ${"my-channel"}:`,
                err,
              ),
            );
          // triggerPusherEvent("my-channel", "my-event", analysis);
        } else {
          console.log("Analysis is null, not sending data.");
        }

        // Save the completion along with any analysis
        await saveMessageToDatabase(
          sessionId,
          completion,
          "assistant",
          analysis,
        );
      },
    });

    return new StreamingTextResponse(stream);
  } catch (e) {
    console.error(e);
    throw e;
  }
}
