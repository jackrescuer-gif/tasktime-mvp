const express = require('express');
const { authMiddleware } = require('../../shared/auth');
const service = require('./service');

const router = express.Router({ mergeParams: true });
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const list = await service.list();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
