import { useEffect, useRef, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL || window.location.origin;
const suggestions = [
  "PMFBY मध्ये दावा कसा करायचा?",
  "सहकारी समिति में सदस्य के अधिकार क्या हैं?",
  "What services can a PACS provide?"
];

const languageName = { mr: "मराठी", hi: "हिन्दी", en: "English" };
const detectLocale = (language) => ({ mr: "mr-IN", hi: "hi-IN", en: "en-IN" }[language] || "hi-IN");
const uniqueId = () => globalThis.crypto?.randomUUID?.() || `conversation-${Date.now()}`;

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [document, setDocument] = useState(null);
  const conversationId = useRef(uniqueId());
  const recognitionRef = useRef(null);
  const uploadRef = useRef(null);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => () => {
    globalThis.speechSynthesis?.cancel();
  }, []);

  const sendMessage = async (text = input) => {
    const message = text.trim();
    if (!message || loading) return;
    setError("");
    setMessages((items) => [...items, { id: uniqueId(), role: "user", text: message }]);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, conversation_id: conversationId.current, document_id: document?.id })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to send your question.");
      setMessages((items) => [...items, { id: uniqueId(), role: "assistant", text: result.answer, language: result.language }]);
    } catch (cause) {
      setError(cause.message || "Network problem. Check that the Sahakar AI backend is running.");
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file) => {
    if (!file) return;
    setError("");
    const form = new FormData();
    form.append("document", file);
    try {
      const response = await fetch(`${API_URL}/api/upload`, { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The document could not be uploaded.");
      setDocument({ id: result.document_id, name: result.name });
    } catch (cause) {
      setError(cause.message || "The document could not be uploaded.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const toggleMicrophone = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Voice input is not supported in this browser. Please type your question instead.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = "mr-IN";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => setRecording(true);
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results).map((item) => item[0].transcript).join(" ");
      setInput(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") setError("Microphone access failed. Please allow it and try again.");
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const listen = (message) => {
    if (!globalThis.speechSynthesis) {
      setError("Read-aloud is not supported in this browser.");
      return;
    }
    globalThis.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message.text);
    utterance.lang = detectLocale(message.language);
    utterance.rate = 0.92;
    globalThis.speechSynthesis.speak(utterance);
  };

  const clearConversation = async () => {
    globalThis.speechSynthesis?.cancel();
    try { await fetch(`${API_URL}/api/conversations/${conversationId.current}/clear`, { method: "POST" }); } catch { /* local clear still works */ }
    conversationId.current = uniqueId();
    setMessages([]);
    setDocument(null);
    setError("");
  };

  return (
    <main className="page-shell">
      <section className="app-card" aria-label="Sahakar AI assistant">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">🌾</span>
            <div><h1>Sahakar AI</h1><p>Cooperative assistance, in your language</p></div>
          </div>
          <button className="clear-button" onClick={clearConversation} aria-label="Start a new conversation">↺ <span>New chat</span></button>
        </header>

        {messages.length === 0 ? (
          <section className="welcome">
            <div className="welcome-icon">🙏</div>
            <p className="eyebrow">MULTILINGUAL COOPERATIVE ASSISTANT</p>
            <h2>नमस्कार! मी तुमची कशी मदत करू शकतो?</h2>
            <p>सहकारी संस्था, सरकारी योजना, PMFBY, PACS आणि तक्रार निवारणाबद्दल सोप्या भाषेत विचारा.</p>
            <div className="suggestions">
              {suggestions.map((item) => <button key={item} onClick={() => sendMessage(item)}>{item}</button>)}
            </div>
          </section>
        ) : (
          <section className="messages" aria-live="polite">
            {messages.map((message) => (
              <article className={`message ${message.role}`} key={message.id}>
                <div className="avatar" aria-hidden="true">{message.role === "user" ? "You" : "🌾"}</div>
                <div className="bubble">
                  <div className="message-label">{message.role === "user" ? "You" : "Sahakar AI"}{message.language && <span className="language">{languageName[message.language] || message.language}</span>}</div>
                  <p>{message.text}</p>
                  {message.role === "assistant" && <button className="listen-button" onClick={() => listen(message)}>🔊 Listen</button>}
                </div>
              </article>
            ))}
            {loading && <article className="message assistant"><div className="avatar" aria-hidden="true">🌾</div><div className="bubble typing"><span></span><span></span><span></span></div></article>}
            <div ref={messagesEnd} />
          </section>
        )}

        {error && <div className="error" role="alert">{error}</div>}
        {document && <div className="document-pill">📄 {document.name}<button onClick={() => setDocument(null)} aria-label="Remove document">×</button></div>}

        <form className="composer" onSubmit={(event) => { event.preventDefault(); sendMessage(); }}>
          <input ref={uploadRef} type="file" className="hidden" accept=".pdf,.txt,image/jpeg,image/png,image/webp" onChange={(event) => uploadDocument(event.target.files?.[0])} />
          <button type="button" className="icon-button" onClick={() => uploadRef.current?.click()} aria-label="Upload document">📎</button>
          <button type="button" className={`icon-button mic ${recording ? "recording" : ""}`} onClick={toggleMicrophone} aria-label={recording ? "Stop recording" : "Speak your question"}>{recording ? "■" : "🎤"}</button>
          <label className="input-wrap"><span className="sr-only">Your question</span><textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={recording ? "Listening… click stop when finished" : "Type or speak your question…"} rows="1" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); } }} /></label>
          <button className="send-button" type="submit" disabled={!input.trim() || loading} aria-label="Send question">➤</button>
        </form>
        <footer>Private by design: your API key stays on the server.</footer>
      </section>
    </main>
  );
}

export default App;
