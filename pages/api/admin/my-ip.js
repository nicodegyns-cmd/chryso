// pages/api/admin/my-ip.js
export default function handler(req, res) {
  const forwarded = req.headers['x-forwarded-for']
  const ip = forwarded ? forwarded.split(',')[0].trim() : (req.socket?.remoteAddress || '')
  return res.status(200).json({ ip })
}
