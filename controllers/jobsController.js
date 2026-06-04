const Job = require('../models/Recruitment/Job');
const Candidate = require('../models/Recruitment/Candidate');
const axios = require('axios');

const createJob = async (req, res) => {
  try {
    const payload = req.body;
    const companyCode = req.user.companyCode || payload.companyCode;
    // Record creator as job owner when available
    const createdBy = req.user?.id || payload.createdBy || null;
    const job = await Job.create({ ...payload, companyCode, createdBy });
    return res.status(201).json(job);
  } catch (err) {
    console.error('Create job error:', err);
    return res.status(500).json({ error: err.message });
  }
};

const listJobs = async (req, res) => {
  try {
    const companyCode = req.user.companyCode;
    const where = companyCode ? { companyCode } : {};
    const jobs = await Job.findAll({ where, order: [['createdAt','DESC']] });

    // Enrich jobs with applicantCount and sample applicants (first 3 resumes)
    const Company = require('../models/Company/Company');
    const enriched = await Promise.all(jobs.map(async (j) => {
      const jobObj = j.toJSON();
      // fetch recent candidates with useful fields
      const candidates = await Candidate.findAll({ where: { jobId: jobObj.id, companyCode: jobObj.companyCode }, order: [['createdAt','DESC']], limit: 12 });
      const count = await Candidate.count({ where: { jobId: jobObj.id, companyCode: jobObj.companyCode } });
      jobObj.applicantCount = count;
      // include full candidate objects (id, name, resume_url, createdAt)
      jobObj.candidates = (candidates || []).map(c => ({ id: c.id, name: c.name, resume_url: c.resume_url, createdAt: c.createdAt }));
      // attach companyName for public URL construction
      try {
        const comp = await Company.findByPk(jobObj.companyCode);
        jobObj.companyName = comp ? comp.companyName : null;
      } catch (e) {
        jobObj.companyName = null;
      }
      // keep createdAt for frontend postedDate calculation
      return jobObj;
    }));

    return res.json(enriched);
  } catch (err) {
    console.error('List jobs error:', err);
    return res.status(500).json({ error: err.message });
  }
};

const getPublicJob = async (req, res) => {
  try {
    const { companyName, jobId } = req.params;
    // Resolve companyCode by companyName
    const Company = require('../models/Company/Company');
    const company = await Company.findOne({ where: { companyName } });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const job = await Job.findOne({ where: { id: jobId, companyCode: company.id, is_public: true } });
    if (!job) return res.status(404).json({ error: 'Job not found' });
    return res.json(job);
  } catch (err) {
    console.error('Public job fetch error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Rank resumes for a job: call resume-ranker /score
const rankForJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const job = await Job.findByPk(jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (req.user.companyCode && String(job.companyCode) !== String(req.user.companyCode)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const candidates = await Candidate.findAll({ where: { jobId, companyCode: job.companyCode } });

    // Prepare plain objects
    const candPlain = candidates.map(c => ({
      id: c.id,
      name: c.name,
      skills: c.skills || [],
      experience_years: c.experience_years || 0,
      education: c.education || {},
    }));

    const scoreService = process.env.RESUME_RANKER_SCORE_URL || 'http://resume-ranker:5000/score';
    const resp = await axios.post(scoreService, { job: job.toJSON(), candidates: candPlain }, { timeout: 30000 });
    const scored = resp.data || [];

    // Update scores in DB
    for (const s of scored) {
      await Candidate.update({ score: s.score }, { where: { id: s.id } });
    }

    const updated = await Candidate.findAll({ where: { jobId, companyCode: job.companyCode }, order: [['score', 'DESC']] });
    // Create a notification for job owner and their manager (if any)
    try {
      const Notification = require('../models/Others/Notification');
      const User = require('../models/User/User');

      const ownerId = job.createdBy || req.user?.id;
      let owner = null;
      if (ownerId) owner = await User.findByPk(ownerId);

      const notif = await Notification.create({
        companyCode: job.companyCode,
        type: 'other',
        userId: ownerId || null,
        userName: owner ? owner.name : (req.user?.name || 'System'),
        userEmail: owner ? owner.email : null,
        message: `Resume ranking completed for job: ${job.title}`,
        status: 'pending',
        visibleUserIds: targetUserIds,
      });

      const { publishNotificationToUsers } = require('../services/notificationSseService');
      const targetUserIds = [];
      if (ownerId) targetUserIds.push(ownerId);
      if (owner && owner.managerId) targetUserIds.push(owner.managerId);

      if (targetUserIds.length) {
        publishNotificationToUsers({ companyCode: job.companyCode, event: 'notification.created', notification: notif.get({ plain: true }), userIds: targetUserIds });
      }
    } catch (e) {
      console.error('Failed to create/publish job ranking notification', e);
    }

    return res.json(updated);
  } catch (err) {
    console.error('Rank job error:', err.message || err);
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { createJob, listJobs, getPublicJob, rankForJob };
