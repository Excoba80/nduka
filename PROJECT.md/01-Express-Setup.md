# Milestone 1 – Configure the Express Server

## Objective

Configure Express so that the application starts correctly, serves static files, and renders Pug templates.

---

## What is Express?

Express is a web application framework for Node.js.

It helps us build websites and web applications without writing everything from scratch.

Instead of manually handling HTTP requests and responses, Express provides a clean and organized way to do it.

---

## Why are we configuring Express first?

Express is the engine of our application.

Without it:

- the server cannot start,
- pages cannot be displayed,
- routes cannot work,
- forms cannot be submitted.

Everything depends on Express.

---

## Our Goal

By the end of this milestone we should be able to:

- Start the server
- Open the browser
- Visit the home page
- See "NDUKA – Marriage Intelligence & Verification"

---

## Files involved

app.js

bin/www

routes/index.js

views/layouts/layout.pug

views/home/index.pug

public/css/style.css

---

## Concepts to learn

- What Express is
- What app.js does
- What middleware is
- What routes are
- What static files are
- How Pug works
- How the server starts

---

## Expected Outcome

When we run:

npm start

and visit:

http://localhost:3000

the application should display the homepage successfully.

This milestone is complete only when the application runs without errors.