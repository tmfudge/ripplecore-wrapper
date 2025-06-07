const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { message, thread_id } = JSON.parse(event.body || "{}");

    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No message provided" }),
      };
    }

    // Step 1: Create a new thread if needed
    let threadId = thread_id;
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Step 2: Add the user's message
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Step 3: Run the assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Step 4: Poll until the assistant finishes
    let runStatus = run.status;
    let attempts = 0;
    const maxAttempts = 15;

    while (
      (runStatus === "queued" || runStatus === "in_progress") &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const runCheck = await openai.beta.threads.runs.retrieve(threadId, run.id);
      runStatus = runCheck.status;
      attempts++;
    }

    if (runStatus !== "completed") {
      return {
        statusCode: 408,
        body: JSON.stringify({ error: "Assistant timeout or failure" }),
      };
    }

    // Step 5: Get the latest assistant message
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantReply = messages.data.find((msg) => msg.role === "assistant");

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: assistantReply?.content?.[0]?.text?.value || "No reply generated.",
        thread_id: threadId,
      }),
    };
  } catch (error) {
    console.error("OpenAI Assistant Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal server error" }),
    };
  }
};

