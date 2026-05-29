const Candidate = require('../models/Recruitment/Candidate');

const toAbsoluteUrl = (req, maybeUrl) => {
  if (!maybeUrl) return maybeUrl;
  if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
  const configuredBase = process.env.PUBLIC_BACKEND_BASE_URL;
  const base = configuredBase || `${req.protocol}://${req.get('host')}`;
  return `${base}${maybeUrl.startsWith('/') ? '' : '/'}${maybeUrl}`;
};

const listCandidates = async (req, res) => {
  try {
    const companyCode = req.user.companyCode || req.query.companyCode;
    const where = {};
    if (companyCode) where.companyCode = companyCode;
    if (req.query.jobId) where.jobId = req.query.jobId;

    const candidates = await Candidate.findAll({ where, order: [['createdAt', 'DESC']] });
    const out = candidates.map((c) => {
      const plain = c.get({ plain: true });
      plain.resume_url = toAbsoluteUrl(req, plain.resume_url);
      return plain;
    });
    return res.json(out);
  } catch (err) {
    console.error('Candidates list error:', err);
    return res.status(500).json({ error: err.message });
  }
};

const getCandidate = async (req, res) => {
  try {
    const candidate = await Candidate.findByPk(req.params.id);
    if (!candidate) return res.status(404).json({ error: 'Not found' });
    const plain = candidate.get({ plain: true });
    plain.resume_url = toAbsoluteUrl(req, plain.resume_url);
    return res.json(plain);
  } catch (err) {
    console.error('Candidate fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { listCandidates, getCandidate };
