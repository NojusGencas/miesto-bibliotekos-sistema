# Miesto bibliotekos sistema

## Paleidimas

Reikia **Node.js 20+** ir **Docker Desktop**.

1. Projekto aplanke įdiekite priklausomybes ir paleiskite MongoDB:

   ```powershell
   npm install
   npm run db:up
   ```

2. Sukurkite `.env` failą iš pavyzdžio:

   ```powershell
   Copy-Item .env.example .env
   ```

   `.env` faile pakeiskite `JWT_SECRET` į atsitiktinį, bent 32 simbolių raktą, o `ADMIN_PASSWORD` – į savo administratoriaus slaptažodį. Vietinės MongoDB adresą palikite nepakeistą.

3. Paleiskite aplikaciją:

   ```powershell
   npm run dev
   ```

Svetainė: **http://localhost:5173** · Administravimas: **http://localhost:5173/admin** · GraphQL API: **http://localhost:4000/graphql**.

Pirmą kartą paleidus serverį į MongoDB automatiškai įrašomos pradinės kategorijos ir knygos. MongoDB sustabdysite komanda `npm run db:down`; duomenys išlieka.

Norėdami naudoti MongoDB Atlas, `.env` faile pakeiskite `MONGODB_URI` ir `MONGODB_DB_NAME`, o Atlas nustatymuose leiskite savo IP adresą bei sukurkite duomenų bazės naudotoją.

## Pasirinkti sprendimai

- **Architektūra:** React sąsaja bendrauja su Node.js ir Express serveriu per Apollo Client bei GraphQL API. GraphQL resolveriai kreipiasi į atskiras katalogo, naudotojų ir rezervacijų paslaugų klases.
- **Duomenų modelis:** MongoDB saugomi naudotojai, kategorijos, knygos ir rezervacijos. Knygoje laikomas bendras ir laisvų egzempliorių skaičius; rezervacija susieja knygą su skaitytoju ir saugo būseną, grąžinimo terminą bei pratęsimų skaičių.
- **Prieigos teisės:** naudotojo ir administratoriaus rolės tikrinamos serveryje. Slaptažodžiai maišomi su bcrypt, prisijungimui naudojami 12 valandų galiojantys JWT.
- **Rezervavimas:** viena paskyra negali turėti dviejų aktyvių tos pačios knygos rezervacijų. Laisvo egzemplioriaus patikra ir jo skaičiaus sumažinimas atliekami atominiu MongoDB veiksmu. Skaitymo terminas – 21 diena; jį galima pratęsti iki dviejų kartų po 14 dienų.
- **Duomenų išsaugojimas:** panaudotos knygos ir naudotojai nešalinami, jei dėl to būtų prarasta rezervacijų istorija; nešalinama ir kategorija, kuriai priskirtos knygos.
- **Pradinis katalogas:** pavyzdinės kategorijos ir knygos sukuriamos paleidimo metu tik jei jų dar nėra.

## Technologijos

React, JavaScript, Apollo Client, GraphQL, Node.js, Express ir MongoDB.
