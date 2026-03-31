import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();
const app = express();

app.use(cors());
app.use(express.json());

const clients = {
  deepseek: new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com'
  }),
  qwen: new OpenAI({
    apiKey: process.env.QWEN_API_KEY,
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
  })
};

const modelConfigs = {
  'deepseek-chat': { provider: 'deepseek', model: 'deepseek-chat' },
  'deepseek-reasoner': { provider: 'deepseek', model: 'deepseek-reasoner' },
  'qwen-max': { provider: 'qwen', model: 'qwen-max' },
  'qwen-plus': { provider: 'qwen', model: 'qwen-plus' },
  'qwen-turbo': { provider: 'qwen', model: 'qwen-turbo' },
  'qwen-long': { provider: 'qwen', model: 'qwen-long' }
};

app.post('/api/chat', async (req, res) => {
  const { model, messages } = req.body;
  const config = modelConfigs[model];

  if (!config) {
    return res.status(400).json({ error: 'Invalid model' });
  }

  console.log(`[${model}] 收到 ${messages.length} 条消息`);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const client = clients[config.provider];
    const stream = await client.chat.completions.create({
      model: config.model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 2000
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error(`[${model}] 错误:`, error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

app.get('/api/models', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json(Object.keys(modelConfigs).map(id => ({
    id,
    name: id
  })));
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});