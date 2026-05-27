const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const User = require('../models/User');

// Local strategy: login by nickname + password
passport.use(
  new LocalStrategy({ usernameField: 'nickname', passwordField: 'password' }, async (nickname, password, done) => {
    try {
      const user = await User.findOne({ nickname: nickname.toLowerCase() }).select('+password');
      if (!user || !user.password) {
        return done(null, false, { message: 'Invalid credentials' });
      }
      const isMatch = await user.comparePassword(password);
      if (!isMatch) return done(null, false, { message: 'Invalid credentials' });
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  })
);

// Google OAuth strategy
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'your_google_client_id') {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            console.error('[Google OAuth Strategy] No email in profile:', profile.id);
            return done(null, false, { message: 'No email from Google' });
          }

          let user = await User.findOne({ googleId: profile.id });
          if (!user) {
            user = await User.findOne({ email });
          }

          if (user) {
            if (!user.googleId) {
              user.googleId = profile.id;
              await user.save();
              console.log(`[Google OAuth Strategy] Linked existing user ${user.email} to Google ID ${profile.id}`);
            }
            return done(null, user);
          }

          // New user via Google — generate a unique nickname
          const baseName = (profile.displayName || email.split('@')[0]).replace(/\s+/g, '').toLowerCase().slice(0, 16);
          let nickname = baseName;
          let counter = 1;
          while (await User.findOne({ nickname })) {
            nickname = `${baseName}${counter++}`;
          }

          user = await User.create({
            name: profile.displayName || baseName,
            nickname,
            email,
            googleId: profile.id,
            avatar: profile.photos?.[0]?.value || '',
            isEmailVerified: true,
          });

          console.log(`[Google OAuth Strategy] Created new user ${user.email} with nickname ${nickname}`);
          return done(null, user);
        } catch (err) {
          console.error('[Google OAuth Strategy] Error:', err.message);
          return done(err);
        }
      }
    )
  );
}

module.exports = passport;
