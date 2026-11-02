import { gql } from 'graphql-tag';
import jwt from 'jsonwebtoken';
import { Reservation, User } from './models.js';
import { CatalogService, ReservationService, UserService } from './services.js';

const catalog = new CatalogService();
const reservations = new ReservationService();
const users = new UserService();

export const typeDefs = gql`
  enum Role { ADMIN USER }
  enum ReservationStatus { ACTIVE RETURNED }
  type User { id: ID!, name: String!, email: String!, role: Role!, createdAt: String! }
  type Category { id: ID!, name: String!, description: String! }
  type Book {
    id: ID!, title: String!, author: String!, isbn: String!, description: String!,
    coverUrl: String!, category: Category!, totalCopies: Int!, availableCopies: Int!
  }
  type Reservation {
    id: ID!, user: User!, book: Book!, status: ReservationStatus!,
    reservedAt: String!, dueAt: String!, extensions: Int!
  }
  type AuthPayload { token: String!, user: User! }
  input BookInput {
    title: String!, author: String!, isbn: String, description: String,
    coverUrl: String, categoryId: ID!, totalCopies: Int!
  }
  input CategoryInput { name: String!, description: String }
  input UserInput { name: String!, email: String!, password: String!, role: Role }
  input UserUpdateInput { name: String!, email: String!, role: Role! }
  type Query {
    books(search: String, categoryId: ID): [Book!]!
    categories: [Category!]!
    me: User
    myReservations: [Reservation!]!
    users: [User!]!
    allReservations: [Reservation!]!
  }
  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createUser(input: UserInput!): User!
    updateUser(userId: ID!, input: UserUpdateInput!): User!
    deleteUser(userId: ID!): Boolean!
    saveCategory(input: CategoryInput!, categoryId: ID): Category!
    deleteCategory(categoryId: ID!): Boolean!
    saveBook(input: BookInput!, bookId: ID): Book!
    deleteBook(bookId: ID!): Boolean!
    reserveBook(bookId: ID!): Reservation!
    extendReservation(reservationId: ID!): Reservation!
    returnBook(reservationId: ID!): Reservation!
  }
`;

const requireUser = (context) => {
  if (!context.user) throw new Error('Prisijunkite, kad galėtumėte atlikti šį veiksmą.');
  return context.user;
};

const requireAdmin = (context) => {
  const user = requireUser(context);
  if (user.role !== 'ADMIN') throw new Error('Šį veiksmą gali atlikti tik administratorius.');
  return user;
};

const resolvers = {
  Query: {
    books: (_, args) => catalog.listBooks(args),
    categories: () => catalog.listCategories(),
    me: (_, __, context) => context.user ? User.findById(context.user.id) : null,
    myReservations: (_, __, context) => reservations.listForUser(requireUser(context).id),
    users: (_, __, context) => (requireAdmin(context), users.listUsers()),
    allReservations: (_, __, context) => {
      requireAdmin(context);
      return Reservation.find().populate('book').populate('user').sort({ reservedAt: -1 }).limit(200);
    },
  },
  Mutation: {
    login: async (_, { email, password }) => {
      const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
      if (!user || !await user.verifyPassword(password)) throw new Error('Neteisingas el. paštas arba slaptažodis.');
      const token = jwt.sign(
        { id: user.id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '12h' },
      );
      return { token, user };
    },
    createUser: (_, { input }, context) => {
      requireAdmin(context);
      return users.createUser(input);
    },
    updateUser: (_, { userId, input }, context) => users.updateUser(userId, input, requireAdmin(context).id),
    deleteUser: (_, { userId }, context) => users.deleteUser(userId, requireAdmin(context).id),
    saveCategory: (_, { input, categoryId }, context) => (requireAdmin(context), catalog.saveCategory(input, categoryId)),
    deleteCategory: (_, { categoryId }, context) => (requireAdmin(context), catalog.deleteCategory(categoryId)),
    saveBook: (_, { input, bookId }, context) => (requireAdmin(context), catalog.saveBook(input, bookId)),
    deleteBook: (_, { bookId }, context) => (requireAdmin(context), catalog.deleteBook(bookId)),
    reserveBook: (_, { bookId }, context) => reservations.create(requireUser(context).id, bookId),
    extendReservation: (_, { reservationId }, context) => reservations.extend(requireUser(context).id, reservationId),
    returnBook: (_, { reservationId }, context) => reservations.returnBook(requireUser(context).id, reservationId),
  },
  User: {
    id: (user) => user.id ?? user._id.toString(),
    createdAt: (user) => user.createdAt?.toISOString() ?? new Date().toISOString(),
  },
  Category: { id: (category) => category.id ?? category._id.toString() },
  Book: {
    id: (book) => book.id ?? book._id.toString(),
    category: (book) => book.category,
  },
  Reservation: {
    id: (reservation) => reservation.id ?? reservation._id.toString(),
    reservedAt: (reservation) => reservation.reservedAt.toISOString(),
    dueAt: (reservation) => reservation.dueAt.toISOString(),
  },
};

export function createContext({ req }) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return { user: null };
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return { user: { id: payload.id, role: payload.role } };
  } catch {
    return { user: null };
  }
}

export default resolvers;
