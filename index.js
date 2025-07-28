const TelegramBot = require('node-telegram-bot-api');
const request = require('request');

// ВСТАВЬТЕ ВАШ ТОКЕН СЮДА
const token = '7557623448:AAECgkvrmLYu3jD6sEWtkFmX0VcVc95jNNE';

const bot = new TelegramBot(token, { polling: true });

console.log('Бот успешно запущен...');

bot.onText(/\/start/, (msg) => {
    // В группах команда /start может быть не нужна, отвечаем только в личных чатах
    if (msg.chat.type === 'private') {
        bot.sendMessage(msg.chat.id, "👋 Привет! Я бот для скачивания видео из TikTok без водяных знаков.\n\n✨ Просто отправь мне ссылку на видео.");
    }
});

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const chatType = msg.chat.type;

    // Определяем, есть ли у сообщения ID топика (темы)
    const topicId = msg.message_thread_id;

    // Создаем объект с опциями для ответа, чтобы всегда отвечать в нужный топик
    const replyOptions = {
        message_thread_id: topicId
    };

    // Игнорируем сообщения без текста (стикеры, фото и т.д.)
    if (!text) {
        return;
    }

    // Игнорируем команды, чтобы не обрабатывать их как ссылки
    if (text.startsWith('/')) {
        return;
    }

    // Проверяем, содержит ли сообщение ссылку на TikTok
    if (text.includes('tiktok.com/') || text.includes('vm.tiktok.com/')) {
        
        // Отправляем сообщение "подождите" и сохраняем его для последующего удаления
        bot.sendMessage(chatId, "⏳ Нашел! Обрабатываю ваше видео, пожалуйста, подождите...", replyOptions)
            .then((sentMessage) => {
                const waitingMessageId = sentMessage.message_id;

                const tikwmApiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`;

                request({ url: tikwmApiUrl, json: true }, (apiError, apiResponse, apiBody) => {
                    if (apiError || apiResponse.statusCode !== 200 || !apiBody || apiBody.code !== 0) {
                        console.error('Ошибка при обращении к API TikWM:', apiError || (apiBody ? apiBody.msg : 'Unknown Error'));
                        bot.deleteMessage(chatId, waitingMessageId);
                        bot.sendMessage(chatId, "❌ К сожалению, я не смог обработать эту ссылку. Возможно, она неверна или сервис временно недоступен.", replyOptions);
                        return;
                    }

                    const videoUrl = apiBody.data.play;
                    if (!videoUrl) {
                        console.error('В ответе от TikWM не найдена ссылка на видео.');
                        bot.deleteMessage(chatId, waitingMessageId);
                        bot.sendMessage(chatId, "❌ Не удалось найти видео для скачивания.", replyOptions);
                        return;
                    }

                    request({ url: videoUrl, encoding: null }, (videoError, videoResponse, videoBuffer) => {
                        if (videoError || videoResponse.statusCode !== 200) {
                            console.error('Ошибка при скачивании файла видео:', videoError);
                            bot.deleteMessage(chatId, waitingMessageId);
                            bot.sendMessage(chatId, "❌ Не удалось скачать видеофайл с сервера. Пожалуйста, попробуйте позже.", replyOptions);
                            return;
                        }

                        // Собираем опции для отправки видео (надпись + ID топика)
                        const videoOptions = {
                            caption: "Вот ваше видео! ✨",
                            ...replyOptions
                        };

                        bot.sendVideo(chatId, videoBuffer, videoOptions)
                            .then(() => {
                                bot.deleteMessage(chatId, waitingMessageId);
                            })
                            .catch(telegramError => {
                                console.error('Ошибка при отправке видео в Telegram:', telegramError.message);
                                bot.deleteMessage(chatId, waitingMessageId);
                                bot.sendMessage(chatId, `❌ Произошла ошибка при отправке видео. (Код ошибки: ${telegramError.code})`, replyOptions);
                            });
                    });
                });
            }).catch(err => {
                console.error("Не удалось отправить сообщение 'подождите':", err);
            });

    } else {
        // Если это НЕ ссылка на TikTok, отвечаем только в личных чатах
        if (chatType === 'private') {
            bot.sendMessage(chatId, "Это не похоже на ссылку TikTok. Пожалуйста, отправьте действительную ссылку.", replyOptions);
        }
        // Если это группа, бот просто проигнорирует сообщение.
    }
});

// Обработка ошибок опроса (polling) для стабильности
bot.on('polling_error', (error) => {
    console.error(`Ошибка опроса: ${error.code} - ${error.message}`);
});
