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
        body: JSON.stringify({ error: "No message provided." }),
      };
    }

    // Step 1: Create thread if not provided
    let threadId = thread_id;
    if (!threadId) {
      const thread = await openai.beta.threads.create();
      threadId = thread.id;
    }

    // Step 2: Add message
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: message,
    });

    // Step 3: Run assistant
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Step 4: Poll for result
    let status = run.status;
    let attempts = 0;
    const maxAttempts = 15;

    while ((status === "queued" || status === "in_progress") && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const updatedRun = await openai.beta.threads.runs.retrieve(threadId, run.id);
      status = updatedRun.status;
      attempts++;
    }

    if (status !== "completed") {
      return {
        statusCode: 408,
        body: JSON.stringify({ reply: "⏳ Assistant timed out. Please try again." }),
      };
    }

    // Step 5: Get assistant message
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantReply = messages.data.find((msg) => msg.role === "assistant");
    const reply = assistantReply?.content?.[0]?.text?.value;

    if (!reply) {
      console.log("⚠️ Assistant gave no content. Full message:", assistantReply);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: reply || "⚠️ Assistant ran, but didn’t return anything you can see.",
        thread_id: threadId,
      }),
    };
  } catch (error) {
    console.error("❌ OpenAI Assistant Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to connect to assistant." }),
    };
  }
};



