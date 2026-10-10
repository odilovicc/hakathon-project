-- Системные категории (user_id NULL). icon — имя иконки Phosphor, color — токен палитры.
INSERT INTO categories (user_id, name, kind, icon, color) VALUES
  (NULL, 'Продукты',          'expense', 'ShoppingCart', 'clay'),
  (NULL, 'Кафе и доставка',   'expense', 'ForkKnife',    'honey'),
  (NULL, 'Транспорт',         'expense', 'Bus',          'iris'),
  (NULL, 'Жильё',             'expense', 'House',        'brick'),
  (NULL, 'Связь и подписки',  'expense', 'DeviceMobile', 'iris'),
  (NULL, 'Здоровье',          'expense', 'FirstAid',     'moss'),
  (NULL, 'Одежда',            'expense', 'TShirt',       'rose'),
  (NULL, 'Развлечения',       'expense', 'FilmSlate',    'honey'),
  (NULL, 'Подарки',           'expense', 'Gift',         'clay'),
  (NULL, 'Другое',            'expense', 'DotsThree',    'ink-soft'),
  (NULL, 'Зарплата',          'income',  'Briefcase',    'moss'),
  (NULL, 'Подработка',        'income',  'Laptop',       'moss'),
  (NULL, 'Подарок',           'income',  'Gift',         'moss'),
  (NULL, 'Возврат',           'income',  'ArrowUUpLeft', 'moss'),
  (NULL, 'Другое',            'income',  'DotsThree',    'moss');

-- Костюмы по проценту цели. 100% — эволюция, отдельного костюма нет.
INSERT INTO costumes (key, slot, name, unlock_percent) VALUES
  ('scarf',   'scarf',   'Шарф',   15),
  ('hat',     'head',    'Шапка',  30),
  ('glasses', 'glasses', 'Очки',   45),
  ('home',    'home',    'Домик',  60),
  ('cloak',   'cloak',   'Плащ',   75),
  ('crown',   'head',    'Корона', 90);
