const Notification = require('../models/Others/Notification');
const Candidate = require('../models/Recruitment/Candidate');

const receiveCandidate = async (req, res) => {
  try {
    const candidate = req.body || {};

    const name = candidate.name || 'Unknown Candidate';
    const email = candidate.email || null;
    const companyCode = candidate.companyCode || (req.body.companyCode || '000000');

    const message = `New candidate received: ${name}. Score: ${candidate.score || 'N/A'}`;

    // Create notification for admins and publish to admin SSE listeners
    const notification = await Notification.create({
      companyCode,
      type: 'file_upload',
      userName: name,
      userEmail: email,
      message,
      status: 'pending'
    });

    try {
      const { publishNotificationToAdmin } = require('../services/notificationSseService');
      publishNotificationToAdmin({ companyCode, event: 'notification.created', notification: notification.get({ plain: true }) });
    } catch (e) {
      console.error('Failed to publish integration notification via SSE', e);
    }

    const sourceCandidateId = candidate.candidateId || candidate.sourceCandidateId || null;
    const parsedPayload = {
      companyCode,
      jobId: candidate.jobId || null,
      name,
      email,
      phone: candidate.phone || null,
      coverLetter: candidate.coverLetter || null,
      sourceCandidateId: sourceCandidateId ? String(sourceCandidateId) : null,
      skills: candidate.skills || [],
      experience_years: candidate.experience_years || candidate.experience || 0,
      education: candidate.education || {},
      score: candidate.score || null,
      resume_url: candidate.resume_url || candidate.resumeUrl || null,
      status: 'parsed',
    };

    let saved;
    if (sourceCandidateId) {
      const existing = await Candidate.findByPk(sourceCandidateId);
      if (existing) {
        await existing.update(parsedPayload);
        saved = existing;
      }
    }

    if (!saved) {
      saved = await Candidate.create(parsedPayload);
    }

    return res.status(201).json({ ok: true, candidateId: saved.id });
  } catch (err) {
    console.error('Integration error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};

module.exports = { receiveCandidate };
