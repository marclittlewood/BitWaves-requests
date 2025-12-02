// --- Admin request workflow endpoints ---
app.post('/api/requests/:id/hold', authenticateJWT, async (req: Request, res: Response) => {
  const ok = await requests.holdRequest(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Request not found' });
  res.json({ success: true });
});

app.post('/api/requests/:id/unhold', authenticateJWT, async (req: Request, res: Response) => {
  const ok = await requests.unholdRequest(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Request not found' });
  res.json({ success: true });
});

app.post('/api/requests/:id/process', authenticateJWT, async (req: Request, res: Response) => {
  // Force immediate processing eligibility
  const ok = await requests.forceProcessNow(req.params.id);
  if (!ok) return res.status(404).json({ success: false, message: 'Request not found' });
  res.json({ success: true });
});
