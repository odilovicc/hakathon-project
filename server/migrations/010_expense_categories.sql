-- Дополняем системные категории без изменения идентификаторов старых записей.
-- Личные категории и ранее записанные операции остаются на месте.
WITH additions(name, icon, color) AS (
  VALUES
    ('Коммунальные услуги', 'Lightbulb', 'honey'),
    ('Такси', 'Taxi', 'iris'),
    ('Автомобиль', 'Car', 'iris'),
    ('Дом и быт', 'Armchair', 'clay'),
    ('Образование', 'GraduationCap', 'iris'),
    ('Дети', 'Baby', 'rose'),
    ('Красота и уход', 'Scissors', 'rose'),
    ('Спорт', 'Barbell', 'moss'),
    ('Питомцы', 'PawPrint', 'clay'),
    ('Путешествия', 'Airplane', 'iris'),
    ('Техника', 'Laptop', 'ink-soft'),
    ('Ремонт', 'Hammer', 'clay'),
    ('Кредиты и долги', 'CreditCard', 'brick'),
    ('Налоги и штрафы', 'Receipt', 'brick'),
    ('Благотворительность', 'HandHeart', 'moss'),
    ('Услуги', 'Handshake', 'ink-soft'),
    ('Кофе и перекусы', 'Coffee', 'honey')
)
INSERT INTO categories (user_id, name, kind, icon, color)
SELECT NULL, a.name, 'expense', a.icon, a.color
FROM additions a
WHERE NOT EXISTS (
  SELECT 1 FROM categories c
  WHERE c.user_id IS NULL AND c.kind = 'expense' AND kb_lower(c.name) = kb_lower(a.name)
);
