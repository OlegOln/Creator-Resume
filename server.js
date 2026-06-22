const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { Document, Packer, Paragraph, TextRun, ImageRun, Table, TableRow, TableCell, WidthType, VerticalAlign, BorderStyle, UnderlineType } = require('docx');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// КЛЮЧ DEEPSEEK ЗАШИТ ЗДЕСЬ
const DEEPSEEK_API_KEY = 'sk-c657da24678c4dfe919fab15fe47e200';

// ОБНОВЛЕННЫЙ ПРОМПТ ДЛЯ РЕЗЮМЕ
const RESUME_PROMPT = `ТЫ – человек, который очень хочет устроится на работу.
Изучи приложенное резюме.
Проведи анализ навыков и умений.
Задача 1. На основе полученных данных составь резюме, которое будет проходить большинство ATS фильтров и будет привлекательным для работодателя.
Нужно учесть все изложенные факты и преподнести их в наиболее выгодном свете.
Если загружена Вакансия -то все дальнейшие шаги должны исполнятся с приближением к требованиям вакансии, но не копируя их.
Объем дополнительных навыков и опыта должен быть на уровне хорошего специалиста достаточно высокого уровня, но не должен превышать 50-70% от имеющихся фактически и должен с ними коррелироваться.
Количество навыков по владению различными инструментами и сервисами должен быть расширен. Инструменты должны быть актуальными в настоящее время.
Профессиональны достижения – больше в практической плоскости. Можно что-то добавить для улучшения впечатления.
Все учебные проекты переделать в выполнение практических задач. Не должно быть в резюме слов учебный проект или аналогичных словосочетаний.
В итоге должен опыт работы по специальности должен составлять от 1 до 2 лет. И хотя бы в одном месте он должен быть примерно 1 год. Если по датам не не получается – измени даты.
Все указанные факты о человеке должны проходить простейшую проверку на правдовость
Проверить. Что бы все указанные даты и навыки не противоречили друг-другу
Проверить возраст кандидата. Если он меньше 23 лет или больше 35 лет. Возраст и дату рождения в резюме не указывать.
Используй стиль изложения мыслей, который характерен для человека, указанного в данных возраста. Текст должен быть лаконичным, но не телеграфный стиль
Не использовать глагол участвовал. Вместо него использовать реализовал, проводил и тому подобные.
Текст должен быть «человечным», но без грамматических ошибок.
Результат представь в текстовом формате (используй разметку Markdown для заголовков и списков).
ОБЯЗАТЕЛЬНО: Начинай резюме с ФИО кандидата крупным заголовком (используй # ФИО). Сразу после ФИО укажи контакты и желаемую должность. Затем уже шли разделы ## Опыт работы, ## Навыки и т.д.
Задача 2. Если загружена вакансия, то в соответствии с подготовленным резюме нужно написать сопроводительное письмо. Если вакансия не загружена – сопроводительное письмо не делаем.
Что должно отражать сопроводительное письмо
Строгих требований к составлению сопроводительного письма нет. В нем можно указать:
должность, на которую претендует кандидат;
опыт работы, который важен для конкретной вакансии;
мотивацию соискателя ― почему он хочет работать именно в этом месте;
личные качества и навыки, которые пригодятся на данной позиции;
осведомленность о работе компании, ее недавних достижениях;
готовность выполнить тестовое задание и прийти на собеседование.
Объем письма 3-5 абзацев.`;

// НОВЫЙ ПРОМПТ ДЛЯ РАССКАЗА О СЕБЕ
const STORY_PROMPT = `Отвечай как HR в сфере ИТ с опытом 10 лет.
Мне нужно подготовить рассказ о себе на позицию, которая УКАЗАНА В ВАКАНСИИ в сфере деятельности : ОРИЕНТИРОВАТЬСЯ НА СФЕРУ ДЕЯТЕЛЬНОСТИ РАБОТОДАТЕЛЯ на 5-7 минут.
Если вакансия не загружена - используй позицию указанную в резюме, сфера деятельности коррелируется с опытом в вакансии.
Рассказ должен быть на русском языке с большим количеством ключевых слов для моей позиции и исходя из моего опыта работы. Не переписывай мое резюме, не используй много цифр так, как они плохо “считываются” собеседником. Лучше используй формулировки “улучшил”, “повысил”, “создал” и т.п.
Для самых важных навыков приведи примеры из моего резюме. Без цифр, но так, что бы собеседник понял, что это не пустые слова.
Используй для написания рассказа методы 3S(Succes,Strength,Situation) и метод Прошлое-настоящее-будушее. Методы приложены в приложении Методы
Рассказ должен быть составлен по плану:
Кто я такой
С чего начинаем
Чем занимаюсь сейчас
Почему я хороший специалист
Как я могу помочь компании.
Используй в рассказе следующую информацию из моего резюме
Мой опыт работы
Достижения с цифрами
Описание проектов
Описание рабочих процессов
Описание сильных навыков.
Стиль изложения должен соответствовать моему возрасту, указанному в резюме.

Приложение Методы

«Три S»
Этот фреймворк помогает показать твою ценность через результат, сильные стороны и пользу для компании.
1. Success (Успех)
Коротко расскажи, в чём был успешен. Это может быть: результат, достижение, улучшение процесса, решённая проблема
2. Strength (Сильные стороны)
Выбери один конкретный навык, который считаешь своей сильной стороной, и: назови его, кратко приведи пример, где он помог добиться результата
3. Situation (Применимость)
Поясни, как этот опыт будет полезен в новой компании: какие задачи готов решать, с какими проблемами умеешь работать, что тебе важно для профессионального роста

Фреймворк «Прошлое — настоящее — будущее»
Этот фреймворк помогает выстроить логичный и понятный рассказ о себе, особенно если рекрутер просит рассказать о карьерном пути.
Он позволяет показать развитие, текущий уровень и мотивацию без лишних деталей.
1. Прошлое
Этот блок занимает до 30 секунд. Твоя задача — кратко обозначить, как ты пришел в профессию и с чего всё начиналось. Обычно сюда входят: как начинал карьеру, почему выбрал эту сферу, ключевые этапы без подробностей. Важно: это обзор, а не подробный рассказ
2. Настоящее
Основной акцент рассказа. Здесь описываем, где ты сейчас и чем занимаешься. Можно опираться на: последнее место работы, основные навыки и обязанности, как решаешь задачи, сильные стороны
3. Будущее
В этом блоке важно показать направление и мотивацию. Расскажи: какой вклад хочешь внести, почему интересна эта компания, какие задачи и цели привлекают, почему твой опыт подходит под эту роль. Задача — связать свой прошлый опыт и настоящее с будущей ролью.

Результат представь в текстовом формате с использованием заголовков и списков.`;


async function extractText(filePath, originalName) {
    const ext = path.extname(originalName).toLowerCase();
    try {
        if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } else if (ext === '.docx') {
            const result = await mammoth.extractRawText({path: filePath});
            return result.value;
        } else if (ext === '.doc') {
            // НОВАЯ ОБРАБОТКА СТАРЫХ .doc ФАЙЛОВ
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(filePath);
            return extracted.getBody();
        } else if (ext === '.rtf') {
            throw new Error("Формат .rtf не поддерживается. Пожалуйста, пересохраните файл как .docx или .pdf.");
        } else {
            throw new Error(`Неподдерживаемый формат файла: ${ext}`);
        }
    } catch (err) {
        if (err.message.includes("не поддерживается") || err.message.includes("Неподдерживаемый формат")) throw err;
        throw new Error("Произошла ошибка при чтении файла.");
    }
}

// Универсальная функция вызова API
async function callDeepSeekAPI(systemPrompt, userPrompt) {
    const response = await axios.post('https://api.deepseek.com/chat/completions', {
        model: "deepseek-chat",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7
    }, { headers: { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` } });
    return response.data.choices[0].message.content;
}

async function createDocx(markdownText, imageData, isResume = true) {
    const lines = markdownText.split('\n');
    const documentChildren = [];
    
    let nameText = "";
    const introLines = []; 
    const bodyLines = [];  
    
    let bodyStarted = false;

    for (let line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('# ')) {
            nameText = line.replace('# ', '').replace(/\*\*/g, '').trim();
            continue;
        }
        
        if (line.startsWith('## ') || line.startsWith('### ')) {
            bodyStarted = true;
        }

        if (bodyStarted) {
            bodyLines.push(line);
        } else {
            introLines.push(line); 
        }
    }

    const noBorders = {
        top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
        left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
    };

    if (isResume) {
        documentChildren.push(new Paragraph({ 
            spacing: { after: 100 },
            children: [new TextRun({ text: nameText, bold: true, font: "Arial", size: 40 })] 
        }));

        const leftCellChildren = [];
        if (imageData) {
            leftCellChildren.push(new Paragraph({ children: [new ImageRun({ data: imageData, transformation: { width: 120, height: 160 } })] }));
        } else {
            leftCellChildren.push(new Paragraph({ children: [] })); 
        }

        const rightCellChildren = [];
        for (let line of introLines) {
            let cleanLine = line.replace(/\*\*/g, '').replace(/^- /, '');
            rightCellChildren.push(new Paragraph({
                spacing: { before: 40 },
                children: [new TextRun({ text: cleanLine, font: "Arial", size: 24 })]
            }));
        }

        const topTable = new Table({
            borders: {
                top: { style: BorderStyle.NONE, size: 0 }, bottom: { style: BorderStyle.NONE, size: 0 },
                left: { style: BorderStyle.NONE, size: 0 }, right: { style: BorderStyle.NONE, size: 0 },
                insideHorizontal: { style: BorderStyle.NONE, size: 0 }, insideVertical: { style: BorderStyle.NONE, size: 0 },
            },
            rows: [
                new TableRow({
                    children: [
                        new TableCell({ width: { size: 2200, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: leftCellChildren }),
                        new TableCell({ width: { size: 7500, type: WidthType.DXA }, verticalAlign: VerticalAlign.TOP, borders: noBorders, children: rightCellChildren })
                    ]
                })
            ]
        });

        documentChildren.push(topTable);
        documentChildren.push(new Paragraph({ spacing: { before: 200 }, children: [] }));

        for (let line of bodyLines) {
            let cleanLine = line.replace(/\*\*/g, ''); 
            let paragraphOptions = { spacing: { before: 80 }, children: [] };

            if (line.startsWith('### ') || line.startsWith('## ')) {
                let headerText = cleanLine.replace(/^###\s*/, '').replace(/^##\s*/, ''); 
                paragraphOptions.children.push(new TextRun({ text: headerText, bold: true, font: "Arial", size: 28, underline: { type: UnderlineType.SINGLE } }));
                paragraphOptions.spacing = { before: 240, after: 80 };
            } else if (line.startsWith('- ')) {
                paragraphOptions.bullet = { level: 0 };
                paragraphOptions.children.push(new TextRun({ text: cleanLine.replace(/^- /, ''), font: "Arial", size: 24 })); 
            } else {
                paragraphOptions.children.push(new TextRun({ text: cleanLine, font: "Arial", size: 24 }));
            }
            documentChildren.push(new Paragraph(paragraphOptions));
        }

    } else {
        // Для сопроводительного и рассказа (без таблиц)
        if (nameText) documentChildren.push(new Paragraph({ children: [new TextRun({ text: nameText, bold: true, size: 28 })] }));
        const allTextLines = [...introLines, ...bodyLines];
        for (let line of allTextLines) {
            let cleanLine = line.replace(/\*\*/g, '').replace(/^###\s*/, '').replace(/^##\s*/, '');
            let paragraphOptions = { spacing: { before: 80 }, children: [] };
            if (line.startsWith('## ') || line.startsWith('### ')) {
                paragraphOptions.children.push(new TextRun({ text: cleanLine, bold: true, font: "Arial", size: 28, underline: { type: UnderlineType.SINGLE } })); 
            } else if (line.startsWith('- ')) {
                paragraphOptions.bullet = { level: 0 };
                paragraphOptions.children.push(new TextRun({ text: cleanLine.replace(/^- /, ''), font: "Arial", size: 24 }));
            } else {
                paragraphOptions.children.push(new TextRun({ text: cleanLine, font: "Arial", size: 24 }));
            }
            documentChildren.push(new Paragraph(paragraphOptions));
        }
    }

    const doc = new Document({
        styles: { default: { document: { run: { font: "Arial", size: 24 } } } },
        sections: [{ properties: {}, children: documentChildren }]
    });
    return await Packer.toBuffer(doc);
}

app.post('/api/generate', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'vacancy', maxCount: 1 },
    { name: 'photo', maxCount: 1 }
]), async (req, res) => {
    try {
        let resumeText = "", vacancyText = "", photoBuffer = null;

        if (req.files['resume']) resumeText = await extractText(req.files['resume'][0].path, req.files['resume'][0].originalname);
        else if (req.body.manualData) {
            const m = JSON.parse(req.body.manualData);
            let manualParts = [];
            if(m.name) manualParts.push(`ФИО: ${m.name}`);
            if(m.contacts) manualParts.push(`Контакты: ${m.contacts}`);
            if(m.position) manualParts.push(`Желаемая должность: ${m.position}`);
            if(m.experience) manualParts.push(`Опыт работы: ${m.experience}`);
            if(m.skills) manualParts.push(`Навыки: ${m.skills}`);
            if(m.education) manualParts.push(`Образование: ${m.education}`);
            if(m.about) manualParts.push(`О себе: ${m.about}`);
            resumeText = manualParts.join('\n');
        } else return res.status(400).json({ error: "Нет данных резюме" });

        if (!resumeText || resumeText.trim().length < 30) throw new Error("Извлеченный текст слишком короткий.");

        if (req.files['vacancy']) vacancyText = await extractText(req.files['vacancy'][0].path, req.files['vacancy'][0].originalname);
        if (req.files['photo']) photoBuffer = fs.readFileSync(req.files['photo'][0].path);

        // 1. ГЕНЕРАЦИЯ РЕЗЮМЕ И ПИСЬМА
        console.log("Отправляем в DeepSeek (Резюме)...");
        let userPromptResume = `Вот данные кандидата для составления резюме:\n\n${resumeText}`;
        if (vacancyText) userPromptResume += `\n\nВот описание вакансии:\n${vacancyText}`;
        else userPromptResume += `\n\nВакансия не загружена. Сопроводительное письмо писать не нужно, только резюме.`;

        const aiResult = await callDeepSeekAPI(RESUME_PROMPT, userPromptResume);
        console.log("Генерация DOCX (Резюме)...");

        let resumeMd = aiResult, coverMd = "";
        if (vacancyText) {
            const coverIndex = aiResult.toLowerCase().indexOf("сопроводительное письмо");
            if (coverIndex !== -1) { resumeMd = aiResult.substring(0, coverIndex); coverMd = aiResult.substring(coverIndex); }
        }

        const resumeBuffer = await createDocx(resumeMd, photoBuffer, true);
        const resumeFileName = `resume_${Date.now()}.docx`;
        fs.writeFileSync(path.join(__dirname, 'public', resumeFileName), resumeBuffer);

        let coverUrl = null;
        if (coverMd) {
            const coverBuffer = await createDocx(coverMd, null, false);
            const coverFileName = `cover_${Date.now()}.docx`;
            fs.writeFileSync(path.join(__dirname, 'public', coverFileName), coverBuffer);
            coverUrl = `/${coverFileName}`;
        }

        // 2. ГЕНЕРАЦИЯ РАССКАЗА О СЕБЕ (если чекбокс включен)
        let storyUrl = null;
        const needStory = req.body.needStory === 'true';
        if (needStory) {
            console.log("Отправляем в DeepSeek (Рассказ)...");
            let userPromptStory = `Вот мое резюме/данные:\n\n${resumeText}`;
            if (vacancyText) userPromptStory += `\n\nВот вакансия, на которую я претендую:\n${vacancyText}`;
            else userPromptStory += `\n\nВакансия не загружена. Используй позицию из резюме, сфера деятельности коррелируется с опытом.`;

            const storyResult = await callDeepSeekAPI(STORY_PROMPT, userPromptStory);
            console.log("Генерация DOCX (Рассказ)...");
            
            const storyBuffer = await createDocx(storyResult, null, false);
            const storyFileName = `story_${Date.now()}.docx`;
            fs.writeFileSync(path.join(__dirname, 'public', storyFileName), storyBuffer);
            storyUrl = `/${storyFileName}`;
        }

        if (req.files) Object.values(req.files).flat().forEach(f => { if (fs.existsSync(f.path)) fs.unlinkSync(f.path); });

        res.json({ success: true, resumeUrl: `/${resumeFileName}`, coverUrl: coverUrl, storyUrl: storyUrl });
    } catch (error) {
        console.error("=== ОШИБКА ===", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.use(express.static('public'));
app.use(express.static(__dirname));

const PORT = process.env.PORT || 3000;
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('public')) fs.mkdirSync('public');

app.listen(PORT, () => console.log(`✅ Сервер запущен на порту ${PORT}`));