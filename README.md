# Miesto bibliotekos sistema

## Paleidimas

Reikia **Node.js 20+** ir **Docker Desktop**.

1. Atidarykite terminalą projekto aplanke ir įdiekite priklausomybes:

   ```powershell
   npm install
   ```

2. Paleiskite MongoDB:

   ```powershell
   npm run db:up
   ```

3. Sukurkite `.env` failą iš pavyzdžio:

   ```powershell
   Copy-Item .env.example .env
   ```

   `.env` faile pakeiskite `JWT_SECRET` į atsitiktinį, bent 32 simbolių raktą, o `ADMIN_PASSWORD` – į savo administratoriaus slaptažodį. Palikite vietinės MongoDB `MONGODB_URI` ir `MONGODB_DB_NAME` reikšmes.

4. Paleiskite programą:

   ```powershell
   npm run dev
   ```

Atidarykite **http://localhost:5173**. Administratoriaus prisijungimo puslapis: **http://localhost:5173/admin**. Pirmą kartą paleidus serverį į MongoDB automatiškai įrašomos pradinės kategorijos ir knygos.

Norėdami sustabdyti MongoDB, vykdykite `npm run db:down`. Duomenys išsaugomi.

## Paleidimas su MongoDB Atlas

Vietoje vietinės MongoDB `.env` faile nurodykite Atlas prisijungimo adresą `MONGODB_URI` reikšmėje ir norimą bazę `MONGODB_DB_NAME`. Atlas taip pat reikia pridėti savo IP adresą prie **Network Access** ir sukurti duomenų bazės naudotoją.

## Technologijos

React, JavaScript, Apollo Client, GraphQL, Node.js, Express ir MongoDB.
