import { useEffect, useMemo, useRef, useState } from 'react';
import { gql, useApolloClient, useMutation, useQuery } from '@apollo/client';

const CATEGORIES = gql`query Categories { categories { id name description } }`;
const BOOKS = gql`query Books($search: String, $categoryId: ID) {
  books(search: $search, categoryId: $categoryId) {
    id title author isbn description coverUrl totalCopies availableCopies category { id name }
  }
}`;
const ME = gql`query Me { me { id name email role } }`;
const MY_RESERVATIONS = gql`query MyReservations {
  myReservations { id status reservedAt dueAt extensions book { id title author coverUrl } }
}`;
const ALL_RESERVATIONS = gql`query AllReservations {
  allReservations { id status reservedAt dueAt extensions user { name email } book { title author } }
}`;
const USERS = gql`query Users { users { id name email role createdAt } }`;
const LOGIN = gql`mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) { token user { id name email role } }
}`;
const RESERVE = gql`mutation Reserve($bookId: ID!) { reserveBook(bookId: $bookId) { id } }`;
const EXTEND = gql`mutation Extend($reservationId: ID!) {
  extendReservation(reservationId: $reservationId) { id dueAt extensions }
}`;
const RETURN = gql`mutation ReturnBook($reservationId: ID!) { returnBook(reservationId: $reservationId) { id status } }`;
const SAVE_BOOK = gql`mutation SaveBook($input: BookInput!, $bookId: ID) {
  saveBook(input: $input, bookId: $bookId) { id }
}`;
const DELETE_BOOK = gql`mutation DeleteBook($bookId: ID!) { deleteBook(bookId: $bookId) }`;
const SAVE_CATEGORY = gql`mutation SaveCategory($input: CategoryInput!, $categoryId: ID) {
  saveCategory(input: $input, categoryId: $categoryId) { id }
}`;
const DELETE_CATEGORY = gql`mutation DeleteCategory($categoryId: ID!) { deleteCategory(categoryId: $categoryId) }`;
const CREATE_USER = gql`mutation CreateUser($input: UserInput!) { createUser(input: $input) { id } }`;
const UPDATE_USER = gql`mutation UpdateUser($userId: ID!, $input: UserUpdateInput!) {
  updateUser(userId: $userId, input: $input) { id }
}`;
const DELETE_USER = gql`mutation DeleteUser($userId: ID!) { deleteUser(userId: $userId) }`;

const fallbackCovers = [
  'linear-gradient(145deg,#d9e3d3,#789477)',
  'linear-gradient(145deg,#f1dec8,#bd7955)',
  'linear-gradient(145deg,#d9d4e5,#77708d)',
  'linear-gradient(145deg,#dce6e8,#78939a)',
  'linear-gradient(145deg,#f0e2bd,#b29353)',
  'linear-gradient(145deg,#e7d6d2,#a16e72)',
];

function formatBookCount(count) {
  const lastTwoDigits = count % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 19) return 'knygų';
  const lastDigit = count % 10;
  if (lastDigit === 1) return 'knyga';
  if (lastDigit >= 2 && lastDigit <= 9) return 'knygos';
  return 'knygų';
}

function Cover({ book, index = 0, compact = false }) {
  return (
    <div className={`book-cover${compact ? ' book-cover--small' : ''}`} style={{ background: fallbackCovers[index % fallbackCovers.length] }}>
      {book.coverUrl
        ? <img src={book.coverUrl} alt={`„${book.title}“ viršelis`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
        : <div className="cover-art"><span>MIESTO BIBLIOTEKA</span><strong>{book.title}</strong><i>{book.author}</i></div>}
    </div>
  );
}

function AdminBookCover({ book }) {
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div className="admin-book-cover" aria-hidden="true">
      {book.coverUrl && !imageFailed
        ? <img src={book.coverUrl} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        : <div className="admin-book-cover-fallback"><span>MIESTO BIBLIOTEKA</span><strong>{book.title}</strong><i>{book.author}</i></div>}
    </div>
  );
}

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none">
        <path d="M16 9.5c-3-2-6-2.6-10-2.2v15c4.1-.4 7.1.3 10 2.4m0-15.2c3-2 6-2.6 10-2.2v15c-4.1-.4-7.1.3-10 2.4m0-15.2v15.2" />
        <path d="M9 11.5c1.6 0 3 .3 4.3.8M9 15c1.6 0 3 .3 4.3.8m9.7-4.3c-1.6 0-3 .3-4.3.8m4.3 2.7c-1.6 0-3 .3-4.3.8" />
      </svg>
    </span>
  );
}

function Header({ user, activeSection, onView, onLogin, onLogout }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRef = useRef(null);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!accountRef.current?.contains(event.target)) setAccountMenuOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="site-header">
      <a className="brand" href="#" onClick={(event) => { event.preventDefault(); onView('home'); }}>
        <BrandMark /><span>Miesto biblioteka<small>KNYGŲ KATALOGAS</small></span>
      </a>
      <nav className="main-nav" aria-label="Pagrindinė navigacija">
        <button className={activeSection === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => onView('home')}>Pradžia</button>
        <button className={activeSection === 'books' ? 'nav-link active' : 'nav-link'} onClick={() => onView('books')}>Knygos</button>
      </nav>
      <div className="header-account">
        {user ? <div className="account-menu-wrap" ref={accountRef}>
          <button
            className={`account-trigger${accountMenuOpen ? ' account-trigger-open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={accountMenuOpen}
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            <span className="account-avatar">{user.name.trim().charAt(0).toLocaleUpperCase('lt-LT')}</span>
            <span className="account-trigger-copy"><strong>{user.name}</strong><small>{user.role === 'ADMIN' ? 'Administratorius' : 'Skaitytojas'}</small></span>
            <svg className="account-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
          </button>
          {accountMenuOpen && <div className="account-dropdown" role="menu">
            <div className="account-dropdown-heading"><span className="account-avatar">{user.name.trim().charAt(0).toLocaleUpperCase('lt-LT')}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
            <div className="account-dropdown-divider" />
            <button role="menuitem" onClick={() => { setAccountMenuOpen(false); onView('reservations'); }}><span className="account-menu-icon">▤</span>Mano rezervacijos<span className="account-menu-arrow">→</span></button>
            {user.role === 'ADMIN' && <button role="menuitem" onClick={() => { setAccountMenuOpen(false); onView('admin'); }}><span className="account-menu-icon">⚙</span>Administravimas<span className="account-menu-arrow">→</span></button>}
            <div className="account-dropdown-divider" />
            <button className="account-logout" role="menuitem" onClick={() => { setAccountMenuOpen(false); onLogout(); }}><span className="account-menu-icon">↪</span>Atsijungti</button>
          </div>}
        </div>
          : <button className="login-button" onClick={onLogin}>Prisijungti <span>↗</span></button>}
      </div>
    </header>
  );
}

function LoginModal({ onClose, onSuccess, adminMode = false }) {
  const [login, { loading }] = useMutation(LOGIN);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const { data } = await login({ variables: { email, password } });
      onSuccess(data.login);
    } catch (cause) {
      setError(cause.message.replace(/^.*?: /, ''));
    }
  }
  if (adminMode) {
    return (
      <main className="admin-login-page">
        <section className="admin-login-visual">
          <img src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1600&q=90" alt="" />
          <div className="admin-login-visual-overlay" />
          <a className="admin-login-brand" href="/" onClick={(event) => { event.preventDefault(); onClose(); }}>
            <BrandMark /><span>Miesto biblioteka<small>KNYGŲ KATALOGAS</small></span>
          </a>
          <div className="admin-login-caption">
            <div className="admin-login-kicker"><span className="live-dot" /> BIBLIOTEKOS SISTEMA</div>
            <h1>Viskas, ko reikia<br />bibliotekai valdyti.</h1>
            <p>Knygų katalogas, skaitytojai ir rezervacijos — vienoje vietoje.</p>
          </div>
          <span className="admin-login-image-credit">MIESTO BIBLIOTEKA · ADMINISTRAVIMAS</span>
        </section>
        <section className="admin-login-panel">
          <button className="admin-login-back" onClick={onClose}>← <span>Grįžti į biblioteką</span></button>
          <div className="admin-login-form-wrap">
            <div className="admin-login-icon" aria-hidden="true">⌂</div>
            <div className="eyebrow">ADMINISTRATORIAUS PASKYRA</div>
            <h2 id="login-title">Sveiki sugrįžę.</h2>
            <p className="admin-login-intro">Prisijunkite, kad galėtumėte valdyti bibliotekos katalogą.</p>
            <form onSubmit={submit} className="stack-form admin-login-form">
              <label>El. paštas<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vardas@biblioteka.lt" /></label>
              <label>Slaptažodis<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Įveskite slaptažodį" /></label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button full-button" disabled={loading}>{loading ? 'Jungiamasi…' : 'Prisijungti prie sistemos'} <span>→</span></button>
            </form>
            <div className="admin-login-security"><span aria-hidden="true">⌑</span> Ši sritis skirta tik įgaliotiems darbuotojams.</div>
          </div>
          <span className="admin-login-footer">SAUGUS PRISIJUNGIMAS · MIESTO BIBLIOTEKA</span>
        </section>
      </main>
    );
  }
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modal-close" onClick={onClose} aria-label="Uždaryti">×</button>
        <div className="eyebrow">MALONU VĖL MATYTI</div><h2 id="login-title">Prisijunkite prie<br /><em>savo bibliotekos.</em></h2>
        <form onSubmit={submit} className="stack-form">
          <label>El. paštas<input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vardas@pastas.lt" /></label>
          <label>Slaptažodis<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Įveskite slaptažodį" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full-button" disabled={loading}>{loading ? 'Jungiamasi…' : 'Prisijungti'} <span>→</span></button>
        </form>
        <p className="modal-note">Paskyrą jums suteikia bibliotekos administratorius.</p>
      </section>
    </div>
  );
}

function Catalog({ categories, user, onLogin, notify }) {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const { data, loading, error } = useQuery(BOOKS, { variables: { search, categoryId } });
  const [reserve, { loading: reserving }] = useMutation(RESERVE, { refetchQueries: ['Books', 'MyReservations'] });
  const [selected, setSelected] = useState(null);
  const books = data?.books ?? [];
  const selectedCategory = categories.find((category) => category.id === categoryId);

  async function reserveBook(book) {
    if (!user) { onLogin(); return; }
    try {
      await reserve({ variables: { bookId: book.id } });
      notify(`„${book.title}“ rezervuota. Atsiimkite ją bibliotekoje per 21 dieną.`);
    } catch (cause) { notify(cause.message.replace(/^.*?: /, ''), true); }
  }

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> MIESTO BIBLIOTEKA · KNYGŲ KATALOGAS</div>
          <h1>Gera knyga<br />visai <em>netoli.</em></h1>
          <p>Ieškokite bibliotekos knygų, peržiūrėkite jų prieinamumą ir rezervuokite internetu.</p>
          <button className="hero-cta" onClick={() => document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' })}>Peržiūrėti knygas <span>↓</span></button>
          <div className="hero-features"><span><i /> Paieška pagal žanrą ir autorių</span><span><i /> Rezervacija internetu</span></div>
        </div>
        <div className="hero-visual">
          <img src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1400&q=85" alt="Bibliotekos knygų lentynos" />
          <div className="hero-visual-label"><span className="live-dot" /> ATRASKITE BIBLIOTEKOS KATALOGĄ</div>
        </div>
      </section>
      <main className="catalog-section" id="catalog">
        <div className="section-heading"><div><div className="eyebrow">MIESTO BIBLIOTEKOS FONDAS</div><h2>Knygų katalogas<span className="heading-period">.</span></h2></div>
          <p>Ieškokite kataloge ir rezervuokite<br />laisvas knygas internetu.</p>
        </div>
        <div className="filter-panel">
          <div className="filter-panel-heading"><div><span className="filter-panel-icon" aria-hidden="true">⌕</span><div><strong>Raskite knygą</strong><small>Ieškokite pagal pavadinimą, autorių arba žanrą</small></div></div>
            {(search || categoryId) && <button className="clear-filters" onClick={() => { setSearch(''); setCategoryId(''); }}>Išvalyti filtrus <span>×</span></button>}
          </div>
          <div className="filter-bar">
            <label className="search-field"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.7" cy="8.7" r="5.6" /><path d="m13 13 4 4" /></svg><input aria-label="Ieškoti knygų" placeholder="Knygos pavadinimas arba autorius…" value={search} onChange={(event) => setSearch(event.target.value)} />{search && <button type="button" className="clear-search" onClick={() => setSearch('')} aria-label="Išvalyti paiešką">×</button>}</label>
            <label className={`category-select-wrap${categoryId ? ' category-selected' : ''}`}><span className="filter-label">KATEGORIJA</span><select aria-label="Pasirinkti kategoriją" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Visos kategorijos</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><svg className="select-chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg></label>
          </div>
        </div>
        <div className="results-meta"><span>{loading ? 'Ieškoma…' : <>Rodoma <strong>{books.length}</strong> {formatBookCount(books.length)}{selectedCategory && <> kategorijoje <strong>{selectedCategory.name}</strong></>}</>}</span><span>ATNAUJINAMA PAGAL JŪSŲ PASIRINKIMĄ</span></div>
        {error && <div className="notice error-notice">Nepavyko įkelti katalogo. Patikrinkite, ar veikia serveris ir MongoDB.</div>}
        {loading && <div className="loading-state"><span className="spinner" /> Kraunamos knygos…</div>}
        {!loading && !error && books.length > 0 && <div className="book-grid">{books.map((book, index) => <article className="book-card" key={book.id}>
          <button className="cover-button" onClick={() => setSelected(book)} aria-label={`Daugiau apie knygą „${book.title}“`}><Cover book={book} index={index} /><span className="quick-view">Plačiau ↗</span></button>
          <div className="book-info"><div className="book-meta"><span>{book.category.name}</span><span>{book.availableCopies > 0 ? <><i className="available-dot" /> Laisva</> : <><i className="unavailable-dot" /> Rezervuota</>}</span></div>
            <h3>{book.title}</h3><p className="book-author">{book.author}</p>
            <div className="card-bottom"><span className="availability">{book.availableCopies > 0 ? `${book.availableCopies} iš ${book.totalCopies} egz.` : 'Laisvų egzempliorių nėra'}</span>
              <button className="reserve-button" disabled={book.availableCopies === 0 || reserving} onClick={() => reserveBook(book)}>{user ? 'Rezervuoti' : 'Prisijungti'} <span>↗</span></button></div>
          </div></article>)}</div>}
        {!loading && !error && books.length === 0 && <div className="empty-state"><span>⌕</span><h3>Knygų nerasta.</h3><p>Pakeiskite paieškos frazę arba pasirinkite kitą kategoriją.</p><button className="text-button" onClick={() => { setSearch(''); setCategoryId(''); }}>Išvalyti filtrus ↗</button></div>}
      </main>
      {selected && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="book-modal" role="dialog" aria-modal="true">
        <button className="modal-close" onClick={() => setSelected(null)} aria-label="Uždaryti">×</button><Cover book={selected} /><div className="book-modal-copy"><div className="eyebrow">{selected.category.name}</div><h2>{selected.title}</h2><p className="book-author">{selected.author}</p><p>{selected.description || 'Aprašymas šiuo metu nepateiktas.'}</p>{selected.isbn && <small>ISBN {selected.isbn}</small>}<button className="primary-button" disabled={!selected.availableCopies} onClick={() => reserveBook(selected)}>{selected.availableCopies ? 'Rezervuoti knygą' : 'Šiuo metu nėra'} <span>→</span></button></div>
      </section></div>}
    </>
  );
}

function Reservations({ notify }) {
  const { data, loading, error } = useQuery(MY_RESERVATIONS);
  const [extend] = useMutation(EXTEND, { refetchQueries: ['MyReservations'] });
  const [returnBook] = useMutation(RETURN, { refetchQueries: ['MyReservations', 'Books'] });
  const rows = data?.myReservations ?? [];
  async function run(action, id, label) {
    try { await action({ variables: { reservationId: id } }); notify(label); }
    catch (cause) { notify(cause.message.replace(/^.*?: /, ''), true); }
  }
  if (loading) return <main className="content-page"><div className="loading-state"><span className="spinner" /> Kraunamos rezervacijos…</div></main>;
  if (error) return <main className="content-page"><div className="notice error-notice">{error.message}</div></main>;
  return <main className="content-page"><div className="eyebrow">JŪSŲ SKAITYMO KELIONĖ</div><div className="page-title-row"><h1>Mano rezervacijos<span className="heading-period">.</span></h1><p>Ramus priminimas, kiek laiko<br />dar galite mėgautis istorija.</p></div>
    {rows.length ? <div className="reservation-list">{rows.map((reservation) => {
      const overdue = reservation.status === 'ACTIVE' && new Date(reservation.dueAt) < new Date();
      return <article className="reservation-card" key={reservation.id}><Cover book={reservation.book} compact /><div className="reservation-book"><span className="eyebrow">{reservation.book.author}</span><h3>{reservation.book.title}</h3><span className={`status-pill ${reservation.status === 'ACTIVE' ? (overdue ? 'status-overdue' : 'status-active') : 'status-returned'}`}>{reservation.status === 'ACTIVE' ? (overdue ? 'Terminas praleistas' : 'Skaitoma') : 'Grąžinta'}</span></div><div className="reservation-due"><span>GRĄŽINTI IKI</span><strong>{new Date(reservation.dueAt).toLocaleDateString('lt-LT')}</strong><small>Pratęsta {reservation.extensions} iš 2 kartų</small></div>
        {reservation.status === 'ACTIVE' && <div className="reservation-actions"><button disabled={reservation.extensions >= 2} onClick={() => run(extend, reservation.id, 'Skaitymo terminas pratęstas 14 dienų.')}>Pratęsti <span>↗</span></button><button className="return-action" onClick={() => run(returnBook, reservation.id, 'Knyga pažymėta kaip grąžinta.')}>Grąžinti</button></div>}</article>;
    })}</div> : <div className="empty-state"><span>✳</span><h3>Jūsų istorija dar tik prasideda.</h3><p>Pasirinkite knygą kataloge ir rezervuokite ją savo paskyrai.</p></div>}
  </main>;
}

const emptyBook = { title: '', author: '', isbn: '', description: '', coverUrl: '', categoryId: '', totalCopies: 1 };
function Admin({ categories, notify }) {
  const [tab, setTab] = useState('books');
  const [editing, setEditing] = useState(null);
  const [bookForm, setBookForm] = useState(emptyBook);
  const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
  const [userForm, setUserForm] = useState({ name: '', email: '', password: '', role: 'USER' });
  const [editingUser, setEditingUser] = useState(null);
  const { data: booksData, refetch: refetchBooks } = useQuery(BOOKS, { variables: { search: '', categoryId: '' } });
  const { data: usersData, refetch: refetchUsers } = useQuery(USERS, { skip: tab !== 'users' });
  const { data: reservationsData } = useQuery(ALL_RESERVATIONS, { skip: tab !== 'reservations' });
  const [saveBook] = useMutation(SAVE_BOOK, { refetchQueries: ['Books'] });
  const [deleteBook] = useMutation(DELETE_BOOK, { refetchQueries: ['Books'] });
  const [saveCategory] = useMutation(SAVE_CATEGORY, { refetchQueries: ['Categories'] });
  const [deleteCategory] = useMutation(DELETE_CATEGORY, { refetchQueries: ['Categories'] });
  const [createUser] = useMutation(CREATE_USER, { refetchQueries: ['Users'] });
  const [updateUser] = useMutation(UPDATE_USER, { refetchQueries: ['Users'] });
  const [deleteUser] = useMutation(DELETE_USER, { refetchQueries: ['Users'] });

  async function submitBook(event) {
    event.preventDefault();
    try {
      await saveBook({ variables: { input: { ...bookForm, totalCopies: Number(bookForm.totalCopies) }, bookId: editing || null } });
      setBookForm(emptyBook); setEditing(null); await refetchBooks(); notify('Knygos informacija išsaugota.');
    } catch (error) { notify(error.message.replace(/^.*?: /, ''), true); }
  }
  async function removeBook(id) { try { await deleteBook({ variables: { bookId: id } }); notify('Knyga pašalinta.'); } catch (error) { notify(error.message.replace(/^.*?: /, ''), true); } }
  async function submitCategory(event) {
    event.preventDefault();
    try { await saveCategory({ variables: { input: categoryForm, categoryId: editing || null } }); setCategoryForm({ name: '', description: '' }); setEditing(null); notify('Kategorija išsaugota.'); }
    catch (error) { notify(error.message.replace(/^.*?: /, ''), true); }
  }
  async function removeCategory(id) { try { await deleteCategory({ variables: { categoryId: id } }); notify('Kategorija pašalinta.'); } catch (error) { notify(error.message.replace(/^.*?: /, ''), true); } }
  async function submitUser(event) {
    event.preventDefault();
    try { await createUser({ variables: { input: userForm } }); setUserForm({ name: '', email: '', password: '', role: 'USER' }); notify('Naudotojas sukurtas.'); }
    catch (error) { notify(error.message.replace(/^.*?: /, ''), true); }
  }
  async function submitUserUpdate(event) {
    event.preventDefault();
    try {
      await updateUser({ variables: { userId: editingUser.id, input: { name: userForm.name, email: userForm.email, role: userForm.role } } });
      setEditingUser(null); setUserForm({ name: '', email: '', password: '', role: 'USER' }); notify('Naudotojo informacija išsaugota.');
    } catch (error) { notify(error.message.replace(/^.*?: /, ''), true); }
  }
  async function removeUser(id) { try { await deleteUser({ variables: { userId: id } }); await refetchUsers(); notify('Naudotojas pašalintas.'); } catch (error) { notify(error.message.replace(/^.*?: /, ''), true); } }
  const tabs = [['books', 'Knygos'], ['categories', 'Kategorijos'], ['users', 'Naudotojai'], ['reservations', 'Rezervacijos']];
  const books = booksData?.books ?? [];
  const availableCopies = books.reduce((total, book) => total + book.availableCopies, 0);
  return <main className="content-page admin-page">
    <header className="admin-heading">
      <div><div className="eyebrow">MIESTO BIBLIOTEKA <span className="admin-heading-divider">/</span> ADMINISTRAVIMAS</div><h1>Valdymo skydas<span className="heading-period">.</span></h1><p>Tvarkykite katalogą, skaitytojus ir rezervacijas.</p></div>
      <div className="admin-session"><span className="admin-session-dot" /> Administratoriaus aplinka</div>
    </header>
    <section className="admin-stats" aria-label="Bibliotekos suvestinė">
      <article className="admin-stat"><span>KATALOGE</span><strong>{books.length}</strong><small>knygų pavadinimai</small></article>
      <article className="admin-stat"><span>KATEGORIJOS</span><strong>{categories.length}</strong><small>knygų žanrai</small></article>
      <article className="admin-stat"><span>LAISVI EGZEMPLIORIAI</span><strong>{availableCopies}</strong><small>galima rezervuoti</small></article>
    </section>
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-label">VALDYMAS</div>
        <div className="admin-tabs" role="tablist" aria-label="Administravimo skyriai">{tabs.map(([key, label], index) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? 'admin-tab selected' : 'admin-tab'} onClick={() => { setTab(key); setEditing(null); }}><span className="admin-tab-icon">{['▤', '▦', '♙', '↗'][index]}</span><span>{label}</span>{key === 'books' && <span className="admin-tab-count">{books.length}</span>}</button>)}</div>
        <div className="admin-sidebar-note"><span>⌑</span><p>Administratoriaus prieiga<br /><small>Jūsų veiksmai saugomi sistemoje.</small></p></div>
      </aside>
      <div className="admin-main">
    {tab === 'books' && <div className="admin-layout"><section className="admin-panel"><div className="panel-heading"><div><div className="eyebrow">KNYGŲ KATALOGAS</div><h2>{editing ? 'Redaguoti knygą' : 'Pridėti knygą'}</h2></div><span className="admin-step">01</span></div>
      <form className="stack-form admin-form" onSubmit={submitBook}><label>Pavadinimas<input required maxLength="200" value={bookForm.title} onChange={(e) => setBookForm({ ...bookForm, title: e.target.value })} placeholder="Knygos pavadinimas" /></label><label>Autorius<input required value={bookForm.author} onChange={(e) => setBookForm({ ...bookForm, author: e.target.value })} placeholder="Vardas Pavardė" /></label><div className="form-row"><label>Kategorija<select required value={bookForm.categoryId} onChange={(e) => setBookForm({ ...bookForm, categoryId: e.target.value })}><option value="">Pasirinkite kategoriją</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Egzemplioriai<input required type="number" min="1" value={bookForm.totalCopies} onChange={(e) => setBookForm({ ...bookForm, totalCopies: e.target.value })} /></label></div><label>ISBN <span className="optional-label">NEPRIVALOMA</span><input value={bookForm.isbn} onChange={(e) => setBookForm({ ...bookForm, isbn: e.target.value })} placeholder="Pvz., 978609..." /><small className="field-help">ISBN – 10 arba 13 skaitmenų numeris, identifikuojantis konkretų knygos leidimą. Jei jo nežinote, lauką palikite tuščią.</small></label><label>Viršelio nuoroda <span className="optional-label">NEPRIVALOMA</span><input type="url" value={bookForm.coverUrl} onChange={(e) => setBookForm({ ...bookForm, coverUrl: e.target.value })} placeholder="https://…" /></label><label>Aprašymas <span className="optional-label">NEPRIVALOMA</span><textarea rows="3" value={bookForm.description} onChange={(e) => setBookForm({ ...bookForm, description: e.target.value })} placeholder="Trumpai apie knygą…" /></label><div className="form-actions"><button className="primary-button">{editing ? 'Išsaugoti pakeitimus' : 'Pridėti knygą'} <span>→</span></button>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setBookForm(emptyBook); }}>Atšaukti</button>}</div></form></section>
      <section className="admin-panel"><div className="panel-heading"><h2>Visos knygos</h2><span>{booksData?.books.length ?? 0} ĮRAŠŲ</span></div><div className="admin-list">{(booksData?.books ?? []).map((book) => <div className="admin-list-row" key={book.id}><AdminBookCover book={book} /><div className="admin-row-copy"><strong>{book.title}</strong><span>{book.author} · {book.availableCopies}/{book.totalCopies} laisvų</span></div><button className="icon-action" aria-label={`Redaguoti ${book.title}`} onClick={() => { setEditing(book.id); setBookForm({ ...book, categoryId: book.category.id }); }}>↗</button><button className="icon-action delete-action" aria-label={`Pašalinti ${book.title}`} onClick={() => removeBook(book.id)}>×</button></div>)}</div></section></div>}
    {tab === 'categories' && <div className="admin-layout"><section className="admin-panel"><div className="panel-heading"><h2>{editing ? 'Redaguoti kategoriją' : 'Nauja kategorija'}</h2><span>02 / ŽANRAI</span></div><form className="stack-form admin-form" onSubmit={submitCategory}><label>Pavadinimas<input required value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /></label><label>Aprašymas<input value={categoryForm.description} onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })} /></label><div className="form-actions"><button className="primary-button">{editing ? 'Išsaugoti' : 'Pridėti kategoriją'} <span>→</span></button>{editing && <button type="button" className="text-button" onClick={() => { setEditing(null); setCategoryForm({ name: '', description: '' }); }}>Atšaukti</button>}</div></form></section><section className="admin-panel"><div className="panel-heading"><h2>Kategorijos</h2><span>{categories.length} ĮRAŠŲ</span></div><div className="admin-list">{categories.map((category) => <div className="admin-list-row category-row" key={category.id}><div className="category-symbol">✳</div><div className="admin-row-copy"><strong>{category.name}</strong><span>{category.description || 'Aprašymas nepateiktas'}</span></div><button className="icon-action" onClick={() => { setEditing(category.id); setCategoryForm({ name: category.name, description: category.description }); }}>↗</button><button className="icon-action delete-action" onClick={() => removeCategory(category.id)}>×</button></div>)}</div></section></div>}
    {tab === 'users' && <div className="admin-layout"><section className="admin-panel"><div className="panel-heading"><h2>{editingUser ? 'Redaguoti naudotoją' : 'Naujas naudotojas'}</h2><span>03 / PASKYROS</span></div><form className="stack-form admin-form" onSubmit={editingUser ? submitUserUpdate : submitUser}><label>Vardas<input required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} /></label><label>El. paštas<input required type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></label>{!editingUser && <label>Pradinis slaptažodis<input required minLength="8" type="password" value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} /></label>}<label>Rolė<select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="USER">Vartotojas</option><option value="ADMIN">Administratorius</option></select></label><div className="form-actions"><button className="primary-button">{editingUser ? 'Išsaugoti' : 'Sukurti paskyrą'} <span>→</span></button>{editingUser && <button type="button" className="text-button" onClick={() => { setEditingUser(null); setUserForm({ name: '', email: '', password: '', role: 'USER' }); }}>Atšaukti</button>}</div></form></section><section className="admin-panel"><div className="panel-heading"><h2>Naudotojai</h2><span>{usersData?.users.length ?? 0} ĮRAŠŲ</span></div><div className="admin-list">{(usersData?.users ?? []).map((user) => <div className="admin-list-row category-row" key={user.id}><div className="user-avatar">{user.name.slice(0, 1).toUpperCase()}</div><div className="admin-row-copy"><strong>{user.name}</strong><span>{user.email} · {user.role === 'ADMIN' ? 'Administratorius' : 'Vartotojas'}</span></div><button className="icon-action" aria-label={`Redaguoti ${user.name}`} onClick={() => { setEditingUser(user); setUserForm({ name: user.name, email: user.email, password: '', role: user.role }); }}>↗</button><button className="icon-action delete-action" aria-label={`Pašalinti ${user.name}`} onClick={() => removeUser(user.id)}>×</button></div>)}</div></section></div>}
    {tab === 'reservations' && <section className="admin-panel"><div className="panel-heading"><div><div className="eyebrow">SKAITYTOJŲ VEIKLA</div><h2>Visos rezervacijos</h2></div><span className="admin-step">{reservationsData?.allReservations.length ?? 0}</span></div><div className="admin-list">{(reservationsData?.allReservations ?? []).map((r) => <div className="admin-list-row category-row" key={r.id}><div className="admin-row-copy"><strong>{r.book.title}</strong><span>{r.user.name} · {r.user.email}</span></div><span className={`status-pill ${r.status === 'ACTIVE' ? 'status-active' : 'status-returned'}`}>{r.status === 'ACTIVE' ? 'Skaitoma' : 'Grąžinta'}</span><div className="reservation-due"><span>GRĄŽINTI IKI</span><strong>{new Date(r.dueAt).toLocaleDateString('lt-LT')}</strong></div></div>)}</div></section>}
      </div>
    </div>
  </main>;
}

function Footer({ user, onView, onLogin }) {
  return <footer className="site-footer">
    <div className="footer-main">
      <a className="brand footer-brand" href="/" onClick={(event) => { event.preventDefault(); onView('home'); }}><BrandMark /><span>Miesto biblioteka<small>KNYGŲ KATALOGAS</small></span></a>
      <p className="footer-description">Ieškokite knygų kataloge, peržiūrėkite jų prieinamumą ir rezervuokite internetu.</p>
      <nav className="footer-links" aria-label="Nuorodos poraštėje">
        <button onClick={() => onView('home')}>Pradžia</button>
        <button onClick={() => onView('books')}>Knygų katalogas</button>
        {user ? <button onClick={() => onView('reservations')}>Mano rezervacijos</button> : <button onClick={onLogin}>Prisijungti</button>}
      </nav>
    </div>
    <div className="footer-bottom"><span>© {new Date().getFullYear()} Nojus Genčas</span><span>Visos teisės saugomos.</span></div>
  </footer>;
}

export default function App() {
  const client = useApolloClient();
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const [loginDestination, setLoginDestination] = useState(() => window.location.pathname === '/admin' ? 'admin' : null);
  const [activeView, setActiveView] = useState(() => window.location.pathname === '/admin' ? 'admin' : 'catalog');
  const [activeSection, setActiveSection] = useState('home');
  const [toast, setToast] = useState(null);
  const { data: categoriesData } = useQuery(CATEGORIES);
  const { data: meData, loading: meLoading } = useQuery(ME);
  const categories = useMemo(() => categoriesData?.categories ?? [], [categoriesData]);

  useEffect(() => {
    if (meData?.me) setUser(meData.me);
  }, [meData]);

  useEffect(() => {
    function syncRoute() {
      setActiveView(window.location.pathname === '/admin' ? 'admin' : 'catalog');
    }
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (!meLoading && meData && !meData.me && activeView === 'admin') {
      setLoginDestination('admin');
      setShowLogin(true);
    }
  }, [activeView, meData, meLoading]);

  function notify(message, error = false) {
    setToast({ message, error });
    window.setTimeout(() => setToast(null), 4200);
  }
  function logout() {
    localStorage.removeItem('library-token');
    setUser(null);
    setActiveView('catalog');
    if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
    client.clearStore();
  }
  function handleLogin(result) {
    localStorage.setItem('library-token', result.token);
    setUser(result.user);
    setShowLogin(false);
    const destination = loginDestination;
    setLoginDestination(null);
    setActiveView(destination === 'admin' && result.user.role === 'ADMIN' ? 'admin' : 'catalog');
    if (destination === 'admin' && result.user.role !== 'ADMIN') window.history.replaceState({}, '', '/');
    client.resetStore();
    notify(`Sveiki sugrįžę, ${result.user.name}.`);
    if (destination === 'admin' && result.user.role !== 'ADMIN') notify('Administravimo sritis prieinama tik administratoriui.', true);
  }
  function navigate(view) {
    if (view === 'home' || view === 'books' || view === 'catalog') {
      if (window.location.pathname !== '/') window.history.pushState({}, '', '/');
      setActiveView('catalog');
      const section = view === 'books' ? 'books' : 'home';
      setActiveSection(section);
      window.requestAnimationFrame(() => {
        const target = section === 'books' ? 'catalog' : 'home';
        document.getElementById(target)?.scrollIntoView({ behavior: 'smooth' });
      });
      return;
    }
    if (view === 'admin') {
      window.history.pushState({}, '', '/admin');
      if (!user) {
        setLoginDestination('admin');
        setShowLogin(true);
        return;
      }
    }
    if (view === 'admin' && user.role !== 'ADMIN') {
      notify('Administravimo sritis prieinama tik administratoriui.', true);
      window.history.replaceState({}, '', '/');
      return;
    }
    if (view === 'reservations' && window.location.pathname !== '/') {
      window.history.pushState({}, '', '/');
    }
    setActiveView(view);
  }

  const currentUser = user ?? meData?.me ?? null;
  const adminLoginScreen = activeView === 'admin' && currentUser?.role !== 'ADMIN';
  const closeLogin = () => {
    setShowLogin(false);
    if (loginDestination === 'admin' || adminLoginScreen) {
      setLoginDestination(null);
      setActiveView('catalog');
      window.history.replaceState({}, '', '/');
    }
  };

  if (adminLoginScreen && meLoading) {
    return <main className="admin-login-loading"><span className="spinner" /> Tikrinama prieiga…</main>;
  }

  return <>{!adminLoginScreen && <Header user={currentUser} activeSection={activeSection} onView={navigate} onLogin={() => setShowLogin(true)} onLogout={logout} />}
    {activeView === 'catalog' && <Catalog categories={categories} user={user} onLogin={() => setShowLogin(true)} notify={notify} />}
    {activeView === 'reservations' && currentUser && <Reservations notify={notify} />}
    {activeView === 'admin' && currentUser?.role === 'ADMIN' && <Admin categories={categories} notify={notify} />}
    {!adminLoginScreen && <Footer user={currentUser} onView={navigate} onLogin={() => setShowLogin(true)} />}
    {(showLogin || adminLoginScreen) && <LoginModal adminMode={adminLoginScreen} onClose={closeLogin} onSuccess={handleLogin} />}
    {toast && <div className={`toast${toast.error ? ' toast-error' : ''}`} role="status">{toast.error ? '!' : '✓'} <span>{toast.message}</span><button onClick={() => setToast(null)} aria-label="Uždaryti">×</button></div>}
  </>;
}
