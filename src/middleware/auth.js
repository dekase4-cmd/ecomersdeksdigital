function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  
  // Jika request berupa API call, kirim status JSON 401
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Akses ditolak. Anda bukan Admin utama.' });
  }
  
  // Jika request halaman, alihkan ke login admin
  res.redirect('/admin-dashboard/login.html');
}

function isMitra(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'mitra') {
    return next();
  }
  
  // Jika request berupa API call, kirim status JSON 401
  if (req.originalUrl.startsWith('/api/')) {
    return res.status(401).json({ error: 'Akses ditolak. Silakan login sebagai Mitra.' });
  }
  
  // Jika request halaman, alihkan ke login mitra
  res.redirect('/mitra-dashboard/login.html');
}

module.exports = {
  isAdmin,
  isMitra
};
