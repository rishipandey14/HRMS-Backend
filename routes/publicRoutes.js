const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const Job = require('../models/Recruitment/Job');
const Company = require('../models/Company/Company');
const Candidate = require('../models/Recruitment/Candidate');

// serve uploads statically from /uploads
const UPLOAD_DIR = path.resolve(__dirname, '..', 'public_uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

const getPublicBaseUrl = (req) => {
  return process.env.PUBLIC_BACKEND_BASE_URL || `${req.protocol}://${req.get('host')}`;
};

// Public job details
router.get('/job/:companyName/:jobId', async (req, res) => {
  try {
    const { companyName, jobId } = req.params;
    const company = await Company.findOne({ where: { companyName } });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const job = await Job.findOne({ where: { id: jobId, companyCode: company.id, is_public: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (err) {
    console.error('Public job fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Apply to job - public
router.post('/job/:companyName/:jobId/apply', upload.single('resume'), async (req, res) => {
  try {
    const { companyName, jobId } = req.params;
    const { name, email, phone, coverLetter } = req.body;

    const company = await Company.findOne({ where: { companyName } });
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const job = await Job.findOne({ where: { id: jobId, companyCode: company.id, is_public: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (!req.file) return res.status(400).json({ error: 'Resume file is required' });

    const resumeUrl = `${getPublicBaseUrl(req)}/uploads/${path.basename(req.file.path)}`;

    // Create candidate record (minimal) and associate with job
    const candidate = await Candidate.create({
      companyCode: company.id,
      jobId: job.id,
      name: name || 'Anonymous',
      email: email || null,
      phone: phone || null,
      coverLetter: coverLetter || null,
      skills: [],
      experience_years: 0,
      education: {},
      resume_url: resumeUrl,
      status: 'parsing',
    });

    // Forward file to resume-ranker for parsing: POST multipart to resume-ranker /upload
    try {
      const rrUrl = process.env.RESUME_RANKER_UPLOAD_URL || 'http://resume-ranker:5000/upload';
      const FormData = require('form-data');
      const fs2 = require('fs');
      const form = new FormData();
      form.append('resume', fs2.createReadStream(req.file.path));
      // webhook payload context so resume-ranker can call integration and update this candidate
      form.append('candidateId', String(candidate.id));
      form.append('companyCode', String(company.id));
      form.append('jobId', String(job.id));
      form.append('name', name || 'Anonymous');
      form.append('email', email || '');
      form.append('phone', phone || '');
      form.append('coverLetter', coverLetter || '');
      form.append('resume_url', resumeUrl);

      const headers = form.getHeaders();
      await axios.post(rrUrl, form, { headers, maxBodyLength: Infinity });

    } catch (err) {
      console.warn('Failed to forward to resume-ranker:', err.message || err);
    }

    return res.status(201).json({ ok: true, candidateId: candidate.id });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = { router, UPLOAD_DIR };
