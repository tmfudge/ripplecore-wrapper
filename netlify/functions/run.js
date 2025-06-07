const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  try {
    const { message, thread_id } = JSON.parse(event.body);

    // Step 1: Create a new thread if needed
    let threadId = thread_id;
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Step 2: Add user message to thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Step 3: Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Step 4: Poll until run completes
    let status = run.status;
    let result;

    while (status === "queued" || status === "in_progress") {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const check = await openai.beta.threads.runs.retrieve(threadId, run.id);
      status = check.status;
    }

    // Step 5: Get messages
    const messages = await openai.beta.threads.messages.list(threadId);
    const lastMessage = messages.data.find((msg) => msg.role === "assistant");

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: lastMessage?.content?.[0]?.text?.value || "No response.",
        thread_id: threadId,
      }),
    };
  } catch (err) {
    console.error("Error in assistant run:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to process assistant request." }),
    };
  }
};
