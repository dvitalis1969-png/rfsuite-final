# Deploying RF Suite to Netlify

This project is a React application built with Vite. To deploy it to Netlify, follow these steps:

## Option 1: Manual Drag & Drop (Easiest)
1.  **Build the project locally**:
    -   Open your terminal in this folder.
    -   Run `npm install` to install dependencies.
    -   Run `npm run build` to create the production files.
2.  **Upload to Netlify**:
    -   Go to [Netlify](https://app.netlify.com/).
    -   Log in and go to the "Sites" tab.
    -   Scroll to the bottom and drag the **`dist`** folder (created in step 1) into the deployment area.

## Option 2: Connect to GitHub (Recommended for updates)
1.  Create a new repository on GitHub and push this code to it.
2.  On Netlify, click **"Add new site"** -> **"Import an existing project"**.
3.  Select **GitHub** and choose your repository.
4.  Use these settings:
    -   **Build command**: `npm run build`
    -   **Publish directory**: `dist`
5.  Click **"Deploy"**.

## Option 3: Fail-safe JSON Backup
If the ZIP download fails or is empty, use the **JSON Backup** option in the app menu:
1. Click **"JSON Backup"**. This will open a page with all your code in text format.
2. Press `Ctrl+S` (or `Cmd+S`) to save that page as `backup.json`.
3. You can then use a simple script to recreate the files, or just copy-paste the content of each file from the JSON.
-   **Environment Variables**: If you use any API keys (like `GEMINI_API_KEY`), add them in the Netlify dashboard under **Site settings** -> **Environment variables**.
-   **Routing**: The included `netlify.toml` handles Single Page Application (SPA) routing automatically.

## Note on Backend Features
The "Download Source Code" feature in the app menu is a server-side feature that requires a Node.js environment. It will not work on standard Netlify static hosting. However, all RF coordination and planning logic is client-side and will work perfectly.
