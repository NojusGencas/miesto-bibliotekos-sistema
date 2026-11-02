import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const { Schema, model } = mongoose;

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['ADMIN', 'USER'], default: 'USER', required: true },
}, { timestamps: true });

userSchema.pre('save', async function hashPassword() {
  if (this.isModified('password')) this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.verifyPassword = function verifyPassword(password) {
  return bcrypt.compare(password, this.password);
};

const categorySchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 300, default: '' },
}, { timestamps: true });

const bookSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 200 },
  author: { type: String, required: true, trim: true, maxlength: 120 },
  isbn: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  coverUrl: { type: String, trim: true, default: '' },
  category: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  totalCopies: { type: Number, required: true, min: 1, default: 1 },
  availableCopies: { type: Number, required: true, min: 0, default: 1 },
}, { timestamps: true });

bookSchema.index({ title: 'text', author: 'text', description: 'text', isbn: 'text' });

const reservationSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
  status: { type: String, enum: ['ACTIVE', 'RETURNED'], default: 'ACTIVE', required: true },
  reservedAt: { type: Date, default: Date.now, required: true },
  dueAt: { type: Date, required: true },
  extensions: { type: Number, min: 0, max: 2, default: 0 },
}, { timestamps: true });

reservationSchema.index({ user: 1, book: 1, status: 1 });
reservationSchema.index(
  { user: 1, book: 1 },
  { unique: true, partialFilterExpression: { status: 'ACTIVE' } },
);
reservationSchema.index({ status: 1, dueAt: 1 });

export const User = model('User', userSchema);
export const Category = model('Category', categorySchema);
export const Book = model('Book', bookSchema);
export const Reservation = model('Reservation', reservationSchema);
