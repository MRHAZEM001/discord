const { Client, GatewayIntentBits } = require('discord.js');
const Groq = require('groq-sdk');

// Khởi tạo Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Khởi tạo Groq SDK
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Cấu hình tham số
const SYSTEM_INSTRUCTION = 'Bạn là một trợ lý ảo thân thiện và hữu ích trên Discord.';
const MODEL_NAME = 'llama-3.1-8b-instant'; // Model chính thức ổn định trên Groq

client.once('ready', () => {
  console.log(`Bot đã đăng nhập thành công với tên: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  // Bỏ qua tin nhắn từ bot khác hoặc từ chính nó
  if (message.author.bot) return;

  // Kiểm tra nếu bot được nhắc tới (mention) hoặc tin nhắn bắt đầu bằng prefix '!ask'
  const isMentioned = message.mentions.has(client.user);
  const isCommand = message.content.startsWith('!ask');

  if (!isMentioned && !isCommand) return;

  // Lấy nội dung câu hỏi
  let promptContent = message.content;
  if (isCommand) {
    promptContent = promptContent.replace('!ask', '').trim();
  } else if (isMentioned) {
    promptContent = promptContent.replace(`<@!${client.user.id}>`, '').replace(`<@${client.user.id}>`, '').trim();
  }

  if (!promptContent) {
    return message.reply('Bạn vui lòng nhập câu hỏi sau câu lệnh hoặc sau khi tag bot nhé!');
  }

  try {
    await message.channel.sendTyping();

    // Gọi Groq API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_INSTRUCTION },
        { role: 'user', content: promptContent }
      ],
      model: MODEL_NAME,
      temperature: 0.5,
      max_tokens: 1024
    });

    const replyMessage = chatCompletion.choices[0]?.message?.content || 'Không nhận được phản hồi từ AI.';
    
    // Gửi câu trả lời về kênh Discord
    await message.reply(replyMessage);

  } catch (error) {
    console.error('Lỗi Groq API:', error);
    await message.reply(`❌ **Xử lý yêu cầu thất bại**: ${error.message}`);
  }
});

// Đăng nhập Discord Bot bằng Token
client.login(process.env.DISCORD_TOKEN);
