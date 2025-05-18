// server.js
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const Hyperbeam = require('hyperbeam');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: 'http://localhost:5500', // frontend origin, adjust if deployed
  credentials: true,
}));

app.use(express.json());

// Session middleware (use secure settings in production!)
app.use(session({
  secret: 'your_secret_here', // change this!
  resave: false,
  saveUninitialized: false,
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

const client = new Hyperbeam({
  apiKey: process.env.HYPERBEAM_API_KEY,
});

const userSessions = {};

// Passport config
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
},
(accessToken, refreshToken, profile, done) => {
  // Here profile contains user info
  return done(null, profile);
}));

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

// Routes

// Google OAuth login endpoint
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// OAuth callback URL
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful login, redirect to frontend app
    res.redirect('http://localhost:5500'); // adjust if deployed
  }
);

// Logout endpoint
app.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ loggedOut: true });
  });
});

// Middleware to protect routes
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// API to get current logged-in user info
app.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json({ user: null });
  }
});

// Create or get Hyperbeam session for authenticated user
app.post('/api/create-session', ensureAuthenticated, async (req, res) => {
  const userId = req.user.id; // use Google user id as userId

  if (userSessions[userId]) {
    return res.json({ sessionUrl: userSessions[userId].url });
  }

  try {
    const session = await client.sessions.create({
      url: "https://start.duckduckgo.com",
      width: 1280,
      height: 720,
    });

    userSessions[userId] = session;
    return res.json({ sessionUrl: session.url });
  } catch (error) {
    console.error("Hyperbeam session creation failed:", error);
    return res.status(500).json({ error: "Failed to create session" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
