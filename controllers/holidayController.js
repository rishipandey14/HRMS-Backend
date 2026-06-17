const Holiday = require('../models/Others/Holiday');

const resolveCompanyId = (req) => {
	if (req.userType === 'company') {
		return req.user.id;
	}
	return req.user?.companyCode || null;
};

const resolveAuditUserId = (req) => {
	return req.userType === 'user' ? req.user?.id || null : null;
};

const formatHolidayLabel = ({ dateLabel, startDate, endDate }) => {
	if (startDate && endDate) {
		if (startDate === endDate) {
			return startDate;
		}
		return `${startDate} to ${endDate}`;
	}

	return dateLabel;
};

const parseHolidayInput = (req) => {
	const name = String(req.body?.name || '').trim();
	const dateLabelInput = String(req.body?.dateLabel || req.body?.date || '').trim();
	const startDate = String(req.body?.startDate || req.body?.fromDate || '').trim();
	const endDate = String(req.body?.endDate || req.body?.toDate || '').trim();

	const hasRange = Boolean(startDate || endDate);
	const normalizedStartDate = hasRange ? (startDate || endDate) : null;
	const normalizedEndDate = hasRange ? (endDate || startDate) : null;
	const dateLabel = formatHolidayLabel({
		dateLabel: dateLabelInput,
		startDate: normalizedStartDate,
		endDate: normalizedEndDate,
	});

	return {
		name,
		dateLabel,
		startDate: normalizedStartDate,
		endDate: normalizedEndDate,
	};
};

const listHolidays = async (req, res) => {
	try {
		const companyId = resolveCompanyId(req);
		if (!companyId) {
			return res.status(400).json({ msg: 'Company context not found' });
		}

		const holidays = await Holiday.findAll({
			where: { companyId },
			order: [['createdAt', 'DESC']],
		});

		return res.json({ holidays });
	} catch (error) {
		console.error('listHolidays error:', error);
		return res.status(500).json({ msg: 'Failed to load holidays' });
	}
};

const createHoliday = async (req, res) => {
	try {
		const companyId = resolveCompanyId(req);
		if (!companyId) {
			return res.status(400).json({ msg: 'Company context not found' });
		}

		const { name, dateLabel, startDate, endDate } = parseHolidayInput(req);

		if (!name || !dateLabel) {
			return res.status(400).json({ msg: 'Holiday name and date are required' });
		}

		if ((startDate && !endDate) || (!startDate && endDate)) {
			return res.status(400).json({ msg: 'Both holiday start and end dates are required for a range' });
		}

		const holiday = await Holiday.create({
			companyId,
			name,
			dateLabel,
			startDate,
			endDate,
			createdBy: resolveAuditUserId(req),
			updatedBy: resolveAuditUserId(req),
		});

		return res.status(201).json({ holiday });
	} catch (error) {
		console.error('createHoliday error:', error);
		return res.status(500).json({
			msg: 'Failed to create holiday',
			error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
		});
	}
};

const updateHoliday = async (req, res) => {
	try {
		const companyId = resolveCompanyId(req);
		if (!companyId) {
			return res.status(400).json({ msg: 'Company context not found' });
		}

		const { holidayId } = req.params;
		const holiday = await Holiday.findByPk(holidayId);
		if (!holiday || String(holiday.companyId) !== String(companyId)) {
			return res.status(404).json({ msg: 'Holiday not found' });
		}

		const { name, dateLabel, startDate, endDate } = parseHolidayInput(req);
		if (!name || !dateLabel) {
			return res.status(400).json({ msg: 'Holiday name and date are required' });
		}

		if ((startDate && !endDate) || (!startDate && endDate)) {
			return res.status(400).json({ msg: 'Both holiday start and end dates are required for a range' });
		}

		await holiday.update({
			name,
			dateLabel,
			startDate,
			endDate,
			updatedBy: resolveAuditUserId(req),
		});

		return res.json({ holiday });
	} catch (error) {
		console.error('updateHoliday error:', error);
		return res.status(500).json({
			msg: 'Failed to update holiday',
			error: process.env.NODE_ENV !== 'production' ? error.message : undefined,
		});
	}
};

const deleteHoliday = async (req, res) => {
	try {
		const companyId = resolveCompanyId(req);
		if (!companyId) {
			return res.status(400).json({ msg: 'Company context not found' });
		}

		const { holidayId } = req.params;
		const holiday = await Holiday.findByPk(holidayId);
		if (!holiday || String(holiday.companyId) !== String(companyId)) {
			return res.status(404).json({ msg: 'Holiday not found' });
		}

		await holiday.destroy();
		return res.json({ msg: 'Holiday deleted' });
	} catch (error) {
		console.error('deleteHoliday error:', error);
		return res.status(500).json({ msg: 'Failed to delete holiday' });
	}
};

module.exports = {
	createHoliday,
	deleteHoliday,
	listHolidays,
	updateHoliday,
};