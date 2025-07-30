import jwt from 'jsonwebtoken';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Now available in all routes
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token failed', error: err.message });
  }
};

export const allowRoles = (...roles) => {
  return (req, res, next) => {
    const user = req.user;

    if (!user || !roles.includes(user.access_role)) {
      return res.status(403).json({ message: 'Forbidden. Insufficient permissions.' });
    }

    next();
  };
};


export const isAdmin = (req, res, next) => {
  const user = req.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized. No user data found.' });
  }

  if (user.access_role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden. Admins only.' });
  }

  next();
};
