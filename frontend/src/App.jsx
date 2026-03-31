import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

const API_URL = 'http://localhost:3001/api';

export default function App() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 加载模型列表（强制禁用缓存）
  useEffect(() => {
    fetch(`${API_URL}/models`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    })
      .then(res => res.json())
      .then(data => {
        setModels(data);
        setSelectedModel(data[0]);
      });
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // ✅ 关键修复：用独立变量跟踪AI回复，避免状态竞态
    let fullReply = '';
    const assistantMessage = { role: 'assistant', content: '' };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selectedModel,
          messages: [...messages, userMessage]
        })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                // ✅ 关键修复：只追加新内容，不重复历史
                fullReply += parsed.content;
                // ✅ 直接用最新的完整内容更新状态，避免重复
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1].content = fullReply;
                  return newMessages;
                });
              }
            } catch (e) {}
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }

    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <div style={{ marginBottom: '20px' }}>
        <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)} style={{ padding: '8px', fontSize: '16px' }}>
          {models.map(model => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: '20px', border: '1px solid #ddd', padding: '20px', borderRadius: '8px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '20px', padding: '10px', backgroundColor: msg.role === 'user' ? '#e3f2fd' : '#f5f5f5', borderRadius: '8px' }}>
            <strong>{msg.role === 'user' ? '用户' : '小Q'}:</strong>
            <div style={{ marginTop: '8px' }}>
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyPress={e => e.key === 'Enter' && sendMessage()}
          placeholder="输入消息..."
          disabled={loading}
          style={{ flex: 1, padding: '12px', fontSize: '16px', borderRadius: '8px', border: '1px solid #ddd' }}
        />
        <button onClick={sendMessage} disabled={loading} style={{ padding: '12px 24px', fontSize: '16px', borderRadius: '8px', backgroundColor: '#1976d2', color: 'white', border: 'none', cursor: 'pointer' }}>
          {loading ? '发送中...' : '发送'}
        </button>
      </div>
    </div>
  );
}