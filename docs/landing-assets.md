# Материалы лендинга

## Изображение

Файл: `client/public/images/charvak-weekend.webp`, 1536 × 1024, 194 224 байта.
Создан встроенным инструментом imagegen. Это иллюстрация цели, не фотография
пользователя и не отзыв. Исходник сохранён отдельно; для сайта выполнено кодирование
в WebP с качеством 82. Изображение загружается локально и отложенно.

### Финальный промпт

Use case: photorealistic-natural. Asset type: lifestyle photograph for the Kubyshka personal savings landing page, Russian-speaking people in Tashkent. Primary request: a candid, tangible image of the small goal people save for: a quiet weekend trip to Charvak reservoir in Uzbekistan. Wide landscape photograph, 3:2 composition. Scene: view from a simple picnic spot above a turquoise mountain reservoir, dry ochre foothills and pale rugged distant Tian Shan mountains, believable Central Asian autumn afternoon. Foreground on the lower right: one casually dressed person's hand pouring black tea from a small plain metal thermos into a ceramic cup on a sun-worn wooden picnic table, a corner of an olive canvas backpack. Frame as a spontaneous travel photograph on 35 mm film, natural uneven sunlight, subtle organic grain, unpolished real fabric and wood, calm and attainable rather than luxurious. Make the landscape the main subject, generous visible mountain and water area. Warm muted creams and earth with natural subdued turquoise water. No printed text, no captions, no logos, no money, no piggy bank, no cartoons, no staged smiling people, no fantasy landscape, no extreme saturated color, no studio aesthetic, no collage. This is an illustrative goal photograph, not testimonial evidence.

## Остальные визуальные элементы

Кубыш: существующий SVG-компонент `client/src/pet/Kubysh.tsx`, его реальные
настроения, костюмы, кормление и эволюция. Растровая замена персонажа не создавалась.
Иконки: установленная библиотека Phosphor. Шрифты: существующие Unbounded и Onest.
Интерфейсные примеры собраны в HTML/CSS и интерактивны; расчёт дневного бюджета
использует общую с сервером функцию `dailyBudget`.

Движение: GSAP и ScrollTrigger, очистка через matchMedia при смене маршрута.
При `prefers-reduced-motion: reduce` анимации появления и параллакс отключаются.
Документация: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
