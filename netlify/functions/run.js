const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // This stays in Netlify env vars
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

    // Step 1: Create thread if needed
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

    // Step 3: Run the assistant (hardcoded ID is safe)
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: "asst_36tNu70K30oDEVnGF0HauNJq",
    });

    // Step 4: Poll for completion
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

    // Step 5: Retrieve assistant reply
    const messages = await openai.beta.threads.messages.list(threadId);
    const assistantReply = messages.data.find((msg) => msg.role === "assistant");

    const reply =
      assistantReply?.content?.[0]?.text?.value ||
      "⚠️ Assistant ran, but didn’t return anything.";

    return {
      statusCode: 200,
      body: JSON.stringify({ reply, thread_id: threadId }),
    };
  } catch (error) {
    console.error("❌ Assistant Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Assistant processing failed." }),
    };
  }
};





