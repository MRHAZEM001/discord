require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

client.on('ready', () => {
  console.log(`Bot đã online với tên: ${client.user.tag}!`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.mentions.has(client.user) || message.content.startsWith('!gemini')) {
    const prompt = message.content.replace(/<@!\d+>|<@\d+>|!gemini/g, '').trim();
    if (!prompt) {
      return message.reply('Bro muốn hỏi Gemini điều gì?');
    }

    try {
      await message.channel.sendTyping();
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      if (text.length > 2000) {
        for (let i = 0; i < text.length; i += 2000) {
          await message.reply(text.substring(i, i + 2000));
        }
      } else {
        await message.reply(text);
      }
    } catch (error) {
      console.error('Lỗi Gemini API:', error);
      message.reply('Đã xảy ra lỗi khi kết nối với Gemini AI!');
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
  
