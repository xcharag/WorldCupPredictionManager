const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.userId)
      .select('-password')
      .populate('favoriteTeam', 'name shortName fifaCode badgeUrl flag');
    if (!req.user) return res.status(401).json({ message: 'Token valid but user not found' });
    next();
  } catch (err) {
    // Distinguish between expired and invalid tokens for better logging
    const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
    console.error(`[Auth Middleware] ${message}:`, err.message);
    return res.status(401).json({ message });
  }
};

module.exports = { protect };
