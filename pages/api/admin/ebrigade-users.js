export default function handler(req, res) {
  // stub: return a list of available external 'Ebrigade' profile ids
  const items = [
    { id: 'EBR-201', label: 'EBR-201' },
    { id: 'EBR-202', label: 'EBR-202' },
    { id: 'EBR-203', label: 'EBR-203' },
  ]
  res.status(200).json(items)
}
