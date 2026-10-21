# SehatPlate

AI food guide for Pakistani dishes.

## Run locally

```bash
npm install
npm run dev
```

The Vite dev server runs on port 5173 and proxies `/health`, `/api`, `/auth`, `/me`, `/dish`, `/verdict`, and `/history` to the Express API on port 3001.

## Auth page

- Visit `http://localhost:5173/`.
- Toggle between **Register** and **Login**.
- On successful login the access token is stored in `src/api.js` and the page fetches `/me` to show the current user.
- Click **Logout** to clear the token and return to the form.
- Loading spinners and error messages are shown for all requests.