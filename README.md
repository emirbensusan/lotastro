# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/0ae5f47c-6da6-4ba7-8181-c7f0648766f6

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/0ae5f47c-6da6-4ba7-8181-c7f0648766f6) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/0ae5f47c-6da6-4ba7-8181-c7f0648766f6) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## Translation Guidelines

### Key Naming Rules
1. Use **camelCase** for all keys
2. Be descriptive: `goToIncomingStock` NOT `link1`
3. Use prefixes for grouping:
   - `audit*` - Audit log related
   - `reservation*` - Reservation features
   - `action*` - User actions (buttons, links)
   - Entity types: `*Entity` suffix

### Adding New Keys
1. Add to **BOTH** `en` and `tr` sections in `src/contexts/LanguageContext.tsx`
2. Run `npm run check-translations` to verify
3. Test with language toggle (EN ↔ TR)

### What NOT to Translate
- Numbers, dates (use formatters)
- URLs, file paths
- Technical identifiers (IDs, UUIDs)
- Icon-only buttons (use `aria-label` instead)

### Verification
```bash
npm run check-translations
```

This script checks for:
- Missing keys (used in code but not defined)
- Unused keys (defined but never used)
