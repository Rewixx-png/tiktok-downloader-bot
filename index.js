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
        
        // Отправляем сообщение "подождите" и сохраняем его для последующего удаления
        bot.sendMessage(chatId, "⏳ Нашел! Обрабатываю ваше видео, пожалуйста, подождите...")
            .then((sentMessage) => {
                const waitingMessageId = sentMessage.message_id;

                const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`;

                request({ url: tikwmApiUrl, json: true }, (apiError, apiResponse, apiBody) => {
                    if (apiError || apiResponse.statusCode !== 200 || !apiBody || apiBody.code !== 0) {
                        console.error('Ошибка при обращении к API TikWM:', apiError || (apiBody ? apiBody.msg : 'Unknown Error'));
                        bot.deleteMessage(chatId, waitingMessageId); // Удаляем "подождите"
                        bot.sendMessage(chatId, "❌ К сожалению, я не смог обработать эту ссылку. Возможно, она неверна или сервис временно недоступен.");
                        return;
                    }

                    const videoUrl = apiBody.data.play;
                    if (!videoUrl) {
                        console.error('В ответе от TikWM не найдена ссылка на видео.');
                        bot.deleteMessage(chatId, waitingMessageId); // Удаляем "подождите"
                        bot.sendMessage(chatId, "❌ Не удалось найти видео для скачивания.");
                        return;
                    }

                    request({ url: videoUrl, encoding: null }, (videoError, videoResponse, videoBuffer) => {
                        if (videoError || videoResponse.statusCode !== 200) {
                            console.error('Ошибка при скачивании файла видео:', videoError);
                            bot.deleteMessage(chatId, waitingMessageId); // Удаляем "подождите"
                            bot.sendMessage(chatId, "❌ Не удалось скачать видеофайл с сервера. Пожалуйста, попробуйте позже.");
                            return;
                        }

                        // Отправляем видео, а затем удаляем сообщение "подождите"
                        bot.sendVideo(chatId, videoBuffer, { caption: "Вот ваше видео! ✨" })
                            .then(() => {
                                bot.deleteMessage(chatId, waitingMessageId);
                            })
                            .catch(telegramError => {
                                console.error('Ошибка при отправке видео в Telegram:', telegramError.message);
                                bot.deleteMessage(chatId, waitingMessageId); // Удаляем "подождите" даже при ошибке отправки
                                bot.sendMessage(chatId, `❌ Произошла ошибка при отправке видео. (Код ошибки: ${telegramError.code})`);
                            });
                    });
                });
            }).catch(err => {
                console.error("Не удалось отправить сообщение 'подождите':", err);
            });

    } else if (msg.text) { // Добавил проверку, что msg.text существует
        bot.sendMessage(chatId, "Это не похоже на ссылку TikTok. Пожалуйста, отправьте действительную ссылку.");
    }
});

// Обработка ошибок опроса (polling) для стабильности
bot.on('polling_error', (error) => {
    console.error(`Ошибка опроса: ${error.code} - ${error.message}`);
});
