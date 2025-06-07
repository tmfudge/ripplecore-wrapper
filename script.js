const chatForm = document.getElementById("chat-form");
const chatBox = document.getElementById("chat-box");

chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("user-input");
  const userMessage = input.value.trim();
  if (!userMessage) return;

  // Display user's message
  appendMessage("user", userMessage);
  input.value = "";

  // Send to backend
  const res = await fetch("/.netlify/functions/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: userMessage }),
  });

  const data = await res.json();
  appendMessage("assistant", data.reply || "No response.");
});

function appendMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `chat-message ${role}`;
  msg.innerText = text;
  chatBox.appendChild(msg);
  chatBox.scrollTop = chatBox.scrollHeight;
}
