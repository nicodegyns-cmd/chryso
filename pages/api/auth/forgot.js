export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.body || {}
  if (!email) return res.status(400).json({ error: 'Email requis' })

  // Simulated behavior: in a real app, create a reset token and send an email here.
  // Respond with a generic message to avoid account enumeration.
  return res.status(200).json({ message: "Si l'adresse existe, un email de réinitialisation a été envoyé." })
}
