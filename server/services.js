import mongoose from 'mongoose';
import { Book, Category, Reservation, User } from './models.js';

const PAGE_SIZE = 100;
const LOAN_DAYS = 21;
const EXTENSION_DAYS = 14;
const idOf = (value) => String(value?._id ?? value);

export class CatalogService {
  async listBooks({ search = '', categoryId = '' } = {}) {
    const filter = {};
    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) throw new Error('Neteisinga kategorija.');
      filter.category = categoryId;
    }
    const phrase = search.trim();
    if (phrase) {
      const safePhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = ['title', 'author', 'description', 'isbn'].map((field) => ({
        [field]: { $regex: safePhrase, $options: 'i' },
      }));
    }
    return Book.find(filter).populate('category').sort({ title: 1 }).limit(PAGE_SIZE);
  }

  async listCategories() {
    return Category.find().sort({ name: 1 }).limit(PAGE_SIZE);
  }

  async saveBook(input, bookId) {
    if (!mongoose.isValidObjectId(input.categoryId)) throw new Error('Pasirinkite galiojančią kategoriją.');
    if (!await Category.exists({ _id: input.categoryId })) throw new Error('Pasirinkta kategorija nerasta.');
    if (!input.title.trim() || input.title.length > 200) throw new Error('Knygos pavadinimas privalomas (iki 200 simbolių).');
    if (!input.author.trim() || input.author.length > 120) throw new Error('Autorius privalomas (iki 120 simbolių).');
    if ((input.description?.length ?? 0) > 2000) throw new Error('Knygos aprašymas negali viršyti 2000 simbolių.');
    const totalCopies = Number(input.totalCopies);
    if (!Number.isInteger(totalCopies) || totalCopies < 1) throw new Error('Knygų egzempliorių skaičius turi būti teigiamas sveikasis skaičius.');

    if (!bookId) {
      return new Book({
        title: input.title,
        author: input.author,
        isbn: input.isbn ?? '',
        description: input.description ?? '',
        coverUrl: input.coverUrl ?? '',
        category: input.categoryId,
        totalCopies,
        availableCopies: totalCopies,
      }).save();
    }

    if (!mongoose.isValidObjectId(bookId)) throw new Error('Neteisingas knygos identifikatorius.');
    const book = await Book.findOneAndUpdate(
      {
        _id: bookId,
        $expr: { $lte: [{ $subtract: ['$totalCopies', '$availableCopies'] }, totalCopies] },
      },
      [{
        $set: {
          title: input.title.trim(),
          author: input.author.trim(),
          isbn: input.isbn ?? '',
          description: input.description ?? '',
          coverUrl: input.coverUrl ?? '',
          category: new mongoose.Types.ObjectId(input.categoryId),
          totalCopies,
          availableCopies: {
            $add: ['$availableCopies', { $subtract: [totalCopies, '$totalCopies'] }],
          },
        },
      }],
      { new: true },
    ).populate('category');
    if (book) return book;
    const current = await Book.findById(bookId).select('totalCopies availableCopies');
    if (!current) throw new Error('Knyga nerasta.');
    const reservedCopies = current.totalCopies - current.availableCopies;
    throw new Error(`Negalima sumažinti egzempliorių skaičiaus žemiau rezervuotų (${reservedCopies}).`);
  }

  async saveCategory(input, categoryId) {
    if (categoryId) {
      if (!mongoose.isValidObjectId(categoryId)) throw new Error('Neteisingas kategorijos identifikatorius.');
      const category = await Category.findById(categoryId);
      if (!category) throw new Error('Kategorija nerasta.');
      category.name = input.name;
      category.description = input.description ?? '';
      return category.save();
    }
    return new Category({ name: input.name, description: input.description ?? '' }).save();
  }

  async deleteBook(bookId) {
    if (!mongoose.isValidObjectId(bookId)) throw new Error('Neteisingas knygos identifikatorius.');
    if (await Reservation.exists({ book: bookId })) {
      throw new Error('Knygos negalima pašalinti, kol yra su ja susijusių rezervacijų.');
    }
    const deleted = await Book.findByIdAndDelete(bookId);
    if (!deleted) throw new Error('Knyga nerasta.');
    return true;
  }

  async deleteCategory(categoryId) {
    if (!mongoose.isValidObjectId(categoryId)) throw new Error('Neteisingas kategorijos identifikatorius.');
    if (await Book.exists({ category: categoryId })) throw new Error('Kategorijos negalima pašalinti, kol jai priskirtos knygos.');
    const deleted = await Category.findByIdAndDelete(categoryId);
    if (!deleted) throw new Error('Kategorija nerasta.');
    return true;
  }
}

export class UserService {
  async listUsers() {
    return User.find().sort({ createdAt: -1 }).limit(PAGE_SIZE);
  }

  async createUser({ name, email, password, role = 'USER' }) {
    if (password.length < 8) throw new Error('Slaptažodį turi sudaryti bent 8 simboliai.');
    return new User({ name, email, password, role }).save();
  }

  async updateUser(userId, input, actorId) {
    if (!mongoose.isValidObjectId(userId)) throw new Error('Neteisingas naudotojo identifikatorius.');
    const user = await User.findById(userId);
    if (!user) throw new Error('Naudotojas nerastas.');
    if (idOf(userId) === idOf(actorId) && input.role !== 'ADMIN') {
      throw new Error('Negalite pakeisti savo administratoriaus rolės.');
    }
    if (user.role === 'ADMIN' && input.role !== 'ADMIN' && await User.countDocuments({ role: 'ADMIN' }) <= 1) {
      throw new Error('Sistemoje turi likti bent vienas administratorius.');
    }
    user.name = input.name;
    user.email = input.email;
    user.role = input.role;
    return user.save();
  }

  async deleteUser(userId, actorId) {
    if (!mongoose.isValidObjectId(userId)) throw new Error('Neteisingas naudotojo identifikatorius.');
    if (idOf(userId) === idOf(actorId)) throw new Error('Negalite pašalinti savo paskyros.');
    const user = await User.findById(userId);
    if (!user) throw new Error('Naudotojas nerastas.');
    if (user.role === 'ADMIN' && await User.countDocuments({ role: 'ADMIN' }) <= 1) {
      throw new Error('Sistemoje turi likti bent vienas administratorius.');
    }
    if (await Reservation.exists({ user: userId })) {
      throw new Error('Naudotojo negalima pašalinti, kol su juo susijusios rezervacijos saugomos istorijoje.');
    }
    const deleted = await User.findByIdAndDelete(userId);
    if (!deleted) throw new Error('Naudotojas nerastas.');
    return true;
  }
}

export class ReservationService {
  async listForUser(userId) {
    return Reservation.find({ user: userId }).populate('book').populate('user').sort({ reservedAt: -1 }).limit(PAGE_SIZE);
  }

  async create(userId, bookId) {
    if (!mongoose.isValidObjectId(bookId)) throw new Error('Neteisingas knygos identifikatorius.');
    if (await Reservation.exists({ user: userId, book: bookId, status: 'ACTIVE' })) {
      throw new Error('Šią knygą jau esate rezervavę.');
    }

    const book = await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true },
    );
    if (!book) throw new Error('Šiuo metu laisvų knygos egzempliorių nėra.');

    try {
      const reservation = await new Reservation({
        user: userId,
        book: bookId,
        dueAt: new Date(Date.now() + LOAN_DAYS * 24 * 60 * 60 * 1000),
      }).save();
      return reservation.populate(['book', 'user']);
    } catch (error) {
      await Book.updateOne({ _id: bookId }, { $inc: { availableCopies: 1 } });
      throw error;
    }
  }

  async extend(userId, reservationId) {
    if (!mongoose.isValidObjectId(reservationId)) throw new Error('Neteisingas rezervacijos identifikatorius.');
    const reservation = await Reservation.findOneAndUpdate(
      { _id: reservationId, user: userId, status: 'ACTIVE', extensions: { $lt: 2 } },
      [{
        $set: {
          dueAt: { $dateAdd: { startDate: '$dueAt', unit: 'day', amount: EXTENSION_DAYS } },
          extensions: { $add: ['$extensions', 1] },
        },
      }],
      { new: true },
    ).populate(['book', 'user']);
    if (!reservation) {
      const existing = await Reservation.findById(reservationId).select('user status extensions');
      if (!existing) throw new Error('Rezervacija nerasta.');
      if (idOf(existing.user) !== idOf(userId)) throw new Error('Neturite teisės keisti šios rezervacijos.');
      if (existing.status !== 'ACTIVE') throw new Error('Pratęsti galima tik aktyvią rezervaciją.');
      throw new Error('Skaitymo terminą galima pratęsti ne daugiau kaip du kartus.');
    }
    return reservation;
  }

  async returnBook(userId, reservationId) {
    if (!mongoose.isValidObjectId(reservationId)) throw new Error('Neteisingas rezervacijos identifikatorius.');
    const reservation = await Reservation.findOneAndUpdate(
      { _id: reservationId, user: userId, status: 'ACTIVE' },
      { $set: { status: 'RETURNED' } },
      { new: true },
    ).populate(['book', 'user']);
    if (!reservation) {
      const existing = await Reservation.findById(reservationId).select('user status');
      if (!existing) throw new Error('Rezervacija nerasta.');
      if (idOf(existing.user) !== idOf(userId)) throw new Error('Neturite teisės keisti šios rezervacijos.');
      throw new Error('Ši rezervacija jau užbaigta.');
    }
    await Book.updateOne({ _id: reservation.book._id }, { $inc: { availableCopies: 1 } });
    return reservation;
  }
}
