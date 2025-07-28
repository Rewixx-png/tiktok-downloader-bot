const TelegramBot = require('node-telegram-bot-api');
const request = require('request');

// ВСТАВЬТЕ ВАШ ТОКЕН СЮДА
const token = '8070912486:AAFjsVI5WVEs8ZAeGtIgxSyYyonuRLgvJbo';

const bot = new TelegramBot(token, { polling: true });

console.log('Бот успешно запущен...');

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "👋 Привет! Я бот для скачивания видео из TikTok без водяных знаков.\n\n✨ Просто отправь мне ссылку на видео.");
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Игнорируем команды, чтобы не обрабатывать их как ссылки
    if (text.startsWith('/')) {
        return;
    }

    // Проверяем, содержит ли сообщение ссылку на TikTok
    if (text && (text.includes('tiktok.com/') || text.includes('vm.tiktok.com/'))) {
        bot.sendMessage(chatId, "⏳ Нашел! Обрабатываю ваше видео, пожалуйста, подождите...");

        // Шаг 1: Обращаемся к API TikWM, чтобы получить прямую ссылку на видео
        const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`;

        request({ url: tikwmApiUrl, json: true }, (apiError, apiResponse, apiBody) => {
            if (apiError || apiResponse.statusCode !== 200 || !apiBody || apiBody.code !== 0) {
                console.error('Ошибка при обращении к API TikWM:', apiError || (apiBody ? apiBody.msg : 'Unknown Error'));
                bot.sendMessage(chatId, "❌ К сожалению, я не смог обработать эту ссылку. Возможно, она неверна или сервис временно недоступен.");
                return;
            }

            const videoUrl = apiBody.data.play;
            if (!videoUrl) {
                console.error('В ответе от TikWM не найдена ссылка на видео.');
                bot.sendMessage(chatId, "❌ Не удалось найти видео для скачивания.");
                return;
            }

            // Шаг 2: Скачиваем видео по прямой ссылке в память (буфер)
            // Используем encoding: null, чтобы получить ответ в виде необработанного буфера
            request({ url: videoUrl, encoding: null }, (videoError, videoResponse, videoBuffer) => {
                if (videoError || videoResponse.statusCode !== 200) {
                    console.error('Ошибка при скачивании файла видео:', videoError);
                    bot.sendMessage(chatId, "❌ Не удалось скачать видеофайл с сервера. Пожалуйста, попробуйте позже.");
                    return;
                }

                // Шаг 3: Отправляем буфер с видео пользователю
                bot.sendVideo(chatId, videoBuffer, { caption: "Вот ваше видео! ✨" })
                    .catch(telegramError => {
                        // Ловим ошибки от Telegram (например, если файл слишком большой)
                        console.error('Ошибка при отправке видео в Telegram:', telegramError.message);
                        bot.sendMessage(chatId, `❌ Произошла ошибка при отправке видео. (Код ошибки: ${telegramError.code})`);
                    });
            });
        });
    } else {
        bot.sendMessage(chatId, "Это не похоже на ссылку TikTok. Пожалуйста, отправьте действительную ссылку.");
    }
});

// Обработка ошибок опроса (polling) для стабильности
bot.on('polling_error', (error) => {
    console.error(`Ошибка опроса: ${error.code} - ${error.message}`);
});
