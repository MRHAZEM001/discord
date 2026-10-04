const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Groq = require('groq-sdk');
const http = require('http');

// ==========================================
// 1. KIỂM TRA & TẢI BIẾN MÔI TRƯỜNG
// ==========================================
const { DISCORD_TOKEN, CLIENT_ID, GROQ_API_KEY, PORT } = process.env;

if (!DISCORD_TOKEN) {
    console.error('[CONFIG ERROR] Thiếu DISCORD_TOKEN trong Environment!');
    process.exit(1);
}
if (!GROQ_API_KEY) {
    console.error('[CONFIG ERROR] Thiếu GROQ_API_KEY trong Environment!');
    process.exit(1);
}

// Khởi tạo Groq Client
const groq = new Groq({ apiKey: GROQ_API_KEY });

// Khởi tạo Discord Client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ==========================================
// 2. KHỞI TẠO HTTP SERVER (Giữ cho Render Live)
// ==========================================
const serverPort = PORT || 10000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot Discord AI is running online!\n');
}).listen(serverPort, () => {
    console.log(`[HTTP] Health Server đang lắng nghe ở port ${serverPort}`);
});

// ==========================================
// 3. ĐĂNG KÝ SLASH COMMANDS
// ==========================================
const commands = [
    new SlashCommandBuilder()
        .setName('ask')
        .setDescription('Hỏi AI câu hỏi bất kỳ')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Nội dung câu hỏi của bạn')
                .setRequired(true)
        ),
    new SlashCommandBuilder()
        .setName('bot')
        .setDescription('Hỏi AI câu hỏi bất kỳ')
        .addStringOption(option =>
            option.setName('prompt')
                .setDescription('Nội dung câu hỏi của bạn')
                .setRequired(true)
        )
].map(command => command.toJSON());

async function registerCommands() {
    if (!CLIENT_ID) {
        console.warn('[WARNING] Thiếu CLIENT_ID. Bot sẽ không tự động đăng ký Slash Command.');
        return;
    }
    const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
    try {
        console.log('[DISCORD] Đang cập nhật Slash Commands...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands }
        );
        console.log('[DISCORD] Đăng ký Slash Commands thành công!');
    } catch (error) {
        console.error('[DISCORD ERROR] Lỗi khi đăng ký Slash Commands:', error);
    }
}

// ==========================================
// 4. HÀM GỌI GROQ AI API
// ==========================================
async function getGroqResponse(promptText) {
    try {
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: 'Bạn là một trợ lý AI thông minh, thân thiện và hữu ích trên Discord. Hãy trả lời ngắn gọn, rõ ràng và bằng tiếng Việt.'
                },
                {
                    role: 'user',
                    content: promptText
                }
            ],
            model: 'llama-3.3-70b-versatile',
            temperature: 0.7,
            max_tokens: 1024
        });

        return completion.choices[0]?.message?.content || 'Không nhận được phản hồi từ AI.';
    } catch (error) {
        console.error('[GROQ API ERROR]:', error);
        return '❌ Đã xảy ra lỗi khi kết nối với AI Groq. Vui lòng thử lại sau.';
    }
}

// ==========================================
// 5. XỬ LÝ SỰ KIỆN DISCORD
// ==========================================

// Sự kiện khi Bot kết nối thành công
client.once('ready', async () => {
    console.log(`[DISCORD] Bot đã kết nối thành công với tên: ${client.user.tag}`);
    await registerCommands();
});

// Xử lý lệnh Slash (/bot hoặc /ask)
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;
    if (commandName === 'ask' || commandName === 'bot') {
        const prompt = interaction.options.getString('prompt');
        await interaction.deferReply(); // Tránh bị timeout 3s của Discord

        const response = await getGroqResponse(prompt);

        // Nếu câu trả lời dài hơn 2000 ký tự (giới hạn Discord), cắt nhỏ hoặc dùng Embed
        if (response.length > 2000) {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle(`💬 Trả lời cho: ${prompt.substring(0, 100)}...`)
                .setDescription(response.substring(0, 4000))
                .setFooter({ text: 'Powered by Groq AI' });
            await interaction.editReply({ embeds: [embed] });
        } else {
            await interaction.editReply(response);
        }
    }
});

// Xử lý tin nhắn trực tiếp / Tag bot / Prefix
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    // Trả lời khi được tag hoặc dùng prefix !ask
    const isMentioned = message.mentions.has(client.user);
    const isPrefix = message.content.startsWith('!ask ');

    if (isMentioned || isPrefix) {
        let promptText = message.content;
        if (isMentioned) {
            promptText = promptText.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
        } else if (isPrefix) {
            promptText = promptText.replace('!ask ', '').trim();
        }

        if (!promptText) {
            return message.reply('Bạn cần nhập câu hỏi nhé! Ví dụ: `@Bot Bạn là ai?`');
        }

        await message.channel.sendTyping();
        const response = await getGroqResponse(promptText);

        if (response.length > 2000) {
            await message.reply(response.substring(0, 1990) + '...');
        } else {
            await message.reply(response);
        }
    }
});

// Đăng nhập bot
client.login(DISCORD_TOKEN);
