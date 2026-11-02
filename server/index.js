import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { Book, Category, Reservation, User } from './models.js';
import resolvers, { createContext, typeDefs } from './schema.js';

async function seedAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME = 'Bibliotekos administratorius' } = process.env;
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD) return;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Nurodykite abu ADMIN_EMAIL ir ADMIN_PASSWORD.');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  if (!await User.exists({ email })) {
    if (ADMIN_PASSWORD.length < 8) throw new Error('ADMIN_PASSWORD turi būti bent 8 simbolių.');
    await new User({ name: ADMIN_NAME, email, password: ADMIN_PASSWORD, role: 'ADMIN' }).save();
    console.info(`Sukurtas administratoriaus naudotojas: ${email}`);
  }
}

async function seedCatalog() {
  const categoryDescriptions = new Map([
    ['Klasika', 'Laiko patikrintos literatūros istorijos.'],
    ['Nuotykiai', 'Kelionės, atradimai ir netikėti nuotykiai.'],
    ['Mokslinė fantastika', 'Įsivaizduojami pasauliai ir ateities vizijos.'],
  ]);
  const categories = new Map();
  for (const [name, description] of categoryDescriptions) {
    const category = await Category.findOneAndUpdate(
      { name },
      { $setOnInsert: { name, description } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categories.set(name, category);
  }

  const books = [
    {
      title: 'Pride and Prejudice',
      author: 'Jane Austen',
      isbn: '9780141439518',
      description: 'Klasikinis pasakojimas apie Elizabeth Bennet, jos šeimą ir visuomenės lūkesčių kupinus santykius.',
      category: 'Klasika',
    },
    {
      title: 'Alice’s Adventures in Wonderland',
      author: 'Lewis Carroll',
      isbn: '9780141439761',
      description: 'Smalsiosios Alisos kelionė į keistą pasaulį, kuriame logika susitinka su vaizduote.',
      category: 'Nuotykiai',
    },
    {
      title: 'The Adventures of Sherlock Holmes',
      author: 'Arthur Conan Doyle',
      isbn: '9780140439076',
      description: 'Klasikinės detektyvinės istorijos apie išradingąjį Šerloką Holmsą ir daktarą Vatsoną.',
      category: 'Nuotykiai',
    },
    {
      title: 'Little Women',
      author: 'Louisa May Alcott',
      isbn: '9780147514011',
      description: 'Keturių seserų kasdienybė, svajonės ir branda XIX amžiaus Amerikoje.',
      category: 'Klasika',
    },
    {
      title: 'The Secret Garden',
      author: 'Frances Hodgson Burnett',
      isbn: '9780141321062',
      description: 'Apleisto sodo atradimas padeda vaikams užmegzti draugystę ir atrasti naują gyvenimo džiaugsmą.',
      category: 'Nuotykiai',
    },
    {
      title: 'Frankenstein',
      author: 'Mary Shelley',
      isbn: '9780141439471',
      description: 'Gotikinė istorija apie mokslininko ambicijas, atsakomybę ir jo sukurto padaro vienatvę.',
      category: 'Mokslinė fantastika',
    },
    {
      title: 'The Time Machine',
      author: 'H. G. Wells',
      isbn: '9780141439976',
      description: 'Kelionė į tolimą ateitį atskleidžia netikėtą žmonijos civilizacijos likimą.',
      category: 'Mokslinė fantastika',
    },
    {
      title: 'Dracula',
      author: 'Bram Stoker',
      isbn: '9780141439846',
      description: 'Dienoraščiuose ir laiškuose pasakojama paslaptinga grafo Drakulos istorija.',
      category: 'Klasika',
    },
  ];

  let added = 0;
  for (const book of books) {
    const existing = await Book.exists({ title: book.title, author: book.author });
    if (existing) continue;
    await new Book({
      ...book,
      category: categories.get(book.category)._id,
      totalCopies: 3,
      availableCopies: 3,
    }).save();
    added += 1;
  }
  if (added) console.info(`Pradinis katalogas: pridėta ${added} knygų.`);
}

async function start() {
  if (!process.env.MONGODB_URI) throw new Error('Trūksta MONGODB_URI aplinkos kintamojo.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET turi būti nustatytas ir sudaryti bent 32 simbolius.');
  }
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME ?? 'biblioteka',
  });
  await Promise.all([User.init(), Category.init(), Book.init(), Reservation.init()]);
  await seedAdmin();
  await seedCatalog();

  const app = express();
  app.use(cors());
  const apollo = new ApolloServer({ typeDefs, resolvers });
  await apollo.start();
  app.use('/graphql', express.json(), expressMiddleware(apollo, { context: createContext }));
  const port = Number(process.env.PORT ?? 4000);
  app.listen(port, () => console.info(`GraphQL API veikia: http://localhost:${port}/graphql`));
}

start().catch((error) => {
  console.error('Nepavyko paleisti serverio:', error);
  process.exitCode = 1;
});
