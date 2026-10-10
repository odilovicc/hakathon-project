import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  Plus,
  Minus,
  List,
  X,
} from '@phosphor-icons/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { dailyBudget } from '@shared/budget';
import { formatMoney } from '@/lib/money';
import { ThemeSwitch } from '@/ui/ThemeSwitch';
import { Kubysh } from '@/pet/Kubysh';
import '@/styles/landing.css';

gsap.registerPlugin(ScrollTrigger);
const sum = (minor: number) => formatMoney(minor, 'UZS');
const startSaved = 210_000_000;
const target = 300_000_000;

const questions = [
  [
    'Это бесплатно?',
    'Да. Создание аккаунта и доступ к текущим функциям Кубышки бесплатны. Банковская карта для регистрации не нужна.',
  ],
  [
    'Нужно подключать банковскую карту?',
    'Нет. Ты самостоятельно записываешь доходы и расходы. Приложение не запрашивает доступ к банковскому счёту и не списывает деньги.',
  ],
  [
    'Откуда берётся остаток на день?',
    'Кубышка берёт доход, вычитает регулярные платежи, плановый взнос на цель и прошлые расходы. Оставшееся делится на дни до зарплаты. Покупки сегодня вычитаются из дневного лимита целиком. Подробный расчёт можно раскрыть в кабинете.',
  ],
  [
    'Кубышка действительно переводит деньги в копилку?',
    'Кубышка ведёт учёт накоплений. Деньги нужно отложить самостоятельно, а затем записать сумму в цель. Запись обновит прогресс и покормит Кубыша.',
  ],
  [
    'Можно добавить свою категорию расходов?',
    'Да. В форме операции есть 27 готовых категорий расходов, поиск по ним и кнопка «Своя категория». Новую категорию можно создать и сразу выбрать для записи.',
  ],
  [
    'Что будет, если пропущу день или сниму накопления?',
    'Пропуск меняет настроение Кубыша, но не обнуляет дни заботы. Если накоплений станет меньше, некоторые костюмы вернутся в сундук. Они снова откроются, когда ты достигнешь нужного прогресса.',
  ],
];

function StartLink({
  children = 'Начать бесплатно',
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link to="/register?currency=UZS" className={`lp-button ${className}`}>
      {children}
      <ArrowUpRight size={20} aria-hidden />
    </Link>
  );
}

function DayExample() {
  const [spent, setSpent] = useState(3_500_000);
  const [message, setMessage] = useState('');
  const budget = dailyBudget({
    income: 420_000_000,
    mandatory: 180_000_000,
    goalContribution: 60_000_000,
    spentInPeriod: 126_000_000 + spent,
    spentToday: spent,
    period: { daysLeft: 6, daysTotal: 30 },
  });
  function add(amount: number, name: string) {
    setSpent((value) => value + amount);
    setMessage(`Записано: ${name}, ${sum(amount)}. Остаток уменьшился на эту сумму.`);
  }
  return (
    <div className="lp-day-example">
      <div className="lp-example-top">
        <span>
          <span className="lp-status-dot" />
          Сегодня
        </span>
        <span>Интерактивный пример</span>
      </div>
      <h3>Сколько можно потратить?</h3>
      <dl className="lp-budget-ledger">
        <div>
          <dt>Лимит на начало дня</dt>
          <dd>{sum(budget.dailyLimit)}</dd>
        </div>
        <div>
          <dt>Уже потрачено сегодня</dt>
          <dd>{sum(spent)}</dd>
        </div>
        <div className={budget.todayRemaining < 0 ? 'is-over' : 'lp-budget-left'}>
          <dt>{budget.todayRemaining < 0 ? 'Лимит превышен на' : 'Можно потратить ещё'}</dt>
          <dd aria-live="polite" aria-atomic="true">
            {sum(Math.abs(budget.todayRemaining))}
          </dd>
        </div>
      </dl>
      <p className="lp-demo-instruction">Запиши покупку и посмотри на остаток.</p>
      <div className="lp-demo-expenses">
        <button type="button" onClick={() => add(1_800_000, 'кофе')}>
          <Plus size={15} aria-hidden />
          Кофе · 18 000
        </button>
        <button type="button" onClick={() => add(3_500_000, 'продукты')}>
          <Plus size={15} aria-hidden />
          Продукты · 35 000
        </button>
      </div>
      <div className="lp-example-bottom">
        <span>До зарплаты 6 дней</span>
        <button
          type="button"
          onClick={() => {
            setSpent(3_500_000);
            setMessage('Пример сброшен. Уже потрачено 35 000 сум.');
          }}
        >
          Сбросить
        </button>
      </div>
      <p className="lp-demo-status" role="status">
        {message || 'Пример работает здесь. Твои данные не изменяются.'}
      </p>
    </div>
  );
}

function GoalExample() {
  const [saved, setSaved] = useState(startSaved);
  const [feed, setFeed] = useState(0);
  const progress = Math.round((saved / target) * 100);
  const completed = saved >= target;
  return (
    <div className="lp-goal-example">
      <div className="lp-goal-top">
        <span>Твоя цель · пример</span>
        <span>{progress}%</span>
      </div>
      <div className="lp-goal-pet">
        <Kubysh
          mood={completed ? 100 : 76}
          stage={completed ? 2 : 1}
          costumes={
            progress >= 75 ? ['scarf', 'hat', 'glasses', 'cloak'] : ['scarf', 'hat', 'glasses']
          }
          auraTier="ember"
          size={240}
          feedKey={feed}
        />
        <p>{completed ? 'Мы едем?' : 'Деньги остаются. Я расту.'}</p>
      </div>
      <div className="lp-goal-details">
        <h3>Выходные в Чарваке</h3>
        <p>
          <strong>{sum(saved)}</strong>
          <span>из {sum(target)}</span>
        </p>
        <div
          className="lp-goal-track"
          role="progressbar"
          aria-label="Прогресс демонстрационной цели"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ transform: `scaleX(${saved / target})` }} />
        </div>
      </div>
      <button
        className="lp-goal-feed"
        type="button"
        disabled={completed}
        onClick={() => {
          setSaved((amount) => Math.min(target, amount + 10_000_000));
          setFeed((n) => n + 1);
        }}
      >
        <Plus size={18} aria-hidden />
        {completed ? 'Цель достигнута' : 'Попробовать отложить 100 000 сум'}
      </button>
      <div className="lp-goal-caption">
        <span role="status">
          {completed
            ? 'В примере цель достигнута, Кубыш вырос.'
            : 'Демонстрация. Настоящие деньги не переводятся.'}
        </span>
        <button type="button" onClick={() => setSaved(startSaved)}>
          Сбросить
        </button>
      </div>
    </div>
  );
}

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    const previous = document.title;
    document.title = 'Кубышка — деньги на сегодня. Накопления на своё.';
    const mm = gsap.matchMedia();
    mm.add(
      '(prefers-reduced-motion: no-preference)',
      () => {
        gsap.from('.lp-hero-copy > *', {
          y: 22,
          opacity: 0,
          stagger: 0.09,
          duration: 0.85,
          ease: 'power3.out',
          clearProps: 'all',
        });
        gsap.from('.lp-hero-visual', {
          y: 30,
          opacity: 0,
          duration: 1.1,
          delay: 0.15,
          ease: 'power3.out',
          clearProps: 'all',
        });
        gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((element) => {
          gsap.from(element, {
            y: 28,
            opacity: 0,
            duration: 0.85,
            ease: 'power3.out',
            clearProps: 'all',
            scrollTrigger: { trigger: element, start: 'top 91%', once: true },
          });
        });
        const photo = root.current?.querySelector('.lp-dream-photo img');
        if (photo)
          gsap.fromTo(
            photo,
            { yPercent: -5 },
            {
              yPercent: 5,
              ease: 'none',
              scrollTrigger: {
                trigger: '.lp-dream-photo',
                start: 'top bottom',
                end: 'bottom top',
                scrub: 1,
              },
            },
          );
      },
      root,
    );
    return () => {
      mm.revert();
      document.title = previous;
    };
  }, []);
  useEffect(() => {
    if (!menu) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(false);
        root.current?.querySelector<HTMLButtonElement>('.lp-menu')?.focus();
      }
    };
    document.addEventListener('keydown', dismiss);
    return () => document.removeEventListener('keydown', dismiss);
  }, [menu]);
  return (
    <div className="landing" ref={root}>
      <a href="#landing-main" className="lp-skip">
        К содержимому
      </a>
      <header className="lp-header lp-container">
        <Link className="lp-brand" to="/" aria-label="Кубышка, главная">
          кубышка<span>.</span>
        </Link>
        <nav
          className={menu ? 'lp-nav is-open' : 'lp-nav'}
          id="landing-navigation"
          aria-label="О продукте"
        >
          <a href="#how-it-works" onClick={() => setMenu(false)}>
            Как работает
          </a>
          <a href="#your-goal" onClick={() => setMenu(false)}>
            Твой Кубыш
          </a>
          <a href="#questions" onClick={() => setMenu(false)}>
            Вопросы
          </a>
          <Link to="/login" className="lp-mobile-login">
            Войти в кабинет
          </Link>
        </nav>
        <div className="lp-header-actions">
          <ThemeSwitch />
          <Link to="/login" className="lp-login">
            Войти
            <ArrowUpRight size={17} aria-hidden />
          </Link>
          <button
            className="lp-menu"
            type="button"
            aria-expanded={menu}
            aria-controls="landing-navigation"
            aria-label={menu ? 'Закрыть меню' : 'Открыть меню'}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </header>
      <main id="landing-main">
        <section className="lp-hero lp-container" aria-labelledby="hero-heading">
          <div className="lp-hero-copy">
            <p className="lp-kicker">
              <span className="lp-status-dot" />
              Личный бюджет с характером
            </p>
            <h1 id="hero-heading">
              Деньги уходят.
              <br />А твои <span>планы?</span>
            </h1>
            <p className="lp-hero-description">
              Пойми, сколько можно потратить сегодня.
              <br className="lp-desktop-break" /> И начни откладывать на то, чего хочется тебе.
            </p>
            <div className="lp-hero-actions">
              <StartLink>Завести свою Кубышку</StartLink>
              <a className="lp-text-link" href="#how-it-works">
                Сначала посмотреть
                <ArrowDown size={17} aria-hidden />
              </a>
            </div>
            <p className="lp-quiet">Бесплатно. Без подключения банковской карты.</p>
          </div>
          <div className="lp-hero-visual">
            <div className="lp-hero-caption">
              <span>Меньше «куда всё делось?»</span>
              <span>Больше «я знаю».</span>
            </div>
            <DayExample />
            <div className="lp-hero-pet">
              <Kubysh mood={78} stage={1} auraTier="ember" size={160} />
              <p>
                У тебя планы.
                <br />У меня аппетит.
              </p>
            </div>
          </div>
          <div className="lp-hero-foot">
            <span>Для повседневной жизни в Ташкенте</span>
            <span>Сумы. Свои цели. Понятные числа.</span>
            <a href="#the-problem" aria-label="Дальше: куда уходят деньги">
              <ArrowDown size={22} />
            </a>
          </div>
        </section>

        <section
          className="lp-problem lp-container"
          id="the-problem"
          aria-labelledby="problem-heading"
        >
          <div className="lp-problem-copy" data-reveal>
            <p className="lp-section-label">Знакомая история</p>
            <h2 id="problem-heading">
              «Отложу то,
              <br />
              что останется».
            </h2>
            <p className="lp-problem-answer">А потом ничего не остаётся.</p>
            <p>
              Кофе по пути. Такси вместо автобуса. Подписка, про которую забыл. По отдельности
              немного. Вместе съедают деньги на важное.
            </p>
            <p className="lp-problem-conclusion">Кубышка помогает заметить это раньше.</p>
          </div>
          <div className="lp-receipt" data-reveal>
            <span className="lp-receipt-label">Незаметно за день</span>
            <ul>
              <li>
                <span>Кофе по пути</span>
                <span>18 000</span>
              </li>
              <li>
                <span>Поездка на такси</span>
                <span>35 000</span>
              </li>
              <li>
                <span>Ещё одна подписка</span>
                <span>39 000</span>
              </li>
            </ul>
            <div className="lp-receipt-total">
              <span>Уже</span>
              <strong>
                92 000 <small>сум</small>
              </strong>
            </div>
            <p>
              Пример расходов.
              <br />
              Твои суммы могут быть другими.
            </p>
          </div>
        </section>

        <section className="lp-how lp-container" id="how-it-works" aria-labelledby="how-heading">
          <div className="lp-section-heading" data-reveal>
            <p className="lp-section-label">От «куда ушло» к «вот на что»</p>
            <h2 id="how-heading">
              У денег появляется план.
              <br />У тебя больше ясности.
            </h2>
          </div>
          <div className="lp-step">
            <div className="lp-step-number">01</div>
            <div className="lp-step-copy" data-reveal>
              <h3>
                Сначала жизнь.
                <br />
                Потом свободный остаток.
              </h3>
              <p>
                Укажи доход, регулярные платежи и цель. Кубышка учтёт их и покажет, сколько осталось
                на повседневные покупки до зарплаты.
              </p>
              <a href="#hero-heading" className="lp-text-link">
                Попробовать на примере
                <ArrowUpRight size={18} aria-hidden />
              </a>
            </div>
            <div className="lp-plan" data-reveal>
              <div>
                <span>Доход за месяц</span>
                <strong>4 200 000 сум</strong>
              </div>
              <div>
                <span>Регулярные платежи</span>
                <strong>− 1 800 000 сум</strong>
              </div>
              <div>
                <span>Плановый взнос на цель</span>
                <strong>− 600 000 сум</strong>
              </div>
              <p>
                <Check size={18} aria-hidden />
                Остаток распределится на дни до зарплаты
              </p>
              <small>Условный пример. В кабинете расчёт учитывает уже записанные расходы.</small>
            </div>
          </div>
          <div className="lp-step lp-step-second">
            <div className="lp-step-number">02</div>
            <div className="lp-step-copy" data-reveal>
              <h3>
                Находи деньги
                <br />в привычных расходах.
              </h3>
              <p>
                Заметь ненужную подписку. Сохрани покупку, от которой отказался, в музее. Посмотри,
                сколько денег можно оставить на важное.
              </p>
              <p>Сэкономленное можно отложить на свою цель и записать в Кубышке.</p>
            </div>
            <div className="lp-savings-example" data-reveal>
              <div className="lp-savings-heading">
                <span>Подписка, которой не пользуешься</span>
                <span>Пример</span>
              </div>
              <div className="lp-saving-row">
                <span>
                  Онлайн-кинотеатр<small>Каждый месяц</small>
                </span>
                <strong>39 000 сум</strong>
              </div>
              <div className="lp-saving-row lp-saving-row-positive">
                <span>
                  За год набегает
                  <small>
                    <Check size={14} aria-hidden />
                    12 ежемесячных платежей
                  </small>
                </span>
                <strong>468 000 сум</strong>
              </div>
              <div className="lp-saving-note">
                <span>После отмены можно откладывать на своё</span>
                <strong>39 000 сум / мес.</strong>
                <ArrowRight size={23} aria-hidden />
              </div>
              <small>
                Условный пример. Подписку нужно отменить у сервиса, а деньги отложить
                самостоятельно.
              </small>
            </div>
          </div>
        </section>

        <section className="lp-dream" id="your-goal" aria-labelledby="dream-heading">
          <div className="lp-container lp-dream-grid">
            <div className="lp-dream-copy" data-reveal>
              <p className="lp-section-label">03 / Копи на то, что твоё</p>
              <h2 id="dream-heading">
                Пусть «когда‑нибудь»
                <br />
                станет выходными
                <br />в горах.
              </h2>
              <p>
                Или новым ноутбуком. Подушкой на всякий случай. Тем, на что ты давно откладываешь
                жизнь.
              </p>
              <p>
                Выбери цель и записывай накопления. Кубыш растёт вместе с ними: получает костюмы,
                меняет настроение и напоминает, ради чего ты начал.
              </p>
              <StartLink>У меня тоже есть цель</StartLink>
            </div>
            <div className="lp-dream-photo" data-reveal>
              <img
                src="/images/charvak-weekend.webp"
                width="1536"
                height="1024"
                alt="Чай на деревянном столе с видом на бирюзовую воду и горы у Чарвакского водохранилища"
                loading="lazy"
                decoding="async"
                onLoad={() => ScrollTrigger.refresh()}
              />
              <span>Не просто сумма. Твои выходные.</span>
            </div>
            <div className="lp-dream-demo" data-reveal>
              <GoalExample />
            </div>
          </div>
        </section>

        <section className="lp-habit lp-container" aria-labelledby="habit-heading">
          <div data-reveal>
            <p className="lp-section-label">Маленькая привычка. Твоя жизнь.</p>
            <h2 id="habit-heading">
              Не нужно становиться
              <br />
              бухгалтером.
            </h2>
            <p>
              Запиши покупку, посмотри остаток, вечером отметь, как прошёл день. Завтра продолжишь с
              того места, где остановился.
            </p>
          </div>
          <div className="lp-habit-list" data-reveal>
            <div>
              <Check size={21} />
              <span>
                Операции в календаре
                <small>Выбери день, чтобы посмотреть и исправить покупки.</small>
              </span>
            </div>
            <div>
              <Check size={21} />
              <span>
                Расходы в часах работы<small>Посмотри, сколько твоего времени стоит покупка.</small>
              </span>
            </div>
            <div>
              <Check size={21} />
              <span>
                Отчёт дня и живой Кубыш
                <small>Короткий ритуал, к которому хочется возвращаться.</small>
              </span>
            </div>
          </div>
        </section>

        <section className="lp-faq lp-container" id="questions" aria-labelledby="questions-heading">
          <div data-reveal>
            <p className="lp-section-label">Без мелкого шрифта</p>
            <h2 id="questions-heading">
              До того,
              <br />
              как начнёшь.
            </h2>
          </div>
          <div className="lp-faq-items" data-reveal>
            {questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={20} className="lp-faq-plus" aria-hidden />
                  <Minus size={20} className="lp-faq-minus" aria-hidden />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="lp-final lp-container" aria-labelledby="final-heading">
          <div className="lp-final-inner" data-reveal>
            <div>
              <p className="lp-section-label">Начни с сегодняшнего дня</p>
              <h2 id="final-heading">
                У твоих денег
                <br />
                может быть своя история.
              </h2>
              <p>И маленький персонаж, который её помнит.</p>
              <StartLink>Создать Кубышку бесплатно</StartLink>
              <span className="lp-final-note">
                Доходы и расходы вручную. Деньги остаются у тебя.
              </span>
            </div>
            <div className="lp-final-pet">
              <Kubysh mood={92} stage={2} costumes={['scarf']} auraTier="ember" size={240} />
              <span>Я тут. Давай знакомиться.</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="lp-footer lp-container">
        <div>
          <Link to="/" className="lp-brand">
            кубышка<span>.</span>
          </Link>
          <p>
            Деньги, которые ты не потратил,
            <br />
            кого-то кормят.
          </p>
        </div>
        <nav aria-label="Ссылки в подвале">
          <a href="#how-it-works">Как работает</a>
          <a href="#questions">Вопросы</a>
          <Link to="/login">
            Войти в кабинет
            <ArrowUpRight size={16} aria-hidden />
          </Link>
        </nav>
        <p className="lp-footer-note">
          Сделано для повседневной жизни.
          <br />
          Ташкент · Сум · Свой темп.
        </p>
      </footer>
    </div>
  );
}
