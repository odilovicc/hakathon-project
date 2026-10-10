-- Схема «Кубышки». Деньги хранятся в минимальных единицах валюты (целые).
-- Даты дней хранятся как 'YYYY-MM-DD', моменты времени как ISO 8601 UTC.

CREATE TABLE users (
  id            INTEGER PRIMARY KEY,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  currency      TEXT    NOT NULL CHECK (currency IN ('RUB', 'KZT', 'UZS', 'USD')),
  theme         TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE profiles (
  user_id             INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  monthly_income      INTEGER NOT NULL DEFAULT 0 CHECK (monthly_income >= 0),
  spend_range         TEXT    CHECK (spend_range IN ('under_half', 'about_half', 'almost_all', 'over')),
  has_debt            INTEGER NOT NULL DEFAULT 0 CHECK (has_debt IN (0, 1)),
  debt_amount         INTEGER NOT NULL DEFAULT 0 CHECK (debt_amount >= 0),
  -- В ТЗ поле называется cushion_amount, но онбординг спрашивает уровень, а не сумму.
  cushion_level       TEXT    CHECK (cushion_level IN ('none', 'month', 'three_months', 'more')),
  payday_day          INTEGER NOT NULL DEFAULT 1 CHECK (payday_day BETWEEN 1 AND 31),
  work_hours_per_day  REAL    NOT NULL DEFAULT 8 CHECK (work_hours_per_day > 0 AND work_hours_per_day <= 24),
  work_days_per_month INTEGER NOT NULL DEFAULT 22 CHECK (work_days_per_month BETWEEN 1 AND 31),
  onboarding_done     INTEGER NOT NULL DEFAULT 0 CHECK (onboarding_done IN (0, 1))
);

CREATE TABLE pets (
  id                INTEGER PRIMARY KEY,
  user_id           INTEGER NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  species           TEXT    NOT NULL DEFAULT 'kubysh',
  mood              INTEGER NOT NULL DEFAULT 50 CHECK (mood BETWEEN 0 AND 100),
  care_days         INTEGER NOT NULL DEFAULT 0 CHECK (care_days >= 0),
  last_checkin_date TEXT,
  -- До какого дня включительно уже начислен штраф за пропуски.
  last_decay_date   TEXT,
  stage             INTEGER NOT NULL DEFAULT 1 CHECK (stage BETWEEN 1 AND 3),
  created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE goals (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title         TEXT    NOT NULL,
  target_amount INTEGER NOT NULL CHECK (target_amount > 0),
  deadline      TEXT,
  saved_amount  INTEGER NOT NULL DEFAULT 0 CHECK (saved_amount >= 0),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX goals_user_status ON goals (user_id, status);

CREATE TABLE goal_events (
  id         INTEGER PRIMARY KEY,
  goal_id    INTEGER NOT NULL REFERENCES goals (id) ON DELETE CASCADE,
  type       TEXT    NOT NULL CHECK (type IN ('deposit', 'withdraw', 'saving_transfer', 'museum_transfer')),
  amount     INTEGER NOT NULL CHECK (amount > 0),
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX goal_events_goal ON goal_events (goal_id, created_at);

CREATE TABLE categories (
  id      INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users (id) ON DELETE CASCADE, -- NULL для системных
  name    TEXT    NOT NULL,
  kind    TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
  icon    TEXT    NOT NULL,
  color   TEXT    NOT NULL
);
CREATE INDEX categories_user ON categories (user_id);

CREATE TABLE transactions (
  id                 INTEGER PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind               TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
  amount             INTEGER NOT NULL CHECK (amount > 0),
  category_id        INTEGER NOT NULL REFERENCES categories (id),
  note               TEXT,
  date               TEXT    NOT NULL,
  is_recurring_guess INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring_guess IN (0, 1)),
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX transactions_user_date ON transactions (user_id, date);

CREATE TABLE checkins (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date        TEXT    NOT NULL,
  spent_today INTEGER NOT NULL DEFAULT 0 CHECK (spent_today >= 0),
  feeling     INTEGER NOT NULL CHECK (feeling BETWEEN 1 AND 3),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, date)
);

-- В ТЗ слоты 'hat'|'scarf'|'glasses'|'home'|'aura', но среди костюмов есть плащ и корона,
-- а аура зависит от дней заботы. Поэтому слоты: голова, шарф, очки, домик, плащ.
CREATE TABLE costumes (
  id             INTEGER PRIMARY KEY,
  key            TEXT    NOT NULL UNIQUE,
  slot           TEXT    NOT NULL CHECK (slot IN ('head', 'scarf', 'glasses', 'home', 'cloak')),
  name           TEXT    NOT NULL,
  unlock_percent INTEGER NOT NULL CHECK (unlock_percent BETWEEN 1 AND 100)
);

CREATE TABLE pet_costumes (
  pet_id         INTEGER NOT NULL REFERENCES pets (id) ON DELETE CASCADE,
  costume_id     INTEGER NOT NULL REFERENCES costumes (id),
  unlocked_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  is_active      INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
  is_locked_back INTEGER NOT NULL DEFAULT 0 CHECK (is_locked_back IN (0, 1)),
  PRIMARY KEY (pet_id, costume_id)
);

CREATE TABLE museum (
  id                  INTEGER PRIMARY KEY,
  user_id             INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title               TEXT    NOT NULL,
  price               INTEGER NOT NULL CHECK (price > 0),
  category_id         INTEGER REFERENCES categories (id),
  transferred_to_goal INTEGER NOT NULL DEFAULT 0 CHECK (transferred_to_goal IN (0, 1)),
  created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX museum_user ON museum (user_id);

CREATE TABLE subscriptions (
  id            INTEGER PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  amount        INTEGER NOT NULL CHECK (amount > 0),
  period        TEXT    NOT NULL DEFAULT 'month' CHECK (period IN ('month', 'year')),
  detected_auto INTEGER NOT NULL DEFAULT 0 CHECK (detected_auto IN (0, 1)),
  status        TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unused', 'cancelled')),
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX subscriptions_user ON subscriptions (user_id);

CREATE TABLE stores (
  id      INTEGER PRIMARY KEY,
  chain   TEXT NOT NULL,
  name    TEXT NOT NULL,
  address TEXT NOT NULL,
  lat     REAL NOT NULL,
  lng     REAL NOT NULL,
  city    TEXT NOT NULL
);
CREATE INDEX stores_city ON stores (city);

CREATE TABLE products (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT NOT NULL,
  unit     TEXT NOT NULL,
  brand    TEXT
);

CREATE TABLE prices (
  id         INTEGER PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  store_id   INTEGER NOT NULL REFERENCES stores (id) ON DELETE CASCADE,
  price      INTEGER NOT NULL CHECK (price > 0),
  is_promo   INTEGER NOT NULL DEFAULT 0 CHECK (is_promo IN (0, 1)),
  updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (product_id, store_id)
);
CREATE INDEX prices_store ON prices (store_id);

CREATE TABLE deal_logs (
  id           INTEGER PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  store_id     INTEGER NOT NULL REFERENCES stores (id),
  saved_amount INTEGER NOT NULL CHECK (saved_amount >= 0),
  transferred  INTEGER NOT NULL DEFAULT 0 CHECK (transferred IN (0, 1)),
  created_at   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX deal_logs_user ON deal_logs (user_id);
