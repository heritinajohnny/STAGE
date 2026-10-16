This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

The application uses a local system font stack and does not require a remote font download.

## Accès et base de données

Au lancement avec `npm run dev` ou `npm start`, le script `predev` / `prestart` crée les tables manquantes, ajoute les colonnes absentes et crée le compte administrateur s’il n’existe pas encore. Les tables et les données déjà présentes ne sont pas supprimées.

En développement, le compte administrateur initial utilise l’adresse configurée par défaut dans le script d’initialisation et le mot de passe `123456789`. Les utilisateurs peuvent créer leur propre compte depuis `/register`; ces comptes ont accès à leur portail personnel, tandis que la gestion des données de la clinique reste réservée à l’administrateur.

Pour un déploiement, définissez `ADMIN_EMAIL`, `ADMIN_PASSWORD` et une valeur longue et aléatoire pour `SESSION_SECRET`. Les identifiants initiaux ne sont insérés qu’à la première initialisation; changer ces variables ne remplace pas le mot de passe d’un compte déjà créé. `DATABASE_URL` doit pointer vers PostgreSQL.

## Rendez-vous, disponibilités et rappels

Dans **Médecins**, le bouton de calendrier permet de configurer les jours et heures travaillés, la durée (30 minutes par défaut) et la capacité par créneau. Les congés et les créneaux bloqués sont enregistrés comme périodes d’indisponibilité. Les créneaux disponibles sont générés à partir de ces règles; chaque réservation et confirmation vérifie de nouveau l’horaire, les absences, la capacité et les rendez-vous existants du médecin et du patient.

Les patients et la réception peuvent rechercher des créneaux sur une période et par spécialité ou médecin. La liste d’attente conserve la période souhaitée et notifie le premier patient éligible lorsqu’un créneau correspondant est libéré. Les notifications sont intégrées au portail; aucun fournisseur e-mail/SMS n’est configuré.

Dans le portail patient, l’assistant comprend une demande en langage naturel (par exemple « je veux voir un pédiatre mardi matin »), recherche des créneaux libres, demande le choix du patient (titulaire du compte ou nom complet et date de naissance), puis le motif et une confirmation explicite avant d’envoyer la demande. Si aucun dossier patient ne correspond, un dossier minimal est créé lors de la réservation confirmée. La disponibilité est contrôlée une seconde fois au moment de la réservation. L’assistant nécessite `OPENAI_API_KEY` dans le fichier local ignoré `.env.local`; la clé ne doit jamais être ajoutée au dépôt. Seule la phrase de recherche, la date du jour et la liste des spécialités sont envoyées à OpenAI; les informations du patient et le motif restent sur le serveur local.

Depuis **Patients**, le téléchargement exporte la liste au format CSV. Les dates facultatives filtrent la date d’inscription, et non la date de naissance; sans date, tous les patients sont exportés.

Pour envoyer les rappels intégrés 48 h et 24 h avant les rendez-vous confirmés, définissez `CRON_SECRET` comme secret aléatoire puis configurez un cron externe pour appeler `POST /api/reminders` avec l’en-tête `Authorization: Bearer <CRON_SECRET>` toutes les 15 minutes. Les rappels sont idempotents; un même rappel n’est créé qu’une fois. Sans ce cron, les rappels planifiés ne sont pas exécutés automatiquement.

Les nouvelles tables et colonnes sont créées sans supprimer les données au prochain démarrage via `npm run dev` ou `npm start`. Après la migration, configurez les horaires des médecins dans l’interface avant de proposer des rendez-vous; les médecins existants n’ont pas d’horaire hebdomadaire prérempli.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
